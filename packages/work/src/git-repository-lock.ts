import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import lockfile from 'proper-lockfile';

const exec = promisify(execFile);
const LOCK_STALE_MS = 30_000;
const LOCK_UPDATE_MS = 1_000;
const LOCK_RETRIES = { retries: 100, minTimeout: 20, maxTimeout: 100 } as const;
const LOCK_DIRECTORY = 'onni-repository.lock';

export interface RepositoryLease {
  readonly lockPath: string;
  assertValid(): void;
  release(): void | Promise<void>;
}

export class RepositoryLockError extends Error {
  readonly code: string;

  constructor(message: string, code = 'ELOCKED') {
    super(message);
    this.name = 'RepositoryLockError';
    this.code = code;
  }
}

interface LockOwnership {
  readonly token: string;
  readonly ownerPath: string;
  metadataWritten: boolean;
  compromised: boolean;
  directoryIdentity?: string;
}

const lockOwners = new Map<string, LockOwnership>();
const leaseContext = new AsyncLocalStorage<Map<string, RepositoryLease>>();

function canonicalCommonDir(path: string): string {
  const real = fs.realpathSync(resolve(path));
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

function gitOptions(root: string) {
  return { cwd: root, windowsHide: true, maxBuffer: 4096 } as const;
}

/** Git's common directory is stable across linked worktrees and independent of Onni's data dir. */
export function resolveRepositoryIdentitySync(root: string): string | null {
  for (const absolute of [true, false]) {
    try {
      const args = absolute
        ? ['--no-optional-locks', 'rev-parse', '--path-format=absolute', '--git-common-dir']
        : ['--no-optional-locks', 'rev-parse', '--git-common-dir'];
      const commonDir = execFileSync('git', args, { ...gitOptions(root), encoding: 'utf8' }).trim();
      if (!commonDir) return null;
      return canonicalCommonDir(isAbsolute(commonDir) ? commonDir : resolve(root, commonDir));
    } catch {
      // Older Git lacks --path-format; the relative form is resolved against this checkout.
    }
  }
  return null;
}

export async function resolveRepositoryIdentity(root: string): Promise<string | null> {
  for (const absolute of [true, false]) {
    try {
      const args = absolute
        ? ['--no-optional-locks', 'rev-parse', '--path-format=absolute', '--git-common-dir']
        : ['--no-optional-locks', 'rev-parse', '--git-common-dir'];
      const { stdout } = await exec('git', args, gitOptions(root));
      const commonDir = stdout.trim();
      if (!commonDir) return null;
      const path = isAbsolute(commonDir) ? commonDir : resolve(root, commonDir);
      const real = await fs.promises.realpath(path);
      return process.platform === 'win32' ? real.toLowerCase() : real;
    } catch {
      // Older Git lacks --path-format; the relative form is resolved against this checkout.
    }
  }
  return null;
}

export function repositoryLockfilePath(root: string): string | null {
  const identity = resolveRepositoryIdentitySync(root);
  return identity ? join(identity, LOCK_DIRECTORY) : null;
}

function ownerToken(ownership: LockOwnership): string | null {
  try {
    const value = JSON.parse(fs.readFileSync(ownership.ownerPath, 'utf8')) as { token?: unknown };
    return typeof value.token === 'string' ? value.token : null;
  } catch {
    return null;
  }
}

function directoryIdentity(path: string): string | null {
  try {
    const stat = fs.statSync(path);
    return `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
  } catch {
    return null;
  }
}

/** proper-lockfile removes by path; never let a stale owner's release remove its replacement. */
function mayRemoveLock(path: string): boolean {
  const ownership = lockOwners.get(path);
  return Boolean(
    ownership
    && !ownership.compromised
    && (!ownership.directoryIdentity || directoryIdentity(path) === ownership.directoryIdentity)
    && (!ownership.metadataWritten || ownerToken(ownership) === ownership.token),
  );
}

function removeLockSync(path: string): void {
  if (!mayRemoveLock(path)) return;
  fs.rmSync(`${path}.owner`, { force: true });
  fs.rmdirSync(path);
}

function removeLock(path: string, callback: (error: NodeJS.ErrnoException | null) => void): void {
  if (!mayRemoveLock(path)) {
    callback(null);
    return;
  }
  fs.rm(`${path}.owner`, { force: true }, (error) => {
    if (error) {
      callback(error);
      return;
    }
    fs.rmdir(path, callback);
  });
}

function captureDirectory(path: fs.PathLike, ownership: LockOwnership): void {
  const identity = directoryIdentity(String(path));
  if (!identity) throw new Error('Could not identify the acquired repository lock');
  ownership.directoryIdentity = identity;
}

/** Record the exact lock directory created by this acquisition, not just its reusable path. */
function lockFilesystem(ownership: LockOwnership): typeof fs {
  return {
    ...fs,
    mkdir(path: fs.PathLike, callback: (error: NodeJS.ErrnoException | null) => void) {
      fs.mkdir(path, (error) => {
        if (!error) {
          try { captureDirectory(path, ownership); } catch (captureError) {
            fs.rmdir(path, () => callback(captureError as NodeJS.ErrnoException));
            return;
          }
        }
        callback(error);
      });
    },
    mkdirSync(path: fs.PathLike) {
      fs.mkdirSync(path);
      try { captureDirectory(path, ownership); } catch (error) {
        try { fs.rmdirSync(path); } catch { /* preserve the identity error */ }
        throw error;
      }
    },
    rmdir: removeLock,
    rmdirSync: removeLockSync,
  } as typeof fs;
}

function lockError(error: unknown): RepositoryLockError {
  if (error instanceof RepositoryLockError) return error;
  const value = error as { message?: unknown; code?: unknown };
  const message = typeof value.message === 'string' ? value.message : String(error);
  const code = typeof value.code === 'string' ? value.code : 'ELOCKED';
  return new RepositoryLockError(`One & One repository lock unavailable: ${message}`, code);
}

function assertLease(lease: RepositoryLease, ownership: LockOwnership): void {
  if (
    ownership.compromised
    || !ownership.directoryIdentity
    || directoryIdentity(lease.lockPath) !== ownership.directoryIdentity
    || ownerToken(ownership) !== ownership.token
  ) {
    throw new RepositoryLockError('One & One repository lease was lost', 'ECOMPROMISED');
  }
}

function beginOwnership(path: string): LockOwnership {
  const ownership: LockOwnership = {
    token: randomUUID(),
    ownerPath: `${path}.owner`,
    metadataWritten: false,
    compromised: false,
  };
  lockOwners.set(path, ownership);
  return ownership;
}

function finishOwnership(path: string, ownership: LockOwnership): void {
  if (lockOwners.get(path) === ownership) lockOwners.delete(path);
}

/** Keep metadata outside the lock directory so writes do not disturb its heartbeat mtime. */
function writeOwnership(ownership: LockOwnership): void {
  ownership.metadataWritten = true;
  fs.writeFileSync(ownership.ownerPath, JSON.stringify({ token: ownership.token, pid: process.pid }), { mode: 0o600, flag: 'wx' });
}

function options(ownership: LockOwnership) {
  return {
    realpath: false,
    stale: LOCK_STALE_MS,
    update: LOCK_UPDATE_MS,
    fs: lockFilesystem(ownership),
    onCompromised: () => { ownership.compromised = true; },
  };
}

function assertAcquiredDirectory(path: string, ownership: LockOwnership): void {
  if (!ownership.directoryIdentity || directoryIdentity(path) !== ownership.directoryIdentity) {
    ownership.compromised = true;
    throw new RepositoryLockError('One & One repository lease was replaced during acquisition', 'ECOMPROMISED');
  }
}

function acquireRepositoryLockAtIdentitySync(identity: string): RepositoryLease {
  const path = join(identity, LOCK_DIRECTORY);
  if (lockOwners.has(path)) {
    throw new RepositoryLockError('One & One repository is already locked in this process');
  }
  const ownership = beginOwnership(path);
  let releaseLock: (() => void) | undefined;
  try {
    releaseLock = lockfile.lockSync(path, { ...options(ownership), lockfilePath: path });
    assertAcquiredDirectory(path, ownership);
    writeOwnership(ownership);
  } catch (error) {
    if (releaseLock) ownership.compromised = true;
    try { releaseLock?.(); } catch { /* preserve the acquisition/write error */ }
    finishOwnership(path, ownership);
    throw lockError(error);
  }
  let released = false;
  const lease: RepositoryLease = {
    lockPath: path,
    assertValid: () => assertLease(lease, ownership),
    release: () => {
      if (released) return;
      released = true;
      try {
        releaseLock!();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ERELEASED') throw error;
      } finally {
        finishOwnership(path, ownership);
      }
    },
  };
  return lease;
}

export function acquireRepositoryLockSync(root: string): RepositoryLease | null {
  const identity = resolveRepositoryIdentitySync(root);
  return identity ? acquireRepositoryLockAtIdentitySync(identity) : null;
}

async function acquireRepositoryLockAtIdentity(identity: string): Promise<RepositoryLease> {
  const path = join(identity, LOCK_DIRECTORY);
  if (lockOwners.has(path)) {
    throw new RepositoryLockError('One & One repository is already locked in this process');
  }
  const ownership = beginOwnership(path);
  let releaseLock: (() => Promise<void>) | undefined;
  try {
    releaseLock = await lockfile.lock(path, { ...options(ownership), lockfilePath: path, retries: LOCK_RETRIES });
    assertAcquiredDirectory(path, ownership);
    writeOwnership(ownership);
  } catch (error) {
    if (releaseLock) ownership.compromised = true;
    try { await releaseLock?.(); } catch { /* preserve the acquisition/write error */ }
    finishOwnership(path, ownership);
    throw lockError(error);
  }
  let released = false;
  const lease: RepositoryLease = {
    lockPath: path,
    assertValid: () => assertLease(lease, ownership),
    release: async () => {
      if (released) return;
      released = true;
      try {
        await releaseLock!();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ERELEASED') throw error;
      } finally {
        finishOwnership(path, ownership);
      }
    },
  };
  return lease;
}

export async function acquireRepositoryLock(root: string): Promise<RepositoryLease | null> {
  const identity = await resolveRepositoryIdentity(root);
  return identity ? acquireRepositoryLockAtIdentity(identity) : null;
}

async function withRepositoryLockAtIdentity<T>(
  identity: string,
  operation: (lease: RepositoryLease) => T | Promise<T>,
): Promise<T> {
  const path = join(identity, LOCK_DIRECTORY);
  const held = leaseContext.getStore()?.get(path);
  if (held) {
    held.assertValid();
    return operation(held);
  }
  const lease = await acquireRepositoryLockAtIdentity(identity);
  return leaseContext.run(new Map([[path, lease]]), async () => {
    try {
      const result = await operation(lease);
      lease.assertValid();
      return result;
    } finally {
      try { await lease.release(); } catch { /* stale recovery owns cleanup after this point */ }
    }
  });
}

export async function withRepositoryLock<T>(
  root: string,
  operation: (lease: RepositoryLease | null) => T | Promise<T>,
): Promise<T> {
  const identity = await resolveRepositoryIdentity(root);
  return identity ? withRepositoryLockAtIdentity(identity, operation) : operation(null);
}

export async function withRequiredRepositoryLock<T>(
  root: string,
  operation: (lease: RepositoryLease) => T | Promise<T>,
): Promise<T> {
  const identity = await resolveRepositoryIdentity(root);
  if (!identity) throw new RepositoryLockError('One & One repository identity could not be resolved', 'ELOCKED');
  return withRepositoryLockAtIdentity(identity, operation);
}

function withRepositoryLockAtIdentitySync<T>(
  identity: string,
  operation: (lease: RepositoryLease) => T,
): T {
  const path = join(identity, LOCK_DIRECTORY);
  const held = leaseContext.getStore()?.get(path);
  if (held) {
    held.assertValid();
    return operation(held);
  }
  const lease = acquireRepositoryLockAtIdentitySync(identity);
  return leaseContext.run(new Map([[path, lease]]), () => {
    try {
      const result = operation(lease);
      lease.assertValid();
      return result;
    } finally {
      try { lease.release(); } catch { /* stale recovery owns cleanup after this point */ }
    }
  });
}

export function withRepositoryLockSync<T>(
  root: string,
  operation: (lease: RepositoryLease | null) => T,
): T {
  const identity = resolveRepositoryIdentitySync(root);
  return identity ? withRepositoryLockAtIdentitySync(identity, operation) : operation(null);
}
