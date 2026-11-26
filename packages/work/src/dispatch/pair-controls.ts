import {
  pairAcceptInputSchema,
  pairDecisionInputSchema,
  pairMessageInputSchema,
  pairProposalInputSchema,
  type PairAcceptInput,
  type PairDecision,
  type PairDecisionInput,
  type PairMessage,
  type PairMessageInput,
  type PairOrder,
  type PairProposal,
  type PairProposalInput,
  type PairRole,
  type PairSnapshot,
  type PairState,
} from '@onni/contract';
import type { RunStore } from '../runs/store.ts';
import { deliverPairPeerText, type PairDeliveryContext } from '../workflows/run/pair-coordinator.ts';
import { mirrorPairState } from '../workflows/run/pair-runtime.ts';
import { PairStore, PairStoreError } from './pair-store.ts';

export interface PairControlContext {
  store: RunStore;
  dataDir: string;
  active?: PairDeliveryContext['active'];
  deliverMessage?: PairDeliveryContext['deliverMessage'];
  deferMessage?: PairDeliveryContext['deferMessage'];
  continueRun?: PairDeliveryContext['continueRun'];
}

export interface PairControlDenial {
  denied: string;
  status: 403 | 404 | 409;
}

type PairControlResult<T> = T | PairControlDenial;
type PairOperation<T> = (pairs: PairStore, state: PairState, role: PairRole, callerId: string) => T;

function withPair<T>(
  context: PairControlContext,
  callerId: string,
  operation: PairOperation<T>,
): Promise<PairControlResult<T>> {
  const caller = context.store.getRun(callerId);
  if (!caller) return Promise.resolve({ denied: 'no such run', status: 404 });
  const rootPairId = caller.dispatch?.pair?.pairId;
  const memberPairId = caller.dispatch?.pairMember?.pairId;
  if (rootPairId && memberPairId && rootPairId !== memberPairId) {
    return Promise.resolve({ denied: 'run references more than one pair', status: 409 });
  }
  const pairId = rootPairId ?? memberPairId;
  if (!pairId) return Promise.resolve({ denied: 'run is not part of a One & One pair', status: 404 });

  const pairs = new PairStore(context.dataDir);
  return Promise.resolve().then(() => pairs.serialize<PairControlResult<T>>(pairId, (): PairControlResult<T> => {
    const currentCaller = context.store.getRun(callerId);
    if (!currentCaller) return { denied: 'no such run', status: 404 };
    const currentRootPairId = currentCaller.dispatch?.pair?.pairId;
    const currentMemberPairId = currentCaller.dispatch?.pairMember?.pairId;
    if (currentRootPairId && currentMemberPairId && currentRootPairId !== currentMemberPairId) {
      return { denied: 'run references more than one pair', status: 409 };
    }
    const state = pairs.readState(pairId);
    if (!state) return { denied: 'pair state not found', status: 404 };
    const role = authorizePairCaller(currentCaller, state, currentRootPairId, currentMemberPairId);
    if (!role) return { denied: 'run does not belong to this pair', status: 403 };
    return operation(pairs, state, role, callerId);
  })).catch((error: unknown) => {
    if (error instanceof PairStoreError) return { denied: error.message, status: 409 as const };
    throw error;
  });
}

function authorizePairCaller(
  caller: NonNullable<ReturnType<RunStore['getRun']>>,
  state: PairState,
  rootPairId: string | undefined,
  memberPairId: string | undefined,
): PairRole | null {
  if (caller.id === state.managerRunId) {
    if (caller.dispatch?.rootRunId !== caller.id || rootPairId !== state.pairId) return null;
    return 'manager';
  }
  if (caller.id === state.workerRunId) {
    const member = caller.dispatch?.pairMember;
    if (
      caller.dispatch?.rootRunId !== state.managerRunId
      || memberPairId !== state.pairId
      || member?.role !== 'worker'
      || member.peerRunId !== state.managerRunId
    ) return null;
    return 'worker';
  }
  return null;
}

function assertPairMutable(state: PairState): PairControlDenial | null {
  if (state.phase === 'stopped' || state.phase === 'complete') {
    return { denied: `pair is ${state.phase}`, status: 409 };
  }
  return null;
}

function notifyPeer(context: PairControlContext, state: PairState, role: PairRole, text: string): void {
  if (!context.active || !context.deliverMessage || !context.deferMessage || !context.continueRun) return;
  const peerRunId = role === 'manager' ? state.workerRunId : state.managerRunId;
  if (!peerRunId) return;
  deliverPairPeerText({
    store: context.store,
    active: context.active,
    deliverMessage: context.deliverMessage,
    deferMessage: context.deferMessage,
    continueRun: context.continueRun,
  }, peerRunId, text, 'One & One peer message is saved, but could not be delivered automatically');
}

