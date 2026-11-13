import { buildGraph, type BuildOptions, type BuildStats } from './build.ts';
import { ensureFresh, type RefreshOptions } from './freshness.ts';
import type { ProjectGraph } from './graph.ts';
import { computeImpact, normalizePath, type ImpactInput, type SelectTests } from './impact.ts';
import { gitHead, type GitRun } from './list-files.ts';
import type { GraphStatus, ImpactResult, Snapshot, TestCandidate, Unavailable } from './types.ts';

export type { ImpactInput, SelectTests } from './impact.ts';
export type { GraphStatus, ImpactResult, Snapshot, TestCandidate, TestsResult, Coverage, GraphItem, HubGroup, Unavailable } from './types.ts';
export { isDenied } from './denylist.ts';

export interface ProjectGraphServiceOptions {
  /** Test seam: replaces the git spawn. */
  run?: GitRun;
  /** Replaces the built-in test ranking in `impact` (T1). */
  selectTests?: SelectTests;
  /** Time budget for the pre-query freshness pass. */
  freshnessDeadlineMs?: number;
}

export type BuildOutcome =
  | { started: true; status: GraphStatus; stats: BuildStats }
  | { started: false; status: GraphStatus; reason: string };

/**
 * One instance per repo root. Read handlers (`getStatus`, `impact`, the accessors) never build: with no graph they report
 * `empty`/`building`. Only {@link build} builds, and only one build runs at a time.
 */
export class ProjectGraphService {
  private graph: ProjectGraph | null = null;
  private head: string | null = null;
  private builtAt = '';
  private building: Promise<BuildOutcome> | null = null;
  private lastFailure: string | null = null;

  constructor(
    readonly root: string,
    private readonly opts: ProjectGraphServiceOptions = {},
  ) {}

  /** In-memory state only; a `stale` verdict needs one cheap `git rev-parse`. */
  async getStatus(): Promise<GraphStatus> {
    return this.building ? { state: 'building' } : this.settledStatus();
  }

  private async settledStatus(): Promise<GraphStatus> {
    if (!this.graph) return this.lastFailure ? { state: 'unavailable', reason: this.lastFailure } : { state: 'empty' };
    const current = await gitHead(this.root, this.opts.run ? { run: this.opts.run } : {});
    return {
      state: current !== this.head ? 'stale' : 'ready',
      head: this.head,
      builtAt: this.builtAt,
      files: this.graph.fileCount,
      edges: this.graph.edgeTotal,
    };
  }

  /** A second call while a build runs gets `{ started:false }` with the `building` status — it never starts another. */
  build(opts: { full?: boolean; signal?: AbortSignal } = {}): Promise<BuildOutcome> {
    if (this.building) return Promise.resolve({ started: false, status: { state: 'building' }, reason: 'a build is already running' });
    const buildOpts: BuildOptions = {
      ...(opts.full ? { ignoreCache: true } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(this.opts.run ? { run: this.opts.run } : {}),
    };
    const run = (async (): Promise<BuildOutcome> => {
      const r = await buildGraph(this.root, buildOpts);
      if (!r.available) {
        this.lastFailure = r.reason;
        const status = await this.settledStatus();
        return { started: false, status, reason: r.reason };
      }
      this.lastFailure = null;
      this.graph = r.graph;
      this.head = r.head;
      this.builtAt = r.builtAt;
      return { started: true, status: await this.settledStatus(), stats: r.stats };
    })();
    this.building = run;
    const clear = (): void => {
      if (this.building === run) this.building = null;
    };
    void run.then(clear, clear);
    return run;
  }

  private notReady(): Unavailable {
    if (this.building) return { available: false, reason: 'the graph is building' };
    return { available: false, reason: this.lastFailure ?? 'no graph yet: run a build first' };
  }

  snapshot(stale = false): Snapshot {
    return { head: this.head, builtAt: this.builtAt, stale };
  }

  /** Impact of `input.files`. Freshens the files the question touches first; never builds the graph. */
  async impact(input: ImpactInput, opts: { signal?: AbortSignal } = {}): Promise<ImpactResult | Unavailable> {
    const graph = this.graph;
    if (!graph) return this.notReady();
    const seeds = [...new Set(input.files.map(normalizePath))];
    const scope = new Set(seeds);
    for (const s of seeds) {
      for (const f of graph.importsOf(s)) scope.add(f);
      for (const f of graph.dependentsOf(s)) scope.add(f);
    }
    const refresh: RefreshOptions = {
      ...(this.opts.freshnessDeadlineMs !== undefined ? { deadlineMs: this.opts.freshnessDeadlineMs } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(this.opts.run ? { run: this.opts.run } : {}),
    };
    const fresh = await ensureFresh({ root: this.root, graph, head: this.head, scope }, refresh);
    this.head = fresh.head;
    return computeImpact(graph, this.snapshot(fresh.stale), input, this.opts.selectTests ? { selectTests: this.opts.selectTests } : {});
  }

  // ------------------------------------------------------------------ read-only accessors (for tests-select)

  dependentsOf(path: string): string[] {
    return this.graph?.dependentsOf(normalizePath(path)) ?? [];
  }
  importsOf(path: string): string[] {
    return this.graph?.importsOf(normalizePath(path)) ?? [];
  }
  isTest(path: string): boolean {
    return this.graph?.isTest(normalizePath(path)) ?? false;
  }
  /** Graph-derived test candidates (same-name sibling, importing tests) for one file. */
  testsFor(path: string): TestCandidate[] {
    return this.graph?.testsFor(normalizePath(path)) ?? [];
  }
  allTests(): string[] {
    return this.graph?.allTests() ?? [];
  }
  /** Is `path` a node of the graph? */
  has(path: string): boolean {
    return this.graph?.fileSet.has(normalizePath(path)) ?? false;
  }
  /** Files this answer cannot judge: unresolved imports or unparsed (scope helper for completeness). */
  unresolvedIn(path: string): number {
    return this.graph?.unresolved.get(normalizePath(path))?.length ?? 0;
  }
  isHub(path: string): boolean {
    return this.graph?.isHub(normalizePath(path)) ?? false;
  }
}
