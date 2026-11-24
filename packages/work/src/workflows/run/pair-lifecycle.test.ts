import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Roster } from '@onni/contract';
import { PairStore } from '../../dispatch/pair-store.ts';
import { RunStore } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import { WorkspaceSemaphore } from '../../workspace/semaphore.ts';
import { RunManager } from '../run.ts';
import { initializePair, mirrorPairState } from './pair-runtime.ts';
import { deliverPairPeerText } from './pair-coordinator.ts';
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
    manager = new RunManager(store, root, {
      semaphore: new WorkspaceSemaphore({ initial: { maxParallel: 0 } }),
    });
    active = (manager as unknown as { active: typeof active }).active;
    store.createRun({
      id: MANAGER_ID,
      title: 'Manager',
      workflow: '(one-and-one)',
      task: 'Coordinate',
      steps: [{ id: 'task', name: 'Task', kind: 'agent' }],
      worktree: false,
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
    vi.unstubAllEnvs();
    await removeTempDir(root);
  });

  function drop(runId: string): void {
    const state = active.get(runId);
    if (!state) throw new Error('missing active fixture');
    (manager as unknown as { dropActive(id: string, expected: object): void }).dropActive(runId, state);
  }

  it('keeps the pair and the manager alive when the worker fails, handing the failure to the manager', () => {
    store.updateRun(WORKER_ID, { status: 'failed', error: 'engine crashed', finishedAt: new Date().toISOString() });
    store.updateStep(WORKER_ID, 'task', { status: 'failed' });
    drop(WORKER_ID);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');
    expect(store.getRun(WORKER_ID)?.status).toBe('failed');
    expect(store.getRun(MANAGER_ID)?.status).toBe('running');
    expect(active.has(MANAGER_ID)).toBe(true);
  });

  it('reports a stopped worker to the manager instead of ending the pair', () => {
    expect(manager.cancel(WORKER_ID)).toBe(true);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');
    expect(store.getRun(WORKER_ID)?.status).toBe('cancelled');
    expect(store.getRun(MANAGER_ID)?.status).toBe('running');
    expect(active.has(MANAGER_ID)).toBe(true);
  });

  it('pauses only the manager when it is stopped: the pair stays open and the worker keeps going', () => {
    const managerInterrupt = active.get(MANAGER_ID)!.interrupt;
    const workerInterrupt = active.get(WORKER_ID)!.interrupt;

    expect(manager.cancel(MANAGER_ID)).toBe(true);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('worker_working');
    expect(store.getRun(MANAGER_ID)?.status).toBe('cancelled');
    expect(store.getRun(WORKER_ID)?.status).toBe('running');
    expect(managerInterrupt).toHaveBeenCalledOnce();
    expect(workerInterrupt).not.toHaveBeenCalled();
    expect(active.has(WORKER_ID)).toBe(true);
  });

  it('stops the worker too when a spending ceiling is hit', () => {
    store.updateRun(MANAGER_ID, { limits: { mode: 'capped', maxCostUsd: 1 }, costUsd: 5 });
    manager.sweepLimits();

    expect(store.getRun(MANAGER_ID)?.limitHit).toMatchObject({ kind: 'cost' });
    expect(store.getRun(MANAGER_ID)?.status).toBe('cancelled');
    expect(store.getRun(WORKER_ID)?.status).toBe('cancelled');
  });

  it('ends both sides only on an explicit stop-all', () => {
    const workerInterrupt = active.get(WORKER_ID)!.interrupt;
    manager.cancelAll();

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('stopped');
    expect(store.getRun(MANAGER_ID)?.status).toBe('cancelled');
    expect(store.getRun(WORKER_ID)?.status).toBe('cancelled');
    expect(workerInterrupt).toHaveBeenCalledOnce();
  });

  it('reuses the persistent worker session, provider, account and binding for a revised order', async () => {
    vi.stubEnv('ONNI_DISPATCH', '1');
    const first = pairs.getOrder(MANAGER_ID, pairs.readState(MANAGER_ID)!.currentOrderId!)!;
    pairs.reportOrder(MANAGER_ID, first.id, 'First attempt');
    mirrorPairState(store, pairs.readState(MANAGER_ID)!);
    active.delete(WORKER_ID);
    const deferredBinding = {
      revision: 'binding-1',
      runner: 'codex',
      accounts: [{ runner: 'codex', id: 'account-a', path: '/accounts/a', identity: 'worker@example.test' }],
    };
    store.updateRun(WORKER_ID, {
      status: 'done',
      runner: 'codex',
      model: 'gpt-5',
      modelIdentity: 'openai/gpt-5',
      agentProfile: 'account-a',
      deferredBinding,
    });
    store.updateStep(WORKER_ID, 'task', {
      status: 'done',
      sessionId: 'worker-session',
      backend: 'codex',
      profileId: 'account-a',
      modelIdentity: 'openai/gpt-5',
    });
    const originalStep = { ...store.getRun(WORKER_ID)!.steps.find((step) => step.id === 'task')! };

    const outcome = await manager.dispatchFromAgent(MANAGER_ID, { objective: 'Revise the implementation' });

    expect(outcome).toMatchObject({ id: WORKER_ID, pair: { workerRunId: WORKER_ID, revision: 2 } });
    const pending = (manager as unknown as {
      pendingContinuations: Map<string, { stepId: string; sessionId: string | undefined; backend: string }>;
    }).pendingContinuations.get(WORKER_ID);
    expect(pending).toMatchObject({ stepId: 'continue-1', sessionId: 'worker-session', backend: 'codex' });
    const worker = store.getRun(WORKER_ID)!;
    expect(worker).toMatchObject({
      id: WORKER_ID,
      runner: 'codex',
      model: 'gpt-5',
      modelIdentity: 'openai/gpt-5',
      agentProfile: 'account-a',
      deferredBinding,
    });
    expect(worker.steps.find((step) => step.id === 'task')).toEqual(originalStep);
    expect(worker.steps.filter((step) => step.id.startsWith('continue-'))).toHaveLength(1);
    expect(store.listRuns().filter((run) => run.dispatch?.pairMember?.pairId === MANAGER_ID)).toHaveLength(1);
  });

  it('starts a fresh worker session when the previous worker failed', async () => {
    vi.stubEnv('ONNI_DISPATCH', '1');
    store.updateRun(WORKER_ID, { status: 'failed', error: 'engine crashed', finishedAt: new Date().toISOString() });
    drop(WORKER_ID);
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');

    const outcome = await manager.dispatchFromAgent(MANAGER_ID, { objective: 'Try the implementation again' });

    if (!('id' in outcome)) throw new Error(`expected a new worker, got ${JSON.stringify(outcome)}`);
    expect(outcome.id).not.toBe(WORKER_ID);
    expect(pairs.readState(MANAGER_ID)).toMatchObject({ workerRunId: outcome.id, phase: 'worker_queued' });
    expect(store.getRun(outcome.id)?.dispatch?.pairMember).toMatchObject({ pairId: MANAGER_ID, role: 'worker' });
  });

  it('leaves the pair open for Continue when the manager fails', () => {
    store.updateRun(MANAGER_ID, { status: 'failed', error: 'manager crashed', finishedAt: new Date().toISOString() });
    store.updateStep(MANAGER_ID, 'task', { status: 'failed' });
    drop(MANAGER_ID);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('worker_working');
    expect(store.getRun(MANAGER_ID)?.status).toBe('failed');
    expect(store.getRun(WORKER_ID)?.status).toBe('running');
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
      settleSuccess: vi.fn(async () => {}),
      reconcileAutoResumes: vi.fn(),
      pump: vi.fn(),
      cancelOne: vi.fn(() => true),
      hasPendingWork: vi.fn(() => false),
      reportSettledChildToParent: vi.fn(async () => {}),
    } as unknown as LifecycleContext;
  }

  it('counts starting continuations and durable worktree operations as pending work', () => {
    active.delete(MANAGER_ID);
    const starting = (manager as unknown as { starting: Set<string> }).starting;
    starting.add(MANAGER_ID);
    expect(manager.hasPendingWork(MANAGER_ID)).toBe(true);
    starting.delete(MANAGER_ID);

    store.updateRun(MANAGER_ID, {
      status: 'done',
      worktreeLifecycle: {
        worktreeId: '33333333-3333-3333-3333-333333333333',
        generation: 1,
        activeOperationId: '44444444-4444-4444-4444-444444444444',
        needsAttention: false,
      },
    });
    expect(manager.hasPendingWork(MANAGER_ID)).toBe(true);
  });

  it('uses the full pending-work predicate before recovering a pair deletion', async () => {
    active.clear();
    const state = pairs.transition(MANAGER_ID, 'complete', 'manager', { completedAt: new Date().toISOString() });
    mirrorPairState(store, state);
    store.updateRun(MANAGER_ID, { status: 'done' });
    store.updateRun(WORKER_ID, { status: 'done' });
    writeFileSync(join(dataDir, 'pairs', MANAGER_ID, 'deletion.json'), JSON.stringify({
      pairId: MANAGER_ID,
      managerRunId: MANAGER_ID,
      workerRunId: WORKER_ID,
      repoRoot: root,
      createdAt: new Date().toISOString(),
    }));
    const context = recoveryContext();
    context.hasPendingWork = vi.fn((runId: string) => runId === MANAGER_ID);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await recover(context);

    expect(context.hasPendingWork).toHaveBeenCalledWith(MANAGER_ID);
    expect(store.getRun(MANAGER_ID)).toBeDefined();
    expect(store.getRun(WORKER_ID)).toBeDefined();
    expect(existsSync(join(dataDir, 'pairs', MANAGER_ID, 'deletion.json'))).toBe(true);
  });

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

  it('reports to the manager instead of stopping it when restart recovery cannot resume the worker', async () => {
    const context = recoveryContext(vi.fn(() => ({ ok: false, error: 'no session' })));
    await recover(context);

    expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');
    expect(context.cancelOne).not.toHaveBeenCalledWith(MANAGER_ID);
  });

  it('keeps a reported pair waiting for review across restart instead of settling it', async () => {
    const order = pairs.getOrder(MANAGER_ID, pairs.readState(MANAGER_ID)!.currentOrderId!)!;
    pairs.reportOrder(MANAGER_ID, order.id, 'Implemented and verified');
    mirrorPairState(store, pairs.readState(MANAGER_ID)!);
    store.updateRun(MANAGER_ID, { status: 'waiting' });
    store.updateStep(MANAGER_ID, 'task', { status: 'waiting', sessionId: 'manager-session' });
    store.updateRun(WORKER_ID, { status: 'done' });
    store.updateStep(WORKER_ID, 'task', { status: 'done', sessionId: 'worker-session' });
    active.clear();
    const context = recoveryContext();

    await recover(context);

    expect(context.settleSuccess).not.toHaveBeenCalled();
    expect(context.continueRun).not.toHaveBeenCalled();
    expect(store.getRun(MANAGER_ID)?.status).toBe('waiting');
    expect(store.getRun(MANAGER_ID)?.steps.find((step) => step.id === 'task')?.status).toBe('done');
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');
  });

  it('resumes an inactive waiting manager for an engine-authored peer report', () => {
    active.delete(MANAGER_ID);
    store.updateRun(MANAGER_ID, { status: 'waiting' });
    store.updateStep(MANAGER_ID, 'task', { status: 'waiting', sessionId: 'manager-session' });
    expect(manager.continueRun(MANAGER_ID, { text: 'ordinary continue' })).toEqual({
      ok: false,
      error: 'cannot continue a waiting run',
    });

    deliverPairPeerText({
      store,
      active,
      deliverMessage: () => false,
      deferMessage: () => false,
      continueRun: (id, options, deferForCapacity) => manager.continueRun(id, options, deferForCapacity),
    }, MANAGER_ID, 'One & One worker report', 'peer delivery failed');

    expect(store.getRun(MANAGER_ID)?.status).toBe('queued');
    expect((manager as unknown as {
      pendingContinuations: Map<string, { stepId: string; sessionId: string | undefined; prompt: string }>;
    }).pendingContinuations.get(MANAGER_ID)).toMatchObject({
      stepId: 'continue-1',
      sessionId: 'manager-session',
      prompt: 'One & One worker report',
    });
  });
});
