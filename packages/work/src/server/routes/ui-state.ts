import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ZodType } from 'zod';
import { jsonZodValidator } from '../validators.ts';
import type { ProjectContext } from '../project-context.ts';
import { readUiState, uiStatePath } from '../../ui-state.ts';
import { atomicWriteJson, serializedByPath } from '../../workspace/config.ts';

type ProjectApiEnv = { Variables: { project: ProjectContext } };

export function uiStateRoutes<TUiStateBody extends ZodType<Record<string, unknown>, any>>(deps: {
  uiStateBody: TUiStateBody;
  maxBodySize: number;
  onSkillsChanged(project: string): void;
}) {
  return new Hono<ProjectApiEnv>()
    .get('/ui-state', async (c) => c.json(await readUiState(c.get('project').root)))

    // On `use`, not inline on the route — see the workspace ui-state PUT above.
    .use('/ui-state', bodyLimit({ maxSize: deps.maxBodySize }))

    .put('/ui-state', jsonZodValidator(deps.uiStateBody), async (c) => {
      const { root: repoRoot, id } = c.get('project');
      // `.passthrough()` keeps unknown prefs (BACKWARD_COMPATIBILITY §3), but a
      // single request may not stuff an unbounded key set (#429) — the shared
      // schema+cap half of both ui-state routes lives in `uiStateBody`.
      const parsed = { data: c.req.valid('json') };
      let merged: Awaited<ReturnType<typeof readUiState>>;
      try {
        merged = await serializedByPath(uiStatePath(repoRoot), async () => {
          const previous = await readUiState(repoRoot);
          const next = { ...previous, ...parsed.data };
          await atomicWriteJson(uiStatePath(repoRoot), next);
          if (JSON.stringify(previous.importedSkills) !== JSON.stringify(next.importedSkills)) deps.onSkillsChanged(id);
          return next;
        });
      } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
      }
      return c.json(merged);
    });
}
