import { statSync } from 'node:fs';
import { PairStore } from '../../dispatch/pair-store.ts';
import { resolveRunEventsPath } from '../../runs/store.ts';
import { relayPairWorkerFailure, type PairDeliveryContext } from './pair-coordinator.ts';

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
 * whose order is queued or working.
 */
export function reconcileOpenPairs(context: PairReconcileContext, memory: PairReconcileMemory, now = Date.now()): void {
  const pairs = new PairStore(context.dataDir);
  const seen = new Set<string>();
  for (const manager of context.store.listRuns()) {
    const pair = manager.dispatch?.pair;
    if (!pair || manager.dispatch?.rootRunId !== manager.id) continue;
    if (pair.phase !== 'worker_queued' && pair.phase !== 'worker_working') continue;
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
  if (!order || (order.status !== 'queued' && order.status !== 'working')) return;
  const workerId = state.workerRunId;
  const worker = context.store.getRun(workerId);
  if (!worker) return;
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
  if (worker.status !== 'running') return;

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
