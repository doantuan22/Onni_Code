import { posix } from 'node:path';
import { resolveSpecifier, type PathAlias, type WorkspacePackage } from './resolve.ts';
import type { EdgeKind, GraphEdge, RawImport, RawImportKind, TestCandidate } from './types.ts';
import { CODE_EXT } from './types.ts';

/** What extraction yields for one file; cached by content hash (store.ts). */
export interface FileRecord {
  hash: string;
  imports: RawImport[];
  unresolvedDynamic: number;
}
export interface UnresolvedRef {
  specifier: string;
  reason: string;
  line: number;
}

export const HUB_MIN_DEGREE = 20;
export const HUB_PERCENTILE = 95;

const KIND: Record<RawImportKind, EdgeKind> = {
  import: 'imports',
  require: 'imports',
  type: 'type-imports',
  reexport: 'reexports',
  dynamic: 'dynamic-import',
  mock: 'mocks',
};

export const isCodeFile = (path: string): boolean => CODE_EXT.some((e) => path.endsWith(e));
export const isTestFile = (path: string): boolean =>
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /(^|\/)(__tests__|test|tests)\//.test(path);

export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] ?? 0;
}

/** Same-name tests of a source file: `foo.ts` -> `foo.test.ts(x)` / `foo.spec.ts(x)`. */
export function siblingTests(file: string, fileSet: ReadonlySet<string>): string[] {
  const m = /^(.*?)(\.[cm]?[jt]sx?)$/.exec(file);
  if (!m) return [];
  const out: string[] = [];
  for (const mid of ['.test', '.spec']) {
    for (const e of ['.ts', '.tsx', '.mts', '.js', '.mjs']) {
      const c = `${m[1]}${mid}${e}`;
      if (fileSet.has(c)) out.push(c);
    }
  }
  return out;
}

/**
 * The in-memory graph: every tracked non-denied file is a node, edges come from per-file {@link FileRecord}s.
 * Edge resolution depends on the file set, so records (cacheable by content) and edges (derived) stay separate —
 * which is also what makes the incremental update below cheap: swap one record, re-resolve its out-edges.
 */
export class ProjectGraph {
  readonly fileSet = new Set<string>();
  readonly records = new Map<string, FileRecord>();
  readonly unparsed = new Set<string>();
  readonly forward = new Map<string, GraphEdge[]>();
  readonly reverse = new Map<string, GraphEdge[]>();
  readonly unresolved = new Map<string, UnresolvedRef[]>();
  readonly ext = new Map<string, number>();
  private hubCache: { threshold: number; hubs: Set<string> } | null = null;
  private edgeCount = 0;

  constructor(
    readonly workspaces: ReadonlyMap<string, WorkspacePackage>,
    readonly aliases: readonly PathAlias[],
  ) {}

  get fileCount(): number {
    return this.fileSet.size;
  }
  get edgeTotal(): number {
    return this.edgeCount;
  }

  /** Adds nodes without resolving anything; call {@link setRecord}/{@link markUnparsed} per code file afterwards. */
  addNodes(paths: Iterable<string>): void {
    for (const p of paths) this.fileSet.add(p);
    this.hubCache = null;
  }

  setRecord(path: string, record: FileRecord): void {
    this.fileSet.add(path);
    this.unparsed.delete(path);
    this.records.set(path, record);
    this.resolveFile(path);
  }

  markUnparsed(path: string): void {
    this.fileSet.add(path);
    this.records.delete(path);
    this.unparsed.add(path);
    this.clearOutEdges(path);
  }

  /** A path that appeared: importers whose specifier was unresolved may now find it. */
  addFile(path: string): void {
    if (this.fileSet.has(path)) return;
    this.fileSet.add(path);
    for (const f of [...this.unresolved.keys()]) this.resolveFile(f);
    this.hubCache = null;
  }

  removeFile(path: string): void {
    if (!this.fileSet.has(path)) return;
    const importers = new Set((this.reverse.get(path) ?? []).map((e) => e.from));
    this.clearOutEdges(path);
    this.fileSet.delete(path);
    this.records.delete(path);
    this.unparsed.delete(path);
    this.unresolved.delete(path);
    // Importers drop their now-dangling edge themselves (resolveFile -> clearOutEdges) and may turn unresolved.
    for (const f of importers) if (f !== path) this.resolveFile(f);
    this.hubCache = null;
  }

  /** Resolves every record (full build). */
  resolveAll(): void {
    for (const path of this.records.keys()) this.resolveFile(path);
  }

