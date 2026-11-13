import { createHash } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { renameWithRetry } from '../fs-rename.ts';
import { atomicTmpPath, atomicWriteJson } from '../workspace/config.ts';
import type { FileRecord } from './graph.ts';
import { EXTRACTOR_VERSION, GRAPH_SCHEMA_VERSION } from './types.ts';

export interface GraphManifest {
  schemaVersion: number;
  extractorVersion: number;
  head: string | null;
  builtAt: string;
  files: number;
  edges: number;
}

/** `<repo>/.ai/onni/project-graph` — the per-repo cache. Written, never required (AGENTS.md "Zero config"). */
export const graphCacheDir = (root: string): string => join(root, '.ai', 'onni', 'project-graph');

export const hashContent = (content: string | Buffer): string => createHash('sha1').update(content).digest('hex');

/** Reads the manifest; a missing, corrupt or version-mismatched file is `null` (the graph is rebuilt, never fatal). */
export async function readManifest(root: string): Promise<GraphManifest | null> {
  try {
    const m = JSON.parse(await fsp.readFile(join(graphCacheDir(root), 'manifest.json'), 'utf8')) as Partial<GraphManifest>;
    if (m.schemaVersion !== GRAPH_SCHEMA_VERSION || m.extractorVersion !== EXTRACTOR_VERSION) return null;
    if (typeof m.builtAt !== 'string' || typeof m.files !== 'number' || typeof m.edges !== 'number') return null;
    return { ...(m as GraphManifest), head: typeof m.head === 'string' ? m.head : null };
  } catch {
    return null;
  }
}

/** Returns false (instead of throwing) when the cache dir is not writable. */
export async function writeManifest(root: string, manifest: GraphManifest): Promise<boolean> {
  try {
    await atomicWriteJson(join(graphCacheDir(root), 'manifest.json'), manifest);
    return true;
  } catch {
    return false;
  }
}

const entryPath = (root: string, hash: string): string => join(graphCacheDir(root), 'files', `${hash}.json`);

/** Cached extraction for a content hash, or null (missing / corrupt / other extractor version). */
export async function readEntry(root: string, hash: string): Promise<FileRecord | null> {
  try {
    const e = JSON.parse(await fsp.readFile(entryPath(root, hash), 'utf8')) as {
      v?: number;
      imports?: FileRecord['imports'];
      unresolvedDynamic?: number;
    };
    if (e.v !== EXTRACTOR_VERSION || !Array.isArray(e.imports) || typeof e.unresolvedDynamic !== 'number') return null;
    return { hash, imports: e.imports, unresolvedDynamic: e.unresolvedDynamic };
  } catch {
    return null;
  }
}

/** Tmp + rename, mode 0600. No fsync: an entry is derived data, a torn one fails to parse and is re-extracted. */
export async function writeEntry(root: string, record: FileRecord): Promise<boolean> {
  const path = entryPath(root, record.hash);
  const tmp = atomicTmpPath(path);
  try {
    await fsp.mkdir(join(graphCacheDir(root), 'files'), { recursive: true, mode: 0o700 });
    await fsp.writeFile(tmp, JSON.stringify({ v: EXTRACTOR_VERSION, imports: record.imports, unresolvedDynamic: record.unresolvedDynamic }), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await renameWithRetry(tmp, path);
    return true;
  } catch {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    return false;
  }
}

/** Deletes entries whose hash is not in `keep` (best effort). */
export async function pruneEntries(root: string, keep: ReadonlySet<string>): Promise<number> {
  let removed = 0;
  try {
    const dir = join(graphCacheDir(root), 'files');
    for (const name of await fsp.readdir(dir)) {
      if (!name.endsWith('.json') || keep.has(name.slice(0, -5))) continue;
      await fsp.rm(join(dir, name), { force: true }).catch(() => {});
      removed++;
    }
  } catch {
    // no cache dir yet
  }
  return removed;
}
