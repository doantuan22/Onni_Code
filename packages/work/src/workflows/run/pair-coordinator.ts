import type { PairState } from '@onni/contract';
import { PairStore, PairStoreError } from '../../dispatch/pair-store.ts';
import type { RunStore } from '../../runs/store.ts';
import type { PastedContent } from './preparation.ts';
import type { PairWorkerTurnResult } from './internal-types.ts';
import {
  checkpointPair,
  inspectPairDiff,
  isPairMember,
  isPairRoot,
  mirrorPairState,
  validatePairWorkspace,
} from './pair-runtime.ts';

export interface PairDeliveryContext {
  store: RunStore;
  active: { has(runId: string): boolean };
  deliverMessage(runId: string, content: PastedContent[], userAuthored: boolean): boolean;
  deferMessage(runId: string, content: PastedContent[]): boolean;
  continueRun(runId: string, options: { text: string; resumeWaitingPair?: boolean }, deferForCapacity?: boolean): { ok: boolean; error?: string };
}

export interface PairCoordinatorContext extends PairDeliveryContext {
  dataDir: string;
  repoRoot: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Does this turn hand the order to the manager? `ONNI:DONE` is the contract, but `agy` ends in a
 * plain text summary and often omits it — without this fallback the order is never reported and
 * the worker fails as "stopped before its current order was checkpointed". Asks and monitoring
 * markers still win, and an empty turn is not a handoff.
 */
export function isPairWorkerHandoffTurn(
  run: { runner?: string; dispatch?: { pairMember?: unknown } } | null | undefined,
  turnText: string,
  endsWithDone: boolean,
): boolean {
  if (!isPairMember(run)) return false;
  if (endsWithDone) return true;
  return run?.runner === 'antigravity'
    && turnText.trim() !== ''
    && !/ONNI:(ASK|MONITORING)/.test(turnText);
}

function canReportOrder(pairs: PairStore, pairId: string, workerRunId: string, orderId: string): boolean {
  const state = pairs.readState(pairId);
  const order = state?.currentOrderId === orderId ? pairs.getOrder(pairId, orderId) : null;
  return Boolean(
    state
    && state.phase !== 'stopped'
    && state.phase !== 'complete'
    && state.workerRunId === workerRunId
    && order?.status === 'working',
  );
}

export function stopPair(context: Pick<PairCoordinatorContext, 'store' | 'dataDir'>, pairId: string, error: string): PairState | null {
  const pairs = new PairStore(context.dataDir);
  const state = pairs.readState(pairId);
  if (!state || state.phase === 'complete' || state.phase === 'stopped') return state;
  let stopped: PairState;
  try {
    stopped = pairs.transition(pairId, 'stopped', 'manager');
  } catch {
    stopped = pairs.updateState(pairId, { phase: 'stopped', activeRole: 'manager' });
  }
  mirrorPairState(context.store, stopped);
  context.store.appendEvent(state.managerRunId, {
    type: 'note',
    message: `One & One stopped — ${error}`,
    tone: 'danger',
  });
  return stopped;
}

/**
 * A run whose pair is still open. Inactivity must never end such a run as `failed`: that would
 * stop the whole pair and cancel the peer, so the user could not keep chatting with the manager.
 */
export function isLivePairParticipant(context: Pick<PairCoordinatorContext, 'store' | 'dataDir'>, runId: string): boolean {
  const pairId = pairIdForRun(context, runId);
  if (!pairId) return false;
  const run = context.store.getRun(runId);
  const phase = isPairRoot(run) ? run?.dispatch?.pair?.phase : new PairStore(context.dataDir).readState(pairId)?.phase;
  return phase !== undefined && phase !== 'stopped' && phase !== 'complete';
}

function pairIdForRun(context: Pick<PairCoordinatorContext, 'store'>, runId: string): string | undefined {
  const dispatch = context.store.getRun(runId)?.dispatch;
  return dispatch?.pair?.pairId ?? dispatch?.pairMember?.pairId;
}

export function stopPairForCancellation(
  context: Pick<PairCoordinatorContext, 'store' | 'dataDir'>,
  runId: string,
): PairState | null {
  const pairId = pairIdForRun(context, runId);
  if (!pairId) return null;
  const state = new PairStore(context.dataDir).readState(pairId);
  if (!state || state.phase === 'complete') return null;
  if (state.phase === 'stopped') return state;
  return stopPair(context, pairId, `run ${runId} was cancelled`);
}

export function stopTerminalPair(
  context: Pick<PairCoordinatorContext, 'store' | 'dataDir'>,
  runId: string,
  resuming: boolean,
): PairState | null {
  const run = context.store.getRun(runId);
  if (!run || (run.status !== 'failed' && run.status !== 'cancelled') || resuming) return null;
  // A failed manager is Continue-able like any manager: leave the pair open for it.
  // The same holds for a manager the user stopped: only the explicit end of the pair stops it.
  if (isPairRoot(run)) return null;
  // A worker that ended is reported to the manager (`relayPairWorkerFailure`), never a reason to
  // stop the pair: only the explicit stop-all ends it.
  return null;
}

const WORKER_ENDED_MARKER = 'WORKER ENDED EARLY';

/**
 * A failed worker is a failed order, not a failed pair. Record it as the order's report and hand
 * it to the manager, which keeps its session so the user can keep chatting and the manager can
 * issue a revised order (that resumes this same worker). Returns false when the pair cannot take
 * the report (stopped, manager gone, no live order) so the caller falls back to stopping it.
 */
export function relayPairWorkerFailure(context: PairDeliveryContext & { dataDir: string }, runId: string): boolean {
  const run = context.store.getRun(runId);
  const pairId = run?.dispatch?.pairMember?.pairId;
  if (!run || (run.status !== 'failed' && run.status !== 'cancelled') || !pairId) return false;
  const pairs = new PairStore(context.dataDir);
  const state = pairs.readState(pairId);
  if (!state || state.phase === 'stopped' || state.phase === 'complete') return false;
  // A worker the manager already replaced is history; its end must not touch the pair.
  if (state.workerRunId !== runId) return true;
  // A manager the user stopped still owns the pair: the report is saved for its next turn.
  if (!context.store.getRun(state.managerRunId)) return false;
  const order = state.currentOrderId ? pairs.getOrder(pairId, state.currentOrderId) : null;
  if (!order) {
    context.store.appendEvent(state.managerRunId, { type: 'note', message: `One & One worker ${runId.slice(0, 8)} ended (${run.status}) with no order in flight — the pair stays open`, tone: 'danger' });
    return true;
  }
  // Idempotent: the cancel path and the teardown both ask, and the second must not stop the pair.
  if (order?.status === 'reported' && order.report?.startsWith(WORKER_ENDED_MARKER)) return true;
  if (order.status !== 'queued' && order.status !== 'working') {
    context.store.appendEvent(state.managerRunId, { type: 'note', message: `One & One worker ${runId.slice(0, 8)} ended (${run.status}) after its order was already reported — the pair stays open`, tone: 'danger' });
    return true;
  }
  const stopped = run.status === 'cancelled';
  const reason = context.store.redactRunText(runId, run.error ?? (stopped ? 'the worker was stopped by the user' : 'the worker run failed')).slice(0, 2_000);
  try {
    if (order.status === 'queued') pairs.markOrderWorking(pairId, order.id);
    pairs.reportOrder(pairId, order.id, `${WORKER_ENDED_MARKER} (${stopped ? 'stopped' : 'failed'}) before finishing this order: ${reason}`);
    const next = mirrorPairState(context.store, pairs.readState(pairId)!);
    context.store.appendEvent(runId, { type: 'note', message: 'One & One worker failed — reported to the manager; the pair stays open', tone: 'danger' });
    context.store.appendEvent(next.managerRunId, { type: 'note', message: `One & One worker failed on order ${order.id.slice(0, 8)} — the manager decides how to continue`, tone: 'danger' });
    // The report is saved in the pair state either way; a delivery hiccup must not stop the pair.
    try {
      deliverManagerReport(context, next.managerRunId, [
        `One & One WORKER ${stopped ? 'STOPPED' : 'FAILED'} — order ${order.id} (revision ${order.revision})`,
        `Reason: ${reason}`,
        '',
        'The worker did not finish this order and nothing was checkpointed. Its partial edits may remain uncommitted in the shared checkout: inspect `git status` and `git diff` read-only.',
        'Do not accept this order. Either issue a new order with onni task create (Onni starts a fresh worker session), or explain the situation to the user and wait for their instruction.',
      ].join('\n'));
    } catch { /* the saved report is still readable with `onni task pair show` */ }
    return true;
  } catch (error) {
    // The pair state could not be updated (e.g. the repository lease is still held); the manager
    // must still be told the worker ended, so record a note that survives the failed mutation.
    context.store.appendEvent(state.managerRunId, {
      type: 'note',
      message: `One & One worker ${runId.slice(0, 8)} ended (${run.status}) but the pair could not record it — ${errorText(error)}`,
      tone: 'danger',
    });
    return false;
  }
}

export function pairPeerRunId(state: PairState, runId: string): string | undefined {
  return runId === state.managerRunId ? state.workerRunId : state.managerRunId;
}

export function deliverPairPeerText(context: PairDeliveryContext, peerRunId: string, text: string, failureMessage: string): void {
  const blocks: PastedContent[] = [{ type: 'text', text }];
  if (context.deliverMessage(peerRunId, blocks, false)) return;
  if (context.deferMessage(peerRunId, blocks)) return;
  const peer = context.store.getRun(peerRunId);
  if (peer && peer.status !== 'cancelled' && peer.status !== 'failed' && !context.active.has(peerRunId)) {
    const resumed = context.continueRun(peerRunId, { text, resumeWaitingPair: true }, true);
    if (resumed.ok) return;
  }
  context.store.appendEvent(peerRunId, {
    type: 'note',
    message: failureMessage,
    tone: 'danger',
  });
}

function deliverManagerReport(context: PairDeliveryContext, managerRunId: string, text: string): void {
  deliverPairPeerText(context, managerRunId, text, 'One & One worker report is saved, but the manager could not be resumed automatically');
}

export async function handlePairWorkerTurn(
  context: PairCoordinatorContext,
  runId: string,
  turnText: string,
  excludedPaths: readonly string[],
): Promise<PairWorkerTurnResult> {
  const worker = context.store.getRun(runId);
  const membership = worker?.dispatch?.pairMember;
  if (!membership) return { handled: false, ok: true };
  const pairs = new PairStore(context.dataDir);
  const state = pairs.readState(membership.pairId);
  const order = state?.currentOrderId ? pairs.getOrder(membership.pairId, state.currentOrderId) : null;
  if (!state || !order || state.workerRunId !== runId || order.status !== 'working') {
    // The worker run fails and `relayPairWorkerFailure` tells the manager; the pair stays open.
    return { handled: true, ok: false, error: 'One & One worker has no current working order to report' };
  }

  const checkpoint = await checkpointPair(state.workspace.repoRoot, pairs, membership.pairId, `worker order ${order.revision}`, excludedPaths);
  // A failed handoff fails the worker run, not the pair: `relayPairWorkerFailure` hands the
  // failure to the manager, who may start a new worker.
  if (!checkpoint.ok) return { handled: true, ok: false, error: checkpoint.error ?? 'worker checkpoint failed' };
  if (!canReportOrder(pairs, membership.pairId, runId, order.id)) {
    return { handled: true, ok: false, error: 'One & One pair stopped before the worker report could be recorded' };
  }
  const diff = await inspectPairDiff(state.workspace.repoRoot, pairs, membership.pairId);
  if (!diff.ok) return { handled: true, ok: false, error: diff.error ?? 'worker diff inspection failed' };
  if (!canReportOrder(pairs, membership.pairId, runId, order.id)) {
    return { handled: true, ok: false, error: 'One & One pair stopped before the worker report could be recorded' };
  }

  const report = context.store.redactRunText(runId, turnText).trim().slice(0, 20_000)
    || 'Worker completed the order without a written report.';
  try {
    pairs.reportOrder(membership.pairId, order.id, report);
    const next = mirrorPairState(context.store, pairs.readState(membership.pairId)!);
    context.store.appendEvent(runId, {
      type: 'note',
      message: `One & One order ${order.id.slice(0, 8)} checkpointed at ${checkpoint.sha?.slice(0, 8) ?? 'HEAD'} and handed to the manager`,
    });
    context.store.appendEvent(next.managerRunId, {
      type: 'note',
      message: `One & One worker reported order ${order.id.slice(0, 8)} (revision ${order.revision})`,
    });
    const managerText = [
      `One & One worker report — order ${order.id} (revision ${order.revision})`,
      `Checkpoint: ${checkpoint.sha ?? 'HEAD'}`,
      `Baseline: ${next.workspace.baselineSha}`,
      '',
      report,
      '',
      'Changed files:',
      diff.nameStatus || '(no changed files)',
      '',
      'Diff stat:',
      diff.stat || '(empty)',
      '',
      `Inspect the actual diff read-only with: git diff ${next.workspace.baselineSha}..HEAD`,
      'Do not mutate Git HEAD or the index. Review the implementation, then either issue a revised order with onni task create or accept it with the exact ONNI:PAIR:ACCEPT marker.',
    ].join('\n').slice(0, 30_000);
    deliverManagerReport(context, next.managerRunId, managerText);
    return { handled: true, ok: true };
  } catch (error) {
    return { handled: true, ok: false, error: errorText(error) };
  }
}

export async function preparePairContinuation(
  context: Pick<PairCoordinatorContext, 'store' | 'dataDir' | 'repoRoot'>,
  runId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const run = context.store.getRun(runId);
  const pairMember = isPairMember(run);
  const pairRoot = isPairRoot(run);
  if (!pairMember && !pairRoot) return { ok: true };
  const pairId = pairMember ? run?.dispatch?.pairMember?.pairId : run?.dispatch?.pair?.pairId;
  if (!pairId) return { ok: false, error: 'One & One membership is missing' };
  const pairs = new PairStore(context.dataDir);
  const state = pairs.readState(pairId);
  if (!state) return { ok: false, error: 'One & One pair state is missing' };
  if (state.phase === 'stopped') return { ok: false, error: 'One & One pair is stopped' };
  // A finished pair's manager is reopened by the user's next message (below); its worker is not.
  if (state.phase === 'complete' && pairMember) return { ok: false, error: 'One & One pair is already complete' };
  const valid = await validatePairWorkspace(context.repoRoot, pairs, pairId);
  if (!valid.ok) return valid;
  const current = pairs.readState(pairId);
  if (!current) return { ok: false, error: 'One & One pair state is missing' };
  if (current.phase === 'stopped' || (current.phase === 'complete' && pairMember)) {
    return { ok: false, error: `One & One pair is ${current.phase}` };
  }
  if (pairMember) {
    if (current.workerRunId !== runId || !['worker_queued', 'worker_working'].includes(current.phase)) {
      return { ok: false, error: 'One & One worker may resume only its current queued or working order' };
    }
    const order = current.currentOrderId ? pairs.getOrder(pairId, current.currentOrderId) : null;
    if (!order || !['queued', 'working'].includes(order.status)) {
      return { ok: false, error: 'One & One worker has no resumable order' };
    }
    try {
      if (order.status === 'queued') pairs.markOrderWorking(pairId, order.id);
      mirrorPairState(context.store, pairs.readState(pairId)!);
    } catch (error) {
      return { ok: false, error: errorText(error) };
    }
  } else if (current.phase === 'user_wait' || current.phase === 'complete') {
    // A parked pair manager resumes for the user's next instruction: open a fresh task scope
    // (its own diff baseline and order revision counter) while keeping both runs' context.
    try {
      const opened = pairs.openNextTask(pairId);
      mirrorPairState(context.store, opened);
    } catch (error) {
      return { ok: false, error: errorText(error) };
    }
  } else if (['worker_queued', 'worker_working'].includes(current.phase)) {
    return { ok: false, error: 'The One & One manager must wait for the worker report before continuing' };
  }
  return { ok: true };
}

export async function finalizePairManager(
  context: Pick<PairCoordinatorContext, 'store' | 'dataDir' | 'repoRoot'>,
  runId: string,
  excludedPaths: readonly string[],
): Promise<{ ok: true; state: PairState } | { ok: false; error: string }> {
  const run = context.store.getRun(runId);
  const pairId = run?.dispatch?.pair?.pairId;
  if (!pairId || !isPairRoot(run)) return { ok: false, error: 'One & One manager state is missing' };
  const pairs = new PairStore(context.dataDir);
  const state = pairs.readState(pairId);
  if (!state) return { ok: false, error: 'One & One pair state is missing' };
  if (state.phase === 'complete') return { ok: true, state };
  const order = state.currentOrderId ? pairs.getOrder(pairId, state.currentOrderId) : null;
  if (!order || order.status !== 'accepted' || !['final_check', 'transitioning'].includes(state.phase)) {
    return { ok: false, error: 'One & One cannot complete until the manager accepts the reported order and finishes final checks' };
  }
  try {
    if (state.phase === 'final_check') pairs.transition(pairId, 'transitioning', 'manager');
    const checkpoint = await checkpointPair(context.repoRoot, pairs, pairId, 'manager final check', excludedPaths);
    if (!checkpoint.ok) return { ok: false, error: checkpoint.error ?? 'One & One final checkpoint failed' };
    const current = pairs.readState(pairId);
    const currentOrder = current?.currentOrderId ? pairs.getOrder(pairId, current.currentOrderId) : null;
    if (!current || current.phase === 'stopped' || current.phase === 'complete') {
      return { ok: false, error: `One & One pair is ${current?.phase ?? 'missing'}` };
    }
    if (currentOrder?.status !== 'accepted' || !['final_check', 'transitioning'].includes(current.phase)) {
      return { ok: false, error: 'One & One final checks were superseded before completion' };
    }
    const completed = pairs.transition(pairId, 'complete', 'manager', { completedAt: new Date().toISOString() });
    return { ok: true, state: mirrorPairState(context.store, completed) };
  } catch (error) {
    return { ok: false, error: error instanceof PairStoreError ? error.message : errorText(error) };
  }
}

/**
 * End one task of a long-lived pair: the same final checkpoint as `finalizePairManager`, but the
 * pair parks at `user_wait` instead of `complete` so the manager keeps its context and the user
 * can hand it the next instruction. Only the explicit finish marker closes the pair.
 */
export async function parkPairManager(
  context: Pick<PairCoordinatorContext, 'store' | 'dataDir' | 'repoRoot'>,
  runId: string,
  excludedPaths: readonly string[],
): Promise<{ ok: true; state: PairState } | { ok: false; error: string }> {
  const run = context.store.getRun(runId);
  const pairId = run?.dispatch?.pair?.pairId;
  if (!pairId || !isPairRoot(run)) return { ok: false, error: 'One & One manager state is missing' };
  const pairs = new PairStore(context.dataDir);
  const state = pairs.readState(pairId);
  if (!state) return { ok: false, error: 'One & One pair state is missing' };
  if (state.phase === 'user_wait') return { ok: true, state };
  const order = state.currentOrderId ? pairs.getOrder(pairId, state.currentOrderId) : null;
  if (!order || order.status !== 'accepted' || !['final_check', 'transitioning'].includes(state.phase)) {
    return { ok: false, error: 'One & One cannot park until the manager accepts the reported order and finishes final checks' };
  }
  try {
    if (state.phase === 'final_check') pairs.transition(pairId, 'transitioning', 'manager');
    const checkpoint = await checkpointPair(context.repoRoot, pairs, pairId, 'manager final check', excludedPaths);
    if (!checkpoint.ok) return { ok: false, error: checkpoint.error ?? 'One & One final checkpoint failed' };
    const current = pairs.readState(pairId);
    const currentOrder = current?.currentOrderId ? pairs.getOrder(pairId, current.currentOrderId) : null;
    if (!current || current.phase === 'stopped' || current.phase === 'complete') {
      return { ok: false, error: `One & One pair is ${current?.phase ?? 'missing'}` };
    }
    if (currentOrder?.status !== 'accepted' || !['final_check', 'transitioning'].includes(current.phase)) {
      return { ok: false, error: 'One & One final checks were superseded before parking' };
    }
    const parked = pairs.transition(pairId, 'user_wait', 'manager');
    return { ok: true, state: mirrorPairState(context.store, parked) };
  } catch (error) {
    return { ok: false, error: error instanceof PairStoreError ? error.message : errorText(error) };
  }
}

/**
 * Close a long-lived pair for good. From an accepted order in final checks this is the same
 * final checkpoint as `finalizePairManager`; from an idle park (`planning`/`user_wait`) there is
 * no order to accept, so it only checkpoints any coordination edits and completes. A pair with an
 * order still in flight refuses to finish.
 */
export async function finishPairManager(
  context: Pick<PairCoordinatorContext, 'store' | 'dataDir' | 'repoRoot'>,
  runId: string,
  excludedPaths: readonly string[],
): Promise<{ ok: true; state: PairState } | { ok: false; error: string }> {
  const run = context.store.getRun(runId);
  const pairId = run?.dispatch?.pair?.pairId;
  if (!pairId || !isPairRoot(run)) return { ok: false, error: 'One & One manager state is missing' };
  const pairs = new PairStore(context.dataDir);
  const state = pairs.readState(pairId);
  if (!state) return { ok: false, error: 'One & One pair state is missing' };
  if (state.phase === 'complete') return { ok: true, state };
  const order = state.currentOrderId ? pairs.getOrder(pairId, state.currentOrderId) : null;
  if (order?.status === 'accepted' && ['final_check', 'transitioning'].includes(state.phase)) {
    return finalizePairManager(context, runId, excludedPaths);
  }
  if (state.phase !== 'planning' && state.phase !== 'user_wait') {
    return { ok: false, error: 'One & One cannot finish while an order is still in flight' };
  }
  try {
    pairs.transition(pairId, 'transitioning', 'manager');
    const checkpoint = await checkpointPair(context.repoRoot, pairs, pairId, 'manager finish', excludedPaths);
    if (!checkpoint.ok) return { ok: false, error: checkpoint.error ?? 'One & One final checkpoint failed' };
    const current = pairs.readState(pairId);
    if (!current || current.phase === 'stopped' || current.phase === 'complete') {
      return { ok: false, error: `One & One pair is ${current?.phase ?? 'missing'}` };
    }
    const completed = pairs.transition(pairId, 'complete', 'manager', { completedAt: new Date().toISOString() });
    return { ok: true, state: mirrorPairState(context.store, completed) };
  } catch (error) {
    return { ok: false, error: error instanceof PairStoreError ? error.message : errorText(error) };
  }
}
