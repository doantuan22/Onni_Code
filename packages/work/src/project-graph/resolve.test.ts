import { describe, expect, it } from 'vitest';
import { aliasesFromTsconfig, buildWorkspaceMap, packageOf, parseJsonc, resolveSpecifier, type ResolveContext } from './resolve.ts';

const files = [
  'packages/work/src/a.ts',
  'packages/work/src/b.ts',
  'packages/work/src/dir/index.ts',
  'packages/work/src/comp.tsx',
  'packages/work/src/text.md',
  'packages/contract/src/index.ts',
  'packages/contract/src/runs.ts',
  'packages/work/src/server/app-type.ts',
  'packages/web/src/lib/x.ts',
  'packages/web/src/main.tsx',
];
const workspaces = buildWorkspaceMap([
  { path: 'packages/contract/package.json', json: { name: '@onni/contract', exports: { '.': './src/index.ts', './runs': './src/runs.ts' } } },
  {
    path: 'packages/work/package.json',
    json: { name: '@onni/work', exports: { '.': './dist/index.js', './app-type': './dist/server/app-type.js' }, dependencies: { '@onni/contract': '1' } },
  },
  { path: 'packages/web/package.json', json: { name: '@onni/web' } },
]);
const aliases = aliasesFromTsconfig(
  'packages/web/tsconfig.json',
  parseJsonc(`{ // comment\n "compilerOptions": { "paths": { "@/*": ["./src/*"], /* x */ "@onni/contract": ["../contract/src/index.ts"], }, }, }`),
);
const ctx: ResolveContext = { fileSet: new Set(files), workspaces, aliases };
const r = (spec: string, from = 'packages/work/src/a.ts') => resolveSpecifier(spec, from, ctx);

describe('resolveSpecifier', () => {
  it('maps .js to .ts/.tsx and resolves index files', () => {
    expect(r('./b.js')).toEqual({ type: 'file', to: 'packages/work/src/b.ts' });
    expect(r('./comp.js')).toEqual({ type: 'file', to: 'packages/work/src/comp.tsx' });
    expect(r('./dir')).toEqual({ type: 'file', to: 'packages/work/src/dir/index.ts' });
    expect(r('./b.ts')).toEqual({ type: 'file', to: 'packages/work/src/b.ts' });
  });
  it('strips vite suffixes such as ?raw', () => {
    expect(r('./text.md?raw')).toEqual({ type: 'file', to: 'packages/work/src/text.md' });
  });
  it('reports a missing relative path as unresolved', () => {
    expect(r('./nope.ts').type).toBe('unresolved');
  });
  it('resolves workspace packages through exports and dist -> src', () => {
    expect(r('@onni/contract')).toEqual({ type: 'file', to: 'packages/contract/src/index.ts' });
    expect(r('@onni/contract/runs')).toEqual({ type: 'file', to: 'packages/contract/src/runs.ts' });
    expect(r('@onni/work/app-type', 'packages/web/src/main.tsx')).toEqual({ type: 'file', to: 'packages/work/src/server/app-type.ts' });
  });
  it('resolves the web alias only inside its tsconfig scope', () => {
    expect(r('@/lib/x', 'packages/web/src/main.tsx')).toEqual({ type: 'file', to: 'packages/web/src/lib/x.ts' });
    expect(r('@/lib/x').type).toBe('ext');
  });
  it('treats bare packages and node: as ext', () => {
    expect(r('react')).toEqual({ type: 'ext', name: 'react' });
    expect(r('@scope/pkg/deep')).toEqual({ type: 'ext', name: '@scope/pkg' });
    expect(r('node:fs')).toEqual({ type: 'ext', name: 'node:fs' });
  });
  it('flags an unknown workspace subpath as unresolved', () => {
    expect(r('@onni/contract/zzz').type).toBe('unresolved');
  });
});

describe('workspace helpers', () => {
  it('finds the owning package by longest dir', () => {
    expect(packageOf('packages/web/src/main.tsx', workspaces)).toBe('@onni/web');
    expect(packageOf('README.md', workspaces)).toBeNull();
  });
  it('records dependencies from the manifest', () => {
    expect(workspaces.get('@onni/work')?.dependencies).toEqual(['@onni/contract']);
  });
  it('parseJsonc survives comments in strings', () => {
    expect(parseJsonc('{"a":"//x", /* c */ "b":1,}')).toEqual({ a: '//x', b: 1 });
  });
});
