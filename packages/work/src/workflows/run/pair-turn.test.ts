import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AgentEvent, AgentSession } from '../../core/agent-runner.ts';
import { createRunner } from '../../core/runner-factory.ts';
import type { RunRecord } from '../../runs/store.ts';
import { repositoryLockfilePath } from '../../git-repository-lock.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import { runAgentStep } from './agent-step.ts';
import { runContinuation } from './continuation.ts';
import { preparePairContinuation } from './pair-coordinator.ts';
import type { AgentStepActiveRun, AgentStepContext, ContinuationActiveRun, ContinuationContext } from './internal-types.ts';

vi.mock('../../core/runner-factory.ts', () => ({ createRunner: vi.fn() }));
vi.mock('./pair-coordinator.ts', async (importOriginal) => ({
  // The handoff predicate is pure; only the pair-store-touching preparation is stubbed.
  ...(await importOriginal<typeof import('./pair-coordinator.ts')>()),
  preparePairContinuation: vi.fn(async () => ({ ok: true })),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function workerSession(getOnEvent: () => ((event: AgentEvent) => void) | undefined, report: string) {
  let resolveResult!: (value: { tokensUsed: number }) => void;
  const result = new Promise<{ tokensUsed: number }>((resolve) => { resolveResult = resolve; });
  const rawSession = {
    open: true,
    result,
    end: vi.fn(() => { rawSession.open = false; }),
    interrupt: vi.fn(),
    sendMessage: vi.fn(() => true),
  };
  const session = rawSession as unknown as AgentSession;
  const emitTurn = () => {
    const onEvent = getOnEvent();
    if (!onEvent) throw new Error('runner callback was not captured');
    onEvent({ type: 'text', text: report });
    onEvent({ type: 'turn-end' });
    resolveResult({ tokensUsed: 7 });
  };
  return { session, emitTurn };
}

function fixture(dataDir: string) {
  const run = {
    id: 'worker',
    title: 'Implement the order',
    task: 'Implement the order',
    workflow: '(planned)',
    status: 'running',
    worktree: false,
    steps: [{ id: 'task', status: 'running', sessionId: 'session' }],
    dispatch: {
      pairMember: { pairId: 'pair', role: 'worker', peerRunId: 'manager', orderId: 'order', orderRevision: 1 },
    },
  } as unknown as RunRecord;
  const active = new Map<string, unknown>();
  const sink = { flushAll: vi.fn(), sessionEnded: vi.fn() };
  const store = {
    getRun: vi.fn(() => run),
    updateRun: vi.fn((_id: string, patch: Partial<RunRecord>) => Object.assign(run, patch)),
    updateStep: vi.fn((_id: string, stepId: string, patch: Partial<RunRecord['steps'][number]>) => {
      const step = run.steps.find((entry) => entry.id === stepId);
      if (step) Object.assign(step, patch);
    }),
    appendEvent: vi.fn(),
    flush: vi.fn(),
    readEvents: vi.fn(() => []),
    redactRunText: vi.fn((_id: string, text: string) => text),
  };
  const handoff = deferred<{ handled: true; ok: boolean; error?: string }>();
  const handlePairWorkerTurn = vi.fn(
    (_runId: string, _turnText: string, _excludedPaths: readonly string[]) => handoff.promise,
  );
  const common = {
    repoRoot: dataDir,
    dataDir,
    store,
    active,
    waiting: new Set<string>(),
    makeUiSink: vi.fn(() => sink),
    recordTurnEnd: vi.fn(async () => {}),
    handlePairWorkerTurn,
    provisionTaskSkills: vi.fn(async () => []),
    flushPendingReports: vi.fn(() => ''),
    flushInbox: vi.fn(() => ''),
    prepareAttachmentLibrary: vi.fn(),
    attachmentLibraryHint: vi.fn(() => ''),
    configuredModelProvider: vi.fn(async () => undefined),
    agentEnvForStep: vi.fn(async () => ({ profileId: 'default', env: {} })),
    privateMcpForLaunch: vi.fn(async () => undefined),
    beginUsageInvocation: vi.fn(),
    agentPermissionSpec: vi.fn(async () => ({})),
    markQueuedManagerDeliveriesDelivered: vi.fn(),
    flushDeferred: vi.fn(),
    recordUsagePeaks: vi.fn(),
    clearIdleTimer: vi.fn(),
    leaveMonitoring: vi.fn(),
    clearMonitoringWakeTimer: vi.fn(),
    handleRunnerUiEvent: vi.fn(),
  };
  return { run, active, store, handoff, handlePairWorkerTurn, common };
}

describe('One & One worker turn handoff', () => {
  let dataDir: string;

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'onni-pair-turn-'));
    execFileSync('git', ['init', '-q', '-b', 'dev'], { cwd: dataDir });
  });

  afterAll(async () => {
    await removeTempDir(dataDir);
  });

  it('preserves the first-step report and closes only after the checkpoint resolves', async () => {
    const { active, handoff, handlePairWorkerTurn, common } = fixture(dataDir);
    const state: AgentStepActiveRun = {
      ownerToken: Symbol('worker'),
      interrupt: vi.fn(),
      cwd: '/project',
      cancelled: false,
      checkInProgress: false,
      autosaveCheckpointBlocked: false,
      skills: [],
      autosaveExcludedPaths: new Map<string, string>(),
    };
    active.set('worker', state);
    let onEvent: ((event: AgentEvent) => void) | undefined;
    const { session, emitTurn } = workerSession(() => onEvent, 'Implemented the order.\n\nONNI:DONE');
    const startSession = vi.fn((_spec: unknown, callback: (event: AgentEvent) => void) => {
      onEvent = callback;
      queueMicrotask(emitTurn);
      return session;
    });
    vi.mocked(createRunner).mockReturnValue({ startSession } as unknown as ReturnType<typeof createRunner>);
    const context = {
      ...common,
      appendTurnText: (current: string, text: string) => current + text,
      stripDoneMarker: (text: string) => text,
      stripMonitoringMarker: (text: string) => text,
      endsWithDoneMarker: (text: string) => /ONNI:DONE\s*$/.test(text),
      persistAttachment: vi.fn(),
      recordNoteMeta: vi.fn(),
      landOnDone: vi.fn(() => false),
    } as unknown as AgentStepContext;

    const running = runAgentStep(context, 'worker', state,
      { id: 'task', name: 'Implement', prompt: '{{task}}' },
      { task: 'Implement the order', generateFollowups: false }, [], null, true,
      vi.fn(), undefined, 'claude', undefined, undefined);

    await vi.waitFor(() => expect(handlePairWorkerTurn).toHaveBeenCalledOnce());
    expect(onEvent).toBeTypeOf('function');
    expect(handlePairWorkerTurn.mock.calls[0]?.[1]).toBe('Implemented the order.\n\nONNI:DONE');
    expect(session.end).not.toHaveBeenCalled();
    handoff.resolve({ handled: true, ok: true });
    await expect(running).resolves.toBeNull();
    expect(session.end).toHaveBeenCalledOnce();
  });

  it('preserves a revised-order report on the continuation path and propagates handoff failure', async () => {
    const { run, active, handoff, handlePairWorkerTurn, common } = fixture(dataDir);
    const admission = deferred<{ ok: true }>();
    vi.mocked(preparePairContinuation).mockImplementationOnce(() => admission.promise);
    const lockPath = repositoryLockfilePath(dataDir)!;
    const deferredBinding = {
      revision: 'binding-1',
      runner: 'codex',
      accounts: [{ runner: 'codex', id: 'account-a', path: '/accounts/a', identity: 'worker@example.test' }],
    };
    Object.assign(run, {
      runner: 'codex',
      model: 'gpt-5',
      modelIdentity: 'openai/gpt-5',
      agentProfile: 'account-a',
      deferredBinding,
    });
    Object.assign(run.steps[0]!, {
      backend: 'codex',
      profileId: 'account-a',
      modelIdentity: 'openai/gpt-5',
    });
    run.steps.push({ id: 'continue-1', name: 'Continue', kind: 'agent', status: 'pending', iterations: 0, tokensUsed: 0 });
    const originalStep = { ...run.steps[0]! };
    const agentEnvForStep = vi.fn(async () => ({
      profileId: 'account-a',
      env: { ONNI_AGENT_ACCOUNT: 'account-a', ONNI_MODEL_PROVIDER: 'openai' },
    }));
    const state = {} as ContinuationActiveRun;
    active.set('worker', state);
    let onEvent: ((event: AgentEvent) => void) | undefined;
    const { session, emitTurn } = workerSession(() => onEvent, 'Revised the order.\n\nONNI:DONE');
    const startSession = vi.fn((_spec: unknown, callback: (event: AgentEvent) => void) => {
      onEvent = callback;
      queueMicrotask(emitTurn);
      return session;
    });
    vi.mocked(createRunner).mockReturnValue({ startSession } as unknown as ReturnType<typeof createRunner>);
    const context = {
      ...common,
      agentEnvForStep,
      checkArtifactSnapshots: new Map(),
      autosaveCheckpointBlockedRuns: new Set<string>(),
      starting: new Set<string>(),
      waiting: new Set<string>(),
      helpers: {
        appendTurnText: (current: string, text: string) => current + text,
        stripDoneMarker: (text: string) => text,
        stripMonitoringMarker: (text: string) => text,
        endsWithDoneMarker: (text: string) => /ONNI:DONE\s*$/.test(text),
        currentCheckExclusions: vi.fn(async () => []),
        configuredModelProvider: vi.fn(async () => undefined),
        leadingSlashSkillName: vi.fn(() => undefined),
        expandRegistrySlashSkillText: vi.fn((text: string) => text),
      },
      acquireRepoRoot: vi.fn(async () => true),
      dropActive: vi.fn((runId: string, expected: unknown) => {
        if (active.get(runId) === expected) active.delete(runId);
      }),
      armAutosave: vi.fn(),
      prepareDispatchSession: vi.fn(),
      prepareAutomationsSession: vi.fn(),
      loadManagerSessionContext: vi.fn(async () => null),
      persistPastedAttachments: vi.fn(() => []),
      attachmentsDir: vi.fn(() => join(dataDir, 'attachments')),
      sessionCostUsd: vi.fn(() => 0),
      settleSuccess: vi.fn(async () => true),
      idleClosedFails: vi.fn(async () => false),
      inactivityFailureMessage: vi.fn(() => 'idle'),
      settleUnansweredPark: vi.fn(),
      clearAutosaveTimer: vi.fn(),
      handleDispatchTurn: vi.fn(() => { throw new Error('pair worker used generic dispatch handling'); }),
    } as unknown as ContinuationContext;

    const running = runContinuation(context, 'worker', 'continue-1', 'session', 'codex', 'Revise the order');
    await vi.waitFor(() => expect(preparePairContinuation).toHaveBeenCalledOnce());
    expect(existsSync(lockPath)).toBe(true);
    expect(startSession).not.toHaveBeenCalled();
    admission.resolve({ ok: true });
    await vi.waitFor(() => expect(startSession).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(existsSync(lockPath)).toBe(false));
    await vi.waitFor(() => expect(handlePairWorkerTurn).toHaveBeenCalledOnce());
    expect(handlePairWorkerTurn.mock.calls[0]?.[1]).toBe('Revised the order.\n\nONNI:DONE');
    expect(agentEnvForStep).toHaveBeenCalledWith('worker', 'codex', expect.objectContaining({ recordedProfileId: 'account-a' }));
    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: dataDir,
        sessionId: 'session',
        resume: true,
        model: 'gpt-5',
        env: { ONNI_AGENT_ACCOUNT: 'account-a', ONNI_MODEL_PROVIDER: 'openai' },
      }),
      expect.any(Function),
      expect.anything(),
    );
    expect(common.store.updateStep).toHaveBeenCalledWith('worker', 'continue-1', expect.objectContaining({
      sessionId: 'session', backend: 'codex',
    }));
    expect(common.store.updateStep).toHaveBeenCalledWith('worker', 'continue-1', expect.objectContaining({
      modelIdentity: 'openai/gpt-5',
    }));
    expect(common.store.updateStep).toHaveBeenCalledWith('worker', 'continue-1', expect.objectContaining({
      profileId: 'account-a',
    }));
    expect(run.steps[0]).toEqual(originalStep);
    expect(run.deferredBinding).toEqual(deferredBinding);
    expect(session.end).not.toHaveBeenCalled();
    handoff.resolve({ handled: true, ok: false, error: 'checkpoint rejected an unexpected HEAD' });
    await running;
    expect(session.end).toHaveBeenCalledOnce();
    expect(common.store.updateRun).toHaveBeenCalledWith('worker', expect.objectContaining({
      status: 'failed',
      error: 'continue failed: checkpoint rejected an unexpected HEAD',
    }));
  });
});
