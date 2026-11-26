import { z } from 'zod';

export const ONE_AND_ONE_MAX_ORDER_REVISIONS = 20;
export const ONE_AND_ONE_MAX_HANDOFFS = 100;
export const ONE_AND_ONE_MAX_MESSAGES = 200;
export const ONE_AND_ONE_MAX_PROPOSALS = 200;
export const ONE_AND_ONE_MAX_DECISIONS = 200;

export const pairRoleSchema = z.enum(['manager', 'worker']);
export type PairRole = z.infer<typeof pairRoleSchema>;

export const PAIR_PHASES = [
  'planning',
  'worker_queued',
  'worker_working',
  'manager_review',
  'discussion',
  'user_wait',
  'transitioning',
  'final_check',
  'complete',
  'stopped',
] as const;
export const pairPhaseSchema = z.enum(PAIR_PHASES);
export type PairPhase = z.infer<typeof pairPhaseSchema>;

const id = z.string().min(1).max(120);
const timestamp = z.string().min(1).max(40);
const sha = z.string().regex(/^[0-9a-f]{7,64}$/i);

export const pairWorkspaceSchema = z.strictObject({
  repoRoot: z.string().min(1).max(4096),
  branch: z.string().min(1).max(512),
  baselineSha: sha,
});
export type PairWorkspace = z.infer<typeof pairWorkspaceSchema>;

export const pairOrderStatusSchema = z.enum(['queued', 'working', 'reported', 'accepted', 'superseded', 'rejected']);
export type PairOrderStatus = z.infer<typeof pairOrderStatusSchema>;

