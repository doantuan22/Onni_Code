import { execFile } from 'node:child_process';
import { isDenied } from './denylist.ts';
import { MAX_LISTED_FILES } from './types.ts';

export type GitRun = (cwd: string, args: string[], opts: { timeoutMs: number; signal?: AbortSignal }) => Promise<string>;

/** Spawns git without a shell (arguments are never interpreted). Rejects on non-zero exit, timeout or abort. */
export const runGit: GitRun = (cwd, args, { timeoutMs, signal }) =>
  new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs, windowsHide: true, ...(signal ? { signal } : {}) },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });

export type ListFilesResult =
  | { available: true; files: string[]; truncated: boolean }
  | { available: false; reason: string };

/** Tracked files minus the denylist. Denied names never leave this function. One git command. */
export async function listFiles(
  root: string,
  opts: { timeoutMs?: number; signal?: AbortSignal; run?: GitRun; maxFiles?: number } = {},
): Promise<ListFilesResult> {
  const run = opts.run ?? runGit;
  const max = opts.maxFiles ?? MAX_LISTED_FILES;
  let out: string;
  try {
    out = await run(root, ['ls-files', '-z'], { timeoutMs: opts.timeoutMs ?? 30_000, ...(opts.signal ? { signal: opts.signal } : {}) });
  } catch (error) {
    return { available: false, reason: `git ls-files failed: ${(error as Error).message.split('\n')[0]}` };
  }
  const all = out.split('\0').filter((f) => f.length > 0 && !isDenied(f));
  return all.length > max ? { available: true, files: all.slice(0, max), truncated: true } : { available: true, files: all, truncated: false };
}

/** Current commit, or null when git cannot say (no repo, no commits). */
export async function gitHead(root: string, opts: { timeoutMs?: number; signal?: AbortSignal; run?: GitRun } = {}): Promise<string | null> {
  try {
    const out = await (opts.run ?? runGit)(root, ['rev-parse', 'HEAD'], {
      timeoutMs: opts.timeoutMs ?? 5_000,
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}
