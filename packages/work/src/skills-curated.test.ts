import { createHash } from 'node:crypto';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CURATED_SKILLS_DIR, discoverSkills, parseFrontmatter } from './skills.ts';
import { provisionSkills } from './skills-provision.ts';
import { expandRegistrySlashSkillText } from './workflows/run/check-steps.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function project() { const root = await mkdtemp(join(tmpdir(), 'onni-curated-')); roots.push(root); return root; }

describe('offline curated skills', () => {
  it('discovers the pinned manifest and expands every skill without a team repository', async () => {
    const manifest = JSON.parse(await readFile(join(CURATED_SKILLS_DIR, '../manifest.json'), 'utf8'));
    const catalog = await discoverSkills(await project());
    expect(manifest.skills).toHaveLength(9);
    for (const entry of manifest.skills) {
      const skill = catalog.find(skill => skill.name === entry.name)!;
      expect(skill.source).toBe('builtin');
      expect(skill.owned).not.toBe(true);
      expect(skill.dependencies).toEqual([]);
      const raw = await readFile(skill.path, 'utf8');
      expect(parseFrontmatter(raw).frontmatter.name).toBe(entry.name);
      expect(createHash('sha256').update(raw).digest('hex')).toBe(entry.sha256);
      expect(entry.sha).toMatch(/^[a-f0-9]{40}$/);
      expect(expandRegistrySlashSkillText(`/${entry.name} Fix the assigned issue`, catalog))
        .toContain('User request:\nFix the assigned issue');
    }
  });

  it('keeps a project override authoritative without duplicating the fallback', async () => {
    const root = await project();
    const path = join(root, '.ai/onni/skills/onni-debug/SKILL.md');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, '---\nname: onni-debug\n---\nProject diagnosis rules.');
    const matches = (await discoverSkills(root)).filter(skill => skill.name === 'onni-debug');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.body).toBe('Project diagnosis rules.');
    expect(matches[0]?.owned).toBe(true);
  });

  it('provisions a bundled skill into both worker discovery paths', async () => {
    const root = await project();
    const catalog = await discoverSkills(root);
    const selected = catalog.find(skill => skill.name === 'onni-debug')!;
    const cwd = join(root, 'worker');
    await mkdir(cwd);
    expect(await provisionSkills(cwd, [selected], catalog)).toContain('onni-debug');
    for (const dir of ['.agents/skills', '.claude/skills']) {
      expect(await readFile(join(cwd, dir, 'onni-debug/SKILL.md'), 'utf8'))
        .toBe(await readFile(selected.path, 'utf8'));
    }
  });
});