export const pairOrderSchema = z.strictObject({
  id,
  revision: z.number().int().min(1).max(ONE_AND_ONE_MAX_ORDER_REVISIONS),
  objective: z.string().min(1).max(4000),
  scope: z.string().max(1000).optional(),
  successCriteria: z.string().max(1000).optional(),
  requiredEvidence: z.string().max(1000).optional(),
  status: pairOrderStatusSchema,
  report: z.string().max(20_000).optional(),
  // Optional for pre-hardening orders; new engine reports carry their provenance.
  reportOutcome: z.enum(['completed', 'failed']).optional(),
  checkpointSha: sha.optional(),
  acceptanceNote: z.string().max(4000).optional(),
  delivery: z.strictObject({
    attempts: z.number().int().min(0).max(6),
    nextAttemptAt: timestamp.optional(),
    deliveredAt: timestamp.optional(),
  }).optional(),
  verification: z.strictObject({
    state: z.enum(['passed', 'failed', 'unavailable']),
    checkpointSha: sha,
    reasonCode: z.string().max(80).optional(),
    at: timestamp,
  }).optional(),
  verificationRuns: z.number().int().min(0).max(3).optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type PairOrder = z.infer<typeof pairOrderSchema>;

export const pairStateSchema = z.strictObject({
  pairId: id,
  managerRunId: id,
  workerRunId: id.optional(),
  phase: pairPhaseSchema,
  activeRole: pairRoleSchema.optional(),
  workspace: pairWorkspaceSchema,
  currentOrderId: id.optional(),
  orderRevision: z.number().int().min(0).max(ONE_AND_ONE_MAX_ORDER_REVISIONS),
  handoffs: z.number().int().min(0).max(ONE_AND_ONE_MAX_HANDOFFS),
  lastCheckpointSha: sha.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: timestamp.optional(),
});
export type PairState = z.infer<typeof pairStateSchema>;

export const pairMemberSchema = z.strictObject({
  pairId: id,
  role: pairRoleSchema,
  peerRunId: id,
});
export type PairMember = z.infer<typeof pairMemberSchema>;

export const pairMessageKindSchema = z.enum(['note', 'question', 'answer']);
export const pairMessageSchema = z.strictObject({
  id,
  pairId: id,
  from: pairRoleSchema,
  to: pairRoleSchema,
  kind: pairMessageKindSchema,
  text: z.string().min(1).max(20_000),
  orderId: id.optional(),
  replyTo: id.optional(),
  createdAt: timestamp,
});
export type PairMessage = z.infer<typeof pairMessageSchema>;

export const pairMessageInputSchema = z.strictObject({
  kind: pairMessageKindSchema.default('note'),
  text: z.string().trim().min(1).max(20_000),
  orderId: id.optional(),
  replyTo: id.optional(),
});
export type PairMessageInput = z.input<typeof pairMessageInputSchema>;

export const pairProposalOptionSchema = z.strictObject({
  id: id,
  title: z.string().trim().min(1).max(160),
  detail: z.string().max(2000).optional(),
});
export type PairProposalOption = z.infer<typeof pairProposalOptionSchema>;

export const pairProposalSchema = z.strictObject({
  id,
  pairId: id,
  from: pairRoleSchema,
  orderId: id.optional(),
  question: z.string().trim().min(1).max(2000),
  options: z.array(pairProposalOptionSchema).min(2).max(4),
  recommendation: id.optional(),
  status: z.enum(['open', 'chosen', 'declined', 'superseded']),
  createdAt: timestamp,
});
export type PairProposal = z.infer<typeof pairProposalSchema>;

export const pairProposalInputSchema = z
  .strictObject({
    orderId: id.optional(),
    question: z.string().trim().min(1).max(2000),
    options: z.array(pairProposalOptionSchema).min(2).max(4),
    recommendation: id.optional(),
  })
  .superRefine((proposal, ctx) => {
    const seen = new Set<string>();
    proposal.options.forEach((option, index) => {
      if (seen.has(option.id)) ctx.addIssue({ code: 'custom', path: ['options', index, 'id'], message: 'option ids must be unique' });
      seen.add(option.id);
    });
    if (proposal.recommendation && !seen.has(proposal.recommendation)) {
      ctx.addIssue({ code: 'custom', path: ['recommendation'], message: 'recommendation must name one of the options' });
    }
  });
export type PairProposalInput = z.infer<typeof pairProposalInputSchema>;

export const pairDecisionSchema = z.strictObject({
  id,
  pairId: id,
  proposalId: id,
  decidedBy: pairRoleSchema,
  outcome: z.enum(['chosen', 'declined']),
  optionId: id.optional(),
  note: z.string().max(4000).optional(),
  createdAt: timestamp,
});
export type PairDecision = z.infer<typeof pairDecisionSchema>;

export const pairDecisionInputSchema = z
  .strictObject({
    proposalId: id,
    outcome: z.enum(['chosen', 'declined']),
    optionId: id.optional(),
    note: z.string().max(4000).optional(),
  })
  .superRefine((decision, ctx) => {
    if (decision.outcome === 'chosen' && !decision.optionId) {
      ctx.addIssue({ code: 'custom', path: ['optionId'], message: 'a chosen decision needs an option id' });
    }
    if (decision.outcome === 'declined' && decision.optionId) {
      ctx.addIssue({ code: 'custom', path: ['optionId'], message: 'a declined decision cannot choose an option' });
    }
  });
export type PairDecisionInput = z.infer<typeof pairDecisionInputSchema>;

export const pairAcceptInputSchema = z.strictObject({
  orderId: id,
  note: z.string().max(4000).optional(),
});
export type PairAcceptInput = z.infer<typeof pairAcceptInputSchema>;

export const pairSnapshotSchema = z.strictObject({
  state: pairStateSchema,
  orders: z.array(pairOrderSchema),
  messages: z.array(pairMessageSchema),
  proposals: z.array(pairProposalSchema),
  decisions: z.array(pairDecisionSchema),
});
export type PairSnapshot = z.infer<typeof pairSnapshotSchema>;

export const pairDispatchResultSchema = z.strictObject({
  workerRunId: id,
  orderId: id,
  revision: z.number().int().min(1).max(ONE_AND_ONE_MAX_ORDER_REVISIONS),
});
export type PairDispatchResult = z.infer<typeof pairDispatchResultSchema>;
