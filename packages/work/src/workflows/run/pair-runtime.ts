import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { PairState } from '@onni/contract';
import { PairStore } from '../../dispatch/pair-store.ts';
import type { RepositoryLease } from '../../git-repository-lock.ts';
import { gitHasIdentity } from '../../git-worktree.ts';
import { getHeadCommit, getRepoInfo } from '../../server/git.ts';
import type { RunStore } from '../../runs/store.ts';

const exec = promisify(execFile);
const RESERVED_PATHS = ['.ai/onni', '.git'];

interface StatusEntry {
  code: string;
  path: string;
  source?: string;
}

export interface PairCheckpointResult {
  ok: boolean;
  sha?: string;
  error?: string;
}

export interface PairDiffResult {
  ok: boolean;
  stat: string;
  nameStatus: string;
  diff: string;
  truncated: boolean;
  error?: string;
}

function failure(error: unknown): string {
  const value = error as { stderr?: unknown; message?: unknown };
  const stderr = typeof value.stderr === 'string' ? value.stderr.trim() : '';
  return stderr.split(/\r?\n/, 1)[0] || (error instanceof Error ? error.message : String(error));
}

async function git(root: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await exec('git', ['--no-optional-locks', '-c', 'core.quotepath=off', ...args], {
    cwd: root,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    env,
  });
  return stdout;
}

function statusEntries(raw: string): StatusEntry[] {
  const records = raw.split('\0').filter(Boolean);
  const entries: StatusEntry[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    if (record.length < 4) continue;
    const code = record.slice(0, 2);
    const path = record.slice(3);
    if (!path) continue;
    if (code.includes('R') || code.includes('C')) {
      entries.push({ code, path, source: records[++index] });
    } else entries.push({ code, path });
  }
  return entries;
}

function reserved(path: string, excluded: readonly string[]): boolean {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '');
  return [...RESERVED_PATHS, ...excluded].some((prefix) => {
    const candidate = prefix.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
    return normalized === candidate || normalized.startsWith(`${candidate}/`);
  });
}

async function readStatus(root: string): Promise<StatusEntry[]> {
  return statusEntries(await git(root, ['status', '--porcelain=v1', '--untracked-files=all', '-z']));
}

async function validateWorkspace(
  root: string,
  state: PairState,
  allowStaged = false,
  lease?: RepositoryLease | null,
  allowHeadDrift = false,
): Promise<{ head: string; status: StatusEntry[] }> {
  const repo = await getRepoInfo(root);
  lease?.assertValid();
  const sameCheckout = repo ? await realpath(root) === await realpath(repo.root) : false;
  lease?.assertValid();
  if (!repo || !sameCheckout || repo.branch === 'HEAD') {
    throw new Error('One & One requires a named branch in the repository checkout');
  }
  if (repo.branch !== state.workspace.branch) {
    throw new Error(`One & One is pinned to branch "${state.workspace.branch}", but the checkout is on "${repo.branch}"`);
  }
  const head = await getHeadCommit(root);
  lease?.assertValid();
  if (!head) throw new Error('One & One could not read HEAD');
  // The active peer's own commits move HEAD between checkpoints (agents commit even
  // though the prompt asks them not to). That drift is the peer's own work, so the
  // checkpoint re-bases onto it instead of failing the pair; only the branch pin,
  // conflicts and the index lock stay fail-closed.
  if (!allowHeadDrift && head !== (state.lastCheckpointSha ?? state.workspace.baselineSha)) {
    throw new Error('One & One detected an unexpected HEAD change; restore the pair checkpoint before continuing');
  }
  const status = await readStatus(root);
  lease?.assertValid();
  const conflict = status.find((entry) => entry.code.includes('U'));
  if (conflict) throw new Error(`One & One detected unresolved conflicts in ${conflict.path}`);
  const staged = status.find((entry) => entry.code !== '??' && entry.code[0] !== ' ');
  if (!allowStaged && staged) throw new Error(`One & One detected unexpected staged changes in ${staged.path}`);
  if (existsSync(join(root, '.git', 'index.lock'))) throw new Error('One & One detected a locked Git index');
  return { head, status };
}

export function isPairRoot(run: { id: string; dispatch?: { pair?: PairState; rootRunId?: string } } | null | undefined): boolean {
  return Boolean(run?.dispatch?.pair && run.dispatch.rootRunId === run.id);
}

export function isLivePairRoot(run: { id: string; dispatch?: { pair?: PairState; rootRunId?: string } } | null | undefined): boolean {
  const phase = run?.dispatch?.pair?.phase;
  return isPairRoot(run) && phase !== undefined && phase !== 'stopped' && phase !== 'complete';
}

