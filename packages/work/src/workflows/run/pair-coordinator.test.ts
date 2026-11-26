import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Roster, RunDispatch } from '@onni/contract';
import { PairStore, PairStoreError } from '../../dispatch/pair-store.ts';
import { acquireRepositoryLockSync } from '../../git-repository-lock.ts';
import { RunStore } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import { handleDispatchTurn } from './manager-state.ts';
import { finalizePairManager, finishPairManager, handlePairWorkerTurn, isLivePairParticipant, isPairWorkerHandoffTurn, parkPairManager, preparePairContinuation, relayPairWorkerFailure, stopPair } from './pair-coordinator.ts';
import { idleClosedFails, settleSuccess, settleUnansweredPark } from './settlement.ts';
import * as pairRuntime from './pair-runtime.ts';
import { checkpointPair, initializePair, mirrorPairState, validatePairWorkspace } from './pair-runtime.ts';
import type { ManagerStateActive, ManagerStateContext } from './internal-types.ts';
import type { PastedContent } from './preparation.ts';

const MANAGER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_ID = '22222222-2222-2222-2222-222222222222';

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const roster: Roster = {
  mode: 'one-and-one',
  manager: { runner: 'claude', model: 'opus' },
  workers: [{ runner: 'codex', model: 'gpt-5', role: 'implementation', maxConcurrent: 1 }],
};

