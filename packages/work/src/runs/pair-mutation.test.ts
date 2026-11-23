import { describe, expect, it } from 'vitest';
import { isPairRun, livePairMutationRefusal, PAIR_RUN_MUTATION_REFUSAL, pairRunMutationRefusal } from './pair-mutation.ts';

describe('pair-run mutation predicate', () => {
  it('fences pair roots and persistent workers only', () => {
    expect(isPairRun({ id: 'root', dispatch: { rootRunId: 'root', pair: {} } })).toBe(true);
    expect(isPairRun({ id: 'worker', dispatch: { rootRunId: 'root', pairMember: {} } })).toBe(true);
    expect(isPairRun({ id: 'ordinary', dispatch: { rootRunId: 'ordinary' } })).toBe(false);
    expect(isPairRun({ id: 'ordinary' })).toBe(false);
    expect(isPairRun(null)).toBe(false);
  });

  it('does not mistake a cached pair payload on a non-root for a pair root', () => {
    expect(isPairRun({ id: 'worker', dispatch: { rootRunId: 'root', pair: {} } })).toBe(false);
    expect(pairRunMutationRefusal({ id: 'root', dispatch: { rootRunId: 'root', pair: {} } })).toBe(PAIR_RUN_MUTATION_REFUSAL);
    expect(pairRunMutationRefusal({ id: 'ordinary' })).toBeNull();
  });

  it('fences repository-wide Git actions only while the pair owns the checkout', () => {
    expect(livePairMutationRefusal({ id: 'root', status: 'running', dispatch: { rootRunId: 'root', pair: { phase: 'planning' } } })).toBe(PAIR_RUN_MUTATION_REFUSAL);
    expect(livePairMutationRefusal({ id: 'root', status: 'waiting', dispatch: { rootRunId: 'root', pair: { phase: 'manager_review' } } })).toBe(PAIR_RUN_MUTATION_REFUSAL);
    expect(livePairMutationRefusal({ id: 'root', status: 'done', dispatch: { rootRunId: 'root', pair: { phase: 'complete' } } })).toBeNull();
    expect(livePairMutationRefusal({ id: 'root', status: 'failed', dispatch: { rootRunId: 'root', pair: { phase: 'stopped' } } })).toBeNull();
    expect(livePairMutationRefusal({ id: 'worker', status: 'running', dispatch: { rootRunId: 'root', pairMember: {} } })).toBeNull();
  });
});
