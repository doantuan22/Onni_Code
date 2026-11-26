import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Roster } from '@onni/contract';
import { PairStore } from '../../dispatch/pair-store.ts';
import { RunStore, resolveRunEventsPath } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import { createPairReconcileMemory, reconcileOpenPairs, type PairReconcileContext } from './pair-reconcile.ts';
import { initializePair } from './pair-runtime.ts';
import { deliverPendingPairReport } from './pair-coordinator.ts';

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

  it('recovers a persisted report when the pair phase write was interrupted', () => {
    const state = pairs.readState(MANAGER_ID)!;
    const order = pairs.getOrder(MANAGER_ID, state.currentOrderId!)!;
    const report = 'Implemented and verified';
    const ordersPath = join(dataDir, 'pairs', MANAGER_ID, 'orders.json');
    const orders = JSON.parse(readFileSync(ordersPath, 'utf8')) as Array<Record<string, unknown>>;
    writeFileSync(ordersPath, JSON.stringify(orders.map((entry) => ({
      ...entry,
      ...(entry.id === order.id ? { status: 'reported', report } : {}),
    }))));
    store.updateRun(WORKER_ID, { status: 'running' });

    reconcileOpenPairs(context(), createPairReconcileMemory());

    expect(pairs.readState(MANAGER_ID)).toMatchObject({ phase: 'manager_review', currentOrderId: order.id });
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('manager_review');
    expect(pairs.getOrder(MANAGER_ID, order.id)).toMatchObject({ status: 'reported', report });
    expect(store.getRun(WORKER_ID)).toMatchObject({ status: 'done', completionReason: 'completed' });
    expect(delivered.join('')).toContain(report);
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

  it('reports an idle waiting worker with no owner after the ghost grace', () => {
    store.updateRun(WORKER_ID, { status: 'waiting' });
    const memory = createPairReconcileMemory();
    const now = Date.now();
    reconcileOpenPairs(context(), memory, now);
    expect(store.getRun(WORKER_ID)?.status).toBe('waiting');
    reconcileOpenPairs(context(), memory, now + 31_000);
    expect(store.getRun(WORKER_ID)?.status).toBe('failed');
    expect(orderStatus()).toBe('reported');
  });

  it('redelivers a report after transport failure and restart without repeating acknowledged work', () => {
    store.updateRun(WORKER_ID, { status: 'failed', error: 'boom' });
    store.updateRun(MANAGER_ID, { status: 'waiting' });
    const unavailable = { ...context(), deliverMessage: () => false, deferMessage: () => false,
      continueRun: () => ({ ok: false, error: 'temporary capacity failure' }) };
    reconcileOpenPairs(unavailable, createPairReconcileMemory());
    expect(orderStatus()).toBe('reported');
    // Recreate the in-memory reconciler to simulate a process restart after failed delivery.
    reconcileOpenPairs(context(), createPairReconcileMemory(), Date.now() + 60_000);
    expect(delivered.join('')).toContain('WORKER');
  });

  it('bounds delivery retries and never resumes a user-stopped manager', () => {
    store.updateRun(WORKER_ID, { status: 'failed', error: 'boom' });
    store.updateRun(MANAGER_ID, { status: 'cancelled' });
    reconcileOpenPairs(context(), createPairReconcileMemory());
    expect(delivered).toHaveLength(0);
    store.updateRun(MANAGER_ID, { status: 'waiting' });
    let attempts = 0;
    const unavailable = { ...context(), deliverMessage: () => { attempts++; return false; }, deferMessage: () => false,
      continueRun: () => ({ ok: false, error: 'capacity unavailable' }) };
    for (let i = 0; i < 10; i++) reconcileOpenPairs(unavailable, createPairReconcileMemory(), Date.now() + i * 120_000);
    expect(attempts).toBe(6);
    expect(JSON.stringify(store.readEvents(MANAGER_ID))).toContain('retry limit reached');
  });

  it('does not duplicate a delivered report while the manager still has a live owner', () => {
    store.updateRun(WORKER_ID, { status: 'failed', error: 'boom' });
    live.add(MANAGER_ID);
    reconcileOpenPairs(context(), createPairReconcileMemory());
    reconcileOpenPairs(context(), createPairReconcileMemory(), Date.now() + 120_000);
    expect(delivered).toHaveLength(1);
  });

  it('reconciles interrupted acceptance and mirrors the authoritative phase', () => {
    const orderId = pairs.readState(MANAGER_ID)!.currentOrderId!;
    pairs.reportOrder(MANAGER_ID, orderId, 'Implemented');
    pairs.acceptOrder(MANAGER_ID, { orderId });
    pairs.updateState(MANAGER_ID, { phase: 'manager_review' });
    reconcileOpenPairs(context(), createPairReconcileMemory());
    expect(pairs.readState(MANAGER_ID)?.phase).toBe('final_check');
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('final_check');
    expect(delivered).toHaveLength(0);
  });

  it('preserves a waiting worker that still has a live owner', () => {
    store.updateRun(WORKER_ID, { status: 'waiting' });
    live.add(WORKER_ID);
    const memory = createPairReconcileMemory();
    reconcileOpenPairs(context(), memory);
    reconcileOpenPairs(context(), memory, Date.now() + 60_000);
    expect(store.getRun(WORKER_ID)?.status).toBe('waiting');
    expect(orderStatus()).toBe('working');
  });

  it('bounds large report summaries while retaining the verification instructions', () => {
    const orderId = pairs.readState(MANAGER_ID)!.currentOrderId!;
    pairs.reportOrder(MANAGER_ID, orderId, 'r'.repeat(20_000));
    deliverPendingPairReport(context(), MANAGER_ID, Date.now(), { nameStatus: 'n'.repeat(40_000), stat: 's'.repeat(40_000) });
    const blocks: unknown = JSON.parse(delivered[0] ?? 'null');
    if (!Array.isArray(blocks)) throw new Error('missing report');
    const first: unknown = blocks[0];
    if (!first || typeof first !== 'object' || !('text' in first) || typeof first.text !== 'string') throw new Error('missing report text');
    expect(first.text.length).toBeLessThanOrEqual(30_000);
    expect(first.text).toContain('Run onni task verify');
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
