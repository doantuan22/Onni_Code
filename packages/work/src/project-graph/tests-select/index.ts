import { normalizePath, type SelectTests } from '../impact.ts';
import type { ProjectGraphService } from '../index.ts';
import type { Coverage, Snapshot, TestCandidate, TestsResult, Unavailable } from '../types.ts';
import { selectGraphTests, selectTestsAdapter } from './graph-select.ts';
import { runVitestRelated, type ExecuteVitest } from './runner.ts';

export { selectGraphTests, selectTestsAdapter } from './graph-select.ts';
export { RUNNER_OUTPUT_CAP, RUNNER_TIMEOUT_MS, runVitestRelated, type ExecuteVitest, type ExecuteVitestOptions, type RunnerOutcome } from './runner.ts';

export interface SelectTestsOptions {
  files: string[];
  runner?: boolean;
  maxItems?: number;
  signal?: AbortSignal;
  /** Injection seam for runner tests. */
  execute?: ExecuteVitest;
}

const RANK = { high: 3, medium: 2, low: 1 } as const;

function mergeCandidates(graph: TestCandidate[], runner: TestCandidate[]): TestCandidate[] {
  const merged = new Map(graph.map((candidate) => [candidate.path, candidate]));
  for (const candidate of runner) {
    const previous = merged.get(candidate.path);
    if (!previous) merged.set(candidate.path, candidate);
    else if (RANK[candidate.confidence] > RANK[previous.confidence]) merged.set(candidate.path, previous);
  }
  return [...merged.values()].sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || a.path.localeCompare(b.path));
}

/** Graph candidates are always retained; Vitest related is an opt-in additive source. */
export async function selectTests(
  service: ProjectGraphService,
  options: SelectTestsOptions,
): Promise<TestsResult | Unavailable> {
  const status = await service.getStatus();
  if (status.state === 'empty' || status.state === 'building' || status.state === 'unavailable' || status.state === 'disabled') {
    return { available: false, reason: status.reason ?? `project graph is ${status.state}` };
  }

  const changed = [...new Set(options.files.map(normalizePath).filter(Boolean))];
  const allDependents = [...new Set(changed.flatMap((path) => service.dependentsOf(path)))].sort();
  const graphTests = selectGraphTests(service, changed, allDependents);
  const runner = await runVitestRelated({
    root: service.root,
    files: changed,
    requested: options.runner === true,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.execute ? { execute: options.execute } : {}),
  });
  const merged = mergeCandidates(graphTests, runner.tests);
  const max = Math.max(1, Math.floor(options.maxItems ?? 200));
  const truncated = merged.length > max;
  const tests = merged.slice(0, max);
  const scope = new Set([...changed, ...allDependents]);
  const notInGraph = changed.filter((path) => !service.has(path));
  let unresolvedImports = 0;
  let unparsedFiles = 0;
  for (const path of scope) {
    unresolvedImports += service.unresolvedIn(path);
    if (service.unparsedIn(path)) unparsedFiles++;
  }
  const complete = !truncated && notInGraph.length === 0 && unresolvedImports === 0 && unparsedFiles === 0 && !status.state.includes('stale');
  const coverage: Coverage = { unresolvedImports, unparsedFiles, notInGraph };
  coverage.note = complete
    ? 'These are graph-based suggestions; run the full test suite afterward.'
    : `Graph coverage is incomplete; run a broader test suite afterward${truncated ? ' (candidate list was truncated)' : ''}.`;
  const snapshot: Snapshot = service.snapshot(status.state === 'stale');
  return { snapshot, complete, truncated, coverage, tests, runner: { used: runner.used, available: runner.available, ...(runner.reason ? { reason: runner.reason } : {}) } };
}

/** Adapter form accepted by ProjectGraphServiceOptions.selectTests. */
export const selectTestsForImpact: SelectTests = selectTestsAdapter;
