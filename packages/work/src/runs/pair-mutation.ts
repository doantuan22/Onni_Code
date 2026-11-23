export const PAIR_RUN_MUTATION_REFUSAL =
  'One & One owns this shared checkout; pair runs cannot directly land, review, commit, push, mutate branches, or remove worktrees';

type PairRunLike = {
  id: string;
  status?: string;
  dispatch?: {
    rootRunId?: string;
    pair?: { phase?: string | undefined };
    pairMember?: unknown;
  };
};

/** Pair checkpoints use their own fenced path; this predicate fences user/agent-driven mutation boundaries. */
export function isPairRun(run: PairRunLike | null | undefined): boolean {
  if (!run?.dispatch) return false;
  return run.dispatch.pairMember !== undefined
    || (run.dispatch.pair !== undefined && run.dispatch.rootRunId === run.id);
}

export function pairRunMutationRefusal(run: PairRunLike | null | undefined): string | null {
  return isPairRun(run) ? PAIR_RUN_MUTATION_REFUSAL : null;
}

/** Repository-wide Git actions may move the shared checkout, but historical pairs own nothing. */
export function livePairMutationRefusal(run: PairRunLike | null | undefined): string | null {
  if (!run?.dispatch || run.dispatch.rootRunId !== run.id || !run.dispatch.pair) return null;
  if (run.dispatch.pair.phase === 'stopped' || run.dispatch.pair.phase === 'complete') return null;
  if (run.status !== undefined && ['done', 'failed', 'cancelled'].includes(run.status)) return null;
  return PAIR_RUN_MUTATION_REFUSAL;
}
