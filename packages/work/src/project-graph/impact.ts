import { posix } from 'node:path';
import { isDenied } from './denylist.ts';
import { siblingTests, type ProjectGraph } from './graph.ts';
import { packageOf } from './resolve.ts';
import type { Coverage, GraphEdge, GraphItem, HubGroup, ImpactResult, Snapshot, TestCandidate } from './types.ts';

export const DEFAULT_MAX_ITEMS = 200;
const HUB_SAMPLE = 3;

export interface ImpactInput {
  /** Repo-relative paths that changed (or are about to). */
  files: string[];
  /** Open one hub directory: its dependents are listed instead of only counted. */
  expand?: string;
  /** Cap per list (default 200). Anything cut sets `truncated`. */
  maxItems?: number;
}

/** Optional replacement for the built-in test ranking (T1 plugs in here). */
export type SelectTests = (ctx: { graph: ProjectGraph; changed: string[]; dependents: string[] }) => TestCandidate[];

export const normalizePath = (p: string): string => p.replace(/\\/g, '/').replace(/^\.\//, '');

const edgeReason = (e: GraphEdge, seed: string): string => {
  const what = e.kind === 'reexports' ? 'reexports' : e.kind === 'mocks' ? 'mocks' : e.kind === 'type-imports' ? 'imports (type)' : e.kind === 'dynamic-import' ? 'imports (dynamic)' : 'imports';
  return `${what} \`${posix.basename(seed)}\`${e.line ? ` (line ${e.line})` : ''}`;
};

const underDir = (file: string, dir: string): boolean => {
  const d = posix.dirname(file);
  return d === dir || d.startsWith(`${dir}/`);
};

function cap<T>(list: T[], max: number): { list: T[]; cut: boolean } {
  return list.length > max ? { list: list.slice(0, max), cut: true } : { list, cut: false };
}

const RANK = { high: 3, medium: 2, low: 1 } as const;

/** Built-in test candidates: the changed test itself, same-name tests, tests importing a seed (lower via a hub), sibling tests of dependents. */
export function defaultTests(graph: ProjectGraph, changed: readonly string[], dependents: readonly string[]): TestCandidate[] {
  const out = new Map<string, TestCandidate>();
  const add = (c: TestCandidate): void => {
    const prev = out.get(c.path);
    if (!prev || RANK[c.confidence] > RANK[prev.confidence]) out.set(c.path, c);
  };
  for (const f of changed) {
    if (graph.isTest(f)) add({ path: f, confidence: 'high', reason: 'test file itself changed', source: 'graph' });
    for (const t of graph.testsFor(f)) add(t);
  }
  for (const d of dependents) {
    for (const t of siblingTests(d, graph.fileSet)) {
      add({ path: t, confidence: 'medium', reason: `same-name test of dependent \`${posix.basename(d)}\``, source: 'graph' });
    }
  }
  return [...out.values()].sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || a.path.localeCompare(b.path));
}

/**
 * L0 changed, L1 dependents (one hop; a hub seed collapses into directory groups), L2 packages, plus test candidates.
 * `complete` is judged over the question's own scope (changed files and the dependents listed), never the whole repo.
 */