describe('One & One coordinator', () => {
  let root: string;
  let dataDir: string;
  let store: RunStore;
  let pairs: PairStore;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'onni-one-and-one-repo-'));
    dataDir = mkdtempSync(join(tmpdir(), 'onni-one-and-one-data-'));
    git(root, 'init', '-b', 'dev');
    git(root, 'config', 'user.name', 'Onni Test');
    git(root, 'config', 'user.email', 'onni@test.local');
    writeFileSync(join(root, 'README.md'), 'base\n', 'utf8');
    git(root, 'add', 'README.md');
    git(root, 'commit', '-m', 'base');
    store = RunStore.open(dataDir);
    pairs = new PairStore(dataDir);
    store.createRun({ id: MANAGER_ID, title: 'Manager', workflow: '(one-and-one)', task: 'Coordinate', steps: [] });
    store.createRun({ id: WORKER_ID, title: 'Worker', workflow: '(one-and-one)', task: 'Implement', autonomous: true, worktree: false, steps: [] });
    store.updateRun(MANAGER_ID, { roster, dispatch: { rootRunId: MANAGER_ID } });
    store.updateRun(WORKER_ID, { dispatch: { rootRunId: MANAGER_ID, parentRunId: MANAGER_ID, pairMember: { pairId: MANAGER_ID, role: 'worker', peerRunId: MANAGER_ID } } });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    store.flush();
    await removeTempDir(root);
    await removeTempDir(dataDir);
  });

  async function startOrder(): Promise<void> {
    const initialized = await initializePair(root, store, pairs, MANAGER_ID);
    if (!initialized.ok) throw new Error(initialized.error);
    pairs.setWorker(MANAGER_ID, WORKER_ID);
    const order = pairs.enqueueOrder(MANAGER_ID, { objective: 'Implement the feature' });
    pairs.markOrderWorking(MANAGER_ID, order.id);
    const state = pairs.readState(MANAGER_ID)!;
    store.updateRun(MANAGER_ID, { dispatch: { rootRunId: MANAGER_ID, pair: state } });
  }

  async function recordCheckEvidence(): Promise<void> {
    const checkpoint = await checkpointPair(root, pairs, MANAGER_ID, 'test verification');
    if (!checkpoint.ok || !checkpoint.sha) throw new Error(checkpoint.error ?? 'missing checkpoint');
    const orderId = pairs.readState(MANAGER_ID)?.currentOrderId;
    if (!orderId) throw new Error('missing order');
    // Coordinator unit tests supply the verifier receipt; pair-verify tests execute the check path.
    pairs.recordVerification(MANAGER_ID, orderId, { state: 'passed', checkpointSha: checkpoint.sha, at: new Date().toISOString() });
  }

  it('heals a transient lock failure while recording the worker report instead of failing the worker', async () => {
    await startOrder();
    writeFileSync(join(root, 'feature.txt'), 'implemented\n', 'utf8');
    const original = PairStore.prototype.reportOrder;
    let failures = 2;
    vi.spyOn(PairStore.prototype, 'reportOrder').mockImplementation(function (this: PairStore, ...args: Parameters<PairStore['reportOrder']>) {
      if (failures > 0) {
        failures -= 1;
        throw new PairStoreError('One & One repository lease was lost');
      }
      return original.apply(this, args);
    });
    const context = {
      store, dataDir, repoRoot: root,
      active: new Set<string>(),
      deliverMessage: () => true,
      deferMessage: () => false,
      continueRun: () => ({ ok: true }),
    };
    const handedOff = await handlePairWorkerTurn(context, WORKER_ID, 'Implemented feature.txt.\nONNI:DONE', []);
    expect(handedOff).toEqual({ handled: true, ok: true });
    expect(failures).toBe(0);
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');
  });

  it('repairs the pair phase when the report write succeeds but its lock is then lost', async () => {
    await startOrder();
    writeFileSync(join(root, 'feature.txt'), 'implemented\n', 'utf8');
    const original = PairStore.prototype.reportOrder;
    let lostAfterWrite = true;
    vi.spyOn(PairStore.prototype, 'reportOrder').mockImplementation(function (this: PairStore, ...args: Parameters<PairStore['reportOrder']>) {
      const result = original.apply(this, args);
      if (lostAfterWrite) {
        lostAfterWrite = false;
        throw new PairStoreError('One & One repository lease was lost');
      }
      return result;
    });
    const context = {
      store, dataDir, repoRoot: root,
      active: new Set<string>(),
      deliverMessage: () => true,
      deferMessage: () => false,
      continueRun: () => ({ ok: true }),
    };

    await expect(handlePairWorkerTurn(context, WORKER_ID, 'Implemented feature.txt.\nONNI:DONE', []))
      .resolves.toEqual({ handled: true, ok: true });
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');
    expect(pairs.getOrder(MANAGER_ID, pairs.readState(MANAGER_ID)!.currentOrderId!)?.status).toBe('reported');
  });

  it('checkpoints explicit worker paths, reports to the manager, and completes only after acceptance', async () => {
    await startOrder();
    writeFileSync(join(root, 'feature.txt'), 'implemented\n', 'utf8');
    mkdirSync(join(root, '.ai', 'onni'), { recursive: true });
    writeFileSync(join(root, '.ai', 'onni', 'state.json'), 'reserved', 'utf8');
    const delivered: PastedContent[][] = [];
    const context = {
      store,
      dataDir,
      repoRoot: root,
      active: new Set<string>(),
      deliverMessage: (_runId: string, content: PastedContent[]) => { delivered.push(content); return true; },
      deferMessage: () => false,
      continueRun: () => ({ ok: true }),
    };
    const handedOff = await handlePairWorkerTurn(context, WORKER_ID, 'Implemented feature.txt and verified it.\nONNI:DONE', []);
    expect(handedOff).toEqual({ handled: true, ok: true });
    const state = pairs.readState(MANAGER_ID)!;
    const order = pairs.getOrder(MANAGER_ID, state.currentOrderId!)!;
    expect(state.phase).toBe('manager_review');
    expect(order).toMatchObject({ status: 'reported', revision: 1 });
    expect(order.report).toContain('Implemented feature.txt');
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('manager_review');
    expect(git(root, 'show', '--format=', '--name-only', 'HEAD')).toBe('feature.txt');
    expect(readFileSync(join(root, '.ai', 'onni', 'state.json'), 'utf8')).toBe('reserved');
    expect(delivered[0]?.[0]).toMatchObject({ type: 'text' });
    expect(JSON.stringify(delivered[0])).toContain('ONNI:PAIR:ACCEPT');

    const incomplete = await finalizePairManager(context, MANAGER_ID, []);
    if (incomplete.ok) throw new Error('manager completed before accepting the order');
    await recordCheckEvidence();
    pairs.acceptOrder(MANAGER_ID, { orderId: order.id });
    writeFileSync(join(root, 'final.txt'), 'final check\n', 'utf8');
    expect((await finalizePairManager(context, MANAGER_ID, [])).ok).toBe(false);
    await recordCheckEvidence();
    const finalized = await finalizePairManager(context, MANAGER_ID, []);
    if (!finalized.ok) throw new Error(finalized.error);
    expect(finalized.state.phase).toBe('complete');
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('complete');
    expect(git(root, 'show', '--format=', '--name-only', 'HEAD')).toBe('final.txt');
    expect((await validatePairWorkspace(root, pairs, MANAGER_ID)).ok).toBe(true);
  });

  it('reopens a finished pair for the manager when the user writes again, but never for the worker', async () => {
    await startOrder();
    const orderId = pairs.readState(MANAGER_ID)!.currentOrderId!;
    pairs.reportOrder(MANAGER_ID, orderId, 'done');
    pairs.acceptOrder(MANAGER_ID, { orderId });
    const finalized = await finalizePairManager({ store, dataDir, repoRoot: root }, MANAGER_ID, []);
    if (!finalized.ok) throw new Error(finalized.error);
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('complete');

    expect((await preparePairContinuation({ store, dataDir, repoRoot: root }, WORKER_ID)).ok).toBe(false);
    expect((await preparePairContinuation({ store, dataDir, repoRoot: root }, MANAGER_ID)).ok).toBe(true);
    const reopened = pairs.readState(MANAGER_ID)!;
    expect(reopened.phase).toBe('planning');
    expect(reopened.completedAt).toBeUndefined();
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('planning');
  });

  describe('a failed worker is reported to the manager, not fatal to the pair', () => {
    function deliveryContext(delivered: PastedContent[][]) {
      return {
        store,
        dataDir,
        active: new Set<string>(),
        deliverMessage: (_runId: string, content: PastedContent[]) => { delivered.push(content); return true; },
        deferMessage: () => false,
        continueRun: () => ({ ok: true }),
      };
    }

    it('turns the failure into a report and keeps the pair open for a revised order', async () => {
      await startOrder();
      store.updateRun(MANAGER_ID, { status: 'waiting' });
      store.updateRun(WORKER_ID, { status: 'failed', error: 'agent crashed' });
      const delivered: PastedContent[][] = [];
      expect(relayPairWorkerFailure(deliveryContext(delivered), WORKER_ID)).toBe(true);
      const state = pairs.readState(MANAGER_ID)!;
      expect(state.phase).toBe('manager_review');
      expect(pairs.getOrder(MANAGER_ID, state.currentOrderId!)).toMatchObject({ status: 'reported' });
      expect(JSON.stringify(delivered[0])).toContain('WORKER FAILED');
      expect(JSON.stringify(delivered[0])).toContain('agent crashed');
      expect(store.getRun(MANAGER_ID)?.status).toBe('waiting');
      // The manager can resume (the user can chat) and revise the order for the same worker.
      expect((await preparePairContinuation({ store, dataDir, repoRoot: root }, MANAGER_ID)).ok).toBe(true);
      const revised = pairs.enqueueOrder(MANAGER_ID, { objective: 'Retry the feature' });
      expect(revised.revision).toBe(2);
    });

    it('still saves the report when the manager was stopped by the user', async () => {
      await startOrder();
      store.updateRun(MANAGER_ID, { status: 'cancelled' });
      store.updateRun(WORKER_ID, { status: 'failed', error: 'boom' });
      expect(relayPairWorkerFailure(deliveryContext([]), WORKER_ID)).toBe(true);
      expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');
      // A second ask (cancel path then teardown) is a no-op that still reports success.
      expect(relayPairWorkerFailure(deliveryContext([]), WORKER_ID)).toBe(true);
    });

    it('keeps the pair open and tells the manager when the worker ends with no order in flight', async () => {
      await startOrder();
      const orderId = pairs.readState(MANAGER_ID)!.currentOrderId!;
      pairs.reportOrder(MANAGER_ID, orderId, 'a normal report');
      store.updateRun(WORKER_ID, { status: 'failed', error: 'late crash' });
      expect(relayPairWorkerFailure(deliveryContext([]), WORKER_ID)).toBe(true);
      expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');
      expect(JSON.stringify(store.readEvents(MANAGER_ID))).toContain('already reported');
    });

    it('parks the manager instead of failing the run when the final checkpoint cannot close the task', async () => {
      await startOrder();
      store.updateRun(MANAGER_ID, { status: 'waiting' });
      const owner = {};
      const ctx = {
        store, dataDir, repoRoot: root,
        active: new Map([[MANAGER_ID, owner]]),
        currentCheckExclusions: async () => [],
      } as unknown as Parameters<typeof settleSuccess>[0];
      expect(await settleSuccess(ctx, MANAGER_ID, owner as never)).toBe(true);
      expect(store.getRun(MANAGER_ID)?.status).toBe('waiting');
      expect(pairs.readState(MANAGER_ID)?.phase).not.toBe('stopped');
    });

    it('falls back to stopping the pair when the pair is already stopped', async () => {
      await startOrder();
      stopPair({ store, dataDir }, MANAGER_ID, 'stop-all');
      store.updateRun(WORKER_ID, { status: 'cancelled' });
      expect(relayPairWorkerFailure(deliveryContext([]), WORKER_ID)).toBe(false);
    });

    it('still tells the manager when the pair state cannot be updated', async () => {
      await startOrder();
      store.updateRun(WORKER_ID, { status: 'failed', error: 'One & One repository lease was lost' });
      // Hold the repository lease so the relay's pair mutation cannot acquire it.
      const blocker = acquireRepositoryLockSync(root)!;
      try {
        expect(relayPairWorkerFailure(deliveryContext([]), WORKER_ID)).toBe(false);
      } finally {
        blocker.release();
      }
      expect(JSON.stringify(store.readEvents(MANAGER_ID))).toContain('ended (failed) but the pair could not record it');
      expect(pairs.readState(MANAGER_ID)?.phase).toBe('worker_working');
    });
  });

  describe('inactivity never stops an open pair', () => {
    function settlementContext(owner?: { idleClosed?: boolean }) {
      return {
        store,
        dataDir,
        repoRoot: root,
        active: new Map(owner ? [[MANAGER_ID, owner]] : []),
        reviewGateApplies: async () => false,
      } as unknown as Parameters<typeof settleSuccess>[0];
    }

    it('does not treat an idle-closed manager or worker as failed', async () => {
      await startOrder();
      const owner = { idleClosed: true };
      expect(await idleClosedFails(settlementContext(owner), MANAGER_ID, owner as never)).toBe(false);
      expect(await idleClosedFails(settlementContext(owner), WORKER_ID, owner as never)).toBe(false);
      expect(isLivePairParticipant({ store, dataDir }, MANAGER_ID)).toBe(true);
      expect(isLivePairParticipant({ store, dataDir }, WORKER_ID)).toBe(true);
    });

    it('still fails an idle-closed manager once the pair is stopped', async () => {
      await startOrder();
      stopPair({ store, dataDir }, MANAGER_ID, 'test stop');
      const owner = { idleClosed: true };
      expect(isLivePairParticipant({ store, dataDir }, MANAGER_ID)).toBe(false);
      expect(await idleClosedFails(settlementContext(owner), MANAGER_ID, owner as never)).toBe(true);
    });

    it('parks an unanswered question without stopping the pair', async () => {
      await startOrder();
      store.updateRun(MANAGER_ID, { status: 'waiting', askParked: true });
      settleUnansweredPark(settlementContext(), MANAGER_ID, new Date().toISOString(), false);
      expect(store.getRun(MANAGER_ID)?.status).toBe('waiting');
      expect(pairs.readState(MANAGER_ID)?.phase).toBe('worker_working');
    });

    it('settles an idle-closed manager as a resumable park', async () => {
      await startOrder();
      const owner = { idleClosed: true };
      store.updateRun(MANAGER_ID, { status: 'waiting' });
      expect(await settleSuccess(settlementContext(owner), MANAGER_ID, owner as never)).toBe(true);
      expect(store.getRun(MANAGER_ID)?.status).toBe('waiting');
      expect(pairs.readState(MANAGER_ID)?.phase).toBe('worker_working');
    });
  });

  it('tolerates the worker committing and staging mid-turn when handing off', async () => {
    await startOrder();
    writeFileSync(join(root, 'committed.txt'), 'committed\n', 'utf8');
    git(root, 'add', 'committed.txt');
    git(root, 'commit', '-m', 'worker committed mid-order');
    writeFileSync(join(root, 'staged.txt'), 'staged\n', 'utf8');
    git(root, 'add', 'staged.txt');
    const delivered: PastedContent[][] = [];
    const context = {
      store,
      dataDir,
      repoRoot: root,
      active: new Set<string>(),
      deliverMessage: (_runId: string, content: PastedContent[]) => { delivered.push(content); return true; },
      deferMessage: () => false,
      continueRun: () => ({ ok: true }),
    };
    const handedOff = await handlePairWorkerTurn(context, WORKER_ID, 'Implemented, committed, and staged.\nONNI:DONE', []);
    expect(handedOff).toEqual({ handled: true, ok: true });
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('manager_review');
    expect(git(root, 'show', '--format=', '--name-only', 'HEAD')).toContain('staged.txt');
  });

  it('resumes the same worker for a revised order and mirrors worker_working', async () => {
    await startOrder();
    const first = pairs.getOrder(MANAGER_ID, pairs.readState(MANAGER_ID)!.currentOrderId!)!;
    pairs.reportOrder(MANAGER_ID, first.id, 'First attempt');
    const revised = pairs.enqueueOrder(MANAGER_ID, { objective: 'Revise the feature', success_criteria: 'tests pass' });
    expect(revised.revision).toBe(2);
    const prepared = await preparePairContinuation({ store, dataDir, repoRoot: root }, WORKER_ID);
    expect(prepared.ok).toBe(true);
    expect(pairs.getOrder(MANAGER_ID, first.id)?.status).toBe('reported');
    expect(pairs.getOrder(MANAGER_ID, revised.id)?.status).toBe('working');
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('worker_working');
    expect(store.getRun(WORKER_ID)?.id).toBe(WORKER_ID);
  });

  it('restores the reported order when a revised worker resume is refused', async () => {
    await startOrder();
    const first = pairs.getOrder(MANAGER_ID, pairs.readState(MANAGER_ID)!.currentOrderId!)!;
    pairs.reportOrder(MANAGER_ID, first.id, 'First attempt');
    const previous = pairs.readState(MANAGER_ID)!;
    const revised = pairs.enqueueOrder(MANAGER_ID, { objective: 'Revise the feature' });
    pairs.discardQueuedOrder(MANAGER_ID, revised.id, previous);

    expect(pairs.getOrder(MANAGER_ID, revised.id)?.status).toBe('rejected');
    expect(pairs.readState(MANAGER_ID)).toMatchObject({
      phase: 'manager_review',
      currentOrderId: first.id,
      orderRevision: previous.orderRevision,
      handoffs: previous.handoffs,
    });
  });

  it('fails closed when the shared checkout moves to another branch', async () => {
    await startOrder();
    git(root, 'checkout', '-b', 'other');
    const valid = await validatePairWorkspace(root, pairs, MANAGER_ID);
    if (valid.ok) throw new Error('pair continued on the wrong branch');
    expect(valid.error).toContain('pinned to branch "dev"');
    const prepared = await preparePairContinuation({ store, dataDir, repoRoot: root }, WORKER_ID);
    expect(prepared.ok).toBe(false);
  });

  it('does not checkpoint or resume a stopped pair', async () => {
    await startOrder();
    writeFileSync(join(root, 'feature.txt'), 'implemented\n', 'utf8');
    pairs.transition(MANAGER_ID, 'stopped', 'manager');
    const head = git(root, 'rev-parse', 'HEAD');

    const checkpoint = await checkpointPair(root, pairs, MANAGER_ID, 'cancelled worker');
    expect(checkpoint.ok).toBe(false);
    expect(checkpoint.error).toContain('stopped');
    expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(root, 'status', '--porcelain')).toContain('feature.txt');
    const prepared = await preparePairContinuation({ store, dataDir, repoRoot: root }, WORKER_ID);
    expect(prepared).toEqual({ ok: false, error: 'One & One pair is stopped' });
  });

  it('does not record a worker report when stop wins after the async checkpoint', async () => {
    await startOrder();
    writeFileSync(join(root, 'feature.txt'), 'implemented\n', 'utf8');
    const checkpointFinished = deferred<void>();
    const releaseCheckpoint = deferred<void>();
    const original = pairRuntime.checkpointPair;
    vi.spyOn(pairRuntime, 'checkpointPair').mockImplementation(async (...args: Parameters<typeof original>) => {
      const result = await original(...args);
      checkpointFinished.resolve();
      await releaseCheckpoint.promise;
      return result;
    });
    const delivered: PastedContent[][] = [];
    const context = {
      store, dataDir, repoRoot: root, active: new Set<string>(),
      deliverMessage: (_runId: string, content: PastedContent[]) => { delivered.push(content); return true; },
      deferMessage: () => false,
      continueRun: () => ({ ok: true }),
    };

    const pending = handlePairWorkerTurn(context, WORKER_ID, 'Implemented the feature.\nONNI:DONE', []);
    await checkpointFinished.promise;
    mirrorPairState(store, pairs.transition(MANAGER_ID, 'stopped', 'manager'));
    releaseCheckpoint.resolve();

    await expect(pending).resolves.toEqual({
      handled: true,
      ok: false,
      error: 'One & One pair stopped before the worker report could be recorded',
    });
    const state = pairs.readState(MANAGER_ID)!;
    const order = pairs.getOrder(MANAGER_ID, state.currentOrderId!)!;
    expect(state.phase).toBe('stopped');
    expect(order).toMatchObject({ status: 'working' });
    expect(order.report).toBeUndefined();
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('stopped');
    expect(delivered).toEqual([]);
  });

  it('does not record a worker report when stop wins during async diff inspection', async () => {
    await startOrder();
    writeFileSync(join(root, 'feature.txt'), 'implemented\n', 'utf8');
    const diffFinished = deferred<void>();
    const releaseDiff = deferred<void>();
    const original = pairRuntime.inspectPairDiff;
    vi.spyOn(pairRuntime, 'inspectPairDiff').mockImplementation(async (...args: Parameters<typeof original>) => {
      const result = await original(...args);
      diffFinished.resolve();
      await releaseDiff.promise;
      return result;
    });
    const delivered: PastedContent[][] = [];
    const context = {
      store, dataDir, repoRoot: root, active: new Set<string>(),
      deliverMessage: (_runId: string, content: PastedContent[]) => { delivered.push(content); return true; },
      deferMessage: () => false,
      continueRun: () => ({ ok: true }),
    };

    const pending = handlePairWorkerTurn(context, WORKER_ID, 'Implemented the feature.\nONNI:DONE', []);
    await diffFinished.promise;
    mirrorPairState(store, pairs.transition(MANAGER_ID, 'stopped', 'manager'));
    releaseDiff.resolve();

    await expect(pending).resolves.toEqual({
      handled: true,
      ok: false,
      error: 'One & One pair stopped before the worker report could be recorded',
    });
    const state = pairs.readState(MANAGER_ID)!;
    const order = pairs.getOrder(MANAGER_ID, state.currentOrderId!)!;
    expect(state.phase).toBe('stopped');
    expect(order).toMatchObject({ status: 'working' });
    expect(order.report).toBeUndefined();
    expect(delivered).toEqual([]);
  });

  it('blocks manager completion on the acceptance turn and allows it after final checks', async () => {
    await startOrder();
    const order = pairs.getOrder(MANAGER_ID, pairs.readState(MANAGER_ID)!.currentOrderId!)!;
    pairs.reportOrder(MANAGER_ID, order.id, 'Ready for review');
    const sendMessage = vi.fn(() => true);
    const active = new Map<string, ManagerStateActive>([[MANAGER_ID, { cancelled: false, session: { open: true, sendMessage } }]]);
    const context = {
      store,
      dataDir,
      repoRoot: root,
      active,
      softAskTimers: new Map(),
      maxAutoContinues: 3,
      dispatchEnabled: () => true,
      dispatchOf: (id: string) => store.getRun(id)?.dispatch,
      updateDispatch: (id: string, patch: (dispatch: RunDispatch) => RunDispatch) => {
        const current = store.getRun(id)?.dispatch;
        if (current) store.updateRun(id, { dispatch: patch(current) });
      },
      makeUiSink: vi.fn(),
      emitAskRequested: vi.fn(),
      turnEndMarkerText: (text: string) => text,
      enforceDispatchBudget: () => false,
      deliverMessage: () => true,
      continueRun: () => ({ ok: true }),
      managerComplexityPolicyEnabled: () => false,
    } as unknown as ManagerStateContext;
    const state = active.get(MANAGER_ID)!;
    const accepted = handleDispatchTurn(context, MANAGER_ID, 'ONNI:PAIR:ACCEPT\nONNI:DONE', { state, stepId: 'task', done: true });
    expect(accepted.doneBlocked).toBe(true);
    expect(pairs.getOrder(MANAGER_ID, order.id)?.status).toBe('accepted');
    expect(sendMessage).toHaveBeenCalledOnce();
    const completed = handleDispatchTurn(context, MANAGER_ID, 'Final checks passed.\nONNI:DONE', { state, stepId: 'task', done: true });
    expect(completed.doneBlocked).not.toBe(true);
  });

  it('blocks API acceptance on the same manager turn without blocking a later turn', async () => {
    await startOrder();
    const order = pairs.getOrder(MANAGER_ID, pairs.readState(MANAGER_ID)!.currentOrderId!)!;
    pairs.reportOrder(MANAGER_ID, order.id, 'Ready for review');
    pairs.acceptOrder(MANAGER_ID, { orderId: order.id });
    const sendMessage = vi.fn(() => true);
    const state: ManagerStateActive = {
      cancelled: false,
      pairTurnSeq: 4,
      pairAcceptedTurnSeq: 4,
      session: { open: true, sendMessage },
    };
    const context = {
      store,
      dataDir,
      repoRoot: root,
      active: new Map([[MANAGER_ID, state]]),
      softAskTimers: new Map(),
      maxAutoContinues: 3,
      dispatchEnabled: () => true,
      dispatchOf: (id: string) => store.getRun(id)?.dispatch,
      updateDispatch: (id: string, patch: (dispatch: RunDispatch) => RunDispatch) => {
        const current = store.getRun(id)?.dispatch;
        if (current) store.updateRun(id, { dispatch: patch(current) });
      },
      makeUiSink: vi.fn(),
      emitAskRequested: vi.fn(),
      turnEndMarkerText: (text: string) => text,
      enforceDispatchBudget: () => false,
      deliverMessage: () => true,
      continueRun: () => ({ ok: true }),
      managerComplexityPolicyEnabled: () => false,
    } as unknown as ManagerStateContext;

    const accepted = handleDispatchTurn(context, MANAGER_ID, 'ONNI:DONE', { state, stepId: 'task', done: true });
    expect(accepted.doneBlocked).toBe(true);
    expect(state.pairAcceptedTurnSeq).toBeUndefined();
    state.pairTurnSeq = 5;
    const completed = handleDispatchTurn(context, MANAGER_ID, 'Final checks passed.\nONNI:DONE', { state, stepId: 'task', done: true });
    expect(completed.doneBlocked).not.toBe(true);

    state.pairTurnSeq = 6;
    state.pairAcceptedTurnSeq = 5;
    const staleAcceptance = handleDispatchTurn(context, MANAGER_ID, 'ONNI:DONE', { state, stepId: 'task', done: true });
    expect(staleAcceptance.doneBlocked).not.toBe(true);
  });

  describe('long-lived One & One pair park and finish', () => {
  const pairContext = () => ({
    store,
    dataDir,
    repoRoot: root,
    active: new Set<string>(),
    deliverMessage: () => true,
    deferMessage: () => false,
    continueRun: () => ({ ok: true }),
  });

  /** Run one order to acceptance, run final checks, and park the manager at `user_wait`. */
  async function parkAcceptedOrder(): Promise<void> {
    await startOrder();
    writeFileSync(join(root, 'feature.txt'), 'implemented\n', 'utf8');
    await handlePairWorkerTurn(pairContext(), WORKER_ID, 'Implemented feature.txt.\nONNI:DONE', []);
    const order = pairs.getOrder(MANAGER_ID, pairs.readState(MANAGER_ID)!.currentOrderId!)!;
    await recordCheckEvidence();
    pairs.acceptOrder(MANAGER_ID, { orderId: order.id });
    writeFileSync(join(root, 'final.txt'), 'final check\n', 'utf8');
    await recordCheckEvidence();
    const parked = await parkPairManager(pairContext(), MANAGER_ID, []);
    if (!parked.ok) throw new Error(parked.error);
  }

  function managerContext(sendMessage: () => boolean): ManagerStateContext {
    const state: ManagerStateActive = { cancelled: false, session: { open: true, sendMessage } };
    return {
      store,
      dataDir,
      repoRoot: root,
      active: new Map([[MANAGER_ID, state]]),
      softAskTimers: new Map(),
      maxAutoContinues: 3,
      dispatchEnabled: () => true,
      dispatchOf: (id: string) => store.getRun(id)?.dispatch,
      updateDispatch: (id: string, patch: (dispatch: RunDispatch) => RunDispatch) => {
        const current = store.getRun(id)?.dispatch;
        if (current) store.updateRun(id, { dispatch: patch(current) });
      },
      makeUiSink: vi.fn(),
      emitAskRequested: vi.fn(),
      turnEndMarkerText: (text: string) => text,
      enforceDispatchBudget: () => false,
      deliverMessage: () => true,
      continueRun: () => ({ ok: true }),
      managerComplexityPolicyEnabled: () => false,
    } as unknown as ManagerStateContext;
  }

  it('parks an accepted order at user_wait, checkpointing the final check instead of completing', async () => {
    await parkAcceptedOrder();
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('user_wait');
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('user_wait');
    expect(git(root, 'show', '--format=', '--name-only', 'HEAD')).toBe('final.txt');
  });

  it('resumes a parked manager into a fresh task scope', async () => {
    await parkAcceptedOrder();
    const prepared = await preparePairContinuation(pairContext(), MANAGER_ID);
    expect(prepared.ok).toBe(true);
    const state = pairs.readState(MANAGER_ID)!;
    expect(state.phase).toBe('planning');
    expect(state.currentOrderId).toBeUndefined();
    expect(state.orderRevision).toBe(0);
    expect(state.workspace.baselineSha).toBe(state.lastCheckpointSha);
  });

  it('finishes an idle parked pair for good', async () => {
    await parkAcceptedOrder();
    const finished = await finishPairManager(pairContext(), MANAGER_ID, []);
    if (!finished.ok) throw new Error(finished.error);
    expect(finished.state.phase).toBe('complete');
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('complete');
  });

  it('refuses to finish while an order is still in flight', async () => {
    await startOrder();
    const finished = await finishPairManager(pairContext(), MANAGER_ID, []);
    expect(finished).toMatchObject({ ok: false, error: 'One & One cannot finish while an order is still in flight' });
  });

  it('a manager FINISH marker no longer completes an idle pair — only the user Finish does', async () => {
    await parkAcceptedOrder();
    await preparePairContinuation(pairContext(), MANAGER_ID); // → planning, no order in flight
    const sendMessage = vi.fn(() => true);
    const context = managerContext(sendMessage);
    const state = context.active.get(MANAGER_ID)!;
    const result = handleDispatchTurn(context, MANAGER_ID, 'All done.\nONNI:PAIR:FINISH\nONNI:DONE', { state, stepId: 'task', done: true });
    expect(result.doneBlocked).toBe(true);
  });
  });
});

