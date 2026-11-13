import { describe, expect, it } from 'vitest';
import { extractImports } from './extract.ts';
import { ProjectGraph } from './graph.ts';
import { computeImpact } from './impact.ts';
import { buildWorkspaceMap } from './resolve.ts';
import type { Snapshot } from './types.ts';

const snap: Snapshot = { head: 'abc', builtAt: '2026-01-01T00:00:00.000Z', stale: false };

function build(sources: Record<string, string>, extra: string[] = [], unparsed: string[] = []): ProjectGraph {
  const g = new ProjectGraph(
    buildWorkspaceMap([
      { path: 'packages/a/package.json', json: { name: '@x/a', dependencies: { '@x/b': '1' } } },
      { path: 'packages/b/package.json', json: { name: '@x/b' } },
      { path: 'packages/c/package.json', json: { name: '@x/c', dependencies: { '@x/b': '1' } } },
    ]),
    [],
  );
  g.addNodes([...Object.keys(sources), ...extra, ...unparsed]);
  for (const [p, s] of Object.entries(sources)) {
    const x = extractImports(s);
    g.setRecord(p, { hash: p, imports: x.imports, unresolvedDynamic: x.unresolvedDynamic });
  }
  for (const u of unparsed) g.markUnparsed(u);
  return g;
}

const small = () =>
  build({
    'packages/b/src/core.ts': '',
    'packages/a/src/x.ts': `import { c } from '../../b/src/core.ts';`,
    'packages/a/src/y.ts': `export * from '../../b/src/core.ts';`,
    'packages/a/src/x.test.ts': `import './x.ts';`,
    'packages/b/src/core.test.ts': `import './core.ts';`,
    'packages/a/src/z.ts': '',
  });