export function computeImpact(graph: ProjectGraph, snapshot: Snapshot, input: ImpactInput, opts: { selectTests?: SelectTests } = {}): ImpactResult {
  const max = Math.max(1, input.maxItems ?? DEFAULT_MAX_ITEMS);
  const wanted = [...new Set(input.files.map(normalizePath).filter(Boolean))];
  const known = wanted.filter((f) => graph.fileSet.has(f) && !isDenied(f));
  const notInGraph = wanted.filter((f) => !known.includes(f));
  const changedSet = new Set(known);
  const expand = input.expand ? normalizePath(input.expand).replace(/\/$/, '') : undefined;

  const items = new Map<string, GraphItem>();
  const hubGroups: HubGroup[] = [];
  const allDependents = new Set<string>(); // including those folded into hub groups
  for (const seed of known) {
    const deps = graph.dependentEdges(seed).filter((e) => !changedSet.has(e.from) && !graph.isTest(e.from));
    for (const e of deps) allDependents.add(e.from);
    if (graph.isHub(seed)) {
      const byDir = new Map<string, string[]>();
      for (const e of deps) {
        const d = posix.dirname(e.from);
        const list = byDir.get(d);
        if (list) list.push(e.from);
        else byDir.set(d, [e.from]);
      }
      for (const [dir, list] of byDir) {
        hubGroups.push({ hub: seed, dir, count: list.length, sample: [...list].sort().slice(0, HUB_SAMPLE) });
      }
    }
    for (const e of deps) {
      if (graph.isHub(seed) && !(expand && underDir(e.from, expand))) continue;
      const prev = items.get(e.from);
      if (prev) {
        prev.via = [...(prev.via ?? []), seed];
        continue;
      }
      items.set(e.from, { path: e.from, provenance: 'extracted', reason: edgeReason(e, seed), via: [seed] });
    }
  }
  hubGroups.sort((a, b) => b.count - a.count || a.hub.localeCompare(b.hub) || a.dir.localeCompare(b.dir));

  let truncated = false;
  const cut = <T,>(list: T[]): T[] => {
    const r = cap(list, max);
    if (r.cut) truncated = true;
    return r.list;
  };

  const changed = cut(known.map((path): GraphItem => ({ path, provenance: 'extracted', reason: 'changed' })));
  const dependents = cut([...items.values()].sort((a, b) => a.path.localeCompare(b.path)));
  const groups = cut(hubGroups);

  // L2 — packages that own a changed file or a dependent, plus packages that declare a dependency on a changed package.
  const pkgChanged = new Map<string, number>();
  const pkgDeps = new Map<string, number>();
  for (const f of known) {
    const p = packageOf(f, graph.workspaces) ?? '(root)';
    pkgChanged.set(p, (pkgChanged.get(p) ?? 0) + 1);
  }
  for (const f of allDependents) {
    const p = packageOf(f, graph.workspaces) ?? '(root)';
    pkgDeps.set(p, (pkgDeps.get(p) ?? 0) + 1);
  }
  const packages: GraphItem[] = [];
  for (const [p, n] of pkgChanged) packages.push({ path: p, provenance: 'extracted', reason: `contains ${n} changed file${n === 1 ? '' : 's'}` });
  for (const [p, n] of pkgDeps) {
    if (!pkgChanged.has(p)) packages.push({ path: p, provenance: 'extracted', reason: `${n} file${n === 1 ? '' : 's'} import changed files` });
  }
  for (const d of graph.packageDeps()) {
    if (pkgChanged.has(d.to) && !pkgChanged.has(d.from) && !pkgDeps.has(d.from) && !packages.some((x) => x.path === d.from)) {
      packages.push({ path: d.from, provenance: 'declared', reason: `declares a dependency on \`${d.to}\`` });
    }
  }
  const pkgOut = cut(packages.sort((a, b) => a.path.localeCompare(b.path)));

  const testList = (opts.selectTests ?? ((c) => defaultTests(c.graph, c.changed, c.dependents)))({
    graph,
    changed: known,
    dependents: [...allDependents],
  });
  const tests = cut(testList);

  // coverage / completeness, over the files this answer rests on
  const scope = new Set<string>([...known, ...dependents.map((d) => d.path)]);
  let unresolvedImports = 0;
  let unparsedFiles = 0;
  for (const f of scope) {
    unresolvedImports += graph.unresolved.get(f)?.length ?? 0;
    if (graph.unparsed.has(f)) unparsedFiles++;
  }
  const complete = !truncated && notInGraph.length === 0 && unresolvedImports === 0 && unparsedFiles === 0 && !snapshot.stale;
  const coverage: Coverage = { unresolvedImports, unparsedFiles, notInGraph };
  if (!complete) {
    const why = [
      notInGraph.length ? `${notInGraph.length} file(s) not in the graph` : '',
      unresolvedImports ? `${unresolvedImports} import(s) could not be resolved in scope` : '',
      unparsedFiles ? `${unparsedFiles} file(s) not parsed` : '',
      truncated ? 'list truncated' : '',
      snapshot.stale ? 'snapshot may be stale' : '',
    ].filter(Boolean);
    coverage.note = `The graph may miss edges (${why.join('; ')}): confirm with grep or by reading the source.`;
  }

  return { snapshot, complete, truncated, coverage, hubThreshold: graph.hubThreshold(), changed, dependents, hubGroups: groups, packages: pkgOut, tests };
}
