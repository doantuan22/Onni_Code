import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PairStore } from '../../dispatch/pair-store.ts';
import { PAIR_RUN_MUTATION_REFUSAL } from '../../runs/pair-mutation.ts';
import { RunStore } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import type { SettlementActiveRun, SettlementContext } from './internal-types.ts';
import { settleSuccess } from './settlement.ts';

const MANAGER_ID = '11111111-1111-1111-1111-111111111111';
const WORKER_ID = '22222222-2222-2222-2222-222222222222';

let root: string;
let dataDir: string;
let store: RunStore;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'onni-pair-settlement-repo-'));
  dataDir = mkdtempSync(join(tmpdir(), 'onni-pair-settlement-data-'));
  store = RunStore.open(dataDir);
});

afterEach(async () => {
  store.flush();
  await removeTempDir(root);
  await removeTempDir(dataDir);
});

it('settles a reported pair worker without ordinary landing', async () => {
  const pairs = new PairStore(dataDir);
  const now = new Date().toISOString();
  pairs.create({
    pairId: MANAGER_ID,
    managerRunId: MANAGER_ID,
    phase: 'planning',
    workspace: { repoRoot: root, branch: 'dev', baselineSha: 'a'.repeat(40) },
    orderRevision: 0,
    handoffs: 0,
    createdAt: now,
    updatedAt: now,
  });
  pairs.setWorker(MANAGER_ID, WORKER_ID);
  const order = pairs.enqueueOrder(MANAGER_ID, { objective: 'Implement the feature' });
  pairs.markOrderWorking(MANAGER_ID, order.id);
  pairs.reportOrder(MANAGER_ID, order.id, 'Implemented and verified.\nONNI:DONE');

  store.createRun({ id: MANAGER_ID, title: 'Manager', workflow: '(one-and-one)', task: 'Coordinate', steps: [] });
  store.createRun({
    id: WORKER_ID,
    title: 'Worker',
    workflow: '(one-and-one)',
    task: 'Implement',
    autonomous: true,
    worktree: false,
    steps: [],
  });
  store.updateRun(MANAGER_ID, { dispatch: { rootRunId: MANAGER_ID, pair: pairs.readState(MANAGER_ID)! } });
  store.updateRun(WORKER_ID, {
    status: 'running',
    dispatch: {
      rootRunId: MANAGER_ID,
      parentRunId: MANAGER_ID,
      pairMember: { pairId: MANAGER_ID, role: 'worker', peerRunId: MANAGER_ID },
    },
  });
  const owner: SettlementActiveRun = {
    ownerToken: Symbol('worker'),
    cancelled: false,
    interrupt: vi.fn(),
    cwd: root,
    autosaveExcludedPaths: new Map(),
    checkInProgress: false,
    autosaveCheckpointBlocked: false,
  };
  const landBeforeSettle = vi.fn(async () => PAIR_RUN_MUTATION_REFUSAL);
  const reviewGateApplies = vi.fn(async () => false);
  const context = {
    store,
    dataDir,
    repoRoot: root,
    active: new Map([[WORKER_ID, owner]]),
    waiting: new Set<string>(),
    lastNamerKey: new Map<string, string>(),
    queuedImageSeq: new Map<string, number>(),
    landBeforeSettle,
    reviewGateApplies,
  } as unknown as SettlementContext;

  expect(await settleSuccess(context, WORKER_ID, owner)).toBe(true);
  expect(store.getRun(WORKER_ID)).toMatchObject({
    status: 'done',
    completionReason: 'completed',
    finishedAt: expect.any(String),
  });
  expect(store.getRun(WORKER_ID)?.error).toBeUndefined();
  expect(landBeforeSettle).not.toHaveBeenCalled();
  expect(reviewGateApplies).not.toHaveBeenCalled();
  expect(pairs.readState(MANAGER_ID)).toMatchObject({ phase: 'manager_review', workerRunId: WORKER_ID });
  expect(pairs.getOrder(MANAGER_ID, order.id)).toMatchObject({ status: 'reported' });
});
