import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PairStore } from '../dispatch/pair-store.ts';
import { removeTempDir } from '../test-fixtures/remove-temp-dir.testkit.ts';
import { deleteHistoricalPair, pairDeletionCandidate, recoverPairDeletions } from './pair-deletion.ts';
import { RunStore } from './store.ts';

const processMocks = vi.hoisted(() => ({
  enabled: vi.fn(() => true),
  reap: vi.fn(),
}));

vi.mock('../core/task-processes.ts', () => ({
  taskProcessReapEnabled: processMocks.enabled,
  reapTaskProcesses: processMocks.reap,
}));

const MANAGER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_ID = '22222222-2222-2222-2222-222222222222';
const PAIR_ID = 'pair-deletion';

describe('historical One & One deletion', () => {
  let root: string;
  let dataDir: string;
  let store: RunStore;
  let pairs: PairStore;
  let pending: Set<string>;
  let manager: {
    hasPendingWork: (runId: string) => boolean;
    forgetSoftAsk: (runId: string) => void;
    stopTaskProcesses: (runId: string) => void;
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'onni-pair-deletion-'));
    execFileSync('git', ['init', '-q', '-b', 'dev'], { cwd: root });
    dataDir = join(root, '.ai', 'onni');
    store = RunStore.open(dataDir);
    pairs = new PairStore(dataDir);
    store.createRun({ id: MANAGER_ID, title: 'Manager', task: 'Manage', workflow: '(one-and-one)', steps: [], worktree: false });
    store.createRun({ id: WORKER_ID, title: 'Worker', task: 'Work', workflow: '(one-and-one)', steps: [], worktree: false });
    const state = pairs.create({
      pairId: PAIR_ID,
      managerRunId: MANAGER_ID,
      workerRunId: WORKER_ID,
      phase: 'complete',
      activeRole: 'manager',
      workspace: { repoRoot: root, branch: 'dev', baselineSha: 'a'.repeat(40) },
      orderRevision: 0,
      handoffs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    store.updateRun(MANAGER_ID, { status: 'done', dispatch: { rootRunId: MANAGER_ID, pair: state } });
    store.updateRun(WORKER_ID, {
      status: 'done',
      dispatch: { rootRunId: MANAGER_ID, parentRunId: MANAGER_ID, pairMember: { pairId: PAIR_ID, role: 'worker', peerRunId: MANAGER_ID } },
    });
    pending = new Set();
    manager = {
      hasPendingWork: vi.fn((runId: string) => pending.has(runId)),
      forgetSoftAsk: vi.fn<(runId: string) => void>(),
      stopTaskProcesses: vi.fn<(runId: string) => void>(),
    };
    processMocks.enabled.mockReturnValue(true);
    processMocks.reap.mockReset();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    store.flush();
    await removeTempDir(root);
  });

  function candidate() {
    const lookup = pairDeletionCandidate(store, manager, dataDir, root, MANAGER_ID);
    if (!lookup.ok) throw new Error(lookup.error);
    return lookup.candidate;
  }

  it('reaps both task processes before removing either run record', async () => {
    processMocks.reap.mockImplementation(async (options) => {
      expect(store.getRun(MANAGER_ID)).toBeDefined();
      expect(store.getRun(WORKER_ID)).toBeDefined();
      expect(options.match(MANAGER_ID)).toBe(true);
      expect(options.match(WORKER_ID)).toBe(true);
      expect(options.stillSettled(MANAGER_ID)).toBe(true);
      expect(options.stillSettled(WORKER_ID)).toBe(true);
      return [];
    });

    await deleteHistoricalPair(store, manager, dataDir, candidate());

    expect(processMocks.reap).toHaveBeenCalledOnce();
    expect(manager.stopTaskProcesses).toHaveBeenCalledTimes(2);
    expect(store.getRun(MANAGER_ID)).toBeUndefined();
    expect(store.getRun(WORKER_ID)).toBeUndefined();
    expect(pairs.snapshot(PAIR_ID)).toBeNull();
  });

  it('rejects new pending work before persisting a deletion intent', async () => {
    const selected = candidate();
    pending.add(WORKER_ID);

    await expect(deleteHistoricalPair(store, manager, dataDir, selected)).rejects.toThrow('Pair changed while deletion was being prepared');

    expect(existsSync(join(dataDir, 'pairs', PAIR_ID, 'deletion.json'))).toBe(false);
    expect(processMocks.reap).not.toHaveBeenCalled();
    expect(store.getRun(MANAGER_ID)).toBeDefined();
    expect(store.getRun(WORKER_ID)).toBeDefined();
  });

  it('revalidates durable records from another cockpit before writing deletion intent', async () => {
    store.flush({ throwOnError: true });
    const otherCockpit = RunStore.open(dataDir);
    otherCockpit.updateRun(WORKER_ID, { status: 'running' });
    otherCockpit.flush({ throwOnError: true });

    await expect(deleteHistoricalPair(store, manager, dataDir, candidate())).rejects.toThrow('Pair changed while deletion was being prepared');

    expect(existsSync(join(dataDir, 'pairs', PAIR_ID, 'deletion.json'))).toBe(false);
    expect(processMocks.reap).not.toHaveBeenCalled();
    expect(store.getRun(MANAGER_ID)).toBeDefined();
    expect(store.getRun(WORKER_ID)?.status).toBe('done');
    expect(otherCockpit.getRun(WORKER_ID)?.status).toBe('running');
    expect(pairs.snapshot(PAIR_ID)).not.toBeNull();
  });

  it('revalidates after process reaping so a continuation race cannot delete live work', async () => {
    processMocks.reap.mockImplementation(async () => {
      pending.add(MANAGER_ID);
      return [];
    });

    await expect(deleteHistoricalPair(store, manager, dataDir, candidate())).rejects.toThrow('Pair changed while deletion was being prepared');

    expect(existsSync(join(dataDir, 'pairs', PAIR_ID, 'deletion.json'))).toBe(true);
    expect(manager.stopTaskProcesses).not.toHaveBeenCalled();
    expect(store.getRun(MANAGER_ID)).toBeDefined();
    expect(store.getRun(WORKER_ID)).toBeDefined();
  });

  it('reaps validated ids during recovery even when one record is already gone', async () => {
    await expect(pairs.delete(PAIR_ID, {
      managerRunId: MANAGER_ID, workerRunId: WORKER_ID, repoRoot: root,
    }, () => {
      store.deleteRun(WORKER_ID);
      throw new Error('interrupted');
    })).rejects.toThrow('interrupted');
    processMocks.reap.mockImplementation(async (options) => {
      expect(options.match(MANAGER_ID)).toBe(true);
      expect(options.match(WORKER_ID)).toBe(true);
      expect(options.stillSettled(MANAGER_ID)).toBe(true);
      expect(options.stillSettled(WORKER_ID)).toBe(true);
      return [];
    });

    await recoverPairDeletions(store, manager, dataDir);

    expect(processMocks.reap).toHaveBeenCalledOnce();
    expect(store.getRun(MANAGER_ID)).toBeUndefined();
    expect(pairs.snapshot(PAIR_ID)).toBeNull();
  });

  it('fails closed on a traversal run id without touching the shared checkout', async () => {
    const unsafeId = '../../../sentinel';
    const sentinel = join(root, 'sentinel');
    writeFileSync(sentinel, 'keep\n');
    const unsafePairId = 'unsafe-pair';
    const state = pairs.create({
      pairId: unsafePairId,
      managerRunId: unsafeId,
      phase: 'complete',
      activeRole: 'manager',
      workspace: { repoRoot: root, branch: 'dev', baselineSha: 'a'.repeat(40) },
      orderRevision: 0,
      handoffs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    writeFileSync(join(dataDir, 'pairs', unsafePairId, 'deletion.json'), JSON.stringify({
      pairId: unsafePairId,
      managerRunId: state.managerRunId,
      repoRoot: root,
      createdAt: new Date().toISOString(),
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await recoverPairDeletions(store, manager, dataDir);

    expect(processMocks.reap).not.toHaveBeenCalled();
    expect(manager.stopTaskProcesses).not.toHaveBeenCalled();
    expect(existsSync(sentinel)).toBe(true);
    expect(existsSync(join(dataDir, 'pairs', unsafePairId, 'state.json'))).toBe(true);
  });
});
