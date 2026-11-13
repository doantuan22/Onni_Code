import { promises as fsp } from 'node:fs';
import { posix } from 'node:path';
import { join } from 'node:path';
import { setImmediate as yieldToLoop } from 'node:timers/promises';
import { isDenied } from './denylist.ts';
import { extractImports } from './extract.ts';
import { ProjectGraph, isCodeFile, type FileRecord } from './graph.ts';
import { gitHead, listFiles, type GitRun } from './list-files.ts';
import { aliasesFromTsconfig, buildWorkspaceMap, parseJsonc } from './resolve.ts';
import { hashContent, pruneEntries, readEntry, writeEntry, writeManifest } from './store.ts';
import { EXTRACTOR_VERSION, FILE_CAP, GRAPH_SCHEMA_VERSION } from './types.ts';

/** Files per batch; the event loop gets a turn between batches so a build never starves the server. */
export const BUILD_BATCH_SIZE = 10;

export interface BuildOptions {
  signal?: AbortSignal;
  run?: GitRun;
  batchSize?: number;
  /** `true` ignores cached extractions (a "full" rebuild); the cache is rewritten either way. */
  ignoreCache?: boolean;
  /** Persist manifest + entries under `.ai/onni/project-graph`. Default true. */
  persist?: boolean;
  maxFiles?: number;
}
export interface BuildStats {
  files: number;
  edges: number;
  parsed: number;
  fromCache: number;
  extracted: number;
  unparsed: number;
  listingTruncated: boolean;
  ms: number;
}
export type BuildResult =
  | { available: true; graph: ProjectGraph; head: string | null; builtAt: string; stats: BuildStats }
  | { available: false; reason: string };

/** Reads one source file. Returns null for: denied path, unreadable, or over the size cap (`tooBig`). */
export async function readSource(root: string, path: string): Promise<{ text: string; hash: string } | { tooBig: true } | null> {
  if (isDenied(path)) return null;
  try {
    const abs = join(root, path);
    if ((await fsp.stat(abs)).size > FILE_CAP) return { tooBig: true };
    const buf = await fsp.readFile(abs);
    return { text: buf.toString('utf8'), hash: hashContent(buf) };
  } catch {
    return null;
  }
}

/** Extraction for one file through the content-addressed cache. */
export async function recordFor(
  root: string,
  text: string,
  hash: string,
  opts: { ignoreCache?: boolean; persist?: boolean } = {},
): Promise<{ record: FileRecord; cached: boolean }> {
  if (!opts.ignoreCache) {
    const hit = await readEntry(root, hash);
    if (hit) return { record: hit, cached: true };
  }
  const x = extractImports(text);
  const record: FileRecord = { hash, imports: x.imports, unresolvedDynamic: x.unresolvedDynamic };
  if (opts.persist !== false) await writeEntry(root, record);
  return { record, cached: false };
}

async function readJson(root: string, path: string): Promise<unknown> {
  const s = await readSource(root, path);
  if (!s || 'tooBig' in s) return null;
  return parseJsonc(s.text);
}

/** Workspace packages (package.json up to 3 levels deep) and tsconfig `paths` aliases. */
export async function loadWorkspaceContext(root: string, files: readonly string[]) {
  const shallow = files.filter((f) => f.split('/').length <= 4);
  const manifests = await Promise.all(
    shallow.filter((f) => posix.basename(f) === 'package.json').map(async (path) => ({ path, json: await readJson(root, path) })),
  );
  const tsconfigs = await Promise.all(
    shallow.filter((f) => /^tsconfig[^/]*\.json$/.test(posix.basename(f))).map(async (path) => ({ path, json: await readJson(root, path) })),
  );
  const aliases = tsconfigs.flatMap((t) => aliasesFromTsconfig(t.path, t.json));
  return { workspaces: buildWorkspaceMap(manifests), aliases };
}

/** Builds the whole graph. Never throws: failures are `{ available:false, reason }`. */
export async function buildGraph(root: string, opts: BuildOptions = {}): Promise<BuildResult> {
  const t0 = performance.now();
  const aborted = (): BuildResult => ({ available: false, reason: 'build aborted' });
  try {
    const listing = await listFiles(root, {
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(opts.run ? { run: opts.run } : {}),
      ...(opts.maxFiles ? { maxFiles: opts.maxFiles } : {}),
    });
    if (!listing.available) return opts.signal?.aborted ? aborted() : listing;
    if (opts.signal?.aborted) return aborted();

    const { workspaces, aliases } = await loadWorkspaceContext(root, listing.files);
    const graph = new ProjectGraph(workspaces, aliases);
    graph.addNodes(listing.files);

    const code = listing.files.filter(isCodeFile);
    const size = Math.max(1, opts.batchSize ?? BUILD_BATCH_SIZE);
    const hashes = new Set<string>();
    let fromCache = 0;
    let extracted = 0;
    for (let i = 0; i < code.length; i += size) {
      if (opts.signal?.aborted) return aborted();
      await Promise.all(
        code.slice(i, i + size).map(async (path) => {
          const src = await readSource(root, path);
          if (!src || 'tooBig' in src) {
            graph.markUnparsed(path);
            return;
          }
          const { record, cached } = await recordFor(root, src.text, src.hash, {
            ...(opts.ignoreCache !== undefined ? { ignoreCache: opts.ignoreCache } : {}),
            ...(opts.persist !== undefined ? { persist: opts.persist } : {}),
          });
          hashes.add(record.hash);
          if (cached) fromCache++;
          else extracted++;
          graph.records.set(path, record);
        }),
      );
      await yieldToLoop();
    }
    graph.resolveAll();

    const head = await gitHead(root, { ...(opts.run ? { run: opts.run } : {}), ...(opts.signal ? { signal: opts.signal } : {}) });
    const builtAt = new Date().toISOString();
    if (opts.persist !== false) {
      await writeManifest(root, {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        extractorVersion: EXTRACTOR_VERSION,
        head,
        builtAt,
        files: graph.fileCount,
        edges: graph.edgeTotal,
      });
      await pruneEntries(root, hashes);
    }
    return {
      available: true,
      graph,
      head,
      builtAt,
      stats: {
        files: graph.fileCount,
        edges: graph.edgeTotal,
        parsed: graph.records.size,
        fromCache,
        extracted,
        unparsed: graph.unparsed.size,
        listingTruncated: listing.truncated,
        ms: Math.round(performance.now() - t0),
      },
    };
  } catch (error) {
    if (opts.signal?.aborted) return aborted();
    return { available: false, reason: `graph build failed: ${(error as Error).message.split('\n')[0]}` };
  }
}