  /** Recomputes the out-edges of one file from its record. */
  resolveFile(path: string): void {
    this.clearOutEdges(path);
    const rec = this.records.get(path);
    if (!rec) return;
    const ctx = { fileSet: this.fileSet, workspaces: this.workspaces, aliases: this.aliases };
    const out: GraphEdge[] = [];
    const seen = new Set<string>();
    const bad: UnresolvedRef[] = [];
    for (const imp of rec.imports) {
      const r = resolveSpecifier(imp.specifier, path, ctx);
      if (r.type === 'file') {
        if (r.to === path) continue;
        const kind = KIND[imp.kind];
        const key = `${r.to}\0${kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ from: path, to: r.to, kind, line: imp.line });
      } else if (r.type === 'ext') {
        this.ext.set(r.name, (this.ext.get(r.name) ?? 0) + 1);
      } else {
        bad.push({ specifier: imp.specifier, reason: r.reason, line: imp.line });
      }
    }
    if (rec.unresolvedDynamic > 0) {
      bad.push({ specifier: '<non-literal import()>', reason: 'dynamic import with a non-constant argument', line: 0 });
    }
    if (bad.length) this.unresolved.set(path, bad);
    else this.unresolved.delete(path);
    if (out.length) this.forward.set(path, out);
    for (const e of out) {
      const list = this.reverse.get(e.to);
      if (list) list.push(e);
      else this.reverse.set(e.to, [e]);
    }
    this.edgeCount += out.length;
    this.hubCache = null;
  }

  private clearOutEdges(path: string): void {
    const old = this.forward.get(path);
    if (!old) return;
    for (const e of old) {
      const rest = (this.reverse.get(e.to) ?? []).filter((x) => x.from !== path);
      if (rest.length) this.reverse.set(e.to, rest);
      else this.reverse.delete(e.to);
    }
    this.edgeCount -= old.length;
    this.forward.delete(path);
  }

  // ------------------------------------------------------------------ queries (read-only)

  /** Distinct files that import `path` (one edge per importer). */
  dependentEdges(path: string): GraphEdge[] {
    const seen = new Map<string, GraphEdge>();
    for (const e of this.reverse.get(path) ?? []) if (!seen.has(e.from)) seen.set(e.from, e);
    return [...seen.values()];
  }
  dependentsOf(path: string): string[] {
    return this.dependentEdges(path).map((e) => e.from).sort();
  }
  importsOf(path: string): string[] {
    return [...new Set((this.forward.get(path) ?? []).map((e) => e.to))].sort();
  }
  isTest(path: string): boolean {
    return isTestFile(path);
  }
  allTests(): string[] {
    return [...this.fileSet].filter((f) => isCodeFile(f) && isTestFile(f)).sort();
  }
  /** Non-test in-degree: tests must not turn a file into a hub (spikes/hub-cochange.md). */
  hubDegree(path: string): number {
    return this.dependentEdges(path).filter((e) => !isTestFile(e.from)).length;
  }

  hubThreshold(): number {
    return this.hubs().threshold;
  }
  isHub(path: string): boolean {
    return this.hubs().hubs.has(path);
  }
  private hubs(): { threshold: number; hubs: Set<string> } {
    if (this.hubCache) return this.hubCache;
    const degrees = new Map<string, number>();
    for (const target of this.reverse.keys()) {
      const d = this.hubDegree(target);
      if (d > 0) degrees.set(target, d);
    }
    const threshold = Math.max(percentile([...degrees.values()], HUB_PERCENTILE), HUB_MIN_DEGREE);
    const hubs = new Set([...degrees].filter(([, d]) => d >= threshold).map(([p]) => p));
    return (this.hubCache = { threshold, hubs });
  }

  /** Tests that cover `path`: same-name sibling, or a test that imports it (medium when `path` is a hub). */
  testsFor(path: string): TestCandidate[] {
    const out = new Map<string, TestCandidate>();
    for (const t of siblingTests(path, this.fileSet)) {
      out.set(t, { path: t, confidence: 'high', reason: `same-name test of \`${posix.basename(path)}\``, source: 'graph' });
    }
    const hub = this.isHub(path);
    for (const e of this.dependentEdges(path)) {
      if (!isTestFile(e.from) || out.has(e.from)) continue;
      out.set(e.from, {
        path: e.from,
        confidence: hub ? 'medium' : 'high',
        reason: `${e.kind === 'mocks' ? 'mocks' : 'imports'} ${hub ? 'hub ' : ''}\`${posix.basename(path)}\``,
        source: 'graph',
      });
    }
    return [...out.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Workspace-package level edges from the manifests (`from` depends on `to`). */
  packageDeps(): { from: string; to: string }[] {
    const out: { from: string; to: string }[] = [];
    for (const ws of this.workspaces.values()) {
      for (const d of ws.dependencies) if (this.workspaces.has(d)) out.push({ from: ws.name, to: d });
    }
    return out;
  }
}
