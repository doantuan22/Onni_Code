// node --test docs/design/project-graph/scripts/proto/lib.test.mjs
// Fixtures live in a temp dir and a throwaway git repo; nothing touches the real repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  isDenied, extractImports, resolveSpecifier, buildWorkspaceMap, buildGraphFromSources, buildGraph, listFiles,
  groupByDirectory, hubThreshold, computeImpact, coChangeFor, filterCommits, applyBudget, siblingTests, blankNonCode,
} from './lib.mjs';

const ws = buildWorkspaceMap([
  { path: 'packages/contract/package.json', json: { name: '@onni/contract', exports: { '.': './src/index.ts' } } },
  { path: 'packages/work/package.json', json: { name: '@onni/work', exports: { '.': './dist/index.js', './app-type': './dist/server/app-type.js' } } },
]);

test('denylist blocks secrets but allows .env.example', () => {
  for (const p of ['.env', '.env.local', 'a/b/.env.production', 'x/cert.pem', 'k.key', 'id_rsa', 'id_rsa.pub', 'a.p12', 'pkg/.npmrc', 'node_modules/x/y.js', 'packages/work/web/dist/a.js', 'dist/x.js']) assert.equal(isDenied(p), true, p);
  for (const p of ['.env.example', 'src/environment.ts', 'src/keyboard.ts', 'docs/key.md']) assert.equal(isDenied(p), false, p);
});

test('extractImports: static, type, re-export, side-effect, dynamic const, require, mock; comments and templates ignored', () => {
  const src = `
import a from './a.js';
import type { T } from './t';
import {
  b,
  c,
} from "./multi";
export * from './star';
export { x } from './named';
import './side';
const m = await import('./lazy');
const dyn = await import(name);
const r = require('./cjs');
vi.mock('./mocked');
// import z from './commented';
/* import y from './block'; */
const s = \`import q from './in-template'\`;
`;
  const got = extractImports(src);
  const by = Object.fromEntries(got.map((i) => [i.specifier, i.kind]));
  assert.deepEqual(by, {
    './a.js': 'import', './t': 'type', './multi': 'import', './star': 'reexport', './named': 'reexport',
    './side': 'import', './lazy': 'dynamic', './cjs': 'require', './mocked': 'mock',
  });
  assert.equal(got.unresolvedDynamic, 1);
  assert.equal(got.find((i) => i.specifier === './multi').line, 4);
  assert.equal(blankNonCode('a // x\nb').length, 'a // x\nb'.length);
});

test('resolver: .js→.ts, index, directory, extensionless, alias and ?raw', () => {
  const fileSet = new Set(['src/a.ts', 'src/b.tsx', 'src/dir/index.ts', 'src/c.json', 'packages/web/src/lib/u.ts']);
  const ctx = { fileSet, workspaces: ws, aliases: [{ prefix: '@/', dir: 'packages/web/src' }] };
  assert.deepEqual(resolveSpecifier('./a.js', 'src/x.ts', ctx), { type: 'file', to: 'src/a.ts' });
  assert.deepEqual(resolveSpecifier('./b.js', 'src/x.ts', ctx), { type: 'file', to: 'src/b.tsx' });
  assert.deepEqual(resolveSpecifier('./dir', 'src/x.ts', ctx), { type: 'file', to: 'src/dir/index.ts' });
  assert.deepEqual(resolveSpecifier('./c', 'src/x.ts', ctx), { type: 'file', to: 'src/c.json' });
  assert.deepEqual(resolveSpecifier('../a.ts?raw', 'src/x/y.ts', ctx), { type: 'file', to: 'src/a.ts' });
  assert.deepEqual(resolveSpecifier('@/lib/u', 'packages/web/src/app.ts', ctx), { type: 'file', to: 'packages/web/src/lib/u.ts' });
  assert.equal(resolveSpecifier('./missing', 'src/x.ts', ctx).type, 'unresolved');
  assert.deepEqual(resolveSpecifier('react', 'src/x.ts', ctx), { type: 'ext', name: 'react' });
  assert.deepEqual(resolveSpecifier('@scope/pkg/sub', 'src/x.ts', ctx), { type: 'ext', name: '@scope/pkg' });
  assert.deepEqual(resolveSpecifier('node:fs', 'src/x.ts', ctx), { type: 'ext', name: 'node:fs' });
});

