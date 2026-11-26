import { statSync } from 'node:fs';
import { PairStore } from '../../dispatch/pair-store.ts';
import { resolveRunEventsPath } from '../../runs/store.ts';
import {
  deliverPendingPairReport,
  PAIR_WORKER_HANDOFF_INCOMPLETE_ERROR,
  relayPairWorkerFailure,
  type PairDeliveryContext,
} from './pair-coordinator.ts';
import { mirrorPairState } from './pair-runtime.ts';

/** A worker that has had no live owner for this long (two sweeps) is a ghost, not a start race. */
const GHOST_GRACE_MS = 30_000;
/** Silence on a live worker is only reported, never killed: a long build or test emits nothing. */
const SILENT_NOTICE_MS = 20 * 60_000;

export interface PairReconcileContext extends PairDeliveryContext {
  dataDir: string;
  /** Does anything in this process still own the run (live session, start in flight, queue)? */
  isLive(runId: string): boolean;
}

/** Per-worker memory between sweeps; process-local on purpose, a restart starts a fresh epoch. */
export interface PairReconcileMemory {
  ghostSince: Map<string, number>;
  silentNoted: Set<string>;
}

export function createPairReconcileMemory(): PairReconcileMemory {
  return { ghostSince: new Map(), silentNoted: new Set() };
}

