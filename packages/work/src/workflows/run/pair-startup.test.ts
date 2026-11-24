import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Roster } from '@onni/contract';
import { PairStore } from '../../dispatch/pair-store.ts';
import { RunStore } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import { WorkspaceSemaphore } from '../../workspace/semaphore.ts';
import { RunManager } from '../run.ts';
import type { WorkflowDef } from '../types.ts';
import { executeRun } from './execute.ts';
import type { ExecuteActiveRun, ExecuteContext } from './internal-types.ts';
import { mirrorPairState } from './pair-runtime.ts';

const pairStoreConstructor = vi.hoisted(() => vi.fn());
vi.mock('../../dispatch/pair-store.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../dispatch/pair-store.ts')>();
  return {
    ...actual,
    PairStore: function PairStore(dataDir: string) {
      pairStoreConstructor(dataDir);
      return new actual.PairStore(dataDir);
    },
  };
});

const roster: Roster = {
  mode: 'one-and-one',
  manager: { runner: 'claude', model: 'opus' },
  workers: [{ runner: 'codex', model: 'gpt-5', role: 'implementation', maxConcurrent: 1 }],
};

const workflow: WorkflowDef = {
  name: '(one-and-one)',
  source: 'built-in',
  steps: [{ id: 'task', name: 'Task', prompt: '{{task}}' }],
};

