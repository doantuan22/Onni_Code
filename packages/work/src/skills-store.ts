import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { SKILL_NAME_PATTERN } from '@onni/contract';
import type { Skill } from './skills.ts';
import { assertOnniHomeWriteIsSandboxed } from './paths.ts';

/**
 * The write path for onni-managed skills (`owned: true`): `.ai/onni/skills` (project) or
 * `~/.onni/skills` (global). Skills from every other source are read-only — their files belong
 * to another tool or a team repo, so this module never touches them.
 *
 * One rule for the name (`SKILL_NAME_PATTERN`, shared with `skills-provision.ts` via the
 * contract) and one rule for the file: `SKILL.md` inside `<name>/`, written tmp + rename so a
 * reader never sees a half-written body. Skills are USER CONTENT (committable, 0644), not JSON
 * state — the 0600 atomic-write rule does not apply here, but the atomic rename does.
 */

export type SkillScope = 'project' | 'global';

/** A failed write, mapped to a status by the route layer. */
export class SkillStoreError extends Error {
  constructor(
    readonly code: 'invalid-name' | 'name-in-use' | 'not-owned' | 'not-found',
    message: string,
  ) {
    super(message);
    this.name = 'SkillStoreError';
  }
}

export interface OwnedSkillLocation {
  repoRoot: string;
  /** `onniHomeDir()` — the global skills dir hangs off it, so tests pin `ONNI_HOME`. */
  homeDir: string;
}

/** Where an onni-managed skill of a given scope lives. */
export function onniSkillDir(scope: SkillScope, repoRoot: string, homeDir: string): string {
  return scope === 'global' ? join(homeDir, 'skills') : join(repoRoot, '.ai/onni/skills');
}

/** A global write into the REAL `~/.onni` is a leaked test, never intent (see paths.ts). */
function guardGlobalWrite(homeDir: string): void {
  assertOnniHomeWriteIsSandboxed(join(homeDir, 'skills'));
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

function markdown(name: string, description: string | undefined, interactive: boolean, body: string): string {
  const front = [`name: ${JSON.stringify(name)}`];
  if (description) front.push(`description: ${JSON.stringify(description)}`);
  if (interactive) front.push('interactive: true');
  return `---\n${front.join('\n')}\n---\n\n${body.trim()}\n`;
}

/** tmp + rename — a concurrent reader (discovery) sees the old file or the new, never half. */
async function writeAtomic(file: string, content: string): Promise<void> {
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, file);
}

function ownedSkill(
  name: string,
  scope: SkillScope,
  dir: string,
  description: string | undefined,
  interactive: true | undefined,
  body: string,
): Skill {
  return {
    name,
    description,
    interactive,
    body,
    path: join(dir, name, 'SKILL.md'),
    source: scope === 'global' ? 'onni-global' : 'onni',
    owned: true,
    scope,
  };
}

/** The directory a skill's files live in, for delete/rename — and the one guard that keeps
 *  those operations inside the owned dir rather than wherever `path` happens to point. */
function ownedDir(existing: Skill, dir: string): string | undefined {
  return dirname(existing.path) === join(dir, existing.name) ? dirname(existing.path) : undefined;
}

export async function createOwnedSkill(
  loc: OwnedSkillLocation,
  input: { scope: SkillScope; name: string; description?: string; interactive?: boolean; body: string },
): Promise<Skill> {
  const { scope, name } = input;
  if (!SKILL_NAME_PATTERN.test(name)) throw new SkillStoreError('invalid-name', `invalid skill name: ${name}`);
  if (scope === 'global') guardGlobalWrite(loc.homeDir);
  const dir = onniSkillDir(scope, loc.repoRoot, loc.homeDir);
  const target = join(dir, name);
  if (await exists(target)) throw new SkillStoreError('name-in-use', `a skill named "${name}" already exists here`);
  await mkdir(target, { recursive: true });
  const description = input.description?.trim() || undefined;
  const interactive = input.interactive ? true : undefined;
  await writeAtomic(join(target, 'SKILL.md'), markdown(name, description, input.interactive === true, input.body));
  return ownedSkill(name, scope, dir, description, interactive, input.body.trim());
}

export async function updateOwnedSkill(
  loc: OwnedSkillLocation,
  existing: Skill,
  changes: { name?: string; description?: string; interactive?: boolean; body?: string },
): Promise<Skill> {
  const scope = existing.scope ?? 'project';
  if (scope === 'global') guardGlobalWrite(loc.homeDir);
  const dir = onniSkillDir(scope, loc.repoRoot, loc.homeDir);

  const nextName = changes.name ?? existing.name;
  if (!SKILL_NAME_PATTERN.test(nextName)) throw new SkillStoreError('invalid-name', `invalid skill name: ${nextName}`);
  const description = changes.description !== undefined ? changes.description.trim() || undefined : existing.description;
  const interactive =
    changes.interactive !== undefined ? (changes.interactive ? true : undefined) : existing.interactive;
  const body = (changes.body ?? existing.body).trim();

  const target = join(dir, nextName);
  if (nextName === existing.name) {
    await writeAtomic(join(target, 'SKILL.md'), markdown(nextName, description, interactive === true, body));
    return ownedSkill(nextName, scope, dir, description, interactive, body);
  }

  // Rename: the old directory goes away only after the new one is fully written, so a failure
  // mid-way leaves the original intact.
  if (await exists(target)) throw new SkillStoreError('name-in-use', `a skill named "${nextName}" already exists here`);
  await mkdir(target, { recursive: true });
  await writeAtomic(join(target, 'SKILL.md'), markdown(nextName, description, interactive === true, body));
  const old = ownedDir(existing, dir);
  if (old) await rm(old, { recursive: true, force: true });
  return ownedSkill(nextName, scope, dir, description, interactive, body);
}

export async function deleteOwnedSkill(loc: OwnedSkillLocation, existing: Skill): Promise<void> {
  const scope = existing.scope ?? 'project';
  if (scope === 'global') guardGlobalWrite(loc.homeDir);
  const dir = onniSkillDir(scope, loc.repoRoot, loc.homeDir);
  const target = ownedDir(existing, dir);
  if (!target) throw new SkillStoreError('not-owned', `skill "${existing.name}" is not an onni-managed skill`);
  await rm(target, { recursive: true, force: true });
}
