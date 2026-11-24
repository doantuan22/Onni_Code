import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PairState } from '@onni/contract';
import {
  acquireRepositoryLockSync,
  repositoryLockfilePath,
  withRepositoryLock,
  type RepositoryLease,
} from '../git-repository-lock.ts';
import { PairStore } from './pair-store.ts';

const PAIR_ID = '11111111-1111-1111-1111-111111111111';
const MANAGER_ID = '22222222-2222-2222-2222-222222222222';
const WORKER_ID = '33333333-3333-3333-3333-333333333333';
const dirs: string[] = [];
const leases: RepositoryLease[] = [];
const children: Array<{ child: ChildProcess; done: Promise<void> }> = [];

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}

function setup() {
  const base = mkdtempSync(join(tmpdir(), 'onni-pair-lock-'));
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
  const state: PairState = {
    pairId: PAIR_ID,
    managerRunId: MANAGER_ID,
    phase: 'planning',
    activeRole: 'manager',
    workspace: { repoRoot: root, branch: 'dev', baselineSha: git(root, 'rev-parse', 'HEAD') },
    orderRevision: 0,
    handoffs: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const pairs = new PairStore(dataDir);
  pairs.create(state);
  return { root, dataDir, pairs, state };
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
      else reject(new Error(`pair lock fixture exited with ${code ?? signal}\n${stderr}`));
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
      reject(new Error(`pair lock fixture exited before ${type}: ${code ?? signal}`));
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

describe('PairStore repository locking', () => {
  it('blocks a second process until the repository lease is released', async () => {
    const { root, dataDir, pairs } = setup();
    const storeUrl = new URL('./pair-store.ts', import.meta.url).href;
    const env = {
      PAIR_STORE_URL: storeUrl,
      PAIR_DATA_DIR: dataDir,
      PAIR_ROOT: root,
      PAIR_ID: PAIR_ID,
    };
    const holder = startChild(`
      const { PairStore } = await import(process.env.PAIR_STORE_URL);
      const pairs = new PairStore(process.env.PAIR_DATA_DIR);
      const pairId = process.env.PAIR_ID;
      const wait = (type) => new Promise((resolve) => process.once('message', (message) => {
        if (message.type === type) resolve();
      }));
      process.send({ type: 'ready' });
      await wait('enter');
      try {
        const message = await pairs.serialize(pairId, async () => {
          process.send({ type: 'entered' });
          await wait('release');
          return pairs.appendMessage(pairId, 'manager', { text: 'holder' });
        });
        process.send({ type: 'done', text: message.text });
      } catch (error) {
        process.send({ type: 'failed', error: error.message });
      }
      process.disconnect();
    `, env);
    const contender = startChild(`
      const { PairStore } = await import(process.env.PAIR_STORE_URL);
      const pairs = new PairStore(process.env.PAIR_DATA_DIR);
      const pairId = process.env.PAIR_ID;
      const wait = (type) => new Promise((resolve) => process.once('message', (message) => {
        if (message.type === type) resolve();
      }));
      process.send({ type: 'ready' });
      await wait('attempt');
      try {
        pairs.appendMessage(pairId, 'worker', { text: 'blocked' });
        process.send({ type: 'unexpected' });
      } catch (error) {
        process.send({ type: 'blocked', error: error.message });
      }
      await wait('retry');
      try {
        const message = pairs.appendMessage(pairId, 'worker', { text: 'contender' });
        process.send({ type: 'done', text: message.text });
      } catch (error) {
        process.send({ type: 'failed', error: error.message });
      }
      process.disconnect();
    `, env);

    await Promise.all([waitMessage(holder.child, 'ready'), waitMessage(contender.child, 'ready')]);
    const entered = waitMessage(holder.child, 'entered');
    holder.send({ type: 'enter' });
    await entered;

    const blocked = waitMessage(contender.child, 'blocked');
    contender.send({ type: 'attempt' });
    const blockedResult = await blocked;
    expect(blockedResult.error).toContain('repository lock unavailable');
    expect(pairs.listMessages(PAIR_ID)).toEqual([]);

    const holderDone = waitMessage(holder.child, 'done');
    holder.send({ type: 'release' });
    expect(await holderDone).toMatchObject({ text: 'holder' });

    const contenderDone = waitMessage(contender.child, 'done');
    contender.send({ type: 'retry' });
    expect(await contenderDone).toMatchObject({ text: 'contender' });
    await Promise.all([holder.done, contender.done]);
    expect(pairs.listMessages(PAIR_ID).map((message) => message.text)).toEqual(['holder', 'contender']);
    expect(existsSync(repositoryLockfilePath(root)!)).toBe(false);
  }, 20_000);

  it('rechecks a held lease before a nested synchronous mutation', async () => {
    const { root, pairs } = setup();
    const ownerPath = `${repositoryLockfilePath(root)!}.owner`;
    await expect(withRepositoryLock(root, async () => {
      rmSync(ownerPath, { force: true });
      expect(() => pairs.appendMessage(PAIR_ID, 'manager', { text: 'compromised' })).toThrow('lease was lost');
    })).rejects.toThrow('lease was lost');
    expect(pairs.listMessages(PAIR_ID)).toEqual([]);
  });

  it('holds the repository lease until terminal pair deletion finishes', async () => {
    const { root, pairs } = setup();
    pairs.setWorker(PAIR_ID, WORKER_ID);
    pairs.transition(PAIR_ID, 'complete');
    const remove = vi.fn(async () => {
      await Promise.resolve();
      expect(existsSync(repositoryLockfilePath(root)!)).toBe(true);
    });
    await pairs.delete(PAIR_ID, {
      managerRunId: MANAGER_ID,
      workerRunId: WORKER_ID,
      repoRoot: root,
    }, remove);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(existsSync(repositoryLockfilePath(root)!)).toBe(false);
  });

  it('puts every public mutation writer behind the repository lease', () => {
    const { root, pairs, state } = setup();
    const lease = acquireRepositoryLockSync(root)!;
    leases.push(lease);
    const previous = pairs.readState(PAIR_ID)!;
    const writers = [
      () => pairs.create({ ...state, pairId: randomUUID(), managerRunId: randomUUID() }),
      () => pairs.updateState(PAIR_ID, {}),
      () => pairs.setWorker(PAIR_ID, WORKER_ID),
      () => pairs.transition(PAIR_ID, 'worker_queued', 'worker'),
      () => pairs.enqueueOrder(PAIR_ID, { objective: 'blocked' }),
      () => pairs.discardQueuedOrder(PAIR_ID, randomUUID(), previous),
      () => pairs.markOrderWorking(PAIR_ID, randomUUID()),
      () => pairs.reportOrder(PAIR_ID, randomUUID(), 'blocked'),
      () => pairs.acceptOrder(PAIR_ID, { orderId: randomUUID() }),
      () => pairs.appendMessage(PAIR_ID, 'manager', { text: 'blocked' }),
      () => pairs.appendProposal(PAIR_ID, 'worker', {
        question: 'blocked?',
        options: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
      }),
      () => pairs.decide(PAIR_ID, 'manager', { proposalId: randomUUID(), outcome: 'declined' }),
    ];
    for (const write of writers) expect(write).toThrow(/repository.*locked/i);
    expect(pairs.readState(PAIR_ID)).toEqual(state);

    lease.release();
    leases.splice(leases.indexOf(lease), 1);
    expect(() => pairs.appendMessage(PAIR_ID, 'manager', { text: 'released' })).not.toThrow();
  });
});
