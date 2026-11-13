import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { readSource, recordFor } from './build.ts';
import { isDenied } from './denylist.ts';
import { isCodeFile, type ProjectGraph } from './graph.ts';
import { gitHead, runGit, type GitRun } from './list-files.ts';

export interface RefreshOptions {
  /** Total time budget; past it the remaining files are skipped and the result is `timedOut`. */
  deadlineMs?: number;
  signal?: AbortSignal;
  run?: GitRun;
  /** Persist new extractions to the cache. Default true. */
  persist?: boolean;
  /** Cap on how many files one refresh looks at. */
  maxFiles?: number;
}
export interface RefreshResult {
  checked: number;
  updated: string[];
  added: string[];
  removed: string[];
  timedOut: boolean;
}

export const DEFAULT_FRESHNESS_DEADLINE_MS = 3_000;
export const DEFAULT_FRESHNESS_MAX_FILES = 600;

/**
 * Re-hashes `paths` against the graph and applies the difference incrementally: a changed file gets a new record
 * (out-edges replaced, in-edges follow because they are derived), a vanished file is removed, a new one is added.
 * Denylisted paths are skipped before any I/O.
 */
export async function refreshPaths(root: string, graph: ProjectGraph, paths: Iterable<string>, opts: RefreshOptions = {}): Promise<RefreshResult> {
  const deadline = performance.now() + (opts.deadlineMs ?? DEFAULT_FRESHNESS_DEADLINE_MS);
  const cap = opts.maxFiles ?? DEFAULT_FRESHNESS_MAX_FILES;
  const out: RefreshResult = { checked: 0, updated: [], added: [], removed: [], timedOut: false };
  const todo = [...new Set(paths)].filter((p) => !isDenied(p));
  if (todo.length > cap) out.timedOut = true; // the part beyond the cap was not verified
  for (const path of todo.slice(0, cap)) {
    if (opts.signal?.aborted || performance.now() > deadline) {
      out.timedOut = true;
      break;
    }
    out.checked++;
    let exists = true;
    try {
      await fsp.stat(join(root, path));
    } catch {
      exists = false;
    }
    if (!exists) {
      if (graph.fileSet.has(path)) {
        graph.removeFile(path);
        out.removed.push(path);
      }
      continue;
    }
    const isNew = !graph.fileSet.has(path);
    if (isNew) {
      graph.addFile(path);
      out.added.push(path);
    }
    if (!isCodeFile(path)) continue;
    const src = await readSource(root, path);
    if (!src) continue;
    if ('tooBig' in src) {
      graph.markUnparsed(path);
      continue;
    }
    if (graph.records.get(path)?.hash === src.hash) continue;
    const { record } = await recordFor(root, src.text, src.hash, { persist: opts.persist ?? true });
    graph.setRecord(path, record);
    if (!isNew) out.updated.push(path);
  }
  return out;
}

/** Paths that differ between two commits (both sides of a rename), or null when git cannot say. */
export async function changedBetween(root: string, from: string, to: string, opts: { run?: GitRun; signal?: AbortSignal } = {}): Promise<string[] | null> {
  try {
    const out = await (opts.run ?? runGit)(root, ['diff', '--name-only', '-z', '--no-renames', from, to, '--'], {
      timeoutMs: 15_000,
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

export interface FreshnessInput {
  root: string;
  graph: ProjectGraph;
  /** Head the graph was built or last synced at. */
  head: string | null;
  /** Files the question depends on (seeds, their importers and importees). */
  scope: Iterable<string>;
}
export interface FreshnessResult extends RefreshResult {
  /** Head the graph now corresponds to for every file we know about. */
  head: string | null;
  /** True when the answer may rest on out-of-date edges (budget hit, or HEAD moved and the diff was unavailable). */
  stale: boolean;
}

/**
 * Before answering: compare HEAD, then hash the files the question touches. When HEAD moved, everything that changed
 * between the two commits is refreshed too (cheap: `git diff --name-only`), so the whole graph catches up and `head` advances.
 */
export async function ensureFresh(input: FreshnessInput, opts: RefreshOptions = {}): Promise<FreshnessResult> {
  const current = await gitHead(input.root, { ...(opts.run ? { run: opts.run } : {}), ...(opts.signal ? { signal: opts.signal } : {}) });
  let headMoved = current !== input.head;
  let head = input.head;
  const todo = new Set(input.scope);
  if (headMoved && input.head && current) {
    const changed = await changedBetween(input.root, input.head, current, {
      ...(opts.run ? { run: opts.run } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    if (changed) {
      for (const p of changed) todo.add(p);
      headMoved = false; // the diff is part of the refresh; if it completes below the graph is current
      head = current;
    }
  }
  const r = await refreshPaths(input.root, input.graph, todo, opts);
  if (r.timedOut && head !== input.head) head = input.head; // diff not fully applied: keep the old head
  return { ...r, head, stale: r.timedOut || (headMoved && current !== head) };
}
