import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PairState } from '@onni/contract';
import { PairStore } from '../../dispatch/pair-store.ts';
import { acquireRepositoryLockSync, type RepositoryLease } from '../../git-repository-lock.ts';
import { checkpointPair, inspectPairDiff, validatePairWorkspace } from './pair-runtime.ts';

const PAIR_ID = '11111111-1111-1111-1111-111111111111';
const MANAGER_ID = '22222222-2222-2222-2222-222222222222';
const dirs: string[] = [];
const leases: RepositoryLease[] = [];

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'onni-pair-runtime-lock-'));
  dirs.push(base);
  const root = join(base, 'repo');
  const dataDir = join(base, 'data');
  mkdirSync(root);
  mkdirSync(dataDir);
  git(root, 'init', '-b', 'dev');
  git(root, 'config', 'user.name', 'Onni Test');
  git(root, 'config', 'user.email', 'onni@test.local');
  writeFileSync(join(root, 'README.md'), 'base\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-m', 'base');
  const baselineSha = git(root, 'rev-parse', 'HEAD');
  const state: PairState = {
    pairId: PAIR_ID,
    managerRunId: MANAGER_ID,
    phase: 'worker_working',
    activeRole: 'worker',
    workspace: { repoRoot: root, branch: 'dev', baselineSha },
    orderRevision: 1,
    handoffs: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const pairs = new PairStore(dataDir);
  pairs.create(state);
  return { root, pairs, baselineSha };
}

afterEach(async () => {
  for (const lease of leases.splice(0)) {
    try { await lease.release(); } catch { /* stale recovery owns cleanup */ }
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('One & One runtime repository locking', () => {
  it('excludes checkpoint and diff Git operations until the lease is released', async () => {
    const { root, pairs, baselineSha } = setup();
    writeFileSync(join(root, 'feature.txt'), 'feature\n');
    const lease = acquireRepositoryLockSync(root)!;
    leases.push(lease);

    const blockedCheckpoint = await checkpointPair(root, pairs, PAIR_ID, 'blocked');
    const blockedDiff = await inspectPairDiff(root, pairs, PAIR_ID);
    const blockedValidation = await validatePairWorkspace(root, pairs, PAIR_ID);
    expect(blockedCheckpoint.ok).toBe(false);
    expect(blockedCheckpoint.error).toMatch(/repository.*locked/i);
    expect(blockedDiff.ok).toBe(false);
    expect(blockedDiff.error).toMatch(/repository.*locked/i);
    expect(blockedValidation).toMatchObject({ ok: false, error: expect.stringMatching(/repository.*locked/i) });
    expect(git(root, 'rev-parse', 'HEAD')).toBe(baselineSha);
    expect(git(root, 'diff', '--cached', '--name-only')).toBe('');

    await lease.release();
    leases.splice(leases.indexOf(lease), 1);
    const checkpoint = await checkpointPair(root, pairs, PAIR_ID, 'released');
    expect(checkpoint.ok).toBe(true);
    expect(checkpoint.sha).not.toBe(baselineSha);
    expect(pairs.readState(PAIR_ID)?.lastCheckpointSha).toBe(checkpoint.sha);

    const diff = await inspectPairDiff(root, pairs, PAIR_ID);
    expect(diff.ok).toBe(true);
    expect(diff.nameStatus).toContain('feature.txt');
    expect(diff.diff).toContain('+feature');
  });

  it('tolerates the worker committing and staging mid-turn instead of failing the pair', async () => {
    const { root, pairs, baselineSha } = setup();
    // The worker commits one file and stages another before its turn hands off.
    writeFileSync(join(root, 'committed.txt'), 'committed\n');
    git(root, 'add', 'committed.txt');
    git(root, 'commit', '-m', 'worker commit');
    writeFileSync(join(root, 'staged.txt'), 'staged\n');
    git(root, 'add', 'staged.txt');
    const driftedHead = git(root, 'rev-parse', 'HEAD');
    expect(driftedHead).not.toBe(baselineSha);

    const valid = await validatePairWorkspace(root, pairs, PAIR_ID);
    expect(valid.ok).toBe(true);

    const checkpoint = await checkpointPair(root, pairs, PAIR_ID, 'worker handoff');
    expect(checkpoint.ok).toBe(true);
    // The staged file is folded into the checkpoint commit on top of the worker's own commit.
    expect(pairs.readState(PAIR_ID)?.lastCheckpointSha).toBe(checkpoint.sha);
    expect(git(root, 'rev-parse', 'HEAD')).toBe(checkpoint.sha);
    expect(git(root, 'show', '--format=', '--name-only', 'HEAD')).toContain('staged.txt');

    const diff = await inspectPairDiff(root, pairs, PAIR_ID);
    expect(diff.ok).toBe(true);
    expect(diff.nameStatus).toContain('committed.txt');
    expect(diff.nameStatus).toContain('staged.txt');
  });
});
