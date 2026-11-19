import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunStore } from '../runs/store.ts';
import type { RunManager } from '../workflows/run.ts';
import { apiRequest } from './loopback-request.testkit.ts';
import { WorkspaceEventBus, createApp } from './server.ts';

/**
 * The onni-managed skill write routes (`POST /skills`, `PUT /skills/:name`,
 * `DELETE /skills/:name`). Loopback, like the org-skills config suite: a real `createApp` with
 * the boot project bound to a temp repo, and `ONNI_HOME` pinned per test so a `scope: 'global'`
 * write lands in the test's own sandbox and never the developer's `~/.onni`.
 */

describe('skills CRUD routes', () => {
  const savedHome = process.env.ONNI_HOME;
  let home: string;
  let repoRoot: string;
  let store: RunStore;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'onni-skills-api-home-'));
    repoRoot = mkdtempSync(join(tmpdir(), 'onni-skills-api-'));
    process.env.ONNI_HOME = home;
    mkdirSync(join(repoRoot, '.ai/onni'), { recursive: true });
    store = RunStore.open(join(repoRoot, '.ai/onni'));
  });

  afterEach(() => {
    store.flush();
    rmSync(home, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
    if (savedHome === undefined) delete process.env.ONNI_HOME;
    else process.env.ONNI_HOME = savedHome;
  });

  const app = () =>
    createApp({ repoRoot, store, manager: {} as RunManager, version: 'test' });

  const post = (body: unknown) =>
    apiRequest(app(), '/api/v1/skills', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const put = (name: string, body: unknown) =>
    apiRequest(app(), `/api/v1/skills/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const del = (name: string) => apiRequest(app(), `/api/v1/skills/${encodeURIComponent(name)}`, { method: 'DELETE' });
  const get = () => apiRequest(app(), '/api/v1/skills');

  const listNames = async (): Promise<string[]> =>
    ((await (await get()).json()) as Array<{ name: string }>).map((s) => s.name);

  it('creates a project skill and lists it with the owned marker', async () => {
    const res = await post({ name: 'new-skill', body: 'Body', scope: 'project' });
    expect(res.status).toBe(201);
    const saved = (await res.json()) as { skill: { name: string; source: string; owned: boolean; scope: string } };
    expect(saved.skill).toMatchObject({ name: 'new-skill', source: 'onni', owned: true, scope: 'project' });

    const listed = await (await get()).json() as Array<{ name: string; owned: boolean }>;
    expect(listed.find((s) => s.name === 'new-skill')).toMatchObject({ owned: true });
  });

  it('broadcasts committed catalog writes to every client with their actual scope', async () => {
    const bus = new WorkspaceEventBus();
    const first: unknown[] = [], second: unknown[] = [];
    bus.on((name, data) => { if (name === 'skills-changed') first.push(data); });
    bus.on((name, data) => { if (name === 'skills-changed') second.push(data); });
    const server = createApp({ repoRoot, store, manager: {} as RunManager, version: 'test', workspaceEvents: bus });
    const write = (method: string, suffix: string, body?: unknown) => apiRequest(server, `/api/v1/skills${suffix}`, {
      method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    expect((await write('POST', '', { name: 'live', scope: 'project', body: 'first', dependencies: [] })).status).toBe(201);
    expect((await write('PUT', '/live', { body: 'second' })).status).toBe(200);
    const listed = await (await apiRequest(server, '/api/v1/skills')).json() as Array<{ name: string; body: string; dependencies?: string[] }>;
    const live = listed.find(skill => skill.name === 'live');
    expect(live?.body.trim()).toBe('second');
    expect(live?.dependencies).toEqual([]);
    expect((await write('DELETE', '/live')).status).toBe(200);
    expect((await write('POST', '', { name: 'everywhere', scope: 'global', body: 'shared' })).status).toBe(201);
    expect(first).toEqual([
      { project: expect.any(String), scope: 'project' }, { project: expect.any(String), scope: 'project' },
      { project: expect.any(String), scope: 'project' }, { project: expect.any(String), scope: 'global' },
    ]);
    expect(second).toEqual(first);
    expect((await write('DELETE', '/missing')).status).toBe(404);
    expect((await write('POST', '', { name: '../invalid', scope: 'project', body: 'no' })).status).toBe(400);
    expect(first).toHaveLength(4);
  });

  it('creates a global skill under the pinned ONNI_HOME', async () => {
    const res = await post({ name: 'global-skill', body: 'Body', scope: 'global' });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { skill: { source: string; scope: string } }).skill).toMatchObject({
      source: 'onni-global',
      scope: 'global',
    });
    // The route's own discovery reads the import-time ONNI_HOME (GLOBAL_SKILL_DIRS), not this
    // test's pin — so the write/list round-trip for the global scope is asserted in
    // skills-store.test.ts instead, against the shared sandbox home.
  });

  it('rejects a duplicate name with 409 and an invalid name with 400', async () => {
    expect((await post({ name: 'dup', body: 'Body', scope: 'project' })).status).toBe(201);
    const clash = await post({ name: 'dup', body: 'Body', scope: 'project' });
    expect(clash.status).toBe(409);
    expect(await clash.json()).toMatchObject({ error: expect.stringContaining('dup') });

    for (const bad of ['', 'bad name', 'a/b', '.dot']) {
      expect((await post({ name: bad, body: 'Body', scope: 'project' })).status).toBe(400);
    }
    expect((await post({ name: 'valid', body: '', scope: 'project' })).status).toBe(400);
  });

  it('updates body and renames, then refuses an unknown and a read-only skill', async () => {
    await post({ name: 'before', body: 'one', description: 'desc', scope: 'project' });

    const edited = await put('before', { body: 'two' });
    expect(edited.status).toBe(200);
    expect(((await edited.json()) as { skill: { body: string; description: string } }).skill).toMatchObject({
      body: 'two',
      description: 'desc',
    });

    const renamed = await put('before', { name: 'after' });
    expect(renamed.status).toBe(200);
    expect(await listNames()).toEqual(expect.arrayContaining(['after']));
    expect(await listNames()).not.toContain('before');

    expect((await put('no-such', { body: 'x' })).status).toBe(404);

    // A skill from a read-only source is refused (409), not silently edited.
    const aiDir = join(repoRoot, '.ai/skills');
    mkdirSync(aiDir, { recursive: true });
    writeFileSync(join(aiDir, 'readonly.md'), '---\nname: readonly\n---\nBody');
    const readonly = await put('readonly', { body: 'nope' });
    expect(readonly.status).toBe(409);
    expect(await readonly.json()).toMatchObject({ error: expect.stringContaining('not onni-managed') });
  });

  it('deletes an owned skill and refuses a read-only one and a miss', async () => {
    await post({ name: 'doomed', body: 'Body', scope: 'project' });
    const delRes = await del('doomed');
    expect(delRes.status).toBe(200);
    expect(await delRes.json()).toEqual({ deleted: true });
    expect(await listNames()).not.toContain('doomed');

    expect((await del('no-such')).status).toBe(404);

    const aiDir = join(repoRoot, '.ai/skills');
    mkdirSync(aiDir, { recursive: true });
    writeFileSync(join(aiDir, 'keep.md'), '---\nname: keep\n---\nBody');
    expect((await del('keep')).status).toBe(409);
    expect(await listNames()).toContain('keep');
  });
});
