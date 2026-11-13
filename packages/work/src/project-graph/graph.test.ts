import { describe, expect, it } from 'vitest';
import { extractImports } from './extract.ts';
import { ProjectGraph, percentile, siblingTests, type FileRecord } from './graph.ts';
import { buildWorkspaceMap } from './resolve.ts';

function build(sources: Record<string, string>, extraFiles: string[] = []): ProjectGraph {
  const g = new ProjectGraph(
    buildWorkspaceMap([{ path: 'packages/a/package.json', json: { name: '@x/a', dependencies: { '@x/b': '1' } } }, { path: 'packages/b/package.json', json: { name: '@x/b' } }]),
    [],
  );
  g.addNodes([...Object.keys(sources), ...extraFiles]);
  for (const [p, s] of Object.entries(sources)) {
    const x = extractImports(s);
    g.setRecord(p, { hash: p, imports: x.imports, unresolvedDynamic: x.unresolvedDynamic });
  }
  return g;
}

describe('ProjectGraph', () => {
  it('builds forward and reverse edges with kinds, ignoring self edges and ext packages', () => {
    const g = build({
      'src/a.ts': `import { b } from './b.ts';\nimport type { C } from './c.ts';\nexport * from './d.ts';\nimport fs from 'node:fs';\nimport './a.ts';`,
      'src/b.ts': '',
      'src/c.ts': '',
      'src/d.ts': '',
    });
    expect(g.forward.get('src/a.ts')?.map((e) => `${e.kind}:${e.to}`)).toEqual(['imports:src/b.ts', 'type-imports:src/c.ts', 'reexports:src/d.ts']);
    expect(g.dependentsOf('src/b.ts')).toEqual(['src/a.ts']);
    expect(g.importsOf('src/a.ts')).toEqual(['src/b.ts', 'src/c.ts', 'src/d.ts']);
    expect(g.edgeTotal).toBe(3);
    expect(g.ext.get('node:fs')).toBe(1);
  });

  it('collects unresolved imports per file, including non-literal dynamic imports', () => {
    const g = build({ 'src/a.ts': `import './missing.ts';\nawait import(name);` });
    expect(g.unresolved.get('src/a.ts')?.length).toBe(2);
  });

  it('recognises tests, siblings and tests-by-import', () => {
    const g = build({
      'src/foo.ts': '',
      'src/foo.test.ts': `import { x } from './foo.ts';`,
      'src/other.test.ts': `import { x } from './foo.ts';`,
      'src/bar.ts': '',
    });
    expect(g.isTest('src/foo.test.ts')).toBe(true);
    expect(g.isTest('src/foo.ts')).toBe(false);
    expect(g.allTests()).toEqual(['src/foo.test.ts', 'src/other.test.ts']);
    expect(g.testsFor('src/foo.ts').map((t) => [t.path, t.confidence])).toEqual([
      ['src/foo.test.ts', 'high'],
      ['src/other.test.ts', 'high'],
    ]);
    expect(g.testsFor('src/bar.ts')).toEqual([]);
    expect(siblingTests('src/foo.ts', g.fileSet)).toEqual(['src/foo.test.ts']);
  });

  it('computes hubs from NON-test in-degree with a floor of 20', () => {
    const sources: Record<string, string> = { 'src/hub.ts': '', 'src/small.ts': '' };
    for (let i = 0; i < 25; i++) sources[`src/u${i}.ts`] = `import './hub.ts';`;
    for (let i = 0; i < 5; i++) sources[`src/u${i}.ts`] += `\nimport './small.ts';`;
    for (let i = 0; i < 40; i++) sources[`src/t${i}.test.ts`] = `import './small.ts';`;
    const g = build(sources);
    expect(g.hubThreshold()).toBeGreaterThanOrEqual(20);
    expect(g.isHub('src/hub.ts')).toBe(true);
    expect(g.isHub('src/small.ts')).toBe(false); // 40 test importers must not make a hub
    expect(g.hubDegree('src/small.ts')).toBe(5);
  });

  it('lowers confidence of tests reached through a hub', () => {
    const sources: Record<string, string> = { 'src/hub.ts': '', 'src/t.test.ts': `import './hub.ts';` };
    for (let i = 0; i < 25; i++) sources[`src/u${i}.ts`] = `import './hub.ts';`;
    expect(build(sources).testsFor('src/hub.ts')[0]?.confidence).toBe('medium');
  });

  it('updates incrementally: changed record, removed file, added file', () => {
    const g = build({ 'src/a.ts': `import './b.ts';`, 'src/b.ts': '' });
    const rec = (s: string): FileRecord => ({ hash: s, ...extractImports(s) });
    g.setRecord('src/a.ts', rec(`import './c.ts';`));
    expect(g.unresolved.has('src/a.ts')).toBe(true);
    g.addFile('src/c.ts');
    expect(g.unresolved.has('src/a.ts')).toBe(false);
    expect(g.dependentsOf('src/c.ts')).toEqual(['src/a.ts']);
    expect(g.dependentsOf('src/b.ts')).toEqual([]);
    g.removeFile('src/c.ts');
    expect(g.unresolved.has('src/a.ts')).toBe(true);
    expect(g.edgeTotal).toBe(0);
    expect(g.fileSet.has('src/c.ts')).toBe(false);
  });

  it('reports workspace package dependencies from manifests', () => {
    expect(build({}).packageDeps()).toEqual([{ from: '@x/a', to: '@x/b' }]);
  });

  it('percentile picks the nearest rank', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 95)).toBe(0);
  });
});
