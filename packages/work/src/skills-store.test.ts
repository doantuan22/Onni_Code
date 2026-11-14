import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SkillStoreError,
  createOwnedSkill,
  deleteOwnedSkill,
  onniSkillDir,
  updateOwnedSkill,
  type OwnedSkillLocation,
} from './skills-store.ts';
import { discoverSkills, type Skill } from './skills.ts';
import { onniHomeDir } from './paths.ts';

/**
 * The onni-managed write path (`skills-store.ts`): `.ai/onni/skills` (project) or
 * `~/.onni/skills` (global). Skills are user content — atomic tmp+rename, 0644 — and the ONLY
 * dirs this module touches; the read-only sources are refused by `deleteOwnedSkill`'s
 * `ownedDir` guard, not by an explicit allow-list. The store takes `homeDir` as a parameter
 * (`OwnedSkillLocation`) rather than reading `ONNI_HOME` itself, so every case pins its own.
 */

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function loc(): Promise<OwnedSkillLocation> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'onni-store-repo-'));
  const homeDir = await mkdtemp(join(tmpdir(), 'onni-store-home-'));
  tempDirs.push(repoRoot, homeDir);
  return { repoRoot, homeDir };
}

describe('createOwnedSkill', () => {
  it('writes a project skill under .ai/onni/skills with the owned marker', async () => {
    const l = await loc();
    const skill = await createOwnedSkill(l, {
      scope: 'project',
      name: 'my-skill',
      description: '  does a thing  ',
      interactive: true,
      body: '  # Body\n\nInstructions.  ',
    });
    expect(skill).toMatchObject({
      name: 'my-skill',
      description: 'does a thing',
      interactive: true,
      body: '# Body\n\nInstructions.',
      source: 'onni',
      owned: true,
      scope: 'project',
    });
    expect(skill.path).toBe(join(onniSkillDir('project', l.repoRoot, l.homeDir), 'my-skill', 'SKILL.md'));
    const raw = await readFile(skill.path, 'utf8');
    expect(raw).toContain('name: "my-skill"');
    expect(raw).toContain('description: "does a thing"');
    expect(raw).toContain('interactive: true');
    expect(raw).toContain('# Body');
  });

  it('writes a global skill under homeDir/skills with source onni-global', async () => {
    const l = await loc();
    const skill = await createOwnedSkill(l, { scope: 'global', name: 'shared-skill', body: 'Body' });
    expect(skill).toMatchObject({ source: 'onni-global', owned: true, scope: 'global' });
    expect(skill.path).toBe(join(onniSkillDir('global', l.repoRoot, l.homeDir), 'shared-skill', 'SKILL.md'));
  });

  it('rejects a name that fails SKILL_NAME_PATTERN', async () => {
    const l = await loc();
    for (const bad of ['', '.hidden', 'two words', 'a/b', '--flag']) {
      await expect(createOwnedSkill(l, { scope: 'project', name: bad, body: 'x' })).rejects.toMatchObject({
        code: 'invalid-name',
      });
    }
  });

  it('refuses a name that already exists in the same dir', async () => {
    const l = await loc();
    await createOwnedSkill(l, { scope: 'project', name: 'dup', body: 'one' });
    await expect(createOwnedSkill(l, { scope: 'project', name: 'dup', body: 'two' })).rejects.toMatchObject({
      code: 'name-in-use',
    });
  });

  it('keeps an omitted description and a falsy interactive out of the frontmatter', async () => {
    const l = await loc();
    const skill = await createOwnedSkill(l, { scope: 'project', name: 'bare', body: 'Body' });
    expect(skill.description).toBeUndefined();
    expect(skill.interactive).toBeUndefined();
    const raw = await readFile(skill.path, 'utf8');
    expect(raw).not.toContain('description');
    expect(raw).not.toContain('interactive');
  });
});

