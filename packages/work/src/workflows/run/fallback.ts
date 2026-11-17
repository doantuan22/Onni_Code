import { RUNNER_IDS, type RunnerId } from '../../core/agent-runner.ts';

/**
 * The next provider to hand a usage-limit-stopped run to, when one qualifies.
 *
 * Deterministic and pure: the other providers in canonical order, minus the current one, minus any
 * whose default login is not connected, minus any whose account is already held for its own usage
 * window. Each of those would fail again immediately, so skipping them is the whole safety story.
 * Only the discovered default login of a DIFFERENT provider is considered — a second login of the
 * same provider is a different account and deliberately out of scope here.
 */
export function chooseFallbackTarget(
  currentRunner: string | undefined,
  usable: ReadonlySet<RunnerId>,
  heldKeys: ReadonlySet<string>,
): RunnerId | undefined {
  for (const runner of RUNNER_IDS) {
    if (runner === currentRunner) continue;
    if (!usable.has(runner)) continue;
    if (heldKeys.has(`${runner}:default`)) continue;
    return runner;
  }
  return undefined;
}

/**
 * Whether the limit→failover hand-off is on. Opt-in, off by default: it spends money on a
 * DIFFERENT login than the task started on, so it is a bigger step than waiting out the reset and
 * never the zero-config answer. An exact `'1'` opts in — the house spelling.
 */
export function fallbacksEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ONNI_FAILOVER === '1';
}
