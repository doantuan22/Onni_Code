import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildGraph } from './build.ts';
import { FixtureRepo, gitAvailable } from './fixture.testkit.ts';
import { graphCacheDir, hashContent } from './store.ts';
import { EXTRACTOR_VERSION, FILE_CAP } from './types.ts';

const repos: FixtureRepo[] = [];
const fixture = (files: Record<string, string>): FixtureRepo => {
  const r = new FixtureRepo().write(files);
  r.commit('init');
  repos.push(r);
  return r;
};
afterEach(() => {
  for (const r of repos.splice(0)) r.dispose();
});
const ok = async (root: string, opts: Parameters<typeof buildGraph>[1] = {}) => {
  const r = await buildGraph(root, opts);
  if (!r.available) throw new Error(r.reason);
  return r;
};

const basic = {
  'package.json': JSON.stringify({ name: 'root', private: true }),
  'src/a.ts': `import { b } from './b.js';\nimport type { C } from './c.ts';\nimport {\n  d1,\n  d2,\n} from './d.ts';`,
  'src/b.ts': `export const b = 1;`,
  'src/c.ts': `export type C = 1;`,
  'src/d.ts': `export const d1 = 1, d2 = 2;`,
  'src/b.test.ts': `import { b } from './b.ts';`,
};

describe('buildGraph', () => {
  it('builds nodes, edges and a manifest on a real git repo', async () => {
    if (!gitAvailable()) return;
    const repo = fixture(basic);
    const r = await ok(repo.root);
    expect(r.graph.importsOf('src/a.ts')).toEqual(['src/b.ts', 'src/c.ts', 'src/d.ts']);
    expect(r.graph.testsFor('src/b.ts').map((t) => t.path)).toEqual(['src/b.test.ts']);
    expect(r.head).toMatch(/^[0-9a-f]{40}$/);
    const m = JSON.parse(readFileSync(join(graphCacheDir(repo.root), 'manifest.json'), 'utf8'));
    expect(m).toMatchObject({ head: r.head, files: r.stats.files, edges: r.stats.edges, extractorVersion: EXTRACTOR_VERSION });
  });

  it('reuses cached extractions on the second build and survives a missing, corrupt or wrong-version cache', async () => {
    if (!gitAvailable()) return;
    const repo = fixture(basic);
    const first = await ok(repo.root);
    expect(first.stats.fromCache).toBe(0);
    expect(first.stats.extracted).toBe(first.stats.parsed);

    const second = await ok(repo.root);
    expect(second.stats.fromCache).toBe(second.stats.parsed);
    expect(second.graph.edgeTotal).toBe(first.graph.edgeTotal);

    const filesDir = join(graphCacheDir(repo.root), 'files');
    const [one, two] = readdirSync(filesDir);
    writeFileSync(join(filesDir, one ?? ''), '{ corrupt');
    writeFileSync(join(filesDir, two ?? ''), JSON.stringify({ v: EXTRACTOR_VERSION + 9, imports: [], unresolvedDynamic: 0 }));
    const healed = await ok(repo.root);
    expect(healed.stats.extracted).toBe(2);
    expect(healed.graph.edgeTotal).toBe(first.graph.edgeTotal);

    rmSync(graphCacheDir(repo.root), { recursive: true, force: true });
    const rebuilt = await ok(repo.root);
    expect(rebuilt.stats.fromCache).toBe(0);
    expect(rebuilt.graph.edgeTotal).toBe(first.graph.edgeTotal);

    const full = await ok(repo.root, { ignoreCache: true });
    expect(full.stats.fromCache).toBe(0);
  });

  it('never reads or hashes denylisted files, and keeps them out of the graph', async () => {
    if (!gitAvailable()) return;
    const secret = 'API_KEY=hunter2\nimport "./leak.ts"';
    const repo = fixture({
      'src/app.ts': `import './leak.ts';`,
      'src/leak.ts': '',
      '.env': secret,
      'config/server.pem': secret,
      'dist/out.ts': `import '../src/leak.ts';`,
      'node_modules/dep/index.js': `require('../../src/leak.ts')`,
      'deploy/id_rsa': secret,
    });
    const r = await ok(repo.root);
    for (const p of ['.env', 'config/server.pem', 'dist/out.ts', 'node_modules/dep/index.js', 'deploy/id_rsa']) {
      expect(r.graph.fileSet.has(p)).toBe(false);
    }
    expect(r.graph.dependentsOf('src/leak.ts')).toEqual(['src/app.ts']);
    // nothing derived from the secret content was cached
    const cached = readdirSync(join(graphCacheDir(repo.root), 'files'));
    expect(cached).not.toContain(`${hashContent(secret)}.json`);
    expect(cached.length).toBe(r.stats.parsed);
  });

  it('counts files over the size cap as unparsed instead of reading them', async () => {
    if (!gitAvailable()) return;
    const repo = fixture({ 'src/big.ts': `import './a.ts';\n${'// pad\n'.repeat(Math.ceil(FILE_CAP / 7) + 10)}`, 'src/a.ts': '' });
    const r = await ok(repo.root);
    expect(r.graph.unparsed.has('src/big.ts')).toBe(true);
    expect(r.stats.unparsed).toBe(1);
    expect(r.graph.dependentsOf('src/a.ts')).toEqual([]);
  });

  it('degrades to a value when git is unavailable and when aborted', async () => {
    const bad = await buildGraph('.', { run: () => Promise.reject(new Error('git missing')) });
    expect(bad).toEqual({ available: false, reason: expect.stringContaining('git ls-files failed') });
    if (!gitAvailable()) return;
    const repo = fixture(basic);
    const ac = new AbortController();
    ac.abort();
    expect(await buildGraph(repo.root, { signal: ac.signal })).toEqual({ available: false, reason: 'build aborted' });
  });

  it('works without a writable cache directory', async () => {
    if (!gitAvailable()) return;
    const repo = fixture(basic);
    mkdirSync(join(repo.root, '.ai'), { recursive: true });
    writeFileSync(join(repo.root, '.ai', 'onni'), 'a file blocks the cache dir');
    const r = await ok(repo.root);
    expect(r.graph.edgeTotal).toBeGreaterThan(0);
  });

  it('keeps event-loop lag small while building (batches of 10 + yield)', async () => {
    if (!gitAvailable()) return;
    const files: Record<string, string> = {};
    for (let i = 0; i < 400; i++) {
      files[`src/m${i}.ts`] = `import { x } from './m${(i + 1) % 400}.ts';\n${'export const v = 1; // padding line\n'.repeat(200)}`;
    }
    const repo = fixture(files);
    let last = performance.now();
    let maxGap = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      maxGap = Math.max(maxGap, now - last);
      last = now;
    }, 10);
    last = performance.now();
    const r = await ok(repo.root);
    clearInterval(timer);
    console.info(`[project-graph] build of ${r.stats.files} files took ${r.stats.ms} ms, max event-loop gap ${Math.round(maxGap)} ms`);
    expect(r.stats.edges).toBe(400);
    expect(maxGap).toBeLessThan(200);
  });
});
