import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ONE_AND_ONE_MAX_DECISIONS,
  ONE_AND_ONE_MAX_HANDOFFS,
  ONE_AND_ONE_MAX_MESSAGES,
  ONE_AND_ONE_MAX_ORDER_REVISIONS,
  ONE_AND_ONE_MAX_PROPOSALS,
  type PairState,
} from '@onni/contract';
import { PairStore, PairStoreError } from './pair-store.ts';

const PAIR_ID = '11111111-1111-1111-1111-111111111111';
const MANAGER_ID = '22222222-2222-2222-2222-222222222222';
const WORKER_ID = '33333333-3333-3333-3333-333333333333';
let repoRoot = 'C:/repo';

function initialState(): PairState {
  return {
    pairId: PAIR_ID,
    managerRunId: MANAGER_ID,
    phase: 'planning',
    activeRole: 'manager',
    workspace: { repoRoot, branch: 'dev', baselineSha: 'a'.repeat(40) },
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
    repoRoot = dataDir;
    execFileSync('git', ['init', '-q', '-b', 'dev'], { cwd: dataDir });
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

  it('repairs the pair phase when retrying a report persisted before the phase update', () => {
    store.setWorker(PAIR_ID, WORKER_ID);
    const order = store.enqueueOrder(PAIR_ID, { objective: 'implement' });
    store.markOrderWorking(PAIR_ID, order.id);
    const report = 'Implemented and tested';
    const ordersPath = join(dataDir, 'pairs', PAIR_ID, 'orders.json');
    const orders = JSON.parse(readFileSync(ordersPath, 'utf8')) as Array<Record<string, unknown>>;
    writeFileSync(ordersPath, JSON.stringify(orders.map((entry) => ({
      ...entry,
      ...(entry.id === order.id ? { status: 'reported', report } : {}),
    }))));

    expect(store.readState(PAIR_ID)?.phase).toBe('worker_working');
    expect(store.reportOrder(PAIR_ID, order.id, report)).toMatchObject({ status: 'reported', report });
    expect(store.readState(PAIR_ID)).toMatchObject({
      phase: 'manager_review',
      activeRole: 'manager',
      currentOrderId: order.id,
    });
  });

  it('opens the next task scope from a parked pair, resetting baseline and revision', () => {
    expect(() => store.openNextTask(PAIR_ID)).toThrow(PairStoreError);
    const order = store.enqueueOrder(PAIR_ID, { objective: 'first task' });
    store.markOrderWorking(PAIR_ID, order.id);
    store.reportOrder(PAIR_ID, order.id, 'done');
    store.acceptOrder(PAIR_ID, { orderId: order.id });
    const checkpoint = 'b'.repeat(40);
    store.transition(PAIR_ID, 'user_wait', 'manager', { lastCheckpointSha: checkpoint });
    const opened = store.openNextTask(PAIR_ID);
    expect(opened).toMatchObject({ phase: 'planning', activeRole: 'manager', orderRevision: 0 });
    expect(opened.currentOrderId).toBeUndefined();
    expect(opened.workspace.baselineSha).toBe(checkpoint);
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

  it('recovers a terminal pair deletion after its removal callback was interrupted', async () => {
    store.setWorker(PAIR_ID, WORKER_ID);
    store.transition(PAIR_ID, 'complete');
    const remove = vi.fn(async () => { throw new Error('interrupted'); });
    await expect(store.delete(PAIR_ID, {
      managerRunId: MANAGER_ID, workerRunId: WORKER_ID, repoRoot: initialState().workspace.repoRoot,
    }, remove)).rejects.toThrow('interrupted');
    expect(existsSync(join(dataDir, 'pairs', PAIR_ID, 'deletion.json'))).toBe(true);
    expect(store.readState(PAIR_ID)?.phase).toBe('complete');

    const recovered = vi.fn();
    await store.recoverDeletions(recovered);
    expect(recovered).toHaveBeenCalledWith(expect.objectContaining({
      pairId: PAIR_ID, managerRunId: MANAGER_ID, workerRunId: WORKER_ID,
    }));
    expect(store.snapshot(PAIR_ID)).toBeNull();
    expect(existsSync(join(dataDir, 'pairs', PAIR_ID))).toBe(false);
    await store.recoverDeletions(recovered);
    expect(recovered).toHaveBeenCalledTimes(1);
  });

  it('admits a terminal deletion before writing its durable intent', async () => {
    store.setWorker(PAIR_ID, WORKER_ID);
    store.transition(PAIR_ID, 'complete');
    const expected = { managerRunId: MANAGER_ID, workerRunId: WORKER_ID, repoRoot: initialState().workspace.repoRoot };
    const remove = vi.fn();
    const admit = vi.fn(() => { throw new Error('continuation started'); });

    await expect(store.delete(PAIR_ID, expected, remove, admit)).rejects.toThrow('continuation started');
    expect(admit).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    expect(existsSync(join(dataDir, 'pairs', PAIR_ID, 'deletion.json'))).toBe(false);

    await store.delete(PAIR_ID, expected, remove);
    expect(remove).toHaveBeenCalledOnce();
    expect(store.snapshot(PAIR_ID)).toBeNull();
  });

  it.each(['manager', 'worker'] as const)('rejects an unsafe %s run id in deletion recovery', async (role) => {
    const unsafeId = '../outside';
    if (role === 'worker') store.setWorker(PAIR_ID, unsafeId);
    const state = store.transition(PAIR_ID, 'complete', 'manager', role === 'manager' ? { managerRunId: unsafeId } : {});
    writeFileSync(join(dataDir, 'pairs', PAIR_ID, 'deletion.json'), JSON.stringify({
      pairId: PAIR_ID,
      managerRunId: state.managerRunId,
      ...(state.workerRunId !== undefined ? { workerRunId: state.workerRunId } : {}),
      repoRoot: state.workspace.repoRoot,
      createdAt: new Date().toISOString(),
    }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const remove = vi.fn();

    await store.recoverDeletions(remove);

    expect(remove).not.toHaveBeenCalled();
    expect(existsSync(join(dataDir, 'pairs', PAIR_ID, 'state.json'))).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it('fails closed on nonterminal, mismatched and corrupt deletion state', async () => {
    store.setWorker(PAIR_ID, WORKER_ID);
    const expected = { managerRunId: MANAGER_ID, workerRunId: WORKER_ID, repoRoot: initialState().workspace.repoRoot };
    const remove = vi.fn();
    await expect(store.delete(PAIR_ID, expected, remove)).rejects.toThrow('completed or stopped');
    await expect(store.delete(PAIR_ID, { ...expected, managerRunId: 'other' }, remove)).rejects.toThrow('identity');
    expect(remove).not.toHaveBeenCalled();
    expect(existsSync(join(dataDir, 'pairs', PAIR_ID, 'deletion.json'))).toBe(false);

    writeFileSync(join(dataDir, 'pairs', PAIR_ID, 'state.json'), '{broken');
    await expect(store.delete(PAIR_ID, expected, remove)).rejects.toThrow('missing or corrupt');
    expect(remove).not.toHaveBeenCalled();
  });

  it('bounds revisions and handoffs', () => {
    store.updateState(PAIR_ID, { orderRevision: ONE_AND_ONE_MAX_ORDER_REVISIONS });
    expect(() => store.enqueueOrder(PAIR_ID, { objective: 'too many' })).toThrow(PairStoreError);
    store.updateState(PAIR_ID, { handoffs: ONE_AND_ONE_MAX_HANDOFFS, activeRole: 'worker' });
    expect(() => store.transition(PAIR_ID, 'manager_review', 'manager')).toThrow(PairStoreError);
  });

  it('bounds persisted messages and keeps the newest window', () => {
    const createdAt = '2026-11-24T00:00:00.000Z';
    const messages = Array.from({ length: ONE_AND_ONE_MAX_MESSAGES }, (_, index) => ({
      id: `message-${index}`,
      pairId: PAIR_ID,
      from: index % 2 === 0 ? 'manager' as const : 'worker' as const,
      to: index % 2 === 0 ? 'worker' as const : 'manager' as const,
      kind: 'note' as const,
      text: `message ${index}`,
      createdAt,
    }));
    vi.spyOn(store, 'listMessages').mockReturnValue(messages);

    const appended = store.appendMessage(PAIR_ID, 'manager', { text: 'newest' });
    const persisted = new PairStore(dataDir).listMessages(PAIR_ID);

    expect(persisted).toHaveLength(ONE_AND_ONE_MAX_MESSAGES);
    expect(persisted[0]?.id).toBe('message-1');
    expect(persisted.at(-1)?.id).toBe(appended.id);
  });

  it('bounds proposals and removes decisions whose proposal was evicted', () => {
    const createdAt = '2026-11-24T00:00:00.000Z';
    const first = store.appendProposal(PAIR_ID, 'manager', {
      question: 'First?', options: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
    });
    store.decide(PAIR_ID, 'worker', { proposalId: first.id, outcome: 'chosen', optionId: 'a' });
    const proposals = Array.from({ length: ONE_AND_ONE_MAX_PROPOSALS }, (_, index) => index === 0 ? {
      ...first, status: 'chosen' as const,
    } : {
      id: `proposal-${index}`,
      pairId: PAIR_ID,
      from: 'manager' as const,
      question: `Question ${index}?`,
      options: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
      status: 'superseded' as const,
      createdAt,
    });
    vi.spyOn(store, 'listProposals').mockReturnValue(proposals);

    const appended = store.appendProposal(PAIR_ID, 'worker', {
      question: 'Newest?', options: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
    });
    const reopened = new PairStore(dataDir);

    expect(reopened.listProposals(PAIR_ID)).toHaveLength(ONE_AND_ONE_MAX_PROPOSALS);
    expect(reopened.listProposals(PAIR_ID)[0]?.id).toBe('proposal-1');
    expect(reopened.listProposals(PAIR_ID).at(-1)?.id).toBe(appended.id);
    expect(reopened.listDecisions(PAIR_ID)).toEqual([]);
  });

  it('bounds persisted decisions and keeps the newest window', () => {
    const createdAt = '2026-11-24T00:00:00.000Z';
    const proposal = store.appendProposal(PAIR_ID, 'manager', {
      question: 'Choose?', options: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
    });
    const decisions = Array.from({ length: ONE_AND_ONE_MAX_DECISIONS }, (_, index) => ({
      id: `decision-${index}`,
      pairId: PAIR_ID,
      proposalId: proposal.id,
      decidedBy: 'worker' as const,
      outcome: 'chosen' as const,
      optionId: 'a',
      createdAt,
    }));
    writeFileSync(join(dataDir, 'pairs', PAIR_ID, 'decisions.json'), JSON.stringify(decisions), 'utf8');

    const appended = store.decide(PAIR_ID, 'worker', { proposalId: proposal.id, outcome: 'chosen', optionId: 'a' });
    const persisted = new PairStore(dataDir).listDecisions(PAIR_ID);

    expect(persisted).toHaveLength(ONE_AND_ONE_MAX_DECISIONS);
    expect(persisted[0]?.id).toBe('decision-1');
    expect(persisted.at(-1)?.id).toBe(appended.id);
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
