import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveBash } from '../../core/bash-path.ts';
import { PairStore } from '../../dispatch/pair-store.ts';
import { runVerifyCommand } from '../../dispatch/verify-exec.ts';
import { RunStore } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import type { VerifyContext } from './internal-types.ts';
import { parkPairManager } from './pair-coordinator.ts';
import { verifyFor } from './verify.ts';
import { RunManager } from '../run.ts';
import { WorkspaceSemaphore } from '../../workspace/semaphore.ts';

const M = '11111111-1111-1111-1111-111111111111';
const W = '22222222-2222-2222-2222-222222222222';
const success = { exitCode: 0, timedOut: false, aborted: false, output: '', durationMs: 1 };

describe('One & One shared-checkout verification', () => {
  let root: string;
  let dataDir: string;
  let store: RunStore;
  let pairs: PairStore;
  let context: VerifyContext;
  let orderId: string;
  const runCommand = vi.fn(runVerifyCommand);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'onni-pair-verify-repo-'));
    dataDir = mkdtempSync(join(tmpdir(), 'onni-pair-verify-data-'));
    git('init', '-q', '-b', 'dev');
    git('config', 'user.name', 'Onni Test');
    git('config', 'user.email', 'test@onni.local');
    writeFileSync(join(root, 'base.txt'), 'base\n');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, scripts: { test: 'node -e "process.exit(0)"' } }));
    git('add', '.'); git('commit', '-qm', 'base');
    store = RunStore.open(dataDir);
    pairs = new PairStore(dataDir);
    const now = new Date().toISOString();
    const head = git('rev-parse', 'HEAD');
    const state = pairs.create({ pairId: M, managerRunId: M, workerRunId: W, phase: 'planning', activeRole: 'manager',
      workspace: { repoRoot: root, branch: 'dev', baselineSha: head }, orderRevision: 0, handoffs: 0, createdAt: now, updatedAt: now });
    store.createRun({ id: M, title: 'Manager', task: 'Manage', workflow: '(one-and-one)', worktree: false, steps: [] });
    store.createRun({ id: W, title: 'Worker', task: 'Work', workflow: '(one-and-one)', worktree: false, steps: [] });
    store.updateRun(M, { roster: { mode: 'one-and-one', manager: { runner: 'claude' }, workers: [{ runner: 'codex', role: 'implementation', maxConcurrent: 1 }] }, dispatch: { rootRunId: M, pair: state } });
    store.updateRun(W, { status: 'done', dispatch: { rootRunId: M, parentRunId: M, pairMember: { pairId: M, role: 'worker', peerRunId: M } } });
    orderId = reportOrder();
    runCommand.mockReset();
    runCommand.mockImplementation(runVerifyCommand);
    context = { store, dataDir, repoRoot: root, verifying: new Map(), baselineTrees: new Set(), isActive: () => false,
      isDisposed: () => false, currentStepId: () => undefined,
      updateDispatch: (id, patch) => {
        const dispatch = store.getRun(id)?.dispatch;
        if (dispatch) store.updateRun(id, { dispatch: patch(dispatch) });
      },
      verifyDeps: { runCommand, resolveBash, now: Date.now, env: () => process.env, baselineTimeoutMs: 5_000 } };
  });

  afterEach(async () => {
    store.flush();
    vi.unstubAllEnvs();
    await removeTempDir(root);
    await removeTempDir(dataDir);
  });

  function reportOrder(): string {
    const order = pairs.enqueueOrder(M, { objective: 'Fix the feature', required_evidence: 'tests pass' });
    pairs.markOrderWorking(M, order.id);
    const sha = git('rev-parse', 'HEAD');
    pairs.updateState(M, { lastCheckpointSha: sha });
    pairs.reportOrder(M, order.id, 'Implemented', { reportOutcome: 'completed', checkpointSha: sha });
    return order.id;
  }

  it('runs the discovered check in the shared checkout and binds acceptance to its SHA', async () => {
    expect(() => pairs.acceptOrder(M, { orderId })).toThrow(/verify/i);
    const result = await verifyFor(context, M, { target: W });
    expect(result).toMatchObject({ state: 'passed', source: 'discovered' });
    expect(runCommand).toHaveBeenCalledWith(expect.objectContaining({ cwd: root, command: 'npm test' }));
    expect(pairs.getOrder(M, orderId)?.verification).toMatchObject({ state: 'passed', checkpointSha: git('rev-parse', 'HEAD') });
    pairs.acceptOrder(M, { orderId });
    expect((await parkPairManager(context, M, [])).ok).toBe(true);
  });

  it('requires explicit manual review when no commands exist, without claiming a pass', async () => {
    rmSync(join(root, 'package.json'));
    const result = await verifyFor(context, M, { target: W });
    expect(result).toMatchObject({ state: 'unavailable', reasonCode: 'no-commands' });
    expect(runCommand).not.toHaveBeenCalled();
    expect(() => pairs.acceptOrder(M, { orderId })).toThrow(/manual review/i);
    expect(pairs.acceptOrder(M, { orderId, note: 'Reviewed the documentation diff manually' }).status).toBe('accepted');
    expect(pairs.getOrder(M, orderId)?.verification?.state).toBe('unavailable');
  });

  it('rejects failed and skipped checks instead of accepting the worker claim', async () => {
    runCommand.mockResolvedValue({ ...success, exitCode: 1, output: 'test failed' });
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ state: 'failed' });
    expect(() => pairs.acceptOrder(M, { orderId })).toThrow(/verify/i);
    runCommand.mockResolvedValue({ ...success, exitCode: null, aborted: true });
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ state: 'unavailable' });
    expect(() => pairs.acceptOrder(M, { orderId })).toThrow(/unavailable/i);
  });

  it('invalidates evidence after edits and requires fresh verification before final park', async () => {
    runCommand.mockResolvedValue(success);
    await verifyFor(context, M, { target: W });
    pairs.acceptOrder(M, { orderId });
    writeFileSync(join(root, 'base.txt'), 'changed after acceptance\n');
    expect(await parkPairManager(context, M, [])).toMatchObject({ ok: false, error: expect.stringMatching(/stale/i) });
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ state: 'passed' });
    expect((await parkPairManager(context, M, [])).ok).toBe(true);
  });

  it('does not publish passed evidence when a check changes the shared source', async () => {
    runCommand.mockImplementation(async () => { writeFileSync(join(root, 'base.txt'), 'changed by check\n'); return success; });
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ state: 'unavailable' });
    expect(pairs.getOrder(M, orderId)?.verification?.state).toBe('unavailable');
    expect(JSON.stringify(store.readEvents(M))).not.toContain(': passed');
    expect(store.getRun(W)?.dispatch?.verify?.last?.state).not.toBe('passed');
  });

  it('honors stop during verification and never writes evidence for the stopped order', async () => {
    runCommand.mockImplementation(async () => { pairs.transition(M, 'stopped'); return success; });
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ status: 409 });
    expect(pairs.getOrder(M, orderId)?.verification?.state).not.toBe('passed');
    expect(pairs.readState(M)?.phase).toBe('stopped');
  });

  it('bounds verification per order while allowing the persistent worker to verify its next order', async () => {
    runCommand.mockResolvedValue(success);
    for (let i = 0; i < 3; i++) expect(await verifyFor(context, M, { target: W })).toMatchObject({ state: 'passed' });
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ status: 409 });
    orderId = reportOrder();
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ state: 'passed', runsUsed: 1 });
  });

  it('keeps dry-run explicitly unavailable and executes no check', async () => {
    vi.stubEnv('ONNI_DRY_RUN', '1');
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ state: 'unavailable', reasonCode: 'dry-run' });
    expect(runCommand).not.toHaveBeenCalled();
    expect(pairs.acceptOrder(M, { orderId }).status).toBe('accepted');
  });

  it('invalidates earlier passing evidence before a crashed verification attempt', async () => {
    runCommand.mockResolvedValueOnce(success).mockRejectedValueOnce(new Error('check launcher crashed'));
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ state: 'passed' });
    expect(await verifyFor(context, M, { target: W })).toMatchObject({ status: 409 });
    expect(() => pairs.acceptOrder(M, { orderId })).toThrow(/unavailable/i);
  });

});
