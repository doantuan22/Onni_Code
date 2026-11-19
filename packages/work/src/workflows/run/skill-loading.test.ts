import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Skill } from '../../skills.ts';
import type { GraphActiveRun, GraphContext } from './internal-types.ts';
import { provisionTaskSkills } from './graph.ts';
import { discoverSkills } from '../../skills.ts';
import { getTeamSkillsCached, waitForTeamSkills } from '../../skills-remote.ts';
import { provisionSkills } from '../../skills-provision.ts';

vi.mock('../../skills.ts', () => ({ discoverSkills: vi.fn() }));
vi.mock('../../skills-remote.ts', () => ({
  getTeamSkillsCached: vi.fn(), waitForTeamSkills: vi.fn(), materializeSkillDir: vi.fn(),
}));
vi.mock('../../skills-provision.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../../skills-provision.ts')>(), provisionSkills: vi.fn(async () => []),
}));

const leaf: Skill = { name: 'offline', body: 'Work locally.', source: 'builtin', path: '/skills/offline/SKILL.md', dependencies: [] };
const context = { repoRoot: '/project' } as GraphContext;
const state = () => ({ cwd: '/worker' }) as GraphActiveRun;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(discoverSkills).mockResolvedValue([leaf]);
  vi.mocked(getTeamSkillsCached).mockReturnValue([]);
  vi.mocked(waitForTeamSkills).mockResolvedValue([]);
});

describe('task skill resolution', () => {
  it('starts an explicit offline closure without waiting for a pending team load', async () => {
    vi.mocked(waitForTeamSkills).mockReturnValue(new Promise(() => {}));
    const active = state();
    await provisionTaskSkills(context, active, { stepSkill: leaf.name, slash: leaf.name });
    expect(waitForTeamSkills).not.toHaveBeenCalled();
    expect(provisionSkills).toHaveBeenCalledWith('/worker', [leaf], [leaf]);
    expect(active.skills).toEqual([leaf]);
  });

  it('retains the team wait for legacy companions and missing explicit dependencies', async () => {
    for (const root of [{ ...leaf, dependencies: undefined }, { ...leaf, dependencies: ['remote-helper'] }]) {
      vi.mocked(discoverSkills).mockResolvedValue([root]);
      await provisionTaskSkills(context, state(), { stepSkill: root.name });
    }
    expect(waitForTeamSkills).toHaveBeenCalledTimes(2);
  });

  it('keeps the bounded wait when the selected step is absent, and skips an unknown native slash', async () => {
    await provisionTaskSkills(context, state(), { slash: 'compact' });
    expect(waitForTeamSkills).not.toHaveBeenCalled();
    await provisionTaskSkills(context, state(), { stepSkill: 'missing' });
    expect(waitForTeamSkills).toHaveBeenCalledTimes(1);
  });
});
