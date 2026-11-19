import { Hono } from 'hono';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { skillsRoutes } from './skills.ts';
import type { ProjectContext } from '../project-context.ts';
import type { Skill } from '../../skills.ts';

describe('team catalog refresh notifications', () => {
  it('publishes only a changed resolved catalog, after refresh completes', async () => {
    let release!: () => void;
    let catalog: Skill[] = [];
    let importable: Skill[] = [];
    const gate = new Promise<void>(resolve => { release = resolve; });
    const onChanged = vi.fn();
    const refreshTeamSkills = vi.fn(async () => {
      await gate;
      catalog = [{ name: 'remote-skill', source: 'team', body: 'new', path: 'repo@main:skill' }];
      return catalog;
    });
    const unsupported = async (): Promise<never> => { throw Error('not a write fixture'); };
    const app = new Hono<{ Variables: { project: ProjectContext } }>()
      .use('*', async (c, next) => { c.set('project', { id: 'project-a', root: '/repo' } as ProjectContext); await next(); })
      .route('/', skillsRoutes({
        waitQuery: z.object({ wait: z.string().optional() }), discoverSkills: async () => catalog,
        gatedSkillsRepos: async () => new Set<string>(), getTeamSkillsCached: () => importable,
        refreshTeamSkills, waitForTeamSkills: async () => [],
        createOwnedSkill: unsupported, updateOwnedSkill: unsupported, deleteOwnedSkill: unsupported, onChanged,
      }));
    const pending = app.request('/skills/refresh', { method: 'POST' });
    await vi.waitFor(() => expect(refreshTeamSkills).toHaveBeenCalledOnce());
    expect(onChanged).not.toHaveBeenCalled();
    release();
    expect((await pending).status).toBe(200);
    expect(onChanged).toHaveBeenCalledExactlyOnceWith({ project: 'project-a', scope: 'project' });
    expect((await app.request('/skills/refresh', { method: 'POST' })).status).toBe(200);
    expect(onChanged).toHaveBeenCalledOnce();
    refreshTeamSkills.mockImplementationOnce(async () => {
      importable = [{ name: 'disabled-skill', body: 'changed', source: 'team', path: 'repo@main:disabled' }];
      return catalog;
    });
    await app.request('/skills/refresh', { method: 'POST' });
    expect(onChanged).toHaveBeenCalledTimes(2);
  });
});
