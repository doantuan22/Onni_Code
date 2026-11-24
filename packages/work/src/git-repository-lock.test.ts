import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acquireRepositoryLockSync,
  repositoryLockfilePath,
  resolveRepositoryIdentitySync,
  withRepositoryLock,
  withRequiredRepositoryLock,
  type RepositoryLease,
} from './git-repository-lock.ts';

const dirs: string[] = [];
const leases: RepositoryLease[] = [];
const children: Array<{ child: ChildProcess; done: Promise<void> }> = [];

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}

function repository(): string {
  const base = mkdtempSync(join(tmpdir(), 'onni-repository-lock-'));
  dirs.push(base);
  const root = join(base, 'repo');
  mkdirSync(root);
  git(root, 'init', '-b', 'dev');
  git(root, 'config', 'user.name', 'Onni Test');
  git(root, 'config', 'user.email', 'onni@test.local');
  writeFileSync(join(root, 'README.md'), 'base\n');
  git(root, 'add', 'README.md');
  git(root, 'commit', '-m', 'base');
  return root;
}

function startChild(code: string, env: Record<string, string>) {
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', code], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr!.on('data', (chunk) => { stderr += chunk; });
  const done = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`lock fixture exited with ${code ?? signal}\n${stderr}`));
    });
  });
  void done.catch(() => {});
  const entry = { child, done };
  children.push(entry);
  return { ...entry, send: (message: Record<string, string>) => child.send!(message) };
}

function waitMessage(child: ChildProcess, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
    };
    const onMessage = (message: Record<string, unknown>) => {
      if (message.type !== type) return;
      cleanup();
      resolve(message);
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(new Error(`lock fixture exited before ${type}: ${code ?? signal}`));
    };
    child.on('message', onMessage);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

afterEach(async () => {
  for (const lease of leases.splice(0)) {
    try { await lease.release(); } catch { /* stale recovery owns cleanup */ }
  }
  for (const entry of children.splice(0)) {
    entry.child.kill('SIGKILL');
    await entry.done.catch(() => {});
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Git repository lock', () => {
  it('keys the lock to the Git common directory across linked worktrees', () => {
    const root = repository();
    const linked = join(root, '..', 'linked');
    git(root, 'worktree', 'add', '-b', 'linked', linked);

    const identity = resolveRepositoryIdentitySync(root);
    expect(identity).toBe(resolveRepositoryIdentitySync(linked));
    expect(repositoryLockfilePath(root)).toBe(join(identity!, 'onni-repository.lock'));
    expect(repositoryLockfilePath(linked)).toBe(repositoryLockfilePath(root));
  });

  it('keeps the in-process-only path when no Git identity can be resolved', async () => {
    const root = repository();
    const plain = join(root, '..', 'plain');
    mkdirSync(plain);
    expect(repositoryLockfilePath(plain)).toBeNull();
    await expect(withRepositoryLock(plain, (lease) => lease)).resolves.toBeNull();
  });

  it('fails closed when a required repository lease has no Git identity', async () => {
    const root = repository();
    const plain = join(root, '..', 'plain');
    mkdirSync(plain);
    const operation = vi.fn();
    await expect(withRequiredRepositoryLock(plain, operation)).rejects.toMatchObject({ code: 'ELOCKED' });
    expect(operation).not.toHaveBeenCalled();
  });

  it('recovers a stale lease without letting its owner release the replacement', async () => {
    const root = repository();
    const helper = new URL('./git-repository-lock.ts', import.meta.url).href;
    const child = startChild(`
      import internal from 'proper-lockfile/lib/lockfile.js';
      const { acquireRepositoryLockSync } = await import(${JSON.stringify(helper)});
      const lease = acquireRepositoryLockSync(process.env.LOCK_ROOT);
      // Stop only the heartbeat so the directory can be aged without a timing sleep.
      const record = internal.getLocks()[lease.lockPath];
      clearTimeout(record.updateTimeout);
      record.updateTimeout = null;
      const wait = (type) => new Promise((resolve) => process.once('message', (message) => {
        if (message.type === type) resolve();
      }));
      process.send({ type: 'ready', lockPath: lease.lockPath });
      await wait('release');
      lease.release();
      process.send({ type: 'released' });
      process.disconnect();
    `, { LOCK_ROOT: root });

    const ready = await waitMessage(child.child, 'ready');
    const lockPath = ready.lockPath as string;
    const stale = new Date(Date.now() - 60_000);
    utimesSync(lockPath, stale, stale);

    const replacement = acquireRepositoryLockSync(root)!;
    leases.push(replacement);
    expect(replacement.lockPath).toBe(lockPath);
    expect(() => replacement.assertValid()).not.toThrow();

    const released = waitMessage(child.child, 'released');
    child.send({ type: 'release' });
    await released;
    expect(existsSync(lockPath)).toBe(true);
    expect(() => replacement.assertValid()).not.toThrow();

    await replacement.release();
    leases.splice(leases.indexOf(replacement), 1);
    expect(existsSync(lockPath)).toBe(false);
    expect(existsSync(`${lockPath}.owner`)).toBe(false);
  });
});
