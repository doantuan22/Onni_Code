import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { graphCacheDir, hashContent, pruneEntries, readEntry, readManifest, writeEntry, writeManifest } from './store.ts';
import { EXTRACTOR_VERSION, GRAPH_SCHEMA_VERSION } from './types.ts';

const dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'pg-store-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3 });
});
const manifest = { schemaVersion: GRAPH_SCHEMA_VERSION, extractorVersion: EXTRACTOR_VERSION, head: 'abc', builtAt: '2026-01-01T00:00:00.000Z', files: 3, edges: 2 };

describe('store', () => {
  it('round-trips manifest and entries', async () => {
    const root = tmp();
    expect(await writeManifest(root, manifest)).toBe(true);
    expect(await readManifest(root)).toEqual(manifest);
    const hash = hashContent('x');
    expect(await writeEntry(root, { hash, imports: [{ specifier: './a', kind: 'import', line: 1 }], unresolvedDynamic: 2 })).toBe(true);
    expect(await readEntry(root, hash)).toEqual({ hash, imports: [{ specifier: './a', kind: 'import', line: 1 }], unresolvedDynamic: 2 });
  });

  it('treats missing, corrupt and wrong-version files as absent instead of throwing', async () => {
    const root = tmp();
    expect(await readManifest(root)).toBeNull();
    expect(await readEntry(root, 'nope')).toBeNull();
    mkdirSync(join(graphCacheDir(root), 'files'), { recursive: true });
    writeFileSync(join(graphCacheDir(root), 'manifest.json'), '{ not json');
    writeFileSync(join(graphCacheDir(root), 'files', 'bad.json'), '[1,');
    expect(await readManifest(root)).toBeNull();
    expect(await readEntry(root, 'bad')).toBeNull();
    await writeManifest(root, { ...manifest, schemaVersion: GRAPH_SCHEMA_VERSION + 1 });
    expect(await readManifest(root)).toBeNull();
    await writeManifest(root, { ...manifest, extractorVersion: EXTRACTOR_VERSION + 1 });
    expect(await readManifest(root)).toBeNull();
    writeFileSync(join(graphCacheDir(root), 'files', 'old.json'), JSON.stringify({ v: EXTRACTOR_VERSION + 1, imports: [], unresolvedDynamic: 0 }));
    expect(await readEntry(root, 'old')).toBeNull();
  });

  it('leaves no tmp files behind and prunes entries that are not kept', async () => {
    const root = tmp();
    const keep = hashContent('keep');
    await writeEntry(root, { hash: keep, imports: [], unresolvedDynamic: 0 });
    await writeEntry(root, { hash: hashContent('drop'), imports: [], unresolvedDynamic: 0 });
    expect(await pruneEntries(root, new Set([keep]))).toBe(1);
    expect(readdirSync(join(graphCacheDir(root), 'files'))).toEqual([`${keep}.json`]);
    expect(JSON.parse(readFileSync(join(graphCacheDir(root), 'files', `${keep}.json`), 'utf8')).v).toBe(EXTRACTOR_VERSION);
  });

  it('degrades to false when the cache dir cannot be created', async () => {
    const root = tmp();
    mkdirSync(join(root, '.ai'));
    writeFileSync(join(root, '.ai', 'onni'), 'a file where a directory should be');
    expect(await writeManifest(root, manifest)).toBe(false);
    expect(await writeEntry(root, { hash: 'h', imports: [], unresolvedDynamic: 0 })).toBe(false);
  });
});