describe('One & One startup', () => {
  let root: string;
  let store: RunStore;
  let manager: RunManager;

  beforeEach(() => {
    pairStoreConstructor.mockClear();
    root = mkdtempSync(join(tmpdir(), 'onni-pair-startup-'));
    execFileSync('git', ['init', '-b', 'feature'], { cwd: root, windowsHide: true });
    execFileSync('git', ['config', 'user.name', 'Onni Test'], { cwd: root, windowsHide: true });
    execFileSync('git', ['config', 'user.email', 'onni@test.local'], { cwd: root, windowsHide: true });
    writeFileSync(join(root, '.gitignore'), '.ai/\n', 'utf8');
    writeFileSync(join(root, 'README.md'), 'base\n', 'utf8');
    execFileSync('git', ['add', '.gitignore', 'README.md'], { cwd: root, windowsHide: true });
    execFileSync('git', ['commit', '-m', 'base'], { cwd: root, windowsHide: true });
    store = RunStore.open(join(root, '.ai', 'onni'));
    manager = new RunManager(store, root, {
      semaphore: new WorkspaceSemaphore({ initial: { maxParallel: 0 } }),
    });
  });

  afterEach(async () => {
    manager.dispose();
    store.flush();
    await removeTempDir(root);
  });

  function executionContext() {
    const dataDir = join(root, '.ai', 'onni');
    const active = new Map<string, ExecuteActiveRun>();
    const executeGraph = vi.fn(async () => null);
    return {
      executeGraph,
      context: {
        store,
        repoRoot: root,
        dataDir,
        active,
        starting: new Set<string>(),
        queue: [],
        pendingJobs: new Map(),
        pendingContinuations: new Map(),
        pendingBranchNames: new Map(),
        checkArtifactSnapshots: new Map(),
        autosaveCheckpointBlockedRuns: new Set<string>(),
        waiting: new Set<string>(),
        interruptedWorkflowStep: vi.fn(),
        requeueWhileHeld: vi.fn(() => false),
        landingPolicy: vi.fn(async () => undefined),
        configuredModelProvider: vi.fn(async () => undefined),
        repositoryRootLockDisabled: vi.fn(() => false),
        acquireRepoRoot: vi.fn(async () => true),
        dropActive: vi.fn((runId: string, expected: ExecuteActiveRun) => {
          if (active.get(runId) === expected) active.delete(runId);
        }),
        prepareDispatchSession: vi.fn(),
        prepareAutomationsSession: vi.fn(),
        loadManagerSessionContext: vi.fn(async () => null),
        executeGraph,
        settleSuccess: vi.fn(async () => true),
        clearAutosaveTimer: vi.fn(),
        clearIdleTimer: vi.fn(),
        currentCheckExclusions: vi.fn(async () => []),
        settleUnansweredPark: vi.fn(),
        inactivityFailureMessage: vi.fn(() => 'idle'),
      } as unknown as ExecuteContext,
    };
  }

  function workerFixture(assignWorker = true) {
    const dataDir = join(root, '.ai', 'onni');
    const managerId = store.createRun({
      title: 'Manager', workflow: '(one-and-one)', task: 'Coordinate', steps: [{ id: 'task', name: 'Task', kind: 'agent' }],
    }).id;
    const workerId = store.createRun({
      title: 'Worker', workflow: '(one-and-one)', task: 'Implement', autonomous: true, worktree: false,
      steps: [{ id: 'task', name: 'Task', kind: 'agent' }],
    }).id;
    store.updateRun(managerId, { roster, dispatch: { rootRunId: managerId } });
    store.updateRun(workerId, {
      runner: 'codex',
      dispatch: {
        rootRunId: managerId,
        parentRunId: managerId,
        pairMember: { pairId: managerId, role: 'worker', peerRunId: managerId },
      },
    });
    const pairs = new PairStore(dataDir);
    const now = new Date().toISOString();
    let state = pairs.create({
      pairId: managerId,
      managerRunId: managerId,
      phase: 'planning',
      activeRole: 'manager',
      workspace: {
        repoRoot: root,
        branch: execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim(),
        baselineSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      },
      orderRevision: 0,
      handoffs: 0,
      createdAt: now,
      updatedAt: now,
    });
    if (assignWorker) state = pairs.setWorker(managerId, workerId);
    const order = pairs.enqueueOrder(managerId, { objective: 'Implement the feature' });
    state = pairs.readState(managerId)!;
    store.updateRun(managerId, { dispatch: { rootRunId: managerId, pair: state } });
    mirrorPairState(store, state);
    return { dataDir, managerId, workerId, pairs, order };
  }

  async function expectWorkerRefusal(workerId: string, error: string): Promise<void> {
    pairStoreConstructor.mockClear();
    const { context, executeGraph } = executionContext();
    await executeRun(context, workerId, workflow, { task: 'Implement the feature', runner: 'codex', worktree: false });
    expect(store.getRun(workerId)).toMatchObject({ status: 'failed', error: expect.stringContaining(error) });
    expect(executeGraph).not.toHaveBeenCalled();
    expect(context.active.get(workerId)).toBeUndefined();
  }

  it('admits a pair on a dirty checkout by committing the pending changes as its baseline', async () => {
    manager.dispose();
    manager = new RunManager(store, root, {
      semaphore: new WorkspaceSemaphore({ initial: { maxParallel: 1 } }),
    });
    const saved = process.env.ONNI_DRY_RUN;
    process.env.ONNI_DRY_RUN = '1';
    try {
      writeFileSync(join(root, 'unrelated.txt'), 'user work\n', 'utf8');
      const record = manager.startRun(workflow, { task: 'Coordinate one implementation', roster });
      await vi.waitFor(() => {
        const pair = store.getRun(record.id)?.dispatch?.pair;
        expect(pair).toBeDefined();
        expect(execFileSync('git', ['show', '--format=', '--name-only', pair!.workspace.baselineSha], { cwd: root, encoding: 'utf8' })).toContain('unrelated.txt');
      }, { timeout: 10_000 });
      expect(store.getRun(record.id)?.error ?? '').not.toContain('clean');
      expect(record.worktree).toBe(false);
    } finally {
      if (saved === undefined) delete process.env.ONNI_DRY_RUN;
      else process.env.ONNI_DRY_RUN = saved;
    }
  });

  it('pins both agents to the current checkout even when the request asks for a worktree', () => {
    const record = manager.startRun(workflow, {
      task: 'Coordinate one implementation',
      roster,
      worktree: true,
      newBranch: true,
      branch: 'other',
      managerFullAccess: true,
      dispatchIntent: { maxSubtasks: 2 },
    });

    expect(record).toMatchObject({
      status: 'queued',
      worktree: false,
      runner: 'claude',
      model: 'opus',
      roster,
    });
    expect(record.branch).toBeUndefined();
    expect(record.worktreePath).toBeUndefined();
    expect(record.managerFullAccess).toBeUndefined();
    expect(execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim()).toBe('feature');
  });

  it.each(['role', 'peer', 'root', 'worker'] as const)('refuses a worker with a mismatched %s identity', async (mismatch) => {
    const { managerId, workerId, pairs } = workerFixture();
    const worker = store.getRun(workerId)!;
    const member = worker.dispatch!.pairMember!;
    if (mismatch === 'worker') {
      mirrorPairState(store, pairs.setWorker(managerId, 'another-worker'));
    } else {
      store.updateRun(workerId, {
        dispatch: {
          ...worker.dispatch!,
          ...(mismatch === 'root' ? { rootRunId: 'another-manager' } : {}),
          pairMember: {
            ...member,
            ...(mismatch === 'role' ? { role: 'manager' as const } : {}),
            ...(mismatch === 'peer' ? { peerRunId: 'another-manager' } : {}),
          },
        },
      });
    }
    await expectWorkerRefusal(workerId, 'worker membership does not match the persistent pair worker');
  });

  it('refuses a worker whose pair membership points at missing pair state', async () => {
    const { workerId } = workerFixture();
    const worker = store.getRun(workerId)!;
    store.updateRun(workerId, {
      dispatch: { ...worker.dispatch!, pairMember: { ...worker.dispatch!.pairMember!, pairId: 'missing-pair' } },
    });
    await expectWorkerRefusal(workerId, 'pair state is missing');
  });

  it('refuses a persistent worker whose membership marker is missing', async () => {
    const { workerId } = workerFixture();
    const worker = store.getRun(workerId)!;
    const { pairMember: _missing, ...dispatch } = worker.dispatch!;
    store.updateRun(workerId, { dispatch });
    await expectWorkerRefusal(workerId, 'worker membership does not match the persistent pair worker');
  });

  it('refuses a worker when persistent pair state has no worker identity', async () => {
    const { workerId } = workerFixture(false);
    await expectWorkerRefusal(workerId, 'worker membership does not match the persistent pair worker');
  });

  it('does not create a PairStore for the default multi-worker fan-out mode', async () => {
    const fanout: Roster = {
      manager: { runner: 'claude', model: 'opus' },
      workers: [
        { runner: 'codex', model: 'gpt-5', role: 'implementation', maxConcurrent: 1 },
        { runner: 'pi', model: 'pi/default', role: 'review', maxConcurrent: 1 },
      ],
    };
    const runId = store.createRun({
      title: 'Fan out', workflow: '(one-and-one)', task: 'Coordinate independent work',
      steps: [{ id: 'task', name: 'Task', kind: 'agent' }],
    }).id;
    store.updateRun(runId, { roster: fanout });
    pairStoreConstructor.mockClear();
    const { context, executeGraph } = executionContext();

    await executeRun(context, runId, workflow, { task: 'Coordinate independent work', runner: 'claude', worktree: false });

    expect(executeGraph).toHaveBeenCalledOnce();
    expect(pairStoreConstructor).not.toHaveBeenCalled();
    expect(existsSync(join(root, '.ai', 'onni', 'pairs'))).toBe(false);
  });
});
