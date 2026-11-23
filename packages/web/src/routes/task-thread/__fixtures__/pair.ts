import type { PairSnapshot, PairState } from '@onni/api-client'

/** One complete contract-shaped snapshot shared by the One & One UI tests. */
export function pairSnapshot(
  state: Partial<PairState> = {},
  collections: Partial<Omit<PairSnapshot, 'state'>> = {},
): PairSnapshot {
  const timestamp = '2026-11-18T10:00:00.000Z'
  return {
    state: {
      pairId: 'pair-1',
      managerRunId: 'manager-r1',
      workerRunId: 'worker-r1',
      phase: 'manager_review',
      activeRole: 'worker',
      workspace: {
        repoRoot: '/repos/onni',
        branch: 'onni/pair-1',
        baselineSha: 'abcdef123456',
      },
      currentOrderId: 'order-1',
      orderRevision: 2,
      handoffs: 1,
      lastCheckpointSha: '123456abcdef0',
      createdAt: timestamp,
      updatedAt: timestamp,
      ...state,
    },
    orders: [{
      id: 'order-1',
      revision: 2,
      objective: 'Cover the pair status UI with focused tests.',
      scope: 'packages/web only',
      successCriteria: 'Focused tests pass.',
      requiredEvidence: 'Vitest output',
      status: 'reported',
      report: 'Added client, query, event and rendering coverage.',
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    messages: [{
      id: 'message-1',
      pairId: 'pair-1',
      from: 'worker',
      to: 'manager',
      kind: 'answer',
      text: 'The implementation and tests are ready.',
      orderId: 'order-1',
      createdAt: timestamp,
    }],
    proposals: [{
      id: 'proposal-1',
      pairId: 'pair-1',
      from: 'manager',
      orderId: 'order-1',
      question: 'Which verification should run first?',
      options: [
        { id: 'option-1', title: 'Focused web tests', detail: 'Start with the affected suites.' },
        { id: 'option-2', title: 'Full typecheck', detail: 'Check every workspace.' },
      ],
      recommendation: 'option-1',
      status: 'open',
      createdAt: timestamp,
    }],
    decisions: [{
      id: 'decision-1',
      pairId: 'pair-1',
      proposalId: 'proposal-1',
      decidedBy: 'manager',
      outcome: 'chosen',
      optionId: 'option-1',
      note: 'Keep the feedback loop short.',
      createdAt: timestamp,
    }],
    ...collections,
  }
}