describe('isPairWorkerHandoffTurn', () => {
  const member = (runner: string) => ({ runner, dispatch: { pairMember: { pairId: 'p' } } });
  it('accepts the DONE marker for any backend', () => {
    expect(isPairWorkerHandoffTurn(member('claude'), 'done', true)).toBe(true);
  });
  it('lets an Antigravity worker hand off after a normal non-empty turn without the marker', () => {
    expect(isPairWorkerHandoffTurn(member('antigravity'), 'summary of work', false)).toBe(true);
  });
  it('keeps asks, monitoring, empty turns and other backends out of the fallback', () => {
    expect(isPairWorkerHandoffTurn(member('antigravity'), 'q\nONNI:ASK', false)).toBe(false);
    expect(isPairWorkerHandoffTurn(member('antigravity'), 'ONNI:MONITORING', false)).toBe(false);
    expect(isPairWorkerHandoffTurn(member('antigravity'), '  ', false)).toBe(false);
    expect(isPairWorkerHandoffTurn(member('claude'), 'summary', false)).toBe(false);
    expect(isPairWorkerHandoffTurn(member('codex'), 'summary', false)).toBe(false);
    expect(isPairWorkerHandoffTurn({ runner: 'antigravity' }, 'summary', false)).toBe(false);
  });
});
