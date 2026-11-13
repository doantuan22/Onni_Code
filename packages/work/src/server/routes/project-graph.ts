import { Hono, type MiddlewareHandler } from 'hono';
import {
  graphImpactQuerySchema, graphRebuildBodySchema, graphTestsQuerySchema,
  type GraphImpactQuery, type GraphTestsQuery,
} from '@onni/contract';
import { worktreeChangedFilesReadOnly } from '../../git-worktree.ts';
import { selectTests } from '../../project-graph/tests-select/index.ts';
import { graphToolsEnabled, type ProjectGraphRegistry } from '../../project-graph/registry.ts';
import type { ProjectContext } from '../project-context.ts';
import { jsonZodValidator, queryZodValidator } from '../validators.ts';

type ProjectApiEnv = { Variables: { project: ProjectContext } };

export const PROJECT_GRAPH_OFF = 'Project Graph is off — start the cockpit with ONNI_PROJECT_GRAPH=1';

type SubjectFiles = { files: string[] } | { error: string };

/** Files for a graph question: explicit `file`s, else the changed files of run `runId` (404 one-liner when none). */
async function subjectFiles(project: ProjectContext, query: { file?: readonly string[] | undefined; runId?: string | undefined }): Promise<SubjectFiles> {
  if (query.file && query.file.length > 0) return { files: [...query.file] };
  const run = query.runId ? project.store.getRun(query.runId) : undefined;
  if (!run) return { error: `Unknown run: ${query.runId}` };
  const changed = await worktreeChangedFilesReadOnly(run.worktreePath ?? project.root, run.baseBranch ?? 'HEAD');
  if (changed.state !== 'ok') return { error: `Cannot read the changes of run ${run.id} (${changed.state})` };
  if (changed.files.length === 0) return { error: `Run ${run.id} has no changed files` };
  return { files: changed.files };
}

export function createProjectGraphRoutes(deps: {
  requireProjectGraph: MiddlewareHandler<ProjectApiEnv>;
  registry: ProjectGraphRegistry;
}) {
  const { registry } = deps;
  // Explicit paths, never `use('*')`: this family is mounted beside many others (see `requireAutomations`).
  return new Hono<ProjectApiEnv>()
    .use('/graph', deps.requireProjectGraph)
    .use('/graph/*', deps.requireProjectGraph)
    .get('/graph', async (c) => c.json(await registry.service(c.get('project').root).getStatus()))

    .get('/graph/impact', queryZodValidator(graphImpactQuerySchema), async (c) => {
      const project = c.get('project');
      const query: GraphImpactQuery = c.req.valid('query');
      const subject = await subjectFiles(project, query);
      if ('error' in subject) return c.json({ error: subject.error }, 404);
      const result = await registry.service(project.root).impact({
        files: subject.files,
        maxItems: query.maxItems,
        ...(query.expand ? { expand: query.expand } : {}),
      }, { signal: c.req.raw.signal });
      return c.json(result, 200);
    })

    .get('/graph/tests', queryZodValidator(graphTestsQuerySchema), async (c) => {
      const project = c.get('project');
      const query: GraphTestsQuery = c.req.valid('query');
      const subject = await subjectFiles(project, query);
      if ('error' in subject) return c.json({ error: subject.error }, 404);
      const runnerAllowed = query.runner === true && graphToolsEnabled();
      const result = await selectTests(registry.service(project.root), {
        files: subject.files,
        maxItems: query.maxItems,
        runner: runnerAllowed,
        signal: c.req.raw.signal,
      });
      if ('available' in result) return c.json(result, 200);
      if (query.runner === true && !runnerAllowed) {
        return c.json({ ...result, runner: { ...result.runner, reason: 'set ONNI_PROJECT_GRAPH_TOOLS=1 to allow `vitest related`' } }, 200);
      }
      return c.json(result, 200);
    })

    .post('/graph/rebuild', jsonZodValidator(graphRebuildBodySchema), async (c) => {
      const outcome = await registry.rebuild(c.get('project').root, c.req.valid('json').full ? { full: true } : {});
      return c.json({
        accepted: outcome.started,
        status: outcome.status,
        ...(!outcome.started ? { reason: outcome.reason } : {}),
      }, 200);
    });
}
