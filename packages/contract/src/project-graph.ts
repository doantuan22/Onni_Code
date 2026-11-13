import { z } from 'zod';

/** Project graph responses and requests. Kept Node-free for the shared HTTP contract. */
export const GRAPH_DEFAULT_MAX_ITEMS = 200;
export const GRAPH_MAX_ITEMS = 1_000;
const GRAPH_MAX_QUERY_FILES = 200;
const GRAPH_MAX_PATH_LENGTH = 1_024;

/** A repository-relative POSIX path; graph IDs and cache keys never contain machine paths. */
export const projectGraphPathSchema = z
  .string()
  .min(1)
  .max(GRAPH_MAX_PATH_LENGTH)
  .refine((path) => {
    if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:\//.test(path) || path.includes('\\')) return false;
    return path.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
  }, 'Expected a relative POSIX path without dot segments');
export type ProjectGraphPath = z.infer<typeof projectGraphPathSchema>;

/** A hub group may name the repository root with `.`. */
const projectGraphDirectorySchema = z.union([z.literal('.'), projectGraphPathSchema]);

export const graphSnapshotSchema = z.object({
  head: z.string().nullable(),
  builtAt: z.string(),
  stale: z.boolean(),
}).strict();
export type Snapshot = z.infer<typeof graphSnapshotSchema>;
export type GraphSnapshot = Snapshot;

export const graphCoverageSchema = z.object({
  unresolvedImports: z.number().int().nonnegative(),
  unparsedFiles: z.number().int().nonnegative(),
  notInGraph: z.array(projectGraphPathSchema).max(GRAPH_MAX_ITEMS),
  note: z.string().max(4_096).optional(),
}).strict();
export type Coverage = z.infer<typeof graphCoverageSchema>;
export type GraphCoverage = Coverage;

export const graphItemSchema = z.object({
  path: projectGraphPathSchema,
  provenance: z.enum(['extracted', 'declared', 'inferred']),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  reason: z.string().min(1).max(4_096),
  via: z.array(projectGraphPathSchema).max(GRAPH_MAX_ITEMS).optional(),
}).strict();
export type GraphItem = z.infer<typeof graphItemSchema>;

export const graphHubGroupSchema = z.object({
  hub: projectGraphPathSchema,
  dir: projectGraphDirectorySchema,
  count: z.number().int().positive(),
  sample: z.array(projectGraphPathSchema).max(20),
}).strict();
export type HubGroup = z.infer<typeof graphHubGroupSchema>;
export type GraphHubGroup = HubGroup;

export const graphTestCandidateSchema = z.object({
  path: projectGraphPathSchema,
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string().min(1).max(4_096),
  source: z.enum(['graph', 'runner']),
}).strict();
export type TestCandidate = z.infer<typeof graphTestCandidateSchema>;
export type GraphTestCandidate = TestCandidate;

/** `GET /graph`: current graph availability and freshness without loading the graph. */
export const graphStatusSchema = z.object({
  state: z.enum(['disabled', 'unavailable', 'empty', 'building', 'ready', 'stale']),
  head: z.string().nullable().optional(),
  builtAt: z.string().optional(),
  files: z.number().int().nonnegative().optional(),
  edges: z.number().int().nonnegative().optional(),
  reason: z.string().max(4_096).optional(),
}).strict();
export type GraphStatus = z.infer<typeof graphStatusSchema>;

const graphFilesQuerySchema = z
  .union([
    projectGraphPathSchema,
    z.array(projectGraphPathSchema).min(1).max(GRAPH_MAX_QUERY_FILES),
  ])
  .transform((file) => (typeof file === 'string' ? [file] : file));

const graphRunIdSchema = z.string().min(1).max(128);
const graphMaxItemsQuerySchema = z.coerce.number().int().min(1).max(GRAPH_MAX_ITEMS).default(GRAPH_DEFAULT_MAX_ITEMS);

const graphQueryFields = {
  file: graphFilesQuerySchema.optional(),
  runId: graphRunIdSchema.optional(),
  maxItems: graphMaxItemsQuerySchema,
};

function hasGraphSubject(query: { file?: readonly string[] | undefined; runId?: string | undefined }): boolean {
  return (query.file?.length ?? 0) > 0 || query.runId !== undefined;
}

/** `GET /graph/impact`: file paths are normalized to an array for the engine. */
export const graphImpactQuerySchema = z.object({
  ...graphQueryFields,
  expand: projectGraphDirectorySchema.optional(),
}).strict().refine(hasGraphSubject, 'Either file or runId is required');
export type GraphImpactQueryInput = z.input<typeof graphImpactQuerySchema>;
export type GraphImpactQuery = z.output<typeof graphImpactQuerySchema>;

export const graphImpactResultSchema = z.object({
  snapshot: graphSnapshotSchema,
  complete: z.boolean(),
  truncated: z.boolean(),
  coverage: graphCoverageSchema,
  hubThreshold: z.number().int().positive(),
  changed: z.array(graphItemSchema).max(GRAPH_MAX_ITEMS),
  dependents: z.array(graphItemSchema).max(GRAPH_MAX_ITEMS),
  hubGroups: z.array(graphHubGroupSchema).max(GRAPH_MAX_ITEMS),
  packages: z.array(graphItemSchema).max(GRAPH_MAX_ITEMS),
  tests: z.array(graphTestCandidateSchema).max(GRAPH_MAX_ITEMS),
}).strict();
export type ImpactResult = z.infer<typeof graphImpactResultSchema>;
export type GraphImpactResult = ImpactResult;

/** `GET /graph/tests`: `runner=1` or `runner=true` opt in to runner-native discovery. */
export const graphTestsQuerySchema = z.object({
  ...graphQueryFields,
  runner: z.enum(['1', 'true']).transform(() => true).optional(),
}).strict().refine(hasGraphSubject, 'Either file or runId is required');
export type GraphTestsQueryInput = z.input<typeof graphTestsQuerySchema>;
export type GraphTestsQuery = z.output<typeof graphTestsQuerySchema>;

export const graphTestsResultSchema = z.object({
  snapshot: graphSnapshotSchema,
  complete: z.boolean(),
  truncated: z.boolean(),
  coverage: graphCoverageSchema,
  tests: z.array(graphTestCandidateSchema).max(GRAPH_MAX_ITEMS),
  runner: z.object({
    used: z.boolean(),
    available: z.boolean(),
    reason: z.string().max(4_096).optional(),
  }).strict(),
}).strict();
export type TestsResult = z.infer<typeof graphTestsResultSchema>;
export type GraphTestsResult = TestsResult;

/** `POST /graph/rebuild`: absent `full` requests the incremental rebuild. */
export const graphRebuildBodySchema = z.object({ full: z.boolean().optional() }).strict();
export type GraphRebuildBody = z.input<typeof graphRebuildBodySchema>;

export const graphRebuildResultSchema = z.object({
  accepted: z.boolean(),
  status: graphStatusSchema,
  reason: z.string().max(4_096).optional(),
}).strict();
export type GraphRebuildResult = z.infer<typeof graphRebuildResultSchema>;
