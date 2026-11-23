import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  ONE_AND_ONE_MAX_HANDOFFS,
  ONE_AND_ONE_MAX_ORDER_REVISIONS,
  pairAcceptInputSchema,
  pairDecisionInputSchema,
  pairDecisionSchema,
  pairMemberSchema,
  pairMessageInputSchema,
  pairMessageSchema,
  pairOrderSchema,
  pairProposalInputSchema,
  pairProposalSchema,
  pairSnapshotSchema,
  pairStateSchema,
  type DispatchInput,
  type PairAcceptInput,
  type PairDecision,
  type PairDecisionInput,
  type PairMember,
  type PairMessage,
  type PairMessageInput,
  type PairOrder,
  type PairPhase,
  type PairProposal,
  type PairProposalInput,
  type PairRole,
  type PairSnapshot,
  type PairState,
} from '@onni/contract';
import { atomicWriteJsonSync } from '../workspace/config.ts';

const PAIR_ID_RE = /^[A-Za-z0-9._-]{1,120}$/;
const pairMutationTails = new Map<string, Promise<void>>();

export class PairStoreError extends Error {}

function contained(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function parseStored<T>(schema: { parse: (value: unknown) => T }, path: string, fallback: T): T {
  try {
    return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    return fallback;
  }
}

export class PairStore {
  readonly directory: string;

  constructor(readonly dataDir: string) {
    this.directory = join(dataDir, 'pairs');
  }

  private dir(pairId: string): string {
    if (!PAIR_ID_RE.test(pairId) || pairId === '.' || pairId === '..' || pairId.includes('..')) {
      throw new PairStoreError('Invalid pair id');
    }
    const base = resolve(this.directory);
    const target = resolve(base, pairId);
    if (!contained(base, target)) throw new PairStoreError('Pair path is outside the pair store');
    let cursor = base;
    for (const part of pairId.split('/').filter(Boolean)) {
      cursor = join(cursor, part);
      try {
        if (lstatSync(cursor).isSymbolicLink()) throw new PairStoreError('Pair path contains a symbolic link');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return target;
  }

  private path(pairId: string, file: string): string {
    return join(this.dir(pairId), file);
  }

  /** Serialize HTTP read-modify-write sequences without blocking the single Node event loop. */
  async serialize<T>(pairId: string, operation: () => T | Promise<T>): Promise<T> {
    const key = this.dir(pairId);
    const previous = pairMutationTails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    pairMutationTails.set(key, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (pairMutationTails.get(key) === current) pairMutationTails.delete(key);
    }
  }

  private write<T>(schema: { parse: (value: unknown) => T }, pairId: string, file: string, value: T): T {
    const parsed = schema.parse(value);
    atomicWriteJsonSync(this.path(pairId, file), parsed);
    return parsed;
  }

  private read<T>(schema: { parse: (value: unknown) => T }, pairId: string, file: string, fallback: T): T {
    return parseStored(schema, this.path(pairId, file), fallback);
  }

  create(state: PairState): PairState {
    if (existsSync(this.path(state.pairId, 'state.json'))) throw new PairStoreError('Pair already exists');
    return this.write(pairStateSchema, state.pairId, 'state.json', state);
  }

  readState(pairId: string): PairState | null {
    return this.read(pairStateSchema, pairId, 'state.json', null as unknown as PairState) as PairState | null;
  }

  updateState(pairId: string, patch: Partial<PairState>): PairState {
    const current = this.readState(pairId);
    if (!current) throw new PairStoreError('Pair does not exist');
    return this.write(pairStateSchema, pairId, 'state.json', { ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  setWorker(pairId: string, workerRunId: string): PairState {
    return this.updateState(pairId, { workerRunId });
  }

  transition(pairId: string, phase: PairPhase, activeRole?: PairRole, patch: Partial<PairState> = {}): PairState {
    const current = this.readState(pairId);
    if (!current) throw new PairStoreError('Pair does not exist');
    const nextHandoffs = activeRole && current.activeRole && activeRole !== current.activeRole ? current.handoffs + 1 : current.handoffs;
    if (nextHandoffs > ONE_AND_ONE_MAX_HANDOFFS) throw new PairStoreError('One & One handoff limit reached');
    return this.updateState(pairId, { ...patch, phase, ...(activeRole ? { activeRole } : {}), handoffs: nextHandoffs });
  }

  listOrders(pairId: string): PairOrder[] {
    return this.read(pairOrderSchema.array(), pairId, 'orders.json', []);
  }

  getOrder(pairId: string, orderId: string): PairOrder | null {
    return this.listOrders(pairId).find((order) => order.id === orderId) ?? null;
  }

  enqueueOrder(pairId: string, input: DispatchInput): PairOrder {
    const state = this.readState(pairId);
    if (!state) throw new PairStoreError('Pair does not exist');
    const revision = state.orderRevision + 1;
    if (revision > ONE_AND_ONE_MAX_ORDER_REVISIONS) throw new PairStoreError('One & One order revision limit reached');
    const now = new Date().toISOString();
    const order = pairOrderSchema.parse({
      id: randomUUID(),
      revision,
      objective: input.objective,
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.success_criteria !== undefined ? { successCriteria: input.success_criteria } : {}),
      ...(input.required_evidence !== undefined ? { requiredEvidence: input.required_evidence } : {}),
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    });
    const orders = this.listOrders(pairId).map((entry) =>
      entry.status === 'queued' || entry.status === 'working'
        ? { ...entry, status: 'superseded' as const, updatedAt: now }
        : entry,
    );
    this.write(pairOrderSchema.array(), pairId, 'orders.json', [...orders, order]);
    this.updateState(pairId, {
      phase: 'worker_queued',
      activeRole: 'worker',
      currentOrderId: order.id,
      orderRevision: revision,
    });
    return order;
  }

  discardQueuedOrder(pairId: string, orderId: string, previous: PairState): PairOrder {
    const order = this.requireOrder(pairId, orderId);
    if (order.status !== 'queued') throw new PairStoreError('Only a queued order can be discarded');
    const updated = { ...order, status: 'rejected' as const, updatedAt: new Date().toISOString() };
    this.replaceOrder(pairId, updated);
    this.updateState(pairId, {
      phase: previous.phase,
      activeRole: previous.activeRole,
      currentOrderId: previous.currentOrderId,
      orderRevision: previous.orderRevision,
      handoffs: previous.handoffs,
      lastCheckpointSha: previous.lastCheckpointSha,
    });
    return updated;
  }

  markOrderWorking(pairId: string, orderId: string): PairOrder {
    const order = this.requireOrder(pairId, orderId);
    if (order.status !== 'queued') throw new PairStoreError('Order is not queued');
    const updated = { ...order, status: 'working' as const, updatedAt: new Date().toISOString() };
    this.replaceOrder(pairId, updated);
    this.transition(pairId, 'worker_working', 'worker', { currentOrderId: orderId });
    return updated;
  }

  reportOrder(pairId: string, orderId: string, report: string): PairOrder {
    const order = this.requireOrder(pairId, orderId);
    if (order.status !== 'working') throw new PairStoreError('Order is not being worked');
    const updated = pairOrderSchema.parse({ ...order, status: 'reported', report, updatedAt: new Date().toISOString() });
    this.replaceOrder(pairId, updated);
    this.transition(pairId, 'manager_review', 'manager', { currentOrderId: orderId });
    return updated;
  }

  acceptOrder(pairId: string, input: PairAcceptInput): PairOrder {
    pairAcceptInputSchema.parse(input);
    const order = this.requireOrder(pairId, input.orderId);
    if (order.status !== 'reported') throw new PairStoreError('Only a reported order can be accepted');
    const updated = { ...order, status: 'accepted' as const, updatedAt: new Date().toISOString() };
    this.replaceOrder(pairId, updated);
    this.transition(pairId, 'final_check', 'manager', { currentOrderId: order.id });
    return updated;
  }

  listMessages(pairId: string): PairMessage[] {
    return this.read(pairMessageSchema.array(), pairId, 'messages.json', []);
  }

  appendMessage(pairId: string, from: PairRole, input: PairMessageInput): PairMessage {
    const parsed = pairMessageInputSchema.parse(input);
    const state = this.readState(pairId);
    if (!state) throw new PairStoreError('Pair does not exist');
    if (parsed.orderId && !this.getOrder(pairId, parsed.orderId)) throw new PairStoreError('Unknown order');
    const to: PairRole = from === 'manager' ? 'worker' : 'manager';
    const message = pairMessageSchema.parse({
      id: randomUUID(),
      pairId,
      from,
      to,
      kind: parsed.kind,
      text: parsed.text,
      ...(parsed.orderId !== undefined ? { orderId: parsed.orderId } : {}),
      ...(parsed.replyTo !== undefined ? { replyTo: parsed.replyTo } : {}),
      createdAt: new Date().toISOString(),
    });
    this.write(pairMessageSchema.array(), pairId, 'messages.json', [...this.listMessages(pairId), message]);
    this.updateState(pairId, {});
    return message;
  }

  listProposals(pairId: string): PairProposal[] {
    return this.read(pairProposalSchema.array(), pairId, 'proposals.json', []);
  }

  appendProposal(pairId: string, from: PairRole, input: PairProposalInput): PairProposal {
    pairProposalInputSchema.parse(input);
    const state = this.readState(pairId);
    if (!state) throw new PairStoreError('Pair does not exist');
    if (input.orderId && !this.getOrder(pairId, input.orderId)) throw new PairStoreError('Unknown order');
    const now = new Date().toISOString();
    const proposal = pairProposalSchema.parse({
      id: randomUUID(),
      pairId,
      from,
      ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
      question: input.question,
      options: input.options,
      ...(input.recommendation !== undefined ? { recommendation: input.recommendation } : {}),
      status: 'open',
      createdAt: now,
    });
    const proposals = this.listProposals(pairId).map((entry) =>
      entry.status === 'open' ? { ...entry, status: 'superseded' as const } : entry,
    );
    this.write(pairProposalSchema.array(), pairId, 'proposals.json', [...proposals, proposal]);
    this.updateState(pairId, {});
    return proposal;
  }

  listDecisions(pairId: string): PairDecision[] {
    return this.read(pairDecisionSchema.array(), pairId, 'decisions.json', []);
  }

  decide(pairId: string, decidedBy: PairRole, input: PairDecisionInput): PairDecision {
    pairDecisionInputSchema.parse(input);
    const proposals = this.listProposals(pairId);
    const proposal = proposals.find((entry) => entry.id === input.proposalId);
    if (!proposal || proposal.status !== 'open') throw new PairStoreError('Proposal is not open');
    if (input.outcome === 'chosen' && !proposal.options.some((option) => option.id === input.optionId)) {
      throw new PairStoreError('Chosen option does not belong to the proposal');
    }
    const decision = pairDecisionSchema.parse({
      id: randomUUID(),
      pairId,
      proposalId: proposal.id,
      decidedBy,
      outcome: input.outcome,
      ...(input.optionId !== undefined ? { optionId: input.optionId } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      createdAt: new Date().toISOString(),
    });
    this.write(pairDecisionSchema.array(), pairId, 'decisions.json', [...this.listDecisions(pairId), decision]);
    this.write(pairProposalSchema.array(), pairId, 'proposals.json', proposals.map((entry) =>
      entry.id === proposal.id ? { ...entry, status: input.outcome === 'chosen' ? 'chosen' as const : 'declined' as const } : entry,
    ));
    this.updateState(pairId, {});
    return decision;
  }

  snapshot(pairId: string): PairSnapshot | null {
    const state = this.readState(pairId);
    if (!state) return null;
    return pairSnapshotSchema.parse({
      state,
      orders: this.listOrders(pairId),
      messages: this.listMessages(pairId),
      proposals: this.listProposals(pairId),
      decisions: this.listDecisions(pairId),
    });
  }

  member(runId: string, pairId: string): PairMember | null {
    const state = this.readState(pairId);
    if (!state?.managerRunId || !state.workerRunId) return null;
    if (runId === state.managerRunId) return pairMemberSchema.parse({ pairId, role: 'manager', peerRunId: state.workerRunId });
    if (runId === state.workerRunId) return pairMemberSchema.parse({ pairId, role: 'worker', peerRunId: state.managerRunId });
    return null;
  }

  private requireOrder(pairId: string, orderId: string): PairOrder {
    const order = this.getOrder(pairId, orderId);
    if (!order) throw new PairStoreError('Unknown order');
    return order;
  }

  private replaceOrder(pairId: string, updated: PairOrder): void {
    const orders = this.listOrders(pairId);
    if (!orders.some((order) => order.id === updated.id)) throw new PairStoreError('Unknown order');
    this.write(pairOrderSchema.array(), pairId, 'orders.json', orders.map((order) => order.id === updated.id ? updated : order));
  }
}
