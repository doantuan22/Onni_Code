import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ONE_AND_ONE_MAX_HANDOFFS, ONE_AND_ONE_MAX_ORDER_REVISIONS, type PairState } from '@onni/contract';
import { PairStore, PairStoreError } from './pair-store.ts';

const PAIR_ID = '11111111-1111-1111-1111-111111111111';
const MANAGER_ID = '22222222-2222-2222-2222-222222222222';
const WORKER_ID = '33333333-3333-3333-3333-333333333333';

function initialState(): PairState {
  return {
    pairId: PAIR_ID,
    managerRunId: MANAGER_ID,
    phase: 'planning',
    activeRole: 'manager',
    workspace: { repoRoot: 'C:/repo', branch: 'dev', baselineSha: 'a'.repeat(40) },
    orderRevision: 0,
    handoffs: 0,
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  };
}

describe('PairStore', () => {
  let dataDir: string;
  let store: PairStore;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'onni-pair-'));
    store = new PairStore(dataDir);
    store.create(initialState());
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('persists the pair under .ai/onni/pairs and survives a reopen', () => {
    store.setWorker(PAIR_ID, WORKER_ID);
    const reopened = new PairStore(dataDir).snapshot(PAIR_ID);
    expect(reopened?.state.workerRunId).toBe(WORKER_ID);
    expect(reopened?.orders).toEqual([]);
    expect(readFileSync(join(dataDir, 'pairs', PAIR_ID, 'state.json'), 'utf8')).toContain(WORKER_ID);
  });

  it('withholds membership until both peer ids exist', () => {
    expect(store.member(MANAGER_ID, PAIR_ID)).toBeNull();
    expect(store.member(WORKER_ID, PAIR_ID)).toBeNull();

    store.setWorker(PAIR_ID, WORKER_ID);
    expect(store.member(MANAGER_ID, PAIR_ID)).toEqual({ pairId: PAIR_ID, role: 'manager', peerRunId: WORKER_ID });
    expect(store.member(WORKER_ID, PAIR_ID)).toEqual({ pairId: PAIR_ID, role: 'worker', peerRunId: MANAGER_ID });
    expect(store.member('44444444-4444-4444-4444-444444444444', PAIR_ID)).toBeNull();
    expect(store.member(MANAGER_ID, '55555555-5555-5555-5555-555555555555')).toBeNull();
  });

  it('serializes asynchronous pair read-modify-write sections', async () => {
    store.setWorker(PAIR_ID, WORKER_ID);
    const messages = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      store.serialize(PAIR_ID, async () => {
        await Promise.resolve();
        return store.appendMessage(PAIR_ID, index % 2 === 0 ? 'manager' : 'worker', { text: `message ${index}` });
      }),
    ));
    expect(new Set(messages.map((message) => message.id)).size).toBe(8);
    expect(store.listMessages(PAIR_ID)).toHaveLength(8);

    await expect(store.serialize(PAIR_ID, () => { throw new Error('boom'); })).rejects.toThrow('boom');
    await expect(store.serialize(PAIR_ID, () => store.appendMessage(PAIR_ID, 'manager', { text: 'after failure' }))).resolves.toMatchObject({ text: 'after failure' });
  });

  it('reuses the logical worker while superseding an unfinished order', () => {
    store.setWorker(PAIR_ID, WORKER_ID);
    const first = store.enqueueOrder(PAIR_ID, { objective: 'first' });
    store.markOrderWorking(PAIR_ID, first.id);
    const second = store.enqueueOrder(PAIR_ID, { objective: 'revised', success_criteria: 'tests pass' });
    expect(second.revision).toBe(2);
    expect(store.readState(PAIR_ID)).toMatchObject({ phase: 'worker_queued', activeRole: 'worker', currentOrderId: second.id, workerRunId: WORKER_ID });
    expect(store.getOrder(PAIR_ID, first.id)?.status).toBe('superseded');
    expect(store.getOrder(PAIR_ID, second.id)).toMatchObject({ status: 'queued', successCriteria: 'tests pass' });
  });

  it('records a worker report and manager acceptance', () => {
    const order = store.enqueueOrder(PAIR_ID, { objective: 'implement' });
    store.markOrderWorking(PAIR_ID, order.id);
    store.reportOrder(PAIR_ID, order.id, 'Implemented and tested');
    expect(store.readState(PAIR_ID)).toMatchObject({ phase: 'manager_review', activeRole: 'manager', handoffs: 1 });
    store.acceptOrder(PAIR_ID, { orderId: order.id, note: 'Looks good' });
    expect(store.getOrder(PAIR_ID, order.id)?.status).toBe('accepted');
    expect(store.readState(PAIR_ID)?.phase).toBe('final_check');
  });

  it('stores two-way messages and an auditable proposal decision', () => {
    const order = store.enqueueOrder(PAIR_ID, { objective: 'choose an approach' });
    const question = store.appendMessage(PAIR_ID, 'manager', { kind: 'question', text: 'Which approach?', orderId: order.id });
    const answer = store.appendMessage(PAIR_ID, 'worker', { kind: 'answer', text: 'Option B', replyTo: question.id });
    expect(answer.to).toBe('manager');
    const proposal = store.appendProposal(PAIR_ID, 'worker', {
      orderId: order.id,
      question: 'How should we implement it?',
      options: [{ id: 'a', title: 'Small change' }, { id: 'b', title: 'Refactor' }],
      recommendation: 'a',
    });
    const decision = store.decide(PAIR_ID, 'manager', { proposalId: proposal.id, outcome: 'chosen', optionId: 'a' });
    expect(decision.optionId).toBe('a');
    expect(store.listProposals(PAIR_ID)[0]?.status).toBe('chosen');
    expect(store.snapshot(PAIR_ID)?.messages).toHaveLength(2);
    expect(store.readState(PAIR_ID)?.updatedAt).not.toBe(initialState().updatedAt);
  });

  it('bounds revisions and handoffs', () => {
    store.updateState(PAIR_ID, { orderRevision: ONE_AND_ONE_MAX_ORDER_REVISIONS });
    expect(() => store.enqueueOrder(PAIR_ID, { objective: 'too many' })).toThrow(PairStoreError);
    store.updateState(PAIR_ID, { handoffs: ONE_AND_ONE_MAX_HANDOFFS, activeRole: 'worker' });
    expect(() => store.transition(PAIR_ID, 'manager_review', 'manager')).toThrow(PairStoreError);
  });

  it('degrades missing or corrupt history to an empty snapshot', () => {
    writeFileSync(join(dataDir, 'pairs', PAIR_ID, 'messages.json'), '{broken', 'utf8');
    expect(store.listMessages(PAIR_ID)).toEqual([]);
    expect(store.snapshot(PAIR_ID)?.messages).toEqual([]);
    expect(store.snapshot('44444444-4444-4444-4444-444444444444')).toBeNull();
  });

  it('rejects path traversal and invalid message input', () => {
    expect(() => store.readState('../escape')).toThrow(PairStoreError);
    expect(() => store.appendMessage(PAIR_ID, 'manager', { text: '   ' })).toThrow();
  });
});
