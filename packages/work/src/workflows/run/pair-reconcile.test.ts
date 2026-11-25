import { execFileSync } from 'node:child_process';
import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Roster } from '@onni/contract';
import { PairStore } from '../../dispatch/pair-store.ts';
import { RunStore, resolveRunEventsPath } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import { createPairReconcileMemory, reconcileOpenPairs, type PairReconcileContext } from './pair-reconcile.ts';
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

describe('One & One pair reconciliation', () => {
  let root: string;
  let dataDir: string;
  let store: RunStore;
  let pairs: PairStore;
  let live: Set<string>;
  let delivered: string[];

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'onni-pair-reconcile-repo-'));
    dataDir = mkdtempSync(join(tmpdir(), 'onni-pair-reconcile-data-'));
    git(root, 'init', '-b', 'dev');
    git(root, 'config', 'user.name', 'Onni Test');
    git(root, 'config', 'user.email', 'onni@test.local');
    writeFileSync(join(root, 'README.md'), 'base\n', 'utf8');
    git(root, 'add', 'README.md');
    git(root, 'commit', '-m', 'base');
    store = RunStore.open(dataDir);
    pairs = new PairStore(dataDir);
    live = new Set();
    delivered = [];
    store.createRun({ id: MANAGER_ID, title: 'Manager', workflow: '(one-and-one)', task: 'Coordinate', steps: [] });
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
    store.flush();
    await removeTempDir(root);
    await removeTempDir(dataDir);
  });

  function context(): PairReconcileContext {
    return {
      store,
      dataDir,
      active: { has: (runId: string) => live.has(runId) },
      isLive: (runId: string) => live.has(runId),
      deliverMessage: (_runId, content) => { delivered.push(JSON.stringify(content)); return true; },
      deferMessage: () => false,
      continueRun: () => ({ ok: true }),
    };
  }

  const orderStatus = () => pairs.getOrder(MANAGER_ID, pairs.readState(MANAGER_ID)!.currentOrderId!)?.status;

  it('reports a worker that went red without the manager being told', () => {
    store.updateRun(WORKER_ID, { status: 'failed', error: 'boom' });
    reconcileOpenPairs(context(), createPairReconcileMemory());
    expect(orderStatus()).toBe('reported');
    expect(delivered.join('')).toContain('WORKER');
    expect(JSON.stringify(store.readEvents(MANAGER_ID))).toContain('never told');
  });

  it('is idempotent once the failure is reported', () => {
    store.updateRun(WORKER_ID, { status: 'failed', error: 'boom' });
    const memory = createPairReconcileMemory();
    reconcileOpenPairs(context(), memory);
    const events = store.readEvents(MANAGER_ID).length;
    reconcileOpenPairs(context(), memory);
    expect(store.readEvents(MANAGER_ID).length).toBe(events);
  });

  it('leaves a failed worker alone while a provider retry is scheduled for it', () => {
    store.updateRun(WORKER_ID, { status: 'failed', error: 'overloaded', autoResumeAt: new Date(Date.now() + 60_000).toISOString() });
    reconcileOpenPairs(context(), createPairReconcileMemory());
    expect(orderStatus()).toBe('working');
  });

  it('fails a running worker that no live process owns, but only after the grace period', () => {
    store.updateRun(WORKER_ID, { status: 'running' });
    const memory = createPairReconcileMemory();
    const t0 = Date.now();
    reconcileOpenPairs(context(), memory, t0);
    expect(store.getRun(WORKER_ID)?.status).toBe('running');
    reconcileOpenPairs(context(), memory, t0 + 31_000);
    expect(store.getRun(WORKER_ID)?.status).toBe('failed');
    expect(orderStatus()).toBe('reported');
  });

  it('never touches a live worker that is making progress', () => {
    store.updateRun(WORKER_ID, { status: 'running' });
    live.add(WORKER_ID);
    reconcileOpenPairs(context(), createPairReconcileMemory(), Date.now() + 600_000);
    expect(store.getRun(WORKER_ID)?.status).toBe('running');
    expect(orderStatus()).toBe('working');
  });

  it('tells the manager once when a live worker has gone silent, without killing it', () => {
    store.updateRun(WORKER_ID, { status: 'running' });
    store.appendEvent(WORKER_ID, { type: 'note', message: 'working' });
    store.flush();
    live.add(WORKER_ID);
    const path = resolveRunEventsPath(dataDir, WORKER_ID)!;
    const old = new Date(Date.now() - 25 * 60_000);
    utimesSync(path, old, old);
    const memory = createPairReconcileMemory();
    reconcileOpenPairs(context(), memory);
    reconcileOpenPairs(context(), memory);
    const notes = store.readEvents(MANAGER_ID).filter((event) => JSON.stringify(event).includes('silent for'));
    expect(notes).toHaveLength(1);
    expect(store.getRun(WORKER_ID)?.status).toBe('running');
  });
});