function lastActivityMs(dataDir: string, runId: string): number | undefined {
  try {
    const path = resolveRunEventsPath(dataDir, runId);
    return path ? statSync(path).mtimeMs : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The manager waits on an order, so the worker's end must never go unreported. The event-driven
 * relay can miss (a swallowed error, a restart, a run that stopped owning its session), so this
 * sweep checks the invariant itself: an open pair whose current order is in flight must have a
 * worker that is either alive or already reported. Idempotent, and cheap: it only touches pairs
 * whose order is queued, working, or was reported just before a process interruption.
 */
export function reconcileOpenPairs(context: PairReconcileContext, memory: PairReconcileMemory, now = Date.now()): void {
  const pairs = new PairStore(context.dataDir);
  const seen = new Set<string>();
  for (const manager of context.store.listRuns()) {
    const pair = manager.dispatch?.pair;
    if (!pair || manager.dispatch?.rootRunId !== manager.id) continue;
    if (pair.phase === 'stopped' || pair.phase === 'complete' || pair.phase === 'user_wait') continue;
    try {
      reconcileWorker(context, memory, pairs, manager.id, now, seen);
    } catch { /* one broken pair must not stop the sweep for the rest */ }
  }
  for (const runId of [...memory.ghostSince.keys()]) if (!seen.has(runId)) memory.ghostSince.delete(runId);
  for (const runId of [...memory.silentNoted]) if (!seen.has(runId)) memory.silentNoted.delete(runId);
}

function reconcileWorker(
  context: PairReconcileContext,
  memory: PairReconcileMemory,
  pairs: PairStore,
  pairId: string,
  now: number,
  seen: Set<string>,
): void {
  const state = pairs.readState(pairId);
  if (!state || state.phase === 'stopped' || state.phase === 'complete' || !state.workerRunId || !state.currentOrderId) return;
  const order = pairs.getOrder(pairId, state.currentOrderId);
  const workerId = state.workerRunId;
  const worker = context.store.getRun(workerId);
  if (!worker) return;

  if (order?.status === 'accepted' && state.phase === 'manager_review') {
    pairs.acceptOrder(pairId, { orderId: order.id });
    const acceptedState = pairs.readState(pairId);
    if (acceptedState) mirrorPairState(context.store, acceptedState);
    return;
  }

  if (order?.status === 'reported') {
    if (state.phase === 'manager_review') {
      mirrorPairState(context.store, state);
      deliverPendingPairReport(context, pairId, now);
      return;
    }
    if (state.phase !== 'worker_working' || !order.report || context.isLive(workerId)) return;
    // Recover the crash window where orders.json was written but state.json still says
    // worker_working. reportOrder is idempotent and completes this transition under the pair lock.
    pairs.reportOrder(pairId, order.id, order.report);
    const repairedState = pairs.readState(pairId);
    if (
      !repairedState
      || repairedState.workerRunId !== workerId
      || repairedState.currentOrderId !== order.id
      || repairedState.phase !== 'manager_review'
    ) return;
    const next = mirrorPairState(context.store, repairedState);
    const recoveredAt = new Date().toISOString();
    const failedOnlyByGuard = worker.status === 'failed' && worker.error === PAIR_WORKER_HANDOFF_INCOMPLETE_ERROR;
    if (order.reportOutcome !== 'failed' && !order.report?.startsWith('WORKER ENDED EARLY') && (worker.status === 'running' || failedOnlyByGuard)) {
      for (const step of worker.steps) {
        if (step.status === 'running' || step.status === 'waiting' || (failedOnlyByGuard && step.error === PAIR_WORKER_HANDOFF_INCOMPLETE_ERROR)) {
          context.store.updateStep(workerId, step.id, { status: 'done', error: undefined, finishedAt: recoveredAt });
        }
      }
      context.store.updateRun(workerId, {
        status: 'done',
        completionReason: 'completed',
        error: undefined,
        finishedAt: worker.finishedAt ?? recoveredAt,
        currentStepId: undefined,
      });
      context.store.appendEvent(workerId, {
        type: 'lifecycle',
        message: 'One & One recovered the persisted worker report after an interrupted handoff',
      });
    }
    context.store.appendEvent(next.managerRunId, {
      type: 'note',
      message: `One & One recovered the persisted worker report for order ${order.id.slice(0, 8)}`,
    });
    deliverPendingPairReport(context, pairId, now);
    seen.add(workerId);
    return;
  }

  if (!order || (order.status !== 'queued' && order.status !== 'working')) return;
  seen.add(workerId);

  if (worker.status === 'failed' || worker.status === 'cancelled') {
    // A provider retry owns a failed worker that is scheduled to resume.
    if (worker.autoResumeAt !== undefined) return;
    context.store.appendEvent(state.managerRunId, {
      type: 'note',
      message: `One & One worker ${workerId.slice(0, 8)} is ${worker.status} but the manager was never told — reporting it now`,
      tone: 'danger',
    });
    relayPairWorkerFailure(context, workerId);
    return;
  }
  if (worker.autoResumeAt !== undefined || (worker.status !== 'running' && worker.status !== 'waiting')) return;

  if (!context.isLive(workerId)) {
    const since = memory.ghostSince.get(workerId) ?? now;
    memory.ghostSince.set(workerId, since);
    if (now - since < GHOST_GRACE_MS) return;
    memory.ghostSince.delete(workerId);
    const finishedAt = new Date(now).toISOString();
    context.store.updateRun(workerId, {
      status: 'failed',
      error: 'the worker lost its session — no live process owns this run',
      finishedAt,
      currentStepId: undefined,
    });
    context.store.appendEvent(workerId, { type: 'lifecycle', message: 'run stopped — no live process owns this worker; reporting it to the manager', tone: 'danger' });
    relayPairWorkerFailure(context, workerId);
    return;
  }
  memory.ghostSince.delete(workerId);

  const active = lastActivityMs(context.dataDir, workerId);
  if (active === undefined || now - active < SILENT_NOTICE_MS) {
    memory.silentNoted.delete(workerId);
    return;
  }
  if (memory.silentNoted.has(workerId)) return;
  memory.silentNoted.add(workerId);
  const minutes = Math.round((now - active) / 60_000);
  const message = `One & One worker ${workerId.slice(0, 8)} has been silent for ${minutes} min while its order is still open — it may be hung; stop it from the cockpit to have the failure reported`;
  context.store.appendEvent(workerId, { type: 'note', message, tone: 'danger' });
  context.store.appendEvent(state.managerRunId, { type: 'note', message, tone: 'danger' });
}