export function isPairMember(run: { dispatch?: { pairMember?: unknown } } | null | undefined): boolean {
  return run?.dispatch?.pairMember !== undefined;
}

export function mirrorPairState(store: RunStore, state: PairState): PairState {
  const run = store.getRun(state.managerRunId);
  if (run) store.updateRun(state.managerRunId, { dispatch: { ...(run.dispatch ?? { rootRunId: state.managerRunId }), pair: state } });
  return state;
}

export async function initializePair(
  root: string,
  store: RunStore,
  pairs: PairStore,
  runId: string,
): Promise<{ ok: true; state: PairState } | { ok: false; error: string }> {
  const run = store.getRun(runId);
  const pairId = run?.dispatch?.pair?.pairId ?? runId;
  let preexistingChanges = false;
  try {
    const started = await pairs.serialize<{ ok: true; state: PairState } | { ok: false; error: string }>(pairId, async (lease) => {
      const existing = pairs.readState(pairId);
      if (existing) {
        if (existing.managerRunId !== runId) return { ok: false, error: 'One & One pair belongs to another manager' };
        if (existing.phase === 'stopped' || existing.phase === 'complete') {
          return { ok: false, error: `One & One pair is already ${existing.phase}` };
        }
        await validateWorkspace(root, existing, true, lease, true);
        return { ok: true, state: mirrorPairState(store, existing) };
      }
      const repo = await getRepoInfo(root);
      lease?.assertValid();
      const head = await getHeadCommit(root);
      lease?.assertValid();
      const sameCheckout = repo ? await realpath(root) === await realpath(repo.root) : false;
      lease?.assertValid();
      if (!repo || !sameCheckout || repo.branch === 'HEAD' || !head) {
        return { ok: false, error: 'One & One requires a repository with a named branch and at least one commit' };
      }
      const status = await readStatus(root);
      lease?.assertValid();
      // A dirty checkout never kills the task: the pre-existing changes are committed below as the
      // pair's baseline (or, if that is impossible, the pair starts anyway with a warning).
      preexistingChanges = status.some((entry) => !reserved(entry.path, []));
      const now = new Date().toISOString();
      const state = pairs.create({
        pairId: runId,
        managerRunId: runId,
        phase: 'planning',
        workspace: { repoRoot: root, branch: repo.branch, baselineSha: head },
        orderRevision: 0,
        handoffs: 0,
        createdAt: now,
        updatedAt: now,
      });
      lease?.assertValid();
      store.updateRun(runId, { dispatch: { ...(run?.dispatch ?? { rootRunId: runId }), pair: state } });
      return { ok: true, state };
    }, root);
    if (!started.ok || !preexistingChanges) return started;
    // Outside the pair lock: `checkpointPair` takes it itself. This is the "manager commits the
    // user's pending work" step, so every later checkpoint holds only the pair's own edits.
    const checkpoint = await checkpointPair(root, pairs, started.state.pairId, 'pre-existing changes');
    if (!checkpoint.ok || !checkpoint.sha) {
      store.appendEvent(runId, {
        type: 'note',
        message: `One & One could not commit the checkout's uncommitted changes (${checkpoint.error ?? 'unknown error'}) — continuing; its checkpoints may include them. Commit them yourself to keep the pair's history clean.`,
        tone: 'danger',
      });
      return started;
    }
    const rebased = pairs.updateState(started.state.pairId, {
      workspace: { ...started.state.workspace, baselineSha: checkpoint.sha },
    });
    store.appendEvent(runId, {
      type: 'note',
      message: `The checkout had uncommitted changes — Onni committed them as the One & One baseline (${checkpoint.sha.slice(0, 8)}) before starting`,
    });
    return { ok: true, state: mirrorPairState(store, rebased) };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function validatePairWorkspace(root: string, pairs: PairStore, pairId: string): Promise<{ ok: true; head: string } | { ok: false; error: string }> {
  try {
    return await pairs.serialize<{ ok: true; head: string } | { ok: false; error: string }>(pairId, async (lease) => {
      const state = pairs.readState(pairId);
      if (!state) return { ok: false, error: 'One & One pair state is missing' };
      const { head } = await validateWorkspace(root, state, true, lease, true);
      return { ok: true, head };
    }, root);
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function checkpointPair(
  root: string,
  pairs: PairStore,
  pairId: string,
  reason: string,
  excludedPaths: readonly string[] = [],
): Promise<PairCheckpointResult> {
  try {
    return await pairs.serialize<PairCheckpointResult>(pairId, async (lease) => {
      const state = pairs.readState(pairId);
      if (!state) return { ok: false, error: 'One & One pair state is missing' };
      if (state.phase === 'stopped' || state.phase === 'complete') {
        return { ok: false, error: `One & One pair is ${state.phase}` };
      }
      let addedPaths: string[] | undefined;
      try {
        const { status } = await validateWorkspace(root, state, true, lease, true);
        const validatedState = pairs.readState(pairId);
        if (!validatedState) return { ok: false, error: 'One & One pair disappeared during checkpoint' };
        if (validatedState.phase === 'stopped' || validatedState.phase === 'complete') {
          return { ok: false, error: `One & One pair is ${validatedState.phase}` };
        }
        const paths = [...new Set(status.flatMap((entry) => entry.source ? [entry.source, entry.path] : [entry.path]))]
          .filter((path) => !reserved(path, excludedPaths));
        if (paths.length === 0) {
          const sha = await getHeadCommit(root);
          lease?.assertValid();
          if (!sha) return { ok: false, error: 'One & One could not read HEAD' };
          pairs.updateState(pairId, { lastCheckpointSha: sha });
          return { ok: true, sha };
        }
        const env = { ...process.env, GIT_LITERAL_PATHSPECS: '1' };
        await git(root, ['add', '--', ...paths], env);
        addedPaths = paths;
        lease?.assertValid();
        const current = pairs.readState(pairId);
        if (!current) return { ok: false, error: 'One & One pair state disappeared during checkpoint' };
        await validateWorkspace(root, current, true, lease, true);
        const beforeCommit = pairs.readState(pairId);
        if (!beforeCommit) return { ok: false, error: 'One & One pair state disappeared during checkpoint' };
        if (beforeCommit.phase === 'stopped' || beforeCommit.phase === 'complete') {
          return { ok: false, error: `One & One pair is ${beforeCommit.phase}` };
        }
        const staged = await git(root, ['diff', '--cached', '--quiet']).then(() => false, () => true);
        lease?.assertValid();
        if (!staged) return { ok: true, sha: current.lastCheckpointSha ?? current.workspace.baselineSha };
        const identity = await gitHasIdentity(root) ? [] : ['-c', 'user.name=onni', '-c', 'user.email=onni@local'];
        lease?.assertValid();
        await git(root, [...identity, 'commit', '-m', `onni: One & One checkpoint (${reason})`]);
        lease?.assertValid();
        const sha = await getHeadCommit(root);
        lease?.assertValid();
        if (!sha) return { ok: false, error: 'One & One checkpoint committed but HEAD could not be read' };
        pairs.updateState(pairId, { lastCheckpointSha: sha });
        return { ok: true, sha };
      } catch (error) {
        if (addedPaths) {
          try {
            lease?.assertValid();
          } catch {
            // A replacement owner may already be staging or resetting these paths.
            return { ok: false, error: failure(error) };
          }
          await git(root, ['reset', '--quiet', '--', ...addedPaths], { ...process.env, GIT_LITERAL_PATHSPECS: '1' }).catch(() => undefined);
        }
        return { ok: false, error: failure(error) };
      }
    }, root);
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function inspectPairDiff(root: string, pairs: PairStore, pairId: string): Promise<PairDiffResult> {
  try {
    return await pairs.serialize<PairDiffResult>(pairId, async (lease) => {
      const state = pairs.readState(pairId);
      if (!state) return { ok: false, stat: '', nameStatus: '', diff: '', truncated: false, error: 'One & One pair state is missing' };
      const scratch = await mkdtemp(join(tmpdir(), 'onni-pair-diff-'));
      try {
        await validateWorkspace(root, state, true, lease, true);
        const env = { ...process.env, GIT_INDEX_FILE: join(scratch, 'index'), GIT_OPTIONAL_LOCKS: '0' };
        await git(root, ['read-tree', 'HEAD'], env);
        lease?.assertValid();
        await git(root, ['add', '--intent-to-add', '--', '.'], env);
        lease?.assertValid();
        const [stat, nameStatus, diff] = await Promise.all([
          git(root, ['diff', '--stat', state.workspace.baselineSha], env),
          git(root, ['diff', '--name-status', state.workspace.baselineSha], env),
          git(root, ['diff', '--no-ext-diff', '--unified=3', state.workspace.baselineSha], env),
        ]);
        lease?.assertValid();
        return {
          ok: true,
          stat: stat.trim(),
          nameStatus: nameStatus.trim(),
          diff: diff.slice(0, 200_000),
          truncated: diff.length > 200_000,
        };
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    }, root);
  } catch (error) {
    return { ok: false, stat: '', nameStatus: '', diff: '', truncated: false, error: failure(error) };
  }
}
