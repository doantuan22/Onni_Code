import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Roster } from '@onni/contract';
import { PairStore } from '../../dispatch/pair-store.ts';
import { pairDeletionCandidate } from '../../runs/pair-deletion.ts';
import { RunStore } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import { WorkspaceSemaphore } from '../../workspace/semaphore.ts';
import { RunManager } from '../run.ts';
import { initializePair } from './pair-runtime.ts';

const MANAGER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_ID = '22222222-2222-2222-2222-222222222222';

function git(root: string, ...args: string[]): void {
  execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
}

const roster: Roster = {
  mode: 'one-and-one',
  manager: { runner: 'claude', model: 'opus' },
  workers: [{ runner: 'codex', model: 'gpt-5', role: 'implementation', maxConcurrent: 1 }],
};

describe('a One & One pair whose runs already ended', () => {
  let root: string;
  let dataDir: string;
  let store: RunStore;
  let manager: RunManager;
  let pairs: PairStore;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'onni-pair-settle-repo-'));
    dataDir = join(root, '.ai', 'onni');
    git(root, 'init', '-b', 'dev');
    git(root, 'config', 'user.name', 'Onni Test');
    git(root, 'config', 'user.email', 'onni@test.local');
    writeFileSync(join(root, 'README.md'), 'base\n', 'utf8');
    git(root, 'add', 'README.md');
    git(root, 'commit', '-m', 'base');
    store = RunStore.open(dataDir);
    manager = new RunManager(store, root, { semaphore: new WorkspaceSemaphore({ initial: { maxParallel: 0 } }) });
    pairs = new PairStore(dataDir);
    store.createRun({ id: MANAGER_ID, title: 'Manager', workflow: '(one-and-one)', task: 'Coordinate', worktree: false, steps: [] });
    store.createRun({ id: WORKER_ID, title: 'Worker', workflow: '(one-and-one)', task: 'Implement', autonomous: true, worktree: false, steps: [] });
    store.updateRun(MANAGER_ID, { roster, dispatch: { rootRunId: MANAGER_ID } });
    store.updateRun(WORKER_ID, { dispatch: { rootRunId: MANAGER_ID, parentRunId: MANAGER_ID, pairMember: { pairId: MANAGER_ID, role: 'worker', peerRunId: MANAGER_ID } } });
    const initialized = await initializePair(root, store, pairs, MANAGER_ID);
    if (!initialized.ok) throw new Error(initialized.error);
    pairs.setWorker(MANAGER_ID, WORKER_ID);
    const order = pairs.enqueueOrder(MANAGER_ID, { objective: 'Implement the feature' });
    pairs.markOrderWorking(MANAGER_ID, order.id);
    store.updateRun(MANAGER_ID, { dispatch: { rootRunId: MANAGER_ID, pair: pairs.readState(MANAGER_ID)! } });
  });

  afterEach(async () => {
    manager.dispose();
    store.flush();
    await removeTempDir(root);
  });

  const lookup = () => pairDeletionCandidate(store, {
    hasPendingWork: (id: string) => manager.hasPendingWork(id),
    forgetSoftAsk: () => undefined,
    stopTaskProcesses: () => undefined,
  } as never, dataDir, root, WORKER_ID);

  it('cannot be deleted while the pair is still open, which is the stuck state', () => {
    store.updateRun(MANAGER_ID, { status: 'failed' });
    store.updateRun(WORKER_ID, { status: 'failed' });
    const result = lookup();
    expect(result.ok).toBe(false);
  });

  it('is closed by stop-all even though no run is live', () => {
    store.updateRun(MANAGER_ID, { status: 'failed' });
    store.updateRun(WORKER_ID, { status: 'failed' });
    expect(manager.cancelAll()).toBeGreaterThan(0);
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('stopped');
    expect(lookup().ok).toBe(true);
  });

  it('settles a parked `waiting` ghost so the pair can be deleted', () => {
    store.updateRun(MANAGER_ID, { status: 'waiting' });
    store.updateRun(WORKER_ID, { status: 'running' });
    expect(manager.settleIdlePair(WORKER_ID)).toBe(true);
    expect(store.getRun(MANAGER_ID)?.status).toBe('cancelled');
    expect(store.getRun(WORKER_ID)?.status).toBe('cancelled');
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('stopped');
    expect(lookup().ok).toBe(true);
  });

  it('leaves a pair alone while one of its runs has pending work', () => {
    store.updateRun(MANAGER_ID, { status: 'failed' });
    store.updateRun(WORKER_ID, { status: 'failed', autoResumeAt: new Date(Date.now() + 60_000).toISOString() });
    expect(manager.settleIdlePair(MANAGER_ID)).toBe(false);
    expect(pairs.readState(MANAGER_ID)?.phase).not.toBe('stopped');
  });
});
