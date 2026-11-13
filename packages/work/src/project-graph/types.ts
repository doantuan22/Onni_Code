// Shared shapes of the Project Graph engine. Wire shapes (Snapshot, ImpactResult, ...) mirror P1-rules.md
// and are validated by the contract package; the engine returns plain objects of the same names.

export const GRAPH_SCHEMA_VERSION = 1;
/** Bump whenever extract.ts / resolve.ts change what they emit: stale cache entries are then ignored. */
export const EXTRACTOR_VERSION = 1;

export const CODE_EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'] as const;
/** Per-file read cap (PLAN §4.7): larger files count as `unparsedFiles`. */
export const FILE_CAP = 512_000;
/** Cap on `git ls-files` output; beyond it the listing is truncated and reported. */
export const MAX_LISTED_FILES = 20_000;

export type RawImportKind = 'import' | 'type' | 'reexport' | 'dynamic' | 'require' | 'mock';
export interface RawImport {
  specifier: string;
  kind: RawImportKind;
  line: number;
}
export interface ExtractResult {
  imports: RawImport[];
  /** `import(expr)` with a non-literal argument: no edge can be built, so it counts as unresolved. */
  unresolvedDynamic: number;
}

export type EdgeKind = 'imports' | 'reexports' | 'type-imports' | 'dynamic-import' | 'mocks';
export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  line: number;
}

export interface Snapshot {
  head: string | null;
  builtAt: string;
  stale: boolean;
}
export interface Coverage {
  unresolvedImports: number;
  unparsedFiles: number;
  notInGraph: string[];
  note?: string;
}
export interface GraphItem {
  path: string;
  provenance: 'extracted' | 'declared' | 'inferred';
  confidence?: 'high' | 'medium' | 'low';
  reason: string;
  via?: string[];
}
export interface HubGroup {
  hub: string;
  dir: string;
  count: number;
  sample: string[];
}
export interface TestCandidate {
  path: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  source: 'graph' | 'runner';
}
export interface GraphStatus {
  state: 'disabled' | 'unavailable' | 'empty' | 'building' | 'ready' | 'stale';
  head?: string | null;
  builtAt?: string;
  files?: number;
  edges?: number;
  reason?: string;
}
export interface ImpactResult {
  snapshot: Snapshot;
  complete: boolean;
  truncated: boolean;
  coverage: Coverage;
  hubThreshold: number;
  changed: GraphItem[];
  dependents: GraphItem[];
  hubGroups: HubGroup[];
  packages: GraphItem[];
  tests: TestCandidate[];
}
export interface TestsResult {
  snapshot: Snapshot;
  complete: boolean;
  truncated: boolean;
  coverage: Coverage;
  tests: TestCandidate[];
  runner: { used: boolean; available: boolean; reason?: string };
}

/** `{ available:false, reason }` is how every degradation is reported (AGENTS.md "Degradation is a value"). */
export type Unavailable = { available: false; reason: string };
