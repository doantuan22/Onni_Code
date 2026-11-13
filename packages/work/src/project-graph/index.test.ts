import { afterEach, describe, expect, it } from 'vitest';
import { FixtureRepo, gitAvailable } from './fixture.testkit.ts';
import { ProjectGraphService } from './index.ts';

const repos: FixtureRepo[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) r.dispose();
});
const fixture = (files: Record<string, string>): FixtureRepo => {
  const r = new FixtureRepo().write(files);
  r.commit('init');
  repos.push(r);
  return r;
};
const files = {
  'src/core.ts': 'export const core = 1;',
  'src/a.ts': `import { core } from './core.ts';`,
  'src/a.test.ts': `import './a.ts';`,
  'src/core.test.ts': `import './core.ts';`,
};

describe('ProjectGraphService', () => {
  it('reports empty before any build and refuses to build on a read', async () => {
    if (!gitAvailable()) return;
    const svc = new ProjectGraphService(fixture(files).root);
    expect(await svc.getStatus()).toEqual({ state: 'empty' });
    expect(await svc.impact({ files: ['src/core.ts'] })).toEqual({ available: false, reason: expect.stringContaining('build') });
    expect(await svc.getStatus()).toEqual({ state: 'empty' }); // impact did not build
    expect(svc.allTests()).toEqual([]);
    expect(svc.dependentsOf('src/core.ts')).toEqual([]);
  });

  it('builds, then answers status, impact and the read-only accessors', async () => {
    if (!gitAvailable()) return;
    const repo = fixture(files);
    const svc = new ProjectGraphService(repo.root);
    const out = await svc.build();
    expect(out.started).toBe(true);
    const status = await svc.getStatus();
    expect(status).toMatchObject({ state: 'ready', files: 4, edges: 3 });
    expect(status.head).toBe(repo.git('rev-parse', 'HEAD').trim());

    const r = await svc.impact({ files: ['src/core.ts'] });
    if ('available' in r) throw new Error(r.reason);
    expect(r.changed.map((c) => c.path)).toEqual(['src/core.ts']);
    expect(r.dependents.map((d) => d.path)).toEqual(['src/a.ts']);
    expect(r.tests.map((t) => t.path)).toContain('src/core.test.ts');
    expect(r.complete).toBe(true);
    expect(r.snapshot.stale).toBe(false);

    expect(svc.dependentsOf('src/core.ts')).toEqual(['src/a.ts', 'src/core.test.ts']);
    expect(svc.importsOf('src/a.ts')).toEqual(['src/core.ts']);
    expect(svc.isTest('src/a.test.ts')).toBe(true);
    expect(svc.allTests()).toEqual(['src/a.test.ts', 'src/core.test.ts']);
    expect(svc.testsFor('src/a.ts').map((t) => t.path)).toEqual(['src/a.test.ts']);
    expect(svc.snapshot().head).toBe(status.head);
  });

  it('runs one build at a time: an overlapping call reports building', async () => {
    if (!gitAvailable()) return;
    const svc = new ProjectGraphService(fixture(files).root);
    const first = svc.build();
    expect(await svc.getStatus()).toEqual({ state: 'building' });
    const second = await svc.build();
    expect(second).toMatchObject({ started: false, status: { state: 'building' } });
    expect((await first).started).toBe(true);
    expect((await svc.getStatus()).state).toBe('ready');
  });

  it('sees uncommitted edits through the freshness pass, and a new commit as stale until the next query', async () => {
    if (!gitAvailable()) return;
    const repo = fixture(files);
    const svc = new ProjectGraphService(repo.root);
    await svc.build();
    repo.write({ 'src/a.ts': `export {};` }); // a.ts no longer imports core
    const r = await svc.impact({ files: ['src/core.ts'] });
    if ('available' in r) throw new Error(r.reason);
    expect(r.dependents).toEqual([]);

    repo.write({ 'src/b.ts': `import './core.ts';` });
    repo.commit('add b');
    expect((await svc.getStatus()).state).toBe('stale');
    const r2 = await svc.impact({ files: ['src/core.ts'] });
    if ('available' in r2) throw new Error(r2.reason);
    expect(r2.dependents.map((d) => d.path)).toEqual(['src/b.ts']); // b.ts was outside the scope; the commit diff caught it
    expect((await svc.getStatus()).state).toBe('ready');
  });

  it('degrades to an unavailable status when git cannot list files', async () => {
    const svc = new ProjectGraphService('.', { run: () => Promise.reject(new Error('git: command not found')) });
    const out = await svc.build();
    expect(out.started).toBe(false);
    expect(await svc.getStatus()).toEqual({ state: 'unavailable', reason: expect.stringContaining('git ls-files failed') });
  });

  it('passes through a selectTests hook', async () => {
    if (!gitAvailable()) return;
    const svc = new ProjectGraphService(fixture(files).root, {
      selectTests: () => [{ path: 'x.test.ts', confidence: 'low', reason: 'hook', source: 'runner' }],
    });
    await svc.build();
    const r = await svc.impact({ files: ['src/core.ts'] });
    if ('available' in r) throw new Error(r.reason);
    expect(r.tests.map((t) => t.path)).toEqual(['x.test.ts']);
  });
});