test('resolver: workspace @onni/* maps exports (src, and dist→src for built packages)', () => {
  const fileSet = new Set(['packages/contract/src/index.ts', 'packages/work/src/index.ts', 'packages/work/src/server/app-type.ts']);
  const ctx = { fileSet, workspaces: ws };
  assert.deepEqual(resolveSpecifier('@onni/contract', 'packages/web/src/a.ts', ctx), { type: 'file', to: 'packages/contract/src/index.ts' });
  assert.deepEqual(resolveSpecifier('@onni/work', 'packages/web/src/a.ts', ctx), { type: 'file', to: 'packages/work/src/index.ts' });
  assert.deepEqual(resolveSpecifier('@onni/work/app-type', 'packages/web/src/a.ts', ctx), { type: 'file', to: 'packages/work/src/server/app-type.ts' });
  assert.equal(resolveSpecifier('@onni/contract/nope', 'packages/web/src/a.ts', ctx).type, 'unresolved');
});

// A star graph: hub.ts is imported by 12 files in 3 dirs; leaf.ts by 1.
function starFixture() {
  const sources = { 'src/hub.ts': 'export const h = 1;', 'src/leaf.ts': 'export const l = 1;', 'src/leaf.test.ts': "import './leaf';" , 'src/hub.test.ts': "import './hub';" };
  for (let i = 0; i < 5; i++) sources[`src/a/f${i}.ts`] = "import { h } from '../hub';";
  for (let i = 0; i < 4; i++) sources[`src/b/g${i}.ts`] = "import { h } from '../hub';";
  for (let i = 0; i < 3; i++) sources[`src/c/h${i}.ts`] = "import { h } from '../hub';";
  sources['src/c/uses-leaf.ts'] = "import { l } from '../leaf';";
  const fileSet = new Set(Object.keys(sources));
  const graph = buildGraphFromSources(sources, { fileSet, workspaces: new Map() });
  return { sources, fileSet, graph };
}

test('hub grouping: seed above threshold collapses to "N file ở M thư mục" with 3 reps; leaf lists files', () => {
  const { fileSet, graph } = starFixture();
  assert.equal(hubThreshold(graph, { percent: 95, minDegree: 10 }), 13); // hub has 12 non-test + 1 test dependents
  const res = computeImpact(graph, { files: ['src/hub.ts'], fileSet, workspaces: new Map(), hub: { percent: 95, minDegree: 10 } });
  const [h] = res.layers.L1.hubs;
  assert.equal(h.total, 13); // 12 sources in 3 dirs + src/hub.test.ts
  assert.equal(h.summary, '13 file ở 4 thư mục');
  assert.equal(h.groups[0].group, 'src/a');
  assert.equal(h.groups[0].count, 5);
  assert.equal(h.groups[0].representatives.length, 3);
  assert.equal(res.layers.L1.files.length, 0);
  const exp = computeImpact(graph, { files: ['src/hub.ts'], fileSet, workspaces: new Map(), hub: { percent: 95, minDegree: 10 }, expand: 'src/b' });
  assert.equal(exp.layers.L1.files.length, 4);
  const leaf = computeImpact(graph, { files: ['src/leaf.ts'], fileSet, workspaces: new Map(), hub: { percent: 95, minDegree: 10 } });
  assert.equal(leaf.layers.L1.hubs.length, 0);
  assert.deepEqual(leaf.layers.L1.files.map((f) => f.file).sort(), ['src/c/uses-leaf.ts', 'src/leaf.test.ts']);
  assert.ok(leaf.layers.L3.some((t) => t.file === 'src/leaf.test.ts' && t.confidence === 'high'));
  assert.deepEqual(siblingTests('src/leaf.ts', fileSet), ['src/leaf.test.ts']);
});

test('groupByDirectory orders by count and caps representatives', () => {
  const g = groupByDirectory(['a/x.ts', 'a/y.ts', 'a/z.ts', 'a/w.ts', 'b/q.ts']);
  assert.equal(g[0].group, 'a');
  assert.equal(g[0].count, 4);
  assert.deepEqual(g[0].representatives, ['a/w.ts', 'a/x.ts', 'a/y.ts']);
});

function commit(hash, files, extra = {}) { return { hash, subject: `c ${hash}`, author: 'dev', date: 1_700_000_000, files, ...extra }; }

