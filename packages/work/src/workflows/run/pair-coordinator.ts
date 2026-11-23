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
  continueRun(runId: string, options: { text: string }, deferForCapacity?: boolean): { ok: boolean; error?: string };
}

export interface PairCoordinatorContext extends PairDeliveryContext {
  dataDir: string;
  repoRoot: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  const pairId = pairIdForRun(context, runId);
  if (!pairId) return null;
  const state = new PairStore(context.dataDir).readState(pairId);
  if (!state || state.phase === 'complete') return null;
  if (state.phase === 'stopped') return state;
  return stopPair(context, pairId, run.error ?? `${run.status === 'cancelled' ? 'cancelled' : 'failed'} — ${run.id}`);
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
    const resumed = context.continueRun(peerRunId, { text }, true);
    if (resumed.ok) return;
  }
  context.store.appendEvent(peerRunId, {
    type: 'note',
    message: failureMessage,
    tone: 'danger',
  });
}

function deliverManagerReport(context: PairCoordinatorContext, managerRunId: string, text: string): void {
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
    const error = 'One & One worker has no current working order to report';
    stopPair(context, membership.pairId, error);
    return { handled: true, ok: false, error };
  }

  const checkpoint = await checkpointPair(state.workspace.repoRoot, pairs, membership.pairId, `worker order ${order.revision}`, excludedPaths);
  if (!checkpoint.ok) {
    stopPair(context, membership.pairId, checkpoint.error ?? 'worker checkpoint failed');
    return { handled: true, ok: false, error: checkpoint.error };
  }
  if (!canReportOrder(pairs, membership.pairId, runId, order.id)) {
    return { handled: true, ok: false, error: 'One & One pair stopped before the worker report could be recorded' };
  }
  const diff = await inspectPairDiff(state.workspace.repoRoot, pairs, membership.pairId);
  if (!diff.ok) {
    stopPair(context, membership.pairId, diff.error ?? 'worker diff inspection failed');
    return { handled: true, ok: false, error: diff.error };
  }
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
    const message = errorText(error);
    stopPair(context, membership.pairId, message);
    return { handled: true, ok: false, error: message };
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
  if (state.phase === 'complete') return { ok: false, error: 'One & One pair is already complete' };
  const valid = await validatePairWorkspace(context.repoRoot, pairs, pairId);
  if (!valid.ok) return valid;
  const current = pairs.readState(pairId);
  if (!current) return { ok: false, error: 'One & One pair state is missing' };
  if (current.phase === 'stopped' || current.phase === 'complete') {
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
