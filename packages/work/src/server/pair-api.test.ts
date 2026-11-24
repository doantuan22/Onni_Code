import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pairSnapshotSchema, type PairMessage, type PairOrder, type PairProposal, type PairSnapshot } from '@onni/contract';
import { PairStore } from '../dispatch/pair-store.ts';
import { createWorktree } from '../git-worktree.ts';
import { PAIR_RUN_MUTATION_REFUSAL } from '../runs/pair-mutation.ts';
import { recoverPairDeletions } from '../runs/pair-deletion.ts';
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
    managerId = store.createRun({ title: 'Manager', task: 'Manage', workflow: 'quick-task', steps: [{ id: 'task', name: 'Task', kind: 'agent' }], worktree: false }).id;
    workerId = store.createRun({ title: 'Worker', task: 'Work', workflow: 'quick-task', steps: [], worktree: false }).id;
    outsiderId = store.createRun({ title: 'Outsider', task: 'Other', workflow: 'quick-task', steps: [{ id: 'task', name: 'Task', kind: 'agent' }], worktree: false }).id;
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
    vi.restoreAllMocks();
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

  function settlePair(phase: 'complete' | 'stopped'): void {
    assignWorker();
    const state = pairs.transition(pairId, phase, 'manager',
      phase === 'complete' ? { completedAt: new Date().toISOString() } : {});
    const status = phase === 'complete' ? 'done' : 'cancelled';
    store.updateRun(managerId, { status, dispatch: { ...(store.getRun(managerId)!.dispatch!), pair: state } });
    store.updateRun(workerId, { status });
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

  it('resumes an inactive waiting pair manager for an owner reply after restart', async () => {
    assignWorker();
    const order = pairs.enqueueOrder(pairId, { objective: 'Implement the feature' });
    pairs.markOrderWorking(pairId, order.id);
    pairs.reportOrder(pairId, order.id, 'Implemented and tested');
    const state = pairs.readState(pairId)!;
    store.updateRun(managerId, {
      status: 'waiting',
      dispatch: { rootRunId: managerId, pair: state },
    });
    store.updateStep(managerId, 'task', { status: 'done', sessionId: 'manager-session', backend: 'claude' });
    store.updateRun(outsiderId, { status: 'waiting' });
    store.updateStep(outsiderId, 'task', { status: 'done', sessionId: 'ordinary-session', backend: 'claude' });

    const reply = await call(`/runs/${managerId}/messages`, { text: 'Review the worker report' });
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ delivered: true });
    expect(store.getRun(managerId)?.steps.filter((step) => step.id.startsWith('continue-'))).toHaveLength(1);
    const ordinary = await call(`/runs/${outsiderId}/messages`, { text: 'ordinary reply' });
    expect(ordinary.status).toBe(409);
    expect(await ordinary.json()).toEqual({ error: 'session closed' });
  });

  it.each([
    { phase: 'complete', caller: 'manager' },
    { phase: 'complete', caller: 'worker' },
    { phase: 'stopped', caller: 'manager' },
    { phase: 'stopped', caller: 'worker' },
  ] as const)('deletes a $phase pair from its $caller without touching Git', async ({ phase, caller }) => {
    settlePair(phase);
    const dispatchDir = join(dataDir, 'dispatch', managerId);
    mkdirSync(dispatchDir, { recursive: true });
    writeFileSync(join(dispatchDir, 'tree.json'), '{"keptUntilDeletion":true}\n');
    writeFileSync(join(repoRoot, 'checkpoint.txt'), 'manager checkpoint\n');
    git(repoRoot, 'add', 'checkpoint.txt');
    git(repoRoot, 'commit', '-qm', 'pair checkpoint');
    writeFileSync(join(repoRoot, 'unrelated.txt'), 'leave me alone\n');
    const head = git(repoRoot, 'rev-parse', 'HEAD');
    const branch = git(repoRoot, 'branch', '--show-current');
    const index = git(repoRoot, 'diff', '--cached');
    const callerId = caller === 'manager' ? managerId : workerId;

    const response = await call(`/runs/${callerId}`, undefined, 'DELETE');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(store.getRun(managerId)).toBeUndefined();
    expect(store.getRun(workerId)).toBeUndefined();
    expect(pairs.snapshot(pairId)).toBeNull();
    expect(existsSync(join(dataDir, 'pairs', pairId))).toBe(false);
    expect(existsSync(dispatchDir)).toBe(false);
    expect((await call(`/runs/${managerId}`)).status).toBe(404);
    expect((await call(`/runs/${workerId}`)).status).toBe(404);
    expect(git(repoRoot, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(repoRoot, 'branch', '--show-current')).toBe(branch);
    expect(git(repoRoot, 'diff', '--cached')).toBe(index);
    expect(readFileSync(join(repoRoot, 'unrelated.txt'), 'utf8')).toBe('leave me alone\n');
  });

  it('deletes a stopped manager-only pair even when dispatch is disabled', async () => {
    vi.stubEnv('ONNI_DISPATCH', '0');
    const state = pairs.transition(pairId, 'stopped');
    store.updateRun(managerId, { status: 'cancelled', dispatch: { rootRunId: managerId, pair: state } });
    const response = await call(`/runs/${managerId}`, undefined, 'DELETE');
    expect(response.status).toBe(200);
    expect(store.getRun(managerId)).toBeUndefined();
    expect(pairs.snapshot(pairId)).toBeNull();
  });

  it('counts both peers once when project clear cascades a historical pair', async () => {
    settlePair('complete');
    store.deleteRun(outsiderId);
    const response = await call('/project-data/clear', { confirm: 'pair-api' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 2, skipped: [] });
    expect(store.getRun(managerId)).toBeUndefined();
    expect(store.getRun(workerId)).toBeUndefined();
    expect(pairs.snapshot(pairId)).toBeNull();
  });

  it('counts a partial pair deletion without calling an already-removed peer skipped', async () => {
    settlePair('complete');
    store.deleteRun(outsiderId);
    store.updateRun(managerId, { createdAt: '2099-01-01T00:00:00.000Z' });
    const deleteRun = store.deleteRun.bind(store);
    vi.spyOn(store, 'deleteRun').mockImplementation((runId) => {
      if (runId === managerId) throw new Error('cleanup interrupted');
      return deleteRun(runId);
    });

    const response = await call('/project-data/clear', { confirm: 'pair-api' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deleted: 1,
      skipped: [{ id: managerId, title: 'Manager', reason: 'pair worker record is missing' }],
    });
    expect(store.getRun(managerId)).toBeDefined();
    expect(store.getRun(workerId)).toBeUndefined();
  });

  it('recovers run records after an interrupted historical pair deletion', async () => {
    settlePair('complete');
    await expect(pairs.delete(pairId, {
      managerRunId: managerId, workerRunId: workerId, repoRoot,
    }, () => {
      store.deleteRun(workerId);
      store.flush({ throwOnError: true });
      throw new Error('interrupted after worker removal');
    })).rejects.toThrow('interrupted after worker removal');
    expect(store.getRun(managerId)).toBeDefined();
    expect(store.getRun(workerId)).toBeUndefined();
    expect(existsSync(join(dataDir, 'pairs', pairId, 'deletion.json'))).toBe(true);

    await recoverPairDeletions(store, manager, dataDir);
    expect(store.getRun(managerId)).toBeUndefined();
    expect(store.getRun(workerId)).toBeUndefined();
    expect(existsSync(join(dataDir, 'pairs', pairId))).toBe(false);
  });

  it('refuses terminal deletion while a peer, descendant or worktree still needs cleanup', async () => {
    settlePair('complete');
    store.updateRun(workerId, { status: 'waiting' });
    expect((await call(`/runs/${managerId}`, undefined, 'DELETE')).status).toBe(409);
    store.updateRun(workerId, { status: 'done' });
    const extraId = store.createRun({ title: 'Extra', task: 'Extra', workflow: 'quick-task', steps: [], worktree: false }).id;
    store.updateRun(extraId, { dispatch: { rootRunId: managerId, parentRunId: managerId } });
    expect((await call(`/runs/${managerId}`, undefined, 'DELETE')).status).toBe(409);
    store.deleteRun(extraId);
    store.updateRun(managerId, { worktreePath: join(repoRoot, 'unexpected-worktree') });
    expect((await call(`/runs/${managerId}`, undefined, 'DELETE')).status).toBe(409);
    expect(store.getRun(managerId)).toBeDefined();
    expect(store.getRun(workerId)).toBeDefined();
    expect(pairs.readState(pairId)?.phase).toBe('complete');
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
    const activeDelete = await call(`/runs/${workerId}`, undefined, 'DELETE');
    expect(activeDelete.status).toBe(409);
    expect(await activeDelete.json()).toMatchObject({ error: expect.stringContaining('completed or stopped') });

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

  it.each(['complete', 'stopped'] as const)('allows repository Git mutations after the pair is %s', async (phase) => {
    const remote = mkdtempSync(join(tmpdir(), 'onni-pair-api-remote-'));
    try {
      git(remote, 'init', '--bare', '-q');
      git(repoRoot, 'remote', 'add', 'origin', remote);
      git(repoRoot, 'push', '-q', '-u', 'origin', 'main');
      const state = pairs.transition(pairId, phase, 'manager',
        phase === 'complete' ? { completedAt: new Date().toISOString() } : {});
      store.updateRun(managerId, {
        status: phase === 'complete' ? 'done' : 'cancelled',
        dispatch: { ...(store.getRun(managerId)!.dispatch!), pair: state },
      });

      for (const path of ['/repo/fetch', '/repo/pull', '/repo/push', '/repo/sync']) {
        const response = await call(path, undefined, 'POST');
        expect(response.status, path).toBe(200);
        expect((await response.json() as { error?: string }).error, path).not.toBe(PAIR_RUN_MUTATION_REFUSAL);
      }
      const branch = await call('/repo/branch', { name: `historical-${phase}` });
      expect(branch.status).toBe(200);
      expect(await branch.json()).toMatchObject({ branch: `historical-${phase}`, created: true });
      expect(git(repoRoot, 'branch', '--show-current')).toBe(`historical-${phase}`);
    } finally {
      rmSync(remote, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

async function value<T>(promise: Promise<Response>): Promise<T> {
  const response = await promise;
  expect(response.status).toBe(200);
  return response.json() as Promise<T>;
}