describe('computeImpact', () => {
  it('lists changed files, one-hop dependents with reasons, packages and tests', () => {
    const r = computeImpact(small(), snap, { files: ['packages/b/src/core.ts'] });
    expect(r.changed.map((c) => c.path)).toEqual(['packages/b/src/core.ts']);
    expect(r.dependents.map((d) => [d.path, d.via, d.reason])).toEqual([
      ['packages/a/src/x.ts', ['packages/b/src/core.ts'], 'imports `core.ts` (line 1)'],
      ['packages/a/src/y.ts', ['packages/b/src/core.ts'], 'reexports `core.ts` (line 1)'],
    ]);
    expect(r.packages.map((p) => [p.path, p.provenance])).toEqual([
      ['@x/a', 'extracted'],
      ['@x/b', 'extracted'],
      ['@x/c', 'declared'],
    ]);
    // dependents of x.ts (x.test.ts) are NOT pulled in: one hop only; the sibling test of dependent x.ts is medium
    expect(r.tests.map((t) => [t.path, t.confidence])).toEqual([
      ['packages/b/src/core.test.ts', 'high'],
      ['packages/a/src/x.test.ts', 'medium'],
    ]);
    expect(r.complete).toBe(true);
    expect(r.truncated).toBe(false);
    expect(r.snapshot).toEqual(snap);
  });

  it('treats a changed test as its own candidate', () => {
    const r = computeImpact(small(), snap, { files: ['packages/a/src/x.test.ts'] });
    expect(r.tests).toContainEqual({ path: 'packages/a/src/x.test.ts', confidence: 'high', reason: 'test file itself changed', source: 'graph' });
  });

  it('is incomplete for a file that is not in the graph, and says which', () => {
    const r = computeImpact(small(), snap, { files: ['packages/b/src/core.ts', 'src/brand-new.ts', '.env'] });
    expect(r.complete).toBe(false);
    expect(r.coverage.notInGraph).toEqual(['src/brand-new.ts', '.env']);
    expect(r.coverage.note).toContain('not in the graph');
  });

  it('judges completeness by scope: unresolved imports elsewhere do not matter, in-scope ones do', () => {
    const g = build({ 'src/a.ts': '', 'src/b.ts': `import './a.ts';`, 'src/far.ts': `import './missing.ts';` });
    expect(computeImpact(g, snap, { files: ['src/a.ts'] }).complete).toBe(true);
    const g2 = build({ 'src/a.ts': `import './missing.ts';`, 'src/b.ts': `import './a.ts';` });
    const r = computeImpact(g2, snap, { files: ['src/a.ts'] });
    expect(r.complete).toBe(false);
    expect(r.coverage.unresolvedImports).toBe(1);
    const g3 = build({ 'src/a.ts': '', 'src/b.ts': `import './a.ts';\nimport './missing.ts';` });
    const r3 = computeImpact(g3, snap, { files: ['src/a.ts'] }); // dependent b.ts has an unresolved import
    expect(r3.complete).toBe(false);
  });

  it('counts unparsed files in scope', () => {
    const g = build({ 'src/a.ts': '' }, [], ['src/big.ts']);
    const r = computeImpact(g, snap, { files: ['src/big.ts'] });
    expect(r.coverage.unparsedFiles).toBe(1);
    expect(r.complete).toBe(false);
  });

  it('is never complete on a stale snapshot', () => {
    expect(computeImpact(small(), { ...snap, stale: true }, { files: ['packages/b/src/core.ts'] }).complete).toBe(false);
  });

  it('truncates loudly at maxItems', () => {
    const sources: Record<string, string> = { 'src/t.ts': '' };
    for (let i = 0; i < 10; i++) sources[`src/u${i}.ts`] = `import './t.ts';`;
    const r = computeImpact(build(sources), snap, { files: ['src/t.ts'], maxItems: 4 });
    expect(r.dependents.length).toBe(4);
    expect(r.truncated).toBe(true);
    expect(r.complete).toBe(false);
  });

  describe('hubs', () => {
    const hubSources = (): Record<string, string> => {
      const s: Record<string, string> = { 'src/hub.ts': '', 'src/hub.test.ts': `import './hub.ts';` };
      for (let i = 0; i < 12; i++) s[`src/runs/r${i}.ts`] = `import '../hub.ts';`;
      for (let i = 0; i < 8; i++) s[`src/server/s${i}.ts`] = `import '../hub.ts';`;
      for (let i = 0; i < 3; i++) s[`src/web/w${i}.ts`] = `import '../hub.ts';`;
      return s;
    };

    it('collapses a hub seed into directory groups with three samples each', () => {
      const r = computeImpact(build(hubSources()), snap, { files: ['src/hub.ts'] });
      expect(r.dependents).toEqual([]);
      expect(r.hubGroups.map((h) => [h.dir, h.count, h.sample.length])).toEqual([
        ['src/runs', 12, 3],
        ['src/server', 8, 3],
        ['src/web', 3, 3],
      ]);
      expect(r.hubGroups[0]?.hub).toBe('src/hub.ts');
      expect(r.hubGroups[0]?.sample).toEqual(['src/runs/r0.ts', 'src/runs/r1.ts', 'src/runs/r10.ts']);
      expect(r.hubThreshold).toBeGreaterThanOrEqual(20);
      expect(r.tests.map((t) => [t.path, t.confidence])).toEqual([['src/hub.test.ts', 'high']] /* same-name sibling stays high; import-only tests via a hub are medium (graph.test.ts) */);
    });

    it('expand opens one directory only', () => {
      const r = computeImpact(build(hubSources()), snap, { files: ['src/hub.ts'], expand: 'src/web' });
      expect(r.dependents.map((d) => d.path)).toEqual(['src/web/w0.ts', 'src/web/w1.ts', 'src/web/w2.ts']);
      expect(r.hubGroups.length).toBe(3);
    });

    it('does not count test importers toward hub-ness', () => {
      const s: Record<string, string> = { 'src/t.ts': '' };
      for (let i = 0; i < 30; i++) s[`src/t${i}.test.ts`] = `import './t.ts';`;
      const r = computeImpact(build(s), snap, { files: ['src/t.ts'] });
      expect(r.hubGroups).toEqual([]);
      expect(r.tests.length).toBe(30);
    });
  });

  it('lets a selectTests hook replace the built-in ranking', () => {
    const r = computeImpact(small(), snap, { files: ['packages/b/src/core.ts'] }, {
      selectTests: ({ changed }) => [{ path: 'only.test.ts', confidence: 'low', reason: `hook saw ${changed.length}`, source: 'runner' }],
    });
    expect(r.tests).toEqual([{ path: 'only.test.ts', confidence: 'low', reason: 'hook saw 1', source: 'runner' }]);
  });

  it('normalises Windows separators and ./ prefixes', () => {
    const r = computeImpact(small(), snap, { files: ['.\\packages\\b\\src\\core.ts'.replace(/\\/g, '/'), 'packages\\b\\src\\core.ts'.split('\\').join('/')] });
    expect(r.changed.length).toBe(1);
  });
});