describe('updateOwnedSkill', () => {
  it('merges changes over the current value and clears an emptied description', async () => {
    const l = await loc();
    const original = await createOwnedSkill(l, {
      scope: 'project',
      name: 'edit-me',
      description: 'original',
      interactive: true,
      body: 'one',
    });
    const updated = await updateOwnedSkill(l, original, { description: '  ', body: 'two' });
    expect(updated.description).toBeUndefined();
    expect(updated.interactive).toBe(true); // untouched fields survive
    expect(updated.body).toBe('two');
    const raw = await readFile(updated.path, 'utf8');
    expect(raw).not.toContain('description:');
    expect(raw).toContain('interactive: true');
  });

  it('renames: writes the new directory before removing the old one', async () => {
    const l = await loc();
    const original = await createOwnedSkill(l, { scope: 'project', name: 'before', body: 'Body' });
    const updated = await updateOwnedSkill(l, original, { name: 'after' });
    expect(updated.name).toBe('after');
    expect(updated.path).toBe(join(onniSkillDir('project', l.repoRoot, l.homeDir), 'after', 'SKILL.md'));
    await expect(readFile(original.path, 'utf8')).rejects.toThrow();
    await expect(readFile(updated.path, 'utf8')).resolves.toContain('name: "after"');
  });

  it('refuses a rename onto an existing name', async () => {
    const l = await loc();
    const a = await createOwnedSkill(l, { scope: 'project', name: 'a', body: 'a' });
    await createOwnedSkill(l, { scope: 'project', name: 'b', body: 'b' });
    await expect(updateOwnedSkill(l, a, { name: 'b' })).rejects.toMatchObject({ code: 'name-in-use' });
  });

  it('rejects a renamed name that fails the pattern', async () => {
    const l = await loc();
    const a = await createOwnedSkill(l, { scope: 'project', name: 'a', body: 'a' });
    await expect(updateOwnedSkill(l, a, { name: 'bad name' })).rejects.toMatchObject({ code: 'invalid-name' });
  });
});

describe('deleteOwnedSkill', () => {
  it('removes the skill directory and leaves the store a no-op second time', async () => {
    const l = await loc();
    const skill = await createOwnedSkill(l, { scope: 'project', name: 'gone', body: 'Body' });
    await deleteOwnedSkill(l, skill);
    await expect(readFile(skill.path, 'utf8')).rejects.toThrow();
    await deleteOwnedSkill(l, skill); // idempotent: rm force
  });

  it('refuses to delete a skill whose path is outside the owned dir', async () => {
    const l = await loc();
    const foreign: Skill = {
      name: 'foreign',
      body: 'x',
      path: join(l.repoRoot, '.ai/skills', 'foreign.md'),
      source: 'ai',
    };
    await expect(deleteOwnedSkill(l, foreign)).rejects.toMatchObject({ code: 'not-owned' });
  });
});

describe('round-trips through discovery', () => {
  it('a created project skill is rediscovered with owned + scope attached', async () => {
    const l = await loc();
    await mkdir(join(l.repoRoot, '.ai/onni'), { recursive: true });
    await createOwnedSkill(l, { scope: 'project', name: 'round-trip', description: 'desc', body: 'Body' });
    const found = (await discoverSkills(l.repoRoot)).find((s) => s.name === 'round-trip');
    expect(found).toMatchObject({ source: 'onni', owned: true, scope: 'project', description: 'desc' });
  });

  it('a created global skill is rediscovered with source onni-global', async () => {
    const l = await loc();
    await mkdir(join(l.repoRoot, '.ai/onni'), { recursive: true });
    // Discovery reads the import-time ONNI_HOME (GLOBAL_SKILL_DIRS), so create into that same
    // sandbox rather than the test's own homeDir — otherwise the write and the read disagree.
    const skill = await createOwnedSkill({ repoRoot: l.repoRoot, homeDir: onniHomeDir() }, {
      scope: 'global',
      name: 'round-trip-global',
      body: 'Body',
    });
    try {
      const found = (await discoverSkills(l.repoRoot)).find((s) => s.name === 'round-trip-global');
      expect(found).toMatchObject({ source: 'onni-global', owned: true, scope: 'global' });
    } finally {
      await deleteOwnedSkill({ repoRoot: l.repoRoot, homeDir: onniHomeDir() }, skill);
    }
  });
});

describe('SkillStoreError', () => {
  it('carries a machine-readable code and the message', () => {
    const err = new SkillStoreError('invalid-name', 'nope');
    expect(err.code).toBe('invalid-name');
    expect(err.message).toBe('nope');
    expect(err).toBeInstanceOf(Error);
  });
});
