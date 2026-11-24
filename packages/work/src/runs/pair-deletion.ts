import { readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { reapTaskProcesses, taskProcessReapEnabled } from '../core/task-processes.ts';
import { treeDir } from '../dispatch/tree-fs.ts';
import { PairStore, PairStoreError } from '../dispatch/pair-store.ts';
import { deleteRunLayouts } from './layouts.ts';
import { isPairRun } from './pair-mutation.ts';
import { isSafeRunId, readRunIndexTombstones, runRecordSchema, type RunRecord, type RunStore } from './store.ts';

const SETTLED_PAIR_STATUSES = new Set(['done', 'failed', 'cancelled']);

export interface PairDeletionManager {
  hasPendingWork(runId: string): boolean;
  forgetSoftAsk(runId: string): void;
  stopTaskProcesses?(runId: string): void;
}

export interface PairDeletionCandidate {
  pairId: string;
  managerRunId: string;
  workerRunId?: string;
  repoRoot: string;
  runIds: string[];
}

export type PairDeletionLookup =
  | { ok: true; candidate: PairDeletionCandidate }
  | { ok: false; status: 404 | 409; error: string };

function assertSafePairCandidate(candidate: PairDeletionCandidate): void {
  const expectedRunIds = candidate.workerRunId === undefined
    ? [candidate.managerRunId]
    : [candidate.workerRunId, candidate.managerRunId];
  if (
    !isSafeRunId(candidate.managerRunId)
    || (candidate.workerRunId !== undefined && !isSafeRunId(candidate.workerRunId))
    || candidate.runIds.length !== expectedRunIds.length
    || candidate.runIds.some((runId, index) => runId !== expectedRunIds[index])
  ) throw new PairStoreError('Invalid One & One deletion candidate');
}

export function pairDeletionCandidate(
  store: RunStore,
  manager: PairDeletionManager,
  dataDir: string,
  repoRoot: string,
  runId: string,
): PairDeletionLookup {
  const caller = store.getRun(runId);
  if (!caller) return { ok: false, status: 404, error: 'not found' };
  if (!isPairRun(caller)) return { ok: false, status: 409, error: 'run is not part of a One & One pair' };
  const rootPairId = caller.dispatch?.pair?.pairId;
  const memberPairId = caller.dispatch?.pairMember?.pairId;
  if (rootPairId && memberPairId && rootPairId !== memberPairId) {
    return { ok: false, status: 409, error: 'run references more than one pair' };
  }
  const pairId = rootPairId ?? memberPairId;
  if (!pairId) return { ok: false, status: 409, error: 'run is not part of a One & One pair' };
  const state = new PairStore(dataDir).readState(pairId);
  if (!state) return { ok: false, status: 409, error: 'pair state is missing or corrupt' };
  if (!isSafeRunId(state.managerRunId) || (state.workerRunId !== undefined && !isSafeRunId(state.workerRunId))) {
    return { ok: false, status: 409, error: 'pair state contains an invalid run id' };
  }
  if (state.phase !== 'complete' && state.phase !== 'stopped') {
    return { ok: false, status: 409, error: 'only a completed or stopped One & One pair can be deleted' };
  }
  if (resolve(state.workspace.repoRoot) !== resolve(repoRoot)) {
    return { ok: false, status: 409, error: 'pair repository does not match this project' };
  }
  if (caller.id !== state.managerRunId && caller.id !== state.workerRunId) {
    return { ok: false, status: 409, error: 'run does not belong to this pair' };
  }

  const runs = store.listRuns();
  const managerRun = store.getRun(state.managerRunId);
  if (!managerRun) return { ok: false, status: 409, error: 'pair manager record is missing' };
  const workerRun = state.workerRunId === undefined ? undefined : store.getRun(state.workerRunId);
  if (state.workerRunId !== undefined && !workerRun) {
    return { ok: false, status: 409, error: 'pair worker record is missing' };
  }
  const embedded = managerRun.dispatch?.pair;
  if (
    managerRun.dispatch?.rootRunId !== managerRun.id
    || managerRun.dispatch?.pairMember !== undefined
    || embedded?.pairId !== state.pairId
    || embedded.managerRunId !== state.managerRunId
    || embedded.workerRunId !== state.workerRunId
  ) return { ok: false, status: 409, error: 'pair manager identity does not match persistent state' };
  if (workerRun && (
    workerRun.dispatch?.rootRunId !== managerRun.id
    || workerRun.dispatch?.parentRunId !== managerRun.id
    || workerRun.dispatch?.pair !== undefined
    || workerRun.dispatch?.pairMember?.pairId !== state.pairId
    || workerRun.dispatch?.pairMember?.role !== 'worker'
    || workerRun.dispatch?.pairMember?.peerRunId !== managerRun.id
  )) return { ok: false, status: 409, error: 'pair worker identity does not match persistent state' };

  const peers = workerRun ? [managerRun, workerRun] : [managerRun];
  for (const peer of peers) {
    if (!SETTLED_PAIR_STATUSES.has(peer.status)) {
      return { ok: false, status: 409, error: 'pair peers must be done, failed or cancelled before deletion' };
    }
    if (peer.worktree !== false || peer.worktreePath !== undefined || peer.branch !== undefined) {
      return { ok: false, status: 409, error: 'pair deletion will not remove a worktree or branch' };
    }
    if (peer.autoResumeAt !== undefined || manager.hasPendingWork(peer.id)) {
      return { ok: false, status: 409, error: 'pair still has pending work' };
    }
  }
  const allowed = new Set(peers.map((peer) => peer.id));
  if (runs.some((run) =>
    !allowed.has(run.id) && (run.dispatch?.rootRunId === managerRun.id || run.dispatch?.parentRunId === managerRun.id),
  )) return { ok: false, status: 409, error: 'pair has additional descendant records' };

  return {
    ok: true,
    candidate: {
      pairId,
      managerRunId: managerRun.id,
      ...(workerRun ? { workerRunId: workerRun.id } : {}),
      repoRoot: state.workspace.repoRoot,
      runIds: workerRun ? [workerRun.id, managerRun.id] : [managerRun.id],
    },
  };
}

function readDurablePairRuns(dataDir: string): RunRecord[] {
  try {
    const parsed = z.array(runRecordSchema).safeParse(JSON.parse(readFileSync(join(dataDir, 'runs.json'), 'utf8')));
    if (!parsed.success) throw new PairStoreError('Pair deletion could not validate durable run records');
    const tombstones = readRunIndexTombstones(dataDir);
    return parsed.data.filter((run) => !tombstones.has(run.id));
  } catch (error) {
    if (error instanceof PairStoreError) throw error;
    throw new PairStoreError('Pair deletion could not read durable run records');
  }
}

function assertPairRecords(
  runs: readonly RunRecord[],
  candidate: PairDeletionCandidate,
  hasPendingWork: (runId: string) => boolean,
): void {
  const allowed = new Set(candidate.runIds);
  const byId = new Map(runs.map((run) => [run.id, run]));
  const managerRun = byId.get(candidate.managerRunId);
  if (managerRun && (
    managerRun.dispatch?.rootRunId !== candidate.managerRunId
    || managerRun.dispatch?.pairMember !== undefined
    || managerRun.dispatch?.pair?.pairId !== candidate.pairId
    || managerRun.dispatch?.pair?.managerRunId !== candidate.managerRunId
    || managerRun.dispatch?.pair?.workerRunId !== candidate.workerRunId
  )) throw new PairStoreError('Pair manager identity changed during deletion');
  const workerRun = candidate.workerRunId === undefined ? undefined : byId.get(candidate.workerRunId);
  if (workerRun && (
    workerRun.dispatch?.rootRunId !== candidate.managerRunId
    || workerRun.dispatch?.parentRunId !== candidate.managerRunId
    || workerRun.dispatch?.pair !== undefined
    || workerRun.dispatch?.pairMember?.pairId !== candidate.pairId
    || workerRun.dispatch?.pairMember?.role !== 'worker'
    || workerRun.dispatch?.pairMember?.peerRunId !== candidate.managerRunId
  )) throw new PairStoreError('Pair worker identity changed during deletion');
  for (const runId of allowed) {
    const run = byId.get(runId);
    if (!run) continue;
    if (
      !SETTLED_PAIR_STATUSES.has(run.status)
      || run.worktree !== false
      || run.worktreePath !== undefined
      || run.branch !== undefined
      || run.autoResumeAt !== undefined
      || hasPendingWork(runId)
    ) throw new PairStoreError('Pair changed while deletion was being prepared');
  }
  if (runs.some((run) =>
    !allowed.has(run.id) && (run.dispatch?.rootRunId === candidate.managerRunId || run.dispatch?.parentRunId === candidate.managerRunId),
  )) throw new PairStoreError('Pair gained an additional descendant during deletion');
}

function assertRemainingPairRecords(
  store: RunStore,
  manager: PairDeletionManager,
  candidate: PairDeletionCandidate,
  dataDir: string,
): void {
  assertSafePairCandidate(candidate);
  assertPairRecords(store.listRuns(), candidate, (runId) => manager.hasPendingWork(runId));
  assertPairRecords(readDurablePairRuns(dataDir), candidate, () => false);
}

async function reapPairTaskProcesses(
  store: RunStore,
  manager: PairDeletionManager,
  dataDir: string,
  candidate: PairDeletionCandidate,
): Promise<void> {
  if (!taskProcessReapEnabled()) return;
  const ids = new Set(candidate.runIds);
  await reapTaskProcesses({
    match: (runId) => ids.has(runId),
    stillSettled: (runId) => {
      if (!ids.has(runId)) return false;
      try {
        assertRemainingPairRecords(store, manager, candidate, dataDir);
        return true;
      } catch {
        return false;
      }
    },
  });
}

async function removePairRecords(
  store: RunStore,
  manager: PairDeletionManager,
  dataDir: string,
  candidate: PairDeletionCandidate,
): Promise<void> {
  assertRemainingPairRecords(store, manager, candidate, dataDir);
  await reapPairTaskProcesses(store, manager, dataDir, candidate);
  assertRemainingPairRecords(store, manager, candidate, dataDir);
  for (const runId of candidate.runIds) {
    const current = store.getRun(runId);
    if (current && (
      !SETTLED_PAIR_STATUSES.has(current.status)
      || current.worktreePath !== undefined
      || current.branch !== undefined
      || current.autoResumeAt !== undefined
      || manager.hasPendingWork(runId)
    )) throw new PairStoreError('Pair changed while deletion was being prepared');
    manager.stopTaskProcesses?.(runId);
    manager.forgetSoftAsk(runId);
    deleteRunLayouts(dataDir, runId);
    store.deleteRun(runId);
  }
  rmSync(treeDir(dataDir, candidate.managerRunId), { recursive: true, force: true });
  store.flush({ throwOnError: true });
}

export async function deleteHistoricalPair(
  store: RunStore,
  manager: PairDeletionManager,
  dataDir: string,
  candidate: PairDeletionCandidate,
): Promise<void> {
  store.flush({ throwOnError: true });
  await new PairStore(dataDir).delete(candidate.pairId, {
    managerRunId: candidate.managerRunId,
    ...(candidate.workerRunId !== undefined ? { workerRunId: candidate.workerRunId } : {}),
    repoRoot: candidate.repoRoot,
  }, () => removePairRecords(store, manager, dataDir, candidate), () => {
    assertRemainingPairRecords(store, manager, candidate, dataDir);
  });
}

export async function recoverPairDeletions(
  store: RunStore,
  manager: PairDeletionManager,
  dataDir: string,
): Promise<void> {
  await new PairStore(dataDir).recoverDeletions((intent) => removePairRecords(store, manager, dataDir, {
    pairId: intent.pairId,
    managerRunId: intent.managerRunId,
    ...(intent.workerRunId !== undefined ? { workerRunId: intent.workerRunId } : {}),
    repoRoot: intent.repoRoot,
    runIds: intent.workerRunId ? [intent.workerRunId, intent.managerRunId] : [intent.managerRunId],
  }), (intent) => {
    assertRemainingPairRecords(store, manager, {
      pairId: intent.pairId,
      managerRunId: intent.managerRunId,
      ...(intent.workerRunId !== undefined ? { workerRunId: intent.workerRunId } : {}),
      repoRoot: intent.repoRoot,
      runIds: intent.workerRunId ? [intent.workerRunId, intent.managerRunId] : [intent.managerRunId],
    }, dataDir);
  });
}
