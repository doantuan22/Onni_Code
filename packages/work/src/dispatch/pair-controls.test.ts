import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PairState } from '@onni/contract';
import { RunStore } from '../runs/store.ts';
import {
  pairAcceptFor,
  pairDecisionFor,
  pairMessageFor,
  pairProposalFor,
  pairSnapshotFor,
  type PairControlContext,
  type PairControlDenial,
} from './pair-controls.ts';
import { PairStore } from './pair-store.ts';

const PAIR_ID = '11111111-1111-1111-1111-111111111111';
const MANAGER_ID = '22222222-2222-2222-2222-222222222222';
const WORKER_ID = '33333333-3333-3333-3333-333333333333';
const OUTSIDER_ID = '44444444-4444-4444-4444-444444444444';

async function value<T extends object>(result: Promise<T | PairControlDenial>): Promise<T> {
  const outcome = await result;
  if ('denied' in outcome) throw new Error(outcome.denied);
  return outcome;
}

describe('One & One pair controls', () => {
  let root: string;
  let dataDir: string;
  let store: RunStore;
  let pairs: PairStore;
  let context: PairControlContext;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'onni-pair-controls-'));
    dataDir = join(root, '.ai', 'onni');
    store = RunStore.open(dataDir);
    pairs = new PairStore(dataDir);
    context = { store, dataDir };
    const now = new Date().toISOString();
    const state: PairState = {
      pairId: PAIR_ID,
      managerRunId: MANAGER_ID,
      phase: 'planning',
      activeRole: 'manager',
      workspace: { repoRoot: root, branch: 'dev', baselineSha: 'a'.repeat(40) },
      orderRevision: 0,
      handoffs: 0,
      createdAt: now,
      updatedAt: now,
    };
    pairs.create(state);
    store.createRun({ id: MANAGER_ID, title: 'manager', task: 'manage', workflow: 'quick-task', steps: [], worktree: false });
    store.createRun({ id: WORKER_ID, title: 'worker', task: 'work', workflow: 'quick-task', steps: [], worktree: false });
    store.createRun({ id: OUTSIDER_ID, title: 'outsider', task: 'other', workflow: 'quick-task', steps: [], worktree: false });
    store.updateRun(MANAGER_ID, { dispatch: { rootRunId: MANAGER_ID, pair: state } });
  });

  afterEach(() => {
    store.flush();
    rmSync(root, { recursive: true, force: true });
  });

  function assignWorker(): PairState {
    const state = pairs.setWorker(PAIR_ID, WORKER_ID);
    store.updateRun(WORKER_ID, {
      dispatch: {
        rootRunId: MANAGER_ID,
        parentRunId: MANAGER_ID,
        pairMember: { pairId: PAIR_ID, role: 'worker', peerRunId: MANAGER_ID },
      },
    });
    store.updateRun(MANAGER_ID, {
      dispatch: { ...(store.getRun(MANAGER_ID)!.dispatch!), pair: state },
    });
    return state;
  }

  it('authorizes the manager before worker assignment without trusting PairStore.member', async () => {
    expect(pairs.member(MANAGER_ID, PAIR_ID)).toBeNull();
    const snapshot = await value(pairSnapshotFor(context, MANAGER_ID));
    expect(snapshot.state.workerRunId).toBeUndefined();
    expect(snapshot.orders).toEqual([]);
    expect(await pairSnapshotFor(context, WORKER_ID)).toEqual({ denied: 'run is not part of a One & One pair', status: 404 });
  });

  it('lets both assigned peers read the same authoritative pair and rejects outsiders', async () => {
    assignWorker();
    expect((await value(pairSnapshotFor(context, MANAGER_ID))).state.pairId).toBe(PAIR_ID);
    expect((await value(pairSnapshotFor(context, WORKER_ID))).state.pairId).toBe(PAIR_ID);
    expect(await pairSnapshotFor(context, OUTSIDER_ID)).toEqual({ denied: 'run is not part of a One & One pair', status: 404 });

    store.updateRun(OUTSIDER_ID, {
      dispatch: {
        rootRunId: MANAGER_ID,
        pairMember: { pairId: PAIR_ID, role: 'worker', peerRunId: MANAGER_ID },
      },
    });
    expect(await pairSnapshotFor(context, OUTSIDER_ID)).toEqual({ denied: 'run does not belong to this pair', status: 403 });
  });

  it('records two-way messages, proposals and decisions and re-mirrors authoritative state', async () => {
    assignWorker();
    const stale = pairs.readState(PAIR_ID)!;
    store.updateRun(MANAGER_ID, {
      dispatch: { ...(store.getRun(MANAGER_ID)!.dispatch!), pair: { ...stale, phase: 'discussion' } },
    });
    const question = await value(pairMessageFor(context, MANAGER_ID, { kind: 'question', text: 'Which approach?' }));
    const answer = await value(pairMessageFor(context, WORKER_ID, { kind: 'answer', text: 'Option B', replyTo: question.id }));
    expect(answer).toMatchObject({ from: 'worker', to: 'manager', replyTo: question.id });
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair?.phase).toBe('planning');

    const proposal = await value(pairProposalFor(context, WORKER_ID, {
      question: 'How should we implement it?',
      options: [{ id: 'small', title: 'Small change' }, { id: 'refactor', title: 'Refactor' }],
      recommendation: 'small',
    }));
    const decision = await value(pairDecisionFor(context, MANAGER_ID, {
      proposalId: proposal.id,
      outcome: 'chosen',
      optionId: 'small',
      note: 'Keep the diff focused',
    }));
    expect(decision).toMatchObject({ decidedBy: 'manager', optionId: 'small' });
    const snapshot = await value(pairSnapshotFor(context, WORKER_ID));
    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.proposals[0]).toMatchObject({ id: proposal.id, status: 'chosen' });
    expect(snapshot.decisions[0]).toMatchObject({ id: decision.id, outcome: 'chosen' });
  });

  it('redacts every occurrence from pair responses, persisted files, events and peer delivery', async () => {
    assignWorker();
    const secret = 'pair-secret-value-1234567890';
    store.registerRunSecrets(MANAGER_ID, [secret]);
    const deliverMessage = vi.fn(() => true);
    context.deliverMessage = deliverMessage;
    context.deferMessage = vi.fn(() => false);
    context.continueRun = vi.fn(() => ({ ok: true }));
    context.active = { has: () => true };

    const message = await value(pairMessageFor(context, MANAGER_ID, {
      kind: 'question', text: `Start ${secret} / ${secret} / ${secret} end`,
    }));
    expect(message.text).toBe('Start [REDACTED] / [REDACTED] / [REDACTED] end');
    const proposal = await value(pairProposalFor(context, MANAGER_ID, {
      question: `Choose ${secret}`,
      options: [
        { id: 'small', title: `Small ${secret}`, detail: `Keep ${secret} and ${secret}` },
        { id: 'wide', title: 'Wide refactor', detail: 'More churn' },
      ],
      recommendation: 'small',
    }));
    const decision = await value(pairDecisionFor(context, MANAGER_ID, {
      proposalId: proposal.id, outcome: 'chosen', optionId: 'small', note: `Use ${secret} twice: ${secret}`,
    }));
    const order = pairs.enqueueOrder(PAIR_ID, { objective: 'Implement the feature' });
    pairs.markOrderWorking(PAIR_ID, order.id);
    pairs.reportOrder(PAIR_ID, order.id, 'Implemented and tested');
    const accepted = await value(pairAcceptFor(context, MANAGER_ID, { orderId: order.id, note: `Verified with ${secret}` }));

    expect(proposal.question).not.toContain(secret);
    expect(proposal.options[0]).toMatchObject({ title: 'Small [REDACTED]', detail: 'Keep [REDACTED] and [REDACTED]' });
    expect(decision.note).toBe('Use [REDACTED] twice: [REDACTED]');
    expect(accepted.status).toBe('accepted');
    expect(store.readEvents(MANAGER_ID).find((event) => event.type === 'pair-order-accepted')?.note)
      .toBe('Verified with [REDACTED]');
    const snapshot = await value(pairSnapshotFor(context, MANAGER_ID));
    expect(snapshot.messages[0]?.text).toBe(message.text);
    expect(JSON.stringify(snapshot)).not.toContain(secret);
    const pairDirectory = join(pairs.directory, PAIR_ID);
    const persisted = readdirSync(pairDirectory)
      .filter((file) => file.endsWith('.json'))
      .map((file) => readFileSync(join(pairDirectory, file), 'utf8'))
      .join('\n');
    expect(persisted).not.toContain(secret);
    expect(JSON.stringify(store.readEvents(MANAGER_ID))).not.toContain(secret);
    expect(JSON.stringify(deliverMessage.mock.calls)).not.toContain(secret);
    expect(deliverMessage).toHaveBeenCalledWith(WORKER_ID, [{ type: 'text', text: expect.stringContaining(message.text) }], false);
  });

  it('requires the manager, manager review and the reported current order for acceptance', async () => {
    assignWorker();
    const order = pairs.enqueueOrder(PAIR_ID, { objective: 'Implement the feature' });
    expect(await pairAcceptFor(context, MANAGER_ID, { orderId: order.id })).toMatchObject({ status: 409 });
    pairs.markOrderWorking(PAIR_ID, order.id);
    expect(await pairAcceptFor(context, WORKER_ID, { orderId: order.id })).toEqual({ denied: 'only the manager can accept an order', status: 403 });
    expect(await pairAcceptFor(context, MANAGER_ID, { orderId: order.id })).toMatchObject({ status: 409 });
    pairs.reportOrder(PAIR_ID, order.id, 'Implemented and tested');
    expect(await pairAcceptFor(context, MANAGER_ID, { orderId: 'stale-order' })).toEqual({ denied: 'only the current order can be accepted', status: 409 });

    const onAccepted = vi.fn();
    const accepted = await value(pairAcceptFor(context, MANAGER_ID, { orderId: order.id, note: 'Looks good' }, onAccepted));
    expect(accepted.status).toBe('accepted');
    expect(onAccepted).toHaveBeenCalledWith(MANAGER_ID);
    expect(store.getRun(MANAGER_ID)?.dispatch?.pair).toMatchObject({ phase: 'final_check', currentOrderId: order.id });
    expect(store.readEvents(MANAGER_ID).some((event) => event.type === 'pair-order-accepted' && event.note === 'Looks good')).toBe(true);
  });

  it('serializes concurrent HTTP-style mutations without losing messages', async () => {
    assignWorker();
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      pairMessageFor(context, index % 2 === 0 ? MANAGER_ID : WORKER_ID, { text: `message ${index}` }),
    ));
    expect(results.every((result) => !('denied' in result))).toBe(true);
    expect((await value(pairSnapshotFor(context, MANAGER_ID))).messages).toHaveLength(12);
  });

  it('keeps snapshots readable but refuses new mutations after the pair is stopped', async () => {
    pairs.transition(PAIR_ID, 'stopped');
    expect((await value(pairSnapshotFor(context, MANAGER_ID))).state.phase).toBe('stopped');
    expect(await pairMessageFor(context, MANAGER_ID, { text: 'too late' })).toEqual({ denied: 'pair is stopped', status: 409 });
  });
});
