import { execFileSync } from 'node:child_process';
import type { PairOrder, PairState } from '@onni/contract';

/** Spec 2026-11-26: evidence belongs to a clean checkpoint, never merely a model's claim. */
export function pairVerificationHead(root: string): string {
  const git = (...args: string[]) => execFileSync('git', ['--no-optional-locks', ...args], {
    cwd: root, windowsHide: true, encoding: 'utf8', timeout: 5_000, maxBuffer: 1024 * 1024,
  }).trim();
  const status = git('status', '--porcelain=v1', '--untracked-files=all', '--', '.', ':(exclude).ai/onni');
  if (status) throw new Error('One & One verification is stale: checkpoint the changed files and run onni task verify again');
  return git('rev-parse', 'HEAD');
}

export function assertPairOrderVerified(state: PairState, order: PairOrder, note = order.acceptanceNote): void {
  if (order.reportOutcome === 'failed' || order.report?.startsWith('WORKER ENDED EARLY')) {
    throw new Error('A failed worker report cannot be accepted; issue a revised order');
  }
  // Old state has no checkpoint provenance and retains its existing manual review path.
  if (!order.checkpointSha) return;
  const evidence = order.verification;
  if (!evidence || evidence.state === 'failed') throw new Error('Run onni task verify for the current worker before accepting or finishing this order');
  if (evidence.state === 'unavailable' && evidence.reasonCode !== 'dry-run'
    && (evidence.reasonCode !== 'no-commands' || !note?.trim())) {
    throw new Error('Verification is unavailable; when no checks exist, accept with an explicit manual review --note');
  }
  if (evidence.checkpointSha !== state.lastCheckpointSha || pairVerificationHead(state.workspace.repoRoot) !== evidence.checkpointSha) {
    throw new Error('One & One verification is stale: run onni task verify again for the current checkpoint');
  }
}