export function pairSnapshotFor(
  context: PairControlContext,
  callerId: string,
): Promise<PairControlResult<PairSnapshot>> {
  return withPair(context, callerId, (pairs, state) => pairs.snapshot(state.pairId)!);
}

export function pairMessageFor(
  context: PairControlContext,
  callerId: string,
  input: PairMessageInput,
): Promise<PairControlResult<PairMessage>> {
  return withPair(context, callerId, (pairs, state, role, actorId): PairControlResult<PairMessage> => {
    const denied = assertPairMutable(state);
    if (denied) return denied;
    const parsed = pairMessageInputSchema.parse({
      ...input,
      text: context.store.redactRunText(actorId, input.text),
    });
    const message = pairs.appendMessage(state.pairId, role, parsed);
    mirrorPairState(context.store, pairs.readState(state.pairId)!);
    notifyPeer(context, state, role, [
      `One & One ${role} message (${message.kind})`,
      ...(message.orderId ? [`Order: ${message.orderId}`] : []),
      '',
      message.text,
    ].join('\n'));
    return message;
  });
}

export function pairProposalFor(
  context: PairControlContext,
  callerId: string,
  input: PairProposalInput,
): Promise<PairControlResult<PairProposal>> {
  return withPair(context, callerId, (pairs, state, role, actorId): PairControlResult<PairProposal> => {
    const denied = assertPairMutable(state);
    if (denied) return denied;
    const parsed = pairProposalInputSchema.parse({
      ...input,
      question: context.store.redactRunText(actorId, input.question),
      options: input.options.map((option) => ({
        ...option,
        title: context.store.redactRunText(actorId, option.title),
        ...(option.detail !== undefined ? { detail: context.store.redactRunText(actorId, option.detail) } : {}),
      })),
    });
    const proposal = pairs.appendProposal(state.pairId, role, parsed);
    mirrorPairState(context.store, pairs.readState(state.pairId)!);
    notifyPeer(context, state, role, [
      `One & One ${role} proposal`,
      ...(proposal.orderId ? [`Order: ${proposal.orderId}`] : []),
      '',
      proposal.question,
      ...proposal.options.map((option) => `- ${option.id}: ${option.title}${option.detail ? ` — ${option.detail}` : ''}`),
      ...(proposal.recommendation ? [`Recommendation: ${proposal.recommendation}`] : []),
    ].join('\n'));
    return proposal;
  });
}

export function pairDecisionFor(
  context: PairControlContext,
  callerId: string,
  input: PairDecisionInput,
): Promise<PairControlResult<PairDecision>> {
  return withPair(context, callerId, (pairs, state, role, actorId): PairControlResult<PairDecision> => {
    const denied = assertPairMutable(state);
    if (denied) return denied;
    const parsed = pairDecisionInputSchema.parse({
      ...input,
      ...(input.note !== undefined ? { note: context.store.redactRunText(actorId, input.note) } : {}),
    });
    const decision = pairs.decide(state.pairId, role, parsed);
    mirrorPairState(context.store, pairs.readState(state.pairId)!);
    notifyPeer(context, state, role, [
      `One & One ${role} decision`,
      `Proposal: ${decision.proposalId}`,
      `Outcome: ${decision.outcome}${decision.optionId ? ` (${decision.optionId})` : ''}`,
      ...(decision.note ? [`Note: ${decision.note}`] : []),
    ].join('\n'));
    return decision;
  });
}

export function pairAcceptFor(
  context: PairControlContext,
  callerId: string,
  input: PairAcceptInput,
  onAccepted?: (managerRunId: string) => void,
): Promise<PairControlResult<PairOrder>> {
  return withPair(context, callerId, (pairs, state, role, actorId): PairControlResult<PairOrder> => {
    if (role !== 'manager') return { denied: 'only the manager can accept an order', status: 403 };
    const denied = assertPairMutable(state);
    if (denied) return denied;
    if (state.phase !== 'manager_review') return { denied: 'orders can be accepted only during manager review', status: 409 };
    if (state.currentOrderId !== input.orderId) return { denied: 'only the current order can be accepted', status: 409 };
    const order = pairs.getOrder(state.pairId, input.orderId);
    if (!order) return { denied: 'unknown order', status: 404 };
    if (order.status !== 'reported' && order.status !== 'accepted') return { denied: 'only a reported order can be accepted', status: 409 };
    const parsed = pairAcceptInputSchema.parse({
      ...input,
      ...(input.note !== undefined ? { note: context.store.redactRunText(actorId, input.note) } : {}),
    });
    const accepted = pairs.acceptOrder(state.pairId, parsed);
    mirrorPairState(context.store, pairs.readState(state.pairId)!);
    context.store.appendEvent(state.managerRunId, {
      type: 'pair-order-accepted',
      pairId: state.pairId,
      orderId: accepted.id,
      actor: actorId,
      ...(parsed.note !== undefined ? { note: parsed.note } : {}),
    });
    onAccepted?.(state.managerRunId);
    return accepted;
  });
}
