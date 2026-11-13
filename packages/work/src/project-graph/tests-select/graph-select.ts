import { posix } from 'node:path';
import type { SelectTests } from '../impact.ts';
import type { TestCandidate } from '../types.ts';

export interface TestSelectionAccess {
  allTests(): string[];
  dependentsOf(path: string): string[];
  isHub(path: string): boolean;
  isTest(path: string): boolean;
  testsFor(path: string): TestCandidate[];
}

const RANK = { high: 3, medium: 2, low: 1 } as const;

function siblingTests(path: string, allTests: ReadonlySet<string>): string[] {
  const match = /^(.*?)(\.[cm]?[jt]sx?)$/.exec(path);
  if (!match) return [];
  const candidates: string[] = [];
  for (const marker of ['.test', '.spec']) {
    for (const ext of ['.ts', '.tsx', '.mts', '.js', '.mjs']) {
      const candidate = `${match[1]}${marker}${ext}`;
      if (allTests.has(candidate)) candidates.push(candidate);
    }
  }
  return candidates;
}

/** Select direct and one-hop test candidates; deliberately do not walk through dependents. */
export function selectGraphTests(
  graph: TestSelectionAccess,
  changed: readonly string[],
  dependents: readonly string[] = changed.flatMap((path) => graph.dependentsOf(path)),
): TestCandidate[] {
  const selected = new Map<string, TestCandidate>();
  const add = (candidate: TestCandidate): void => {
    const previous = selected.get(candidate.path);
    if (!previous || RANK[candidate.confidence] > RANK[previous.confidence]) selected.set(candidate.path, candidate);
  };
  const allTests = new Set(graph.allTests());

  for (const path of changed) {
    if (graph.isTest(path)) add({ path, confidence: 'high', reason: 'changed test file', source: 'graph' });
    for (const candidate of graph.testsFor(path)) add(candidate);
  }

  // `dependents` is the one-hop scope supplied by impact or derived from changed paths.
  for (const dependent of dependents) {
    if (graph.isTest(dependent)) continue;
    for (const test of siblingTests(dependent, allTests)) {
      add({
        path: test,
        confidence: 'medium',
        reason: `sibling test of dependent \`${posix.basename(dependent)}\``,
        source: 'graph',
      });
    }
  }

  return [...selected.values()].sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || a.path.localeCompare(b.path));
}

/** Pass this adapter to ProjectGraphServiceOptions.selectTests for `impact().tests`. */
export const selectTestsAdapter: SelectTests = ({ graph, changed, dependents }) =>
  selectGraphTests(graph, changed, dependents);
