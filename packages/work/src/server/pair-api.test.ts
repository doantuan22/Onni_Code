import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pairSnapshotSchema, type PairMessage, type PairOrder, type PairProposal, type PairSnapshot } from '@onni/contract';
import { PairStore } from '../dispatch/pair-store.ts';
import { createWorktree } from '../git-worktree.ts';
import { PAIR_RUN_MUTATION_REFUSAL } from '../runs/pair-mutation.ts';
import { RunStore } from '../runs/store.ts';
import { WorkspaceSemaphore } from '../workspace/semaphore.ts';
import { RunManager } from '../workflows/run.ts';
import { apiRequest } from './loopback-request.testkit.ts';
import { createApp } from './server.ts';

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}

describe('One & One through the API', () => {
  let repoRoot: string;
  let dataDir: string;
  let store: RunStore;
  let pairs: PairStore;
  let manager: RunManager;
  let app: ReturnType<typeof createApp>;
  let managerId: string;
  let workerId: string;
  let outsiderId: string;
  const pairId = 'pair-api';

  beforeEach(() => {
    vi.stubEnv('ONNI_DRY_RUN', '1');
    vi.stubEnv('ONNI_DISPATCH', '1');
    repoRoot = mkdtempSync(join(tmpdir(), 'onni-pair-api-'));
    git(repoRoot, 'init', '-q', '-b', 'main');
    git(repoRoot, 'config', 'user.email', 'pair@onni.local');
    git(repoRoot, 'config', 'user.name', 'onni-pair-test');
    git(repoRoot, 'config', 'commit.gpgsign', 'false');
    writeFileSync(join(repoRoot, '.gitignore'), '.ai/\n');
    writeFileSync(join(repoRoot, 'base.txt'), 'base\n');
    git(repoRoot, 'add', '-A');
    git(repoRoot, 'commit', '-qm', 'base');
    dataDir = join(repoRoot, '.ai', 'onni');
    store = RunStore.open(dataDir);
    pairs = new PairStore(dataDir);
    managerId = store.createRun({ title: 'Manager', task: 'Manage', workflow: 'quick-task', steps: [], worktree: false }).id;
    workerId = store.createRun({ title: 'Worker', task: 'Work', workflow: 'quick-task', steps: [], worktree: false }).id;
    outsiderId = store.createRun({ title: 'Outsider', task: 'Other', workflow: 'quick-task', steps: [], worktree: false }).id;
    const now = new Date().toISOString();
    const state = pairs.create({
      pairId,
      managerRunId: managerId,
      phase: 'planning',
      activeRole: 'manager',
      workspace: { repoRoot, branch: 'main', baselineSha: git(repoRoot, 'rev-parse', 'HEAD') },
      orderRevision: 0,
      handoffs: 0,
      createdAt: now,
      updatedAt: now,
    });
    store.updateRun(managerId, { dispatch: { rootRunId: managerId, pair: state } });
    manager = new RunManager(store, repoRoot, { semaphore: new WorkspaceSemaphore({ initial: { maxParallel: 1, maxMonitoringSessions: 0 } }) });
    app = createApp({ repoRoot, store, manager, version: '0.0.0-test', bootProjectId: 'pair-api' });
  });

  afterEach(() => {
    manager.dispose();
    store.flush();
    rmSync(repoRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    vi.unstubAllEnvs();
  });

  const call = (path: string, body?: unknown, method?: string) => apiRequest(app, `/api/v1${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });

  function assignWorker(): void {
    const state = pairs.setWorker(pairId, workerId);
    store.updateRun(managerId, { dispatch: { ...(store.getRun(managerId)!.dispatch!), pair: state } });
    store.updateRun(workerId, {
      dispatch: { rootRunId: managerId, parentRunId: managerId, pairMember: { pairId, role: 'worker', peerRunId: managerId } },
    });
  }

  it('serves all five typed controls to both peers and mirrors accepted state', async () => {
    const before = await call(`/p/pair-api/runs/${managerId}/pair`);
    expect(before.status).toBe(200);
    const initial = pairSnapshotSchema.parse(await before.json());
    expect(initial.state.workerRunId).toBeUndefined();
    expect((await call(`/runs/${outsiderId}/pair`)).status).toBe(404);

    assignWorker();
    expect((await call(`/runs/${workerId}/pair`)).status).toBe(200);
    const message = await call(`/runs/${managerId}/pair/messages`, { kind: 'question', text: 'Which option?' });
    expect(message.status).toBe(200);
    const asked = (await message.json()) as PairMessage;
    expect(asked).toMatchObject({ from: 'manager', to: 'worker', kind: 'question' });
    expect((await call(`/runs/${workerId}/pair/messages`, { text: 'Option B', replyTo: asked.id })).status).toBe(200);

    const proposalResponse = await call(`/runs/${workerId}/pair/proposals`, {
      question: 'How should we implement it?',
      options: [{ id: 'small', title: 'Small diff' }, { id: 'wide', title: 'Wide refactor' }],
      recommendation: 'small',
    });
    expect(proposalResponse.status).toBe(200);
    const proposal = (await proposalResponse.json()) as PairProposal;
    expect((await call(`/runs/${managerId}/pair/decisions`, {
      proposalId: proposal.id, outcome: 'chosen', optionId: 'small', note: 'Stay focused',
    })).status).toBe(200);

    const order = pairs.enqueueOrder(pairId, { objective: 'Implement the feature' });
    expect((await call(`/runs/${managerId}/pair/accept`, { orderId: order.id })).status).toBe(409);
    pairs.markOrderWorking(pairId, order.id);
    expect((await call(`/runs/${workerId}/pair/accept`, { orderId: order.id })).status).toBe(403);
    pairs.reportOrder(pairId, order.id, 'Implemented and tested');
    expect((await call(`/runs/${managerId}/pair/accept`, { orderId: 'stale-order' })).status).toBe(409);
    const accepted = await call(`/runs/${managerId}/pair/accept`, { orderId: order.id, note: 'Verified' });
    expect(accepted.status).toBe(200);
    expect(((await accepted.json()) as PairOrder).status).toBe('accepted');
    expect(store.getRun(managerId)?.dispatch?.pair).toMatchObject({ phase: 'final_check', currentOrderId: order.id });
    expect(store.readEvents(managerId).some((event) => event.type === 'pair-order-accepted' && event.note === 'Verified')).toBe(true);

    const snapshot = pairSnapshotSchema.parse(await (await call(`/runs/${workerId}/pair`)).json());
    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.proposals[0]?.status).toBe('chosen');
    expect(snapshot.decisions[0]?.optionId).toBe('small');
    expect(snapshot.orders[0]?.status).toBe('accepted');
  });

  it('rejects cross-pair references and malformed bodies before mutation', async () => {
    assignWorker();
    store.updateRun(outsiderId, {
      dispatch: { rootRunId: managerId, pairMember: { pairId, role: 'worker', peerRunId: managerId } },
    });
    expect(await call(`/runs/${outsiderId}/pair`)).toMatchObject({ status: 403 });
    expect(await call(`/runs/${outsiderId}/pair/messages`, { text: 'not mine' })).toMatchObject({ status: 403 });

    store.updateRun(workerId, {
      dispatch: {
        rootRunId: managerId,
        pairMember: { pairId: 'another-pair', role: 'worker', peerRunId: managerId },
      },
    });
    expect((await call(`/runs/${workerId}/pair`)).status).toBe(404);
    store.updateRun(workerId, {
      dispatch: {
        rootRunId: managerId,
        pair: { ...(pairs.readState(pairId)!), pairId: 'another-pair' },
        pairMember: { pairId, role: 'worker', peerRunId: managerId },
      },
    });
    expect((await call(`/runs/${workerId}/pair`)).status).toBe(409);

    for (const [suffix, body] of [
      ['messages', { text: '' }],
      ['proposals', { question: 'Q', options: [{ id: 'a', title: 'A' }] }],
      ['decisions', { proposalId: 'p', outcome: 'chosen' }],
      ['accept', { orderId: '' }],
    ] as const) {
      expect((await call(`/runs/${managerId}/pair/${suffix}`, body)).status).toBe(400);
    }
    expect((await value<PairSnapshot>(call(`/runs/${managerId}/pair`))).messages).toEqual([]);
  });

  it('requires dispatch and keeps project aliases byte-identical', async () => {
    const unscoped = await call(`/runs/${managerId}/pair`);
    const scoped = await call(`/p/pair-api/runs/${managerId}/pair`);
    expect(scoped.status).toBe(200);
    expect(await scoped.text()).toBe(await unscoped.text());

    vi.stubEnv('ONNI_DISPATCH', '0');
    const disabled = await call(`/runs/${managerId}/pair`);
    expect(disabled.status).toBe(409);
    expect(await disabled.json()).toMatchObject({ error: expect.stringContaining('ONNI_DISPATCH=0') });
  });

  it('fences RunManager landing and finish-review paths before they touch state', async () => {
    const before = JSON.stringify(store.getRun(managerId));
    const close = vi.fn();
    const internals = manager as unknown as {
      finishReview(id: string): Promise<void>;
      landNow(id: string, policy: 'manual'): Promise<{ result: string; error?: string }>;
      landOnDone(id: string, state: unknown, stepId: undefined, close: () => void): boolean;
      parkForReview(id: string, state: unknown, stepId: undefined): void;
      landWithAgent(id: string, state: unknown, stepId: undefined, close: () => void): Promise<unknown> | undefined;
      landBeforeSettle(id: string): Promise<string | 'review' | undefined>;
    };

    expect(manager.finish(managerId)).toBe(false);
    expect(await manager.land(managerId)).toEqual({ outcome: 'unavailable', message: PAIR_RUN_MUTATION_REFUSAL });
    expect(await manager.mergeFromAgent(managerId, { into: 'task', source: 'onni/other' })).toEqual({ denied: PAIR_RUN_MUTATION_REFUSAL });
    await internals.finishReview(managerId);
    expect(await internals.landNow(managerId, 'manual')).toEqual({ result: 'failed', stage: 'commit', error: PAIR_RUN_MUTATION_REFUSAL });
    expect(internals.landOnDone(managerId, {}, undefined, close)).toBe(false);
    expect(() => internals.parkForReview(managerId, {}, undefined)).not.toThrow();
    expect(internals.landWithAgent(managerId, {}, undefined, close)).toBeUndefined();
    expect(await internals.landBeforeSettle(managerId)).toBe(PAIR_RUN_MUTATION_REFUSAL);
    expect(close).not.toHaveBeenCalled();
    expect(JSON.stringify(store.getRun(managerId))).toBe(before);
  });

  it('fences direct Git, PR, landing and removal mutations without changing the checkout or records', async () => {
    assignWorker();
    const worktree = await createWorktree(repoRoot, managerId, 'main');
    const dispatch = store.getRun(managerId)!.dispatch!;
    store.updateRun(managerId, { status: 'review', worktreePath: worktree.path, branch: worktree.branch });
    store.updateRun(workerId, { status: 'review', worktreePath: worktree.path, branch: worktree.branch });
    writeFileSync(join(worktree.path, 'dirty.txt'), 'must remain uncommitted\n');
    const head = git(worktree.path, 'rev-parse', 'HEAD');
    const branch = git(repoRoot, 'branch', '--show-current');
    const managerBefore = JSON.stringify(store.getRun(managerId));
    const workerBefore = JSON.stringify(store.getRun(workerId));

    const mutations: Array<[string, unknown, string | undefined]> = [
      [`/runs/${managerId}/finish`, undefined, 'POST'],
      [`/runs/${managerId}/land`, undefined, 'POST'],
      [`/runs/${managerId}/git/commit`, { message: 'must not commit' }, 'POST'],
      [`/runs/${managerId}/git/push`, undefined, 'POST'],
      [`/runs/${managerId}/pr`, {}, 'POST'],
      [`/runs/${managerId}/pr/adopt`, undefined, 'POST'],
      [`/runs/${workerId}/remove-worktree`, {}, 'POST'],
      [`/runs/${workerId}`, undefined, 'DELETE'],
      ['/worktree-lifecycle/operations', { requestId: randomUUID(), runId: managerId, intent: 'remove-worktree' }, 'POST'],
      ['/repo/branch', { name: 'must-not-switch' }, 'POST'],
      ['/repo/fetch', undefined, 'POST'],
      ['/repo/pull', undefined, 'POST'],
      ['/repo/push', undefined, 'POST'],
      ['/repo/sync', undefined, 'POST'],
    ];
    for (const [path, body, method] of mutations) {
      const response = await call(path, body, method);
      expect(response.status, path).toBe(409);
      expect(await response.json(), path).toEqual({ error: PAIR_RUN_MUTATION_REFUSAL });
    }

    await expect(manager.lifecycle.startRemoval({
      requestId: randomUUID(), runId: managerId, intent: 'remove-worktree',
    })).rejects.toThrow(PAIR_RUN_MUTATION_REFUSAL);
    expect(git(worktree.path, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(repoRoot, 'branch', '--show-current')).toBe(branch);
    expect(readFileSync(join(worktree.path, 'dirty.txt'), 'utf8')).toBe('must remain uncommitted\n');
    expect(existsSync(worktree.path)).toBe(true);
    expect(JSON.stringify(store.getRun(managerId))).toBe(managerBefore);
    expect(JSON.stringify(store.getRun(workerId))).toBe(workerBefore);
    expect(store.getRun(managerId)?.dispatch).toEqual(dispatch);
  });
});

async function value<T>(promise: Promise<Response>): Promise<T> {
  const response = await promise;
  expect(response.status).toBe(200);
  return response.json() as Promise<T>;
}
