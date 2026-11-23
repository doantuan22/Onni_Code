import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Roster } from '@onni/contract';
import { PairStore } from '../../dispatch/pair-store.ts';
import { RunStore } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import { RunManager } from '../run.ts';
import { initializePair, mirrorPairState } from './pair-runtime.ts';
import { recover } from './lifecycle.ts';
import type { LifecycleContext } from './internal-types.ts';

const MANAGER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_ID = '22222222-2222-2222-2222-222222222222';

const roster: Roster = {
  mode: 'one-and-one',
  manager: { runner: 'claude', model: 'opus' },
  workers: [{ runner: 'codex', model: 'gpt-5', role: 'implementation', maxConcurrent: 1 }],
};

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}

describe('One & One terminal lifecycle', () => {
  let root: string;
  let dataDir: string;
  let store: RunStore;
  let pairs: PairStore;
  let manager: RunManager;
  let active: Map<string, {
    ownerToken: symbol;
    cancelled: boolean;
    interrupt: () => void;
    cwd: string;
    sessionEverOpened: boolean;
  }>;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'onni-pair-lifecycle-repo-'));
    dataDir = join(root, '.ai', 'onni');
    git(root, 'init', '-b', 'dev');
    git(root, 'config', 'user.name', 'Onni Test');
    git(root, 'config', 'user.email', 'onni@test.local');
    writeFileSync(join(root, '.gitignore'), '.ai/\n', 'utf8');
    writeFileSync(join(root, 'README.md'), 'base\n', 'utf8');
    git(root, 'add', '.gitignore', 'README.md');
    git(root, 'commit', '-m', 'base');
    store = RunStore.open(dataDir);
    pairs = new PairStore(dataDir);
    manager = new RunManager(store, root);
    active = (manager as unknown as { active: typeof active }).active;
    store.createRun({
      id: MANAGER_ID,
      title: 'Manager',
      workflow: '(one-and-one)',
      task: 'Coordinate',
      steps: [{ id: 'task', name: 'Task', kind: 'agent' }],
    });
    store.createRun({
      id: WORKER_ID,
      title: 'Worker',
      workflow: '(one-and-one)',
      task: 'Implement',
      autonomous: true,
      worktree: false,
      steps: [{ id: 'task', name: 'Task', kind: 'agent' }],
    });
    store.updateRun(MANAGER_ID, { roster, dispatch: { rootRunId: MANAGER_ID } });
    store.updateRun(WORKER_ID, {
      dispatch: { rootRunId: MANAGER_ID, parentRunId: MANAGER_ID, pairMember: { pairId: MANAGER_ID, role: 'worker', peerRunId: MANAGER_ID } },
    });
    const initialized = await initializePair(root, store, pairs, MANAGER_ID);
    if (!initialized.ok) throw new Error(initialized.error);
    pairs.setWorker(MANAGER_ID, WORKER_ID);
    const order = pairs.enqueueOrder(MANAGER_ID, { objective: 'Implement the feature' });
    pairs.markOrderWorking(MANAGER_ID, order.id);
    mirrorPairState(store, pairs.readState(MANAGER_ID)!);
    store.updateRun(MANAGER_ID, { status: 'running', activity: 'monitoring' });
    store.updateRun(WORKER_ID, { status: 'running' });
    store.updateStep(MANAGER_ID, 'task', { status: 'running', sessionId: 'manager-session' });
    store.updateStep(WORKER_ID, 'task', { status: 'running', sessionId: 'worker-session' });
    active.set(MANAGER_ID, { ownerToken: Symbol('manager'), cancelled: false, interrupt: vi.fn(), cwd: root, sessionEverOpened: false });
    active.set(WORKER_ID, { ownerToken: Symbol('worker'), cancelled: false, interrupt: vi.fn(), cwd: root, sessionEverOpened: false });
  });

  afterEach(async () => {
    manager.dispose();
    store.flush();
    await removeTempDir(root);
  });

  function drop(runId: string): void {
    const state = active.get(runId);
    if (!state) throw new Error('missing active fixture');
    (manager as unknown as { dropActive(id: string, expected: object): void }).dropActive(runId, state);
  }

  it('stops the pair and cancels the monitoring manager when the worker fails', () => {
    store.updateRun(WORKER_ID, { status: 'failed', error: 'engine crashed', finishedAt: new Date().toISOString() });
    store.updateStep(WORKER_ID, 'task', { status: 'failed' });
    drop(WORKER_ID);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('stopped');
    expect(store.getRun(WORKER_ID)?.status).toBe('failed');
    expect(store.getRun(MANAGER_ID)?.status).toBe('cancelled');
    expect(active.has(MANAGER_ID)).toBe(false);
  });

  it('stops both sides when the persistent worker is cancelled', () => {
    expect(manager.cancel(WORKER_ID)).toBe(true);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('stopped');
    expect(store.getRun(WORKER_ID)?.status).toBe('cancelled');
    expect(store.getRun(MANAGER_ID)?.status).toBe('cancelled');
  });

  it('stops the worker when the manager fails', () => {
    store.updateRun(MANAGER_ID, { status: 'failed', error: 'manager crashed', finishedAt: new Date().toISOString() });
    store.updateStep(MANAGER_ID, 'task', { status: 'failed' });
    drop(MANAGER_ID);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('stopped');
    expect(store.getRun(MANAGER_ID)?.status).toBe('failed');
    expect(store.getRun(WORKER_ID)?.status).toBe('cancelled');
  });

  it('keeps a usage-limit resume pending without stopping the pair', () => {
    const resetAt = Math.floor((Date.now() + 60 * 60 * 1000) / 1000);
    store.updateRun(WORKER_ID, {
      status: 'failed',
      error: `Claude AI usage limit reached|${resetAt}`,
      finishedAt: new Date().toISOString(),
    });
    store.updateStep(WORKER_ID, 'task', { status: 'failed', sessionId: 'worker-session' });
    drop(WORKER_ID);

    expect(manager.hasScheduledAutoResume(WORKER_ID)).toBe(true);
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('worker_working');
    expect(store.getRun(MANAGER_ID)?.status).toBe('running');
    manager.cancelAutoResume(WORKER_ID);
  });

  it('leaves a completed pair complete when stale worker cleanup arrives', () => {
    pairs.transition(MANAGER_ID, 'complete', 'manager', { completedAt: new Date().toISOString() });
    mirrorPairState(store, pairs.readState(MANAGER_ID)!);
    store.updateRun(WORKER_ID, { status: 'failed', error: 'late failure', finishedAt: new Date().toISOString() });
    drop(WORKER_ID);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('complete');
    expect(store.getRun(MANAGER_ID)?.status).toBe('running');
  });

  it('ignores stale owner cleanup instead of stopping a replacement worker', () => {
    const oldState = active.get(WORKER_ID)!;
    const replacement = { ...oldState, ownerToken: Symbol('replacement') };
    active.set(WORKER_ID, replacement);
    store.updateRun(WORKER_ID, { status: 'failed', error: 'late failure', finishedAt: new Date().toISOString() });

    (manager as unknown as { dropActive(id: string, expected: object): void }).dropActive(WORKER_ID, oldState);

    expect(active.get(WORKER_ID)).toBe(replacement);
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('worker_working');
    expect(store.getRun(MANAGER_ID)?.status).toBe('running');
  });

  function recoveryContext(
    continueRun: (id: string) => { ok: boolean; error?: string } = vi.fn(() => ({ ok: true })),
  ) {
    return {
      store,
      dataDir,
      repoRoot: root,
      active,
      lifecycle: { reconcile: vi.fn(async () => {}), isBlocked: vi.fn(() => false) },
      recoverRedirectOperations: vi.fn(async () => {}),
      recoverSoftAsks: vi.fn(),
      expireLostManagerDeliveriesAfterRestart: vi.fn(),
      continueRun,
      reconcileAutoResumes: vi.fn(),
      pump: vi.fn(),
      cancelOne: vi.fn(() => true),
      reportSettledChildToParent: vi.fn(async () => {}),
    } as unknown as LifecycleContext;
  }

  it('recovers the worker before its manager and leaves the manager parked for the report', async () => {
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('worker_working');
    expect(store.getRun(WORKER_ID)?.dispatch?.pairMember?.role).toBe('worker');
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.workerRunId).toBe(WORKER_ID);
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.managerRunId).toBe(MANAGER_ID);
    const continueRun = vi.fn((id: string) => {
      if (id === WORKER_ID) store.updateRun(WORKER_ID, { status: 'queued' });
      return { ok: true };
    });
    await recover(recoveryContext(continueRun));

    expect(continueRun.mock.calls.map((call) => call[0])).toEqual([WORKER_ID]);
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('worker_working');
    expect(store.getRun(MANAGER_ID)?.status).toBe('running');
    expect(store.getRun(MANAGER_ID)?.activity).toBe('monitoring');
  });

  it('stops the peer when restart recovery cannot resume the worker', async () => {
    const context = recoveryContext(vi.fn(() => ({ ok: false, error: 'no session' })));
    await recover(context);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('stopped');
    expect(context.cancelOne).toHaveBeenCalledWith(MANAGER_ID);
  });
});
