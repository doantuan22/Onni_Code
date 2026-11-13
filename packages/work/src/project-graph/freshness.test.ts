import { afterEach, describe, expect, it } from 'vitest';
import { buildGraph } from './build.ts';
import { ensureFresh, refreshPaths } from './freshness.ts';
import { FixtureRepo, gitAvailable } from './fixture.testkit.ts';

const repos: FixtureRepo[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) r.dispose();
});

async function setup() {
  const repo = new FixtureRepo().write({
    'src/a.ts': `import './b.ts';`,
    'src/b.ts': `export const b = 1;`,
    'src/c.ts': `export const c = 1;`,
    'src/user.ts': `import './b.ts';`,
  });
  repo.commit('init');
  repos.push(repo);
  const r = await buildGraph(repo.root);
  if (!r.available) throw new Error(r.reason);
  return { repo, graph: r.graph, head: r.head };
}

describe('refreshPaths', () => {
  it('replaces out-edges when a file changed and the in-edges follow', async () => {
    if (!gitAvailable()) return;
    const { repo, graph } = await setup();
    repo.write({ 'src/a.ts': `import './c.ts';` });
    const r = await refreshPaths(repo.root, graph, ['src/a.ts', 'src/b.ts']);
    expect(r.updated).toEqual(['src/a.ts']);
    expect(graph.importsOf('src/a.ts')).toEqual(['src/c.ts']);
    expect(graph.dependentsOf('src/b.ts')).toEqual(['src/user.ts']);
    expect(graph.dependentsOf('src/c.ts')).toEqual(['src/a.ts']);
  });

  it('removes a deleted file and flags its importers as unresolved', async () => {
    if (!gitAvailable()) return;
    const { repo, graph } = await setup();
    repo.remove('src/b.ts');
    const r = await refreshPaths(repo.root, graph, ['src/b.ts']);
    expect(r.removed).toEqual(['src/b.ts']);
    expect(graph.fileSet.has('src/b.ts')).toBe(false);
    expect(graph.unresolved.has('src/a.ts')).toBe(true);
    expect(graph.unresolved.has('src/user.ts')).toBe(true);
  });

  it('adds a new file and resolves imports that were waiting for it', async () => {
    if (!gitAvailable()) return;
    const { repo, graph } = await setup();
    repo.write({ 'src/a.ts': `import './b.ts';\nimport './new.ts';` });
    await refreshPaths(repo.root, graph, ['src/a.ts']);
    expect(graph.unresolved.has('src/a.ts')).toBe(true);
    repo.write({ 'src/new.ts': `export {}` });
    const r = await refreshPaths(repo.root, graph, ['src/new.ts']);
    expect(r.added).toEqual(['src/new.ts']);
    expect(graph.unresolved.has('src/a.ts')).toBe(false);
    expect(graph.dependentsOf('src/new.ts')).toEqual(['src/a.ts']);
  });

  it('skips denylisted paths without reading them', async () => {
    if (!gitAvailable()) return;
    const { repo, graph } = await setup();
    repo.write({ '.env': 'SECRET=1', 'dist/x.ts': `import '../src/b.ts'` });
    const r = await refreshPaths(repo.root, graph, ['.env', 'dist/x.ts']);
    expect(r.checked).toBe(0);
    expect(graph.fileSet.has('.env')).toBe(false);
    expect(graph.fileSet.has('dist/x.ts')).toBe(false);
  });

  it('stops at the deadline and says so', async () => {
    if (!gitAvailable()) return;
    const { repo, graph } = await setup();
    const r = await refreshPaths(repo.root, graph, ['src/a.ts', 'src/b.ts'], { deadlineMs: -1 });
    expect(r.timedOut).toBe(true);
    expect(r.checked).toBe(0);
  });
});

describe('ensureFresh', () => {
  it('is fresh and cheap when nothing moved', async () => {
    if (!gitAvailable()) return;
    const { repo, graph, head } = await setup();
    const r = await ensureFresh({ root: repo.root, graph, head, scope: ['src/a.ts'] });
    expect(r).toMatchObject({ stale: false, head, updated: [], removed: [], added: [] });
  });

  it('catches up with a new commit (edit + rename + delete) even for files outside the scope', async () => {
    if (!gitAvailable()) return;
    const { repo, graph, head } = await setup();
    repo.write({ 'src/user.ts': `import './c.ts';` });
    repo.git('mv', 'src/b.ts', 'src/b2.ts');
    repo.write({ 'src/a.ts': `import './b2.ts';` });
    const next = repo.commit('rename b');
    const r = await ensureFresh({ root: repo.root, graph, head, scope: ['src/c.ts'] });
    expect(r.head).toBe(next);
    expect(r.stale).toBe(false);
    expect(graph.dependentsOf('src/b2.ts')).toEqual(['src/a.ts']);
    expect(graph.dependentsOf('src/c.ts')).toEqual(['src/user.ts']);
    expect(graph.fileSet.has('src/b.ts')).toBe(false);
  });

  it('reports stale (not a throw) when HEAD moved and the diff is unavailable', async () => {
    if (!gitAvailable()) return;
    const { repo, graph } = await setup();
    const r = await ensureFresh({ root: repo.root, graph, head: 'deadbeef'.repeat(5), scope: [] });
    expect(r.stale).toBe(true);
  });

  it('reports stale when the time budget runs out', async () => {
    if (!gitAvailable()) return;
    const { repo, graph, head } = await setup();
    const r = await ensureFresh({ root: repo.root, graph, head, scope: ['src/a.ts'] }, { deadlineMs: -1 });
    expect(r.stale).toBe(true);
  });
});
