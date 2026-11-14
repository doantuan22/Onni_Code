import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { z } from 'zod';
import {
  createSkillInputSchema,
  deleteSkillResponseSchema,
  skillSavedResponseSchema,
  updateSkillInputSchema,
} from '@onni/contract';
import type { discoverSkills as DiscoverSkills } from '../../skills.ts';
import type { gatedSkillsRepos as GatedSkillsRepos } from '../../config.ts';
import type {
  getTeamSkillsCached as GetTeamSkillsCached,
  refreshTeamSkills as RefreshTeamSkills,
  waitForTeamSkills as WaitForTeamSkills,
} from '../../skills-remote.ts';
import {
  SkillStoreError,
  type createOwnedSkill as CreateOwnedSkill,
  type deleteOwnedSkill as DeleteOwnedSkill,
  type updateOwnedSkill as UpdateOwnedSkill,
} from '../../skills-store.ts';
import { onniHomeDir } from '../../paths.ts';
import type { ProjectContext } from '../project-context.ts';
import { jsonZodValidator, paramZodValidator, queryZodValidator } from '../validators.ts';

type ProjectApiEnv = { Variables: { project: ProjectContext } };

/** The `:name` path segment. Skill names can be any non-empty frontmatter string (legacy skills
 *  predate the safe-name rule), so the param gate only requires non-empty — ownership and the
 *  safe-name regex are enforced on the write path where a new directory is actually created. */
const nameParamSchema = z.object({ name: z.string().min(1) });

export function skillsRoutes<TWaitQuery extends ZodType<{ wait?: string | undefined }, any>>(deps: {
  waitQuery: TWaitQuery;
  discoverSkills: typeof DiscoverSkills;
  gatedSkillsRepos: typeof GatedSkillsRepos;
  getTeamSkillsCached: typeof GetTeamSkillsCached;
  refreshTeamSkills: typeof RefreshTeamSkills;
  waitForTeamSkills: typeof WaitForTeamSkills;
  createOwnedSkill: typeof CreateOwnedSkill;
  updateOwnedSkill: typeof UpdateOwnedSkill;
  deleteOwnedSkill: typeof DeleteOwnedSkill;
}) {
  const skillStoreError = (c: Context, err: SkillStoreError) => {
    const status = err.code === 'not-found' ? 404 : err.code === 'invalid-name' ? 400 : 409;
    return c.json({ error: err.message }, status);
  };

  return new Hono<ProjectApiEnv>()
    .get('/skills', queryZodValidator(deps.waitQuery), async (c) => {
      const repoRoot = c.get('project').root;
      // The default read stays fast and starts the team load in the background.
      // The cockpit follows it with `wait=1`, off the render path, so a cold
      // cache converges without polling or a manual reload (spec 005 / #555).
      if (c.req.valid('query').wait === '1') await deps.waitForTeamSkills(repoRoot);
      return c.json(await deps.discoverSkills(repoRoot));
    })

    // Every skill a *default* skills repo offers, regardless of enabled state, so the Skills
    // catalog can list and preview disabled entries. OnniCode ships no default source, so this
    // answers [] unless a fork configures one; it also empties once a repo sets its own
    // `skillsRepos` (nothing is gated then). `wait=1` lets the page wait out a cold team-skill
    // cache, same as `GET /skills` (spec 005).
    .get('/skills/importable', queryZodValidator(deps.waitQuery), async (c) => {
      const repoRoot = c.get('project').root;
      const gated = await deps.gatedSkillsRepos(repoRoot);
      if (gated.size === 0) return c.json([]);
      if (c.req.valid('query').wait === '1') await deps.waitForTeamSkills(repoRoot);
      const importable = deps.getTeamSkillsCached(repoRoot).filter((skill) => skill.team && gated.has(skill.team.repo));
      return c.json(importable);
    })

    // Refresh team skills (spec 005): clone/fetch the configured skills repos,
    // then return the merged catalog. Degrades quietly — offline just means the
    // team entries stay as they were (or absent).
    .post('/skills/refresh', async (c) => {
      const { root: repoRoot } = c.get('project');
      await deps.refreshTeamSkills(repoRoot);
      return c.json(await deps.discoverSkills(repoRoot));
    })

    // Create an onni-managed skill (`.ai/onni/skills` or `~/.onni/skills`). A name collision
    // with ANY source is a 409 — the catalog is name-deduped, so two skills cannot share a name.
    .post('/skills', jsonZodValidator(createSkillInputSchema), async (c) => {
      const repoRoot = c.get('project').root;
      const input = c.req.valid('json');
      const existing = (await deps.discoverSkills(repoRoot)).find((skill) => skill.name === input.name);
      if (existing) {
        return c.json({ error: `a skill named "${input.name}" already exists (source: ${existing.source})` }, 409);
      }
      try {
        const skill = await deps.createOwnedSkill({ repoRoot, homeDir: onniHomeDir() }, input);
        return c.json(skillSavedResponseSchema.parse({ skill }), 201);
      } catch (err) {
        if (err instanceof SkillStoreError) return skillStoreError(c, err);
        throw err;
      }
    })

    // Edit an onni-managed skill. `name` renames it; the other fields merge over the current
    // value (an empty `description` clears it, `interactive: false` clears the hint).
    .put(
      '/skills/:name',
      paramZodValidator(nameParamSchema),
      jsonZodValidator(updateSkillInputSchema),
      async (c) => {
        const repoRoot = c.get('project').root;
        const { name } = c.req.valid('param');
        const changes = c.req.valid('json');
        const existing = (await deps.discoverSkills(repoRoot)).find((skill) => skill.name === name);
        if (!existing) return c.json({ error: `unknown skill: ${name}` }, 404);
        if (!existing.owned) {
          return c.json({ error: `skill "${name}" is not onni-managed (source: ${existing.source})` }, 409);
        }
        if (changes.name && changes.name !== name) {
          const clash = (await deps.discoverSkills(repoRoot)).find((skill) => skill.name === changes.name);
          if (clash) return c.json({ error: `a skill named "${changes.name}" already exists (source: ${clash.source})` }, 409);
        }
        try {
          const skill = await deps.updateOwnedSkill({ repoRoot, homeDir: onniHomeDir() }, existing, changes);
          return c.json(skillSavedResponseSchema.parse({ skill }));
        } catch (err) {
          if (err instanceof SkillStoreError) return skillStoreError(c, err);
          throw err;
        }
      },
    )

    // Delete an onni-managed skill. Read-only sources (team/builtin/agents/global/ai) are refused.
    .delete('/skills/:name', paramZodValidator(nameParamSchema), async (c) => {
      const repoRoot = c.get('project').root;
      const { name } = c.req.valid('param');
      const existing = (await deps.discoverSkills(repoRoot)).find((skill) => skill.name === name);
      if (!existing) return c.json({ error: `unknown skill: ${name}` }, 404);
      if (!existing.owned) {
        return c.json({ error: `skill "${name}" is not onni-managed (source: ${existing.source})` }, 409);
      }
      try {
        await deps.deleteOwnedSkill({ repoRoot, homeDir: onniHomeDir() }, existing);
        return c.json(deleteSkillResponseSchema.parse({ deleted: true }));
      } catch (err) {
        if (err instanceof SkillStoreError) return skillStoreError(c, err);
        throw err;
      }
    });
}