test('co-change: support/confidence thresholds, noise filters, role separation', () => {
  const commits = [
    ...Array.from({ length: 4 }, (_, i) => commit(`ab${i}`, ['a.ts', 'b.ts'])),       // a↔b 4x
    commit('ac0', ['a.ts', 'c.ts']),                                                  // a↔c 1x (below support)
    commit('at0', ['a.ts', 'a.test.ts']), commit('at1', ['a.ts', 'a.test.ts']), commit('at2', ['a.ts', 'a.test.ts']), // test partner dropped
    commit('big', Array.from({ length: 40 }, (_, i) => `m${i}.ts`).concat(['a.ts', 'd.ts'])),          // too many files
    commit('lock', ['a.ts', 'package-lock.json']), commit('lock2', ['a.ts', 'package-lock.json']), commit('lock3', ['a.ts', 'package-lock.json']),
    ...Array.from({ length: 3 }, (_, i) => commit(`bot${i}`, ['a.ts', 'e.ts'], { author: 'dependabot[bot]' })),
    ...Array.from({ length: 3 }, (_, i) => commit(`fmt${i}`, ['a.ts', 'f.ts'], { subject: 'chore(deps): bump x' })),
  ];
  const { rows, stats } = coChangeFor(['a.ts'], commits, { minSupport: 3, minConfidence: 0.3, maxFiles: 30 });
  assert.deepEqual(rows.map((r) => r.file), ['b.ts']);
  assert.equal(rows[0].support, 4);
  assert.equal(rows[0].seedCommits, 8); // 4 ab + 1 ac + 3 at; big/lock/bot/fmt commits are filtered out
  assert.equal(rows[0].confidence, 0.5);
  assert.equal(rows[0].sampleCommits.length, 2);
  assert.ok(stats.commitsUsable < stats.commitsSeen);
  // `exclude` removes partners already in L0
  assert.equal(coChangeFor(['a.ts'], commits, { exclude: ['b.ts'] }).rows.length, 0);
  // lockfile-only partners vanish, commit with <2 real files is unusable
  assert.equal(filterCommits([commit('x', ['a.ts', 'package-lock.json'])]).length, 0);
});

test('truncation is never silent: omitted counts reported, hub summaries and L0 kept', () => {
  const layers = {
    L0: [{ file: 'a.ts' }], L2: [{ package: 'p' }],
    L1: { files: Array.from({ length: 50 }, (_, i) => ({ file: `src/dependent-${i}.ts`, reason: 'imports `a.ts`' })), hubs: [{ seed: 'a.ts', summary: '50 file ở 1 thư mục' }] },
    L3: Array.from({ length: 50 }, (_, i) => ({ file: `src/t-${i}.test.ts` })), LX: [{ file: 'z.ts' }],
  };
  const small = applyBudget(layers, 150); // 600 chars
  assert.equal(small.truncated, true);
  assert.equal(small.layers.L0.length, 1);
  assert.equal(small.layers.L1.hubs.length, 1);
  assert.ok(small.omitted.L1 > 0 && small.omitted.L3 > 0);
  assert.equal(small.layers.L1.files.length + small.omitted.L1, 50);
  const big = applyBudget(layers, 100_000);
  assert.equal(big.truncated, false);
  assert.deepEqual(big.omitted, {});
});

test('buildGraph on a temp git repo: lists via git ls-files, never reads denied files, flags caps', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'graph-proto-'));
  try {
    const w = (p, c) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), c); };
    w('package.json', JSON.stringify({ name: 'root', private: true }));
    w('src/a.ts', "import { b } from './b.js';\nexport const a = b;");
    w('src/b.ts', 'export const b = 1;');
    w('src/b.test.ts', "import { b } from './b';");
    w('.env', "import x from './a'"); // would create an edge if it were read
    w('src/big.ts', 'x'.repeat(600_000));
    const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
    g('init', '-q'); g('add', '-f', '.');
    assert.ok(!listFiles(dir).includes('.env'));
    const b = await buildGraph(dir);
    assert.equal(b.fileSet.has('.env'), false);
    assert.equal(b.unparsed, 1); // big.ts over the 512000-byte cap
    const res = computeImpact(b.graph, { files: ['src/b.ts'], fileSet: b.fileSet, workspaces: b.workspaces, coverage: { unparsedFiles: b.unparsed } });
    assert.deepEqual(res.layers.L1.files.map((f) => f.file).sort(), ['src/a.ts', 'src/b.test.ts']);
    assert.equal(res.coverage.unparsedFiles, 1);
    assert.deepEqual(res.layers.L3.map((t) => t.file), ['src/b.test.ts']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
