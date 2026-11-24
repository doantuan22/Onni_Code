import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import {
  ONE_AND_ONE_MAX_DECISIONS,
  ONE_AND_ONE_MAX_HANDOFFS,
  ONE_AND_ONE_MAX_MESSAGES,
  ONE_AND_ONE_MAX_ORDER_REVISIONS,
  ONE_AND_ONE_MAX_PROPOSALS,
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
import {
  RepositoryLockError,
  withRepositoryLock,
  withRepositoryLockSync,
  withRequiredRepositoryLock,
  type RepositoryLease,
} from '../git-repository-lock.ts';
import { atomicWriteJsonSync } from '../workspace/config.ts';
import { readFileSyncWithRetry } from '../fs-rename.ts';
import { safeRunIdSchema } from '../runs/store.ts';

const PAIR_ID_RE = /^[A-Za-z0-9._-]{1,120}$/;
const pairMutationTails = new Map<string, Promise<void>>();
const pairDeletionIntentSchema = z.strictObject({
  pairId: z.string().min(1).max(120),
  managerRunId: safeRunIdSchema,
  workerRunId: safeRunIdSchema.optional(),
  repoRoot: z.string().min(1).max(4096),
  createdAt: z.string().min(1).max(40),
});

type PairDeletionIntent = z.infer<typeof pairDeletionIntentSchema>;
type PairDeletionCallback = (intent: PairDeletionIntent) => void | Promise<void>;
type PairDeletionAdmission = (intent: PairDeletionIntent) => void;

export class PairStoreError extends Error {}

function contained(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function parseStored<T>(schema: { parse: (value: unknown) => T }, path: string, fallback: T): T {
  try {
    return schema.parse(JSON.parse(readFileSyncWithRetry(path)));
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

  /** Keep the per-pair scheduling queue, then hold the repository lease across the operation. */
  async serialize<T>(
    pairId: string,
    operation: (lease: RepositoryLease | null) => T | Promise<T>,
    repositoryRoot?: string,
    requireRepositoryLease = false,
  ): Promise<T> {
    const key = this.dir(pairId);
    const previous = pairMutationTails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    pairMutationTails.set(key, current);
    await previous;
    try {
      const root = repositoryRoot ?? this.readState(pairId)?.workspace.repoRoot;
      if (!root) return await operation(null);
      try {
        return requireRepositoryLease
          ? await withRequiredRepositoryLock(root, (lease) => operation(lease))
          : await withRepositoryLock(root, operation);
      } catch (error) {
        if (error instanceof RepositoryLockError) throw new PairStoreError(error.message);
        throw error;
      }
    } finally {
      release();
      if (pairMutationTails.get(key) === current) pairMutationTails.delete(key);
    }
  }

  private mutate<T>(pairId: string, operation: (lease: RepositoryLease | null) => T): T {
    const root = this.readState(pairId)?.workspace.repoRoot;
    if (!root) return operation(null);
    try {
      return withRepositoryLockSync(root, operation);
    } catch (error) {
      if (error instanceof RepositoryLockError) throw new PairStoreError(error.message);
      throw error;
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
    const parsed = pairStateSchema.parse(state);
    try {
      return withRepositoryLockSync(parsed.workspace.repoRoot, () => {
        if (existsSync(this.path(parsed.pairId, 'state.json'))) throw new PairStoreError('Pair already exists');
        return this.write(pairStateSchema, parsed.pairId, 'state.json', parsed);
      });
    } catch (error) {
      if (error instanceof RepositoryLockError) throw new PairStoreError(error.message);
      throw error;
    }
  }

  readState(pairId: string): PairState | null {
    return this.read(pairStateSchema, pairId, 'state.json', null as unknown as PairState) as PairState | null;
  }

  private readDeletionState(pairId: string): { state: PairState; intent: PairDeletionIntent | null } {
    try {
      const state = pairStateSchema.parse(JSON.parse(readFileSyncWithRetry(this.path(pairId, 'state.json'))));
      const deletionPath = this.path(pairId, 'deletion.json');
      const intent = existsSync(deletionPath)
        ? pairDeletionIntentSchema.parse(JSON.parse(readFileSyncWithRetry(deletionPath)))
        : null;
      if (intent) this.validateDeletionIntent(state, intent);
      return { state, intent };
    } catch (error) {
      if (error instanceof PairStoreError) throw error;
      throw new PairStoreError(`Pair deletion state is missing or corrupt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private validateDeletionIntent(state: PairState, intent: PairDeletionIntent): void {
    if (state.phase !== 'complete' && state.phase !== 'stopped') throw new PairStoreError('Only a completed or stopped pair can be deleted');
    if (
      intent.pairId !== state.pairId
      || intent.managerRunId !== state.managerRunId
      || intent.workerRunId !== state.workerRunId
      || resolve(intent.repoRoot) !== resolve(state.workspace.repoRoot)
    ) throw new PairStoreError('Pair deletion intent does not match pair state');
  }

  private async finishDeletion(
    pairId: string,
    intent: PairDeletionIntent,
    remove: PairDeletionCallback,
    lease: RepositoryLease,
  ): Promise<void> {
    const current = this.readDeletionState(pairId);
    this.validateDeletionIntent(current.state, intent);
    lease.assertValid();
    await remove(intent);
    lease.assertValid();
    rmSync(this.dir(pairId), { recursive: true, force: true });
  }

  async delete(
    pairId: string,
    expected: { managerRunId: string; workerRunId?: string; repoRoot: string },
    remove: PairDeletionCallback,
    admit?: PairDeletionAdmission,
  ): Promise<void> {
    return this.serialize(pairId, async (lease) => {
      if (!lease) throw new PairStoreError('One & One deletion requires a repository lease');
      const current = this.readDeletionState(pairId);
      if (
        current.state.managerRunId !== expected.managerRunId
        || current.state.workerRunId !== expected.workerRunId
        || resolve(current.state.workspace.repoRoot) !== resolve(expected.repoRoot)
      ) throw new PairStoreError('Pair deletion identity does not match pair state');
      if (current.state.phase !== 'complete' && current.state.phase !== 'stopped') {
        throw new PairStoreError('Only a completed or stopped pair can be deleted');
      }
      const intent = current.intent ?? pairDeletionIntentSchema.parse({
        pairId,
        managerRunId: current.state.managerRunId,
        ...(current.state.workerRunId !== undefined ? { workerRunId: current.state.workerRunId } : {}),
        repoRoot: current.state.workspace.repoRoot,
        createdAt: new Date().toISOString(),
      });
      lease.assertValid();
      admit?.(intent);
      lease.assertValid();
      if (!current.intent) atomicWriteJsonSync(this.path(pairId, 'deletion.json'), intent);
      await this.finishDeletion(pairId, intent, remove, lease);
    }, expected.repoRoot, true);
  }

  async recoverDeletions(remove: PairDeletionCallback, admit?: PairDeletionAdmission): Promise<void> {
    const base = resolve(this.directory);
    if (!existsSync(base)) return;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pairId = entry.name;
      try {
        const deletionPath = this.path(pairId, 'deletion.json');
        if (!existsSync(deletionPath)) continue;
        const intent = pairDeletionIntentSchema.parse(JSON.parse(readFileSyncWithRetry(deletionPath)));
        await this.serialize(pairId, async (lease) => {
          if (!lease) throw new PairStoreError('One & One deletion requires a repository lease');
          lease.assertValid();
          admit?.(intent);
          lease.assertValid();
          await this.finishDeletion(pairId, intent, remove, lease);
        }, intent.repoRoot, true);
      } catch (error) {
        console.warn(`[onni] could not recover One & One deletion ${pairId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  updateState(pairId: string, patch: Partial<PairState>): PairState {
    return this.mutate(pairId, () => this.updateStateUnlocked(pairId, patch));
  }

  private updateStateUnlocked(pairId: string, patch: Partial<PairState>): PairState {
    const current = this.readState(pairId);
    if (!current) throw new PairStoreError('Pair does not exist');
    return this.write(pairStateSchema, pairId, 'state.json', { ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  setWorker(pairId: string, workerRunId: string): PairState {
    return this.updateState(pairId, { workerRunId });
  }

  transition(pairId: string, phase: PairPhase, activeRole?: PairRole, patch: Partial<PairState> = {}): PairState {
    return this.mutate(pairId, () => this.transitionUnlocked(pairId, phase, activeRole, patch));
  }

  private transitionUnlocked(pairId: string, phase: PairPhase, activeRole?: PairRole, patch: Partial<PairState> = {}): PairState {
    const current = this.readState(pairId);
    if (!current) throw new PairStoreError('Pair does not exist');
    const nextHandoffs = activeRole && current.activeRole && activeRole !== current.activeRole ? current.handoffs + 1 : current.handoffs;
    if (nextHandoffs > ONE_AND_ONE_MAX_HANDOFFS) throw new PairStoreError('One & One handoff limit reached');
    return this.updateStateUnlocked(pairId, { ...patch, phase, ...(activeRole ? { activeRole } : {}), handoffs: nextHandoffs });
  }

  listOrders(pairId: string): PairOrder[] {
    return this.read(pairOrderSchema.array(), pairId, 'orders.json', []);
  }

  getOrder(pairId: string, orderId: string): PairOrder | null {
    return this.listOrders(pairId).find((order) => order.id === orderId) ?? null;
  }

  enqueueOrder(pairId: string, input: DispatchInput): PairOrder {
    return this.mutate(pairId, () => this.enqueueOrderUnlocked(pairId, input));
  }

  private enqueueOrderUnlocked(pairId: string, input: DispatchInput): PairOrder {
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
    this.updateStateUnlocked(pairId, {
      phase: 'worker_queued',
      activeRole: 'worker',
      currentOrderId: order.id,
      orderRevision: revision,
    });
    return order;
  }

  discardQueuedOrder(pairId: string, orderId: string, previous: PairState): PairOrder {
    return this.mutate(pairId, () => this.discardQueuedOrderUnlocked(pairId, orderId, previous));
  }

  private discardQueuedOrderUnlocked(pairId: string, orderId: string, previous: PairState): PairOrder {
    const order = this.requireOrder(pairId, orderId);
    if (order.status !== 'queued') throw new PairStoreError('Only a queued order can be discarded');
    const updated = { ...order, status: 'rejected' as const, updatedAt: new Date().toISOString() };
    this.replaceOrderUnlocked(pairId, updated);
    this.updateStateUnlocked(pairId, {
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
    return this.mutate(pairId, () => this.markOrderWorkingUnlocked(pairId, orderId));
  }

  private markOrderWorkingUnlocked(pairId: string, orderId: string): PairOrder {
    const order = this.requireOrder(pairId, orderId);
    if (order.status !== 'queued') throw new PairStoreError('Order is not queued');
    const updated = { ...order, status: 'working' as const, updatedAt: new Date().toISOString() };
    this.replaceOrderUnlocked(pairId, updated);
    this.transitionUnlocked(pairId, 'worker_working', 'worker', { currentOrderId: orderId });
    return updated;
  }

  reportOrder(pairId: string, orderId: string, report: string): PairOrder {
    return this.mutate(pairId, () => this.reportOrderUnlocked(pairId, orderId, report));
  }

  private reportOrderUnlocked(pairId: string, orderId: string, report: string): PairOrder {
    const order = this.requireOrder(pairId, orderId);
    if (order.status !== 'working') throw new PairStoreError('Order is not being worked');
    const updated = pairOrderSchema.parse({ ...order, status: 'reported', report, updatedAt: new Date().toISOString() });
    this.replaceOrderUnlocked(pairId, updated);
    this.transitionUnlocked(pairId, 'manager_review', 'manager', { currentOrderId: orderId });
    return updated;
  }

  acceptOrder(pairId: string, input: PairAcceptInput): PairOrder {
    const parsed = pairAcceptInputSchema.parse(input);
    return this.mutate(pairId, () => this.acceptOrderUnlocked(pairId, parsed));
  }

  private acceptOrderUnlocked(pairId: string, input: PairAcceptInput): PairOrder {
    const order = this.requireOrder(pairId, input.orderId);
    if (order.status !== 'reported') throw new PairStoreError('Only a reported order can be accepted');
    const updated = { ...order, status: 'accepted' as const, updatedAt: new Date().toISOString() };
    this.replaceOrderUnlocked(pairId, updated);
    this.transitionUnlocked(pairId, 'final_check', 'manager', { currentOrderId: order.id });
    return updated;
  }

  listMessages(pairId: string): PairMessage[] {
    return this.read(pairMessageSchema.array(), pairId, 'messages.json', []);
  }

  appendMessage(pairId: string, from: PairRole, input: PairMessageInput): PairMessage {
    const parsed = pairMessageInputSchema.parse(input);
    return this.mutate(pairId, () => this.appendMessageUnlocked(pairId, from, parsed));
  }

  private appendMessageUnlocked(pairId: string, from: PairRole, parsed: PairMessageInput): PairMessage {
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
    this.write(pairMessageSchema.array(), pairId, 'messages.json', [...this.listMessages(pairId), message].slice(-ONE_AND_ONE_MAX_MESSAGES));
    this.updateStateUnlocked(pairId, {});
    return message;
  }

  listProposals(pairId: string): PairProposal[] {
    return this.read(pairProposalSchema.array(), pairId, 'proposals.json', []);
  }

  appendProposal(pairId: string, from: PairRole, input: PairProposalInput): PairProposal {
    const parsed = pairProposalInputSchema.parse(input);
    return this.mutate(pairId, () => this.appendProposalUnlocked(pairId, from, parsed));
  }

  private appendProposalUnlocked(pairId: string, from: PairRole, parsed: PairProposalInput): PairProposal {
    const state = this.readState(pairId);
    if (!state) throw new PairStoreError('Pair does not exist');
    if (parsed.orderId && !this.getOrder(pairId, parsed.orderId)) throw new PairStoreError('Unknown order');
    const now = new Date().toISOString();
    const proposal = pairProposalSchema.parse({
      id: randomUUID(),
      pairId,
      from,
      ...(parsed.orderId !== undefined ? { orderId: parsed.orderId } : {}),
      question: parsed.question,
      options: parsed.options,
      ...(parsed.recommendation !== undefined ? { recommendation: parsed.recommendation } : {}),
      status: 'open',
      createdAt: now,
    });
    const proposals = this.listProposals(pairId).map((entry) =>
      entry.status === 'open' ? { ...entry, status: 'superseded' as const } : entry,
    );
    const boundedProposals = [...proposals, proposal].slice(-ONE_AND_ONE_MAX_PROPOSALS);
    const retainedProposalIds = new Set(boundedProposals.map((entry) => entry.id));
    this.write(pairProposalSchema.array(), pairId, 'proposals.json', boundedProposals);
    this.write(pairDecisionSchema.array(), pairId, 'decisions.json', this.listDecisions(pairId).filter((entry) => retainedProposalIds.has(entry.proposalId)));
    this.updateStateUnlocked(pairId, {});
    return proposal;
  }

  listDecisions(pairId: string): PairDecision[] {
    return this.read(pairDecisionSchema.array(), pairId, 'decisions.json', []);
  }

  decide(pairId: string, decidedBy: PairRole, input: PairDecisionInput): PairDecision {
    const parsed = pairDecisionInputSchema.parse(input);
    return this.mutate(pairId, () => this.decideUnlocked(pairId, decidedBy, parsed));
  }

  private decideUnlocked(pairId: string, decidedBy: PairRole, parsed: PairDecisionInput): PairDecision {
    const proposals = this.listProposals(pairId);
    const proposal = proposals.find((entry) => entry.id === parsed.proposalId);
    if (!proposal || proposal.status !== 'open') throw new PairStoreError('Proposal is not open');
    if (parsed.outcome === 'chosen' && !proposal.options.some((option) => option.id === parsed.optionId)) {
      throw new PairStoreError('Chosen option does not belong to the proposal');
    }
    const decision = pairDecisionSchema.parse({
      id: randomUUID(),
      pairId,
      proposalId: proposal.id,
      decidedBy,
      outcome: parsed.outcome,
      ...(parsed.optionId !== undefined ? { optionId: parsed.optionId } : {}),
      ...(parsed.note !== undefined ? { note: parsed.note } : {}),
      createdAt: new Date().toISOString(),
    });
    this.write(pairDecisionSchema.array(), pairId, 'decisions.json', [...this.listDecisions(pairId), decision].slice(-ONE_AND_ONE_MAX_DECISIONS));
    this.write(pairProposalSchema.array(), pairId, 'proposals.json', proposals.map((entry) =>
      entry.id === proposal.id ? { ...entry, status: parsed.outcome === 'chosen' ? 'chosen' as const : 'declined' as const } : entry,
    ));
    this.updateStateUnlocked(pairId, {});
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

  private replaceOrderUnlocked(pairId: string, updated: PairOrder): void {
    const orders = this.listOrders(pairId);
    if (!orders.some((order) => order.id === updated.id)) throw new PairStoreError('Unknown order');
    this.write(pairOrderSchema.array(), pairId, 'orders.json', orders.map((order) => order.id === updated.id ? updated : order));
  }
}
