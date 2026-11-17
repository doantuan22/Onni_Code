import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunStore } from '../runs/store.ts';
import { RunManager } from './run.ts';
import { QUICK_TASK_WORKFLOW } from './types.ts';

const run = promisify(execFile);
const GIT_ID = ['-c', 'user.name=test', '-c', 'user.email=test@local'];

describe('a run stopped by a context-window overflow compacts and continues on the same model', () => {
  let repoRoot: string;
  let store: RunStore;
  let manager: RunManager | undefined;
  const savedDryRun = process.env.ONNI_DRY_RUN;
  const savedCompaction = process.env.ONNI_CONTEXT_COMPACTION;

  beforeEach(async () => {
    process.env.ONNI_DRY_RUN = '1';
    process.env.ONNI_CONTEXT_COMPACTION = '1';
    repoRoot = mkdtempSync(join(tmpdir(), 'onni-context-compaction-'));
    await run('git', ['init', '-q', '-b', 'main'], { cwd: repoRoot });
    writeFileSync(join(repoRoot, 'a.txt'), 'one\n');
    await run('git', ['add', '-A'], { cwd: repoRoot });
    await run('git', [...GIT_ID, 'commit', '-q', '-m', 'base'], { cwd: repoRoot });
    store = RunStore.open(join(repoRoot, '.ai/onni'));
  });

  afterEach(async () => {
    if (manager) {
      for (const { id } of store.listRuns()) manager.cancel(id);
      await expect.poll(() => store.listRuns().some(({ id }) => manager?.isActive(id)), { timeout: 10_000 }).toBe(false);
      manager.dispose();
      manager = undefined;
    }
    if (savedDryRun === undefined) delete process.env.ONNI_DRY_RUN;
    else process.env.ONNI_DRY_RUN = savedDryRun;
    if (savedCompaction === undefined) delete process.env.ONNI_CONTEXT_COMPACTION;
    else process.env.ONNI_CONTEXT_COMPACTION = savedCompaction;
    store.flush();
    rmSync(repoRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('opens a fresh compacted session on the same model instead of advising the user', async () => {
    manager = new RunManager(store, repoRoot);
    const record = manager.startRun(QUICK_TASK_WORKFLOW, { task: 'mock:context ship it', worktree: false });
    await expect.poll(() => store.getRun(record.id)?.status, { timeout: 20_000 }).toBe('failed');
    const failed = store.getRun(record.id)!;
    expect(failed.failureClass).toBe('context_too_large');

    // The scheduler compacts synchronously after the failure settles, adding a fresh step.
    await expect.poll(() => {
      const fresh = store.getRun(record.id)?.steps.find((step) => step.id.startsWith('continue-'));
      return fresh?.sessionId;
    }, { timeout: 20_000 }).toBeDefined();

    const resumed = store.getRun(record.id)!;
    expect(resumed.autoResumeAttempts).toBe(1);
    expect(resumed.autoResumeAt).toBeUndefined();
    const failedSession = failed.steps.find((step) => step.sessionId)?.sessionId;
    const freshStep = resumed.steps.find((step) => step.id.startsWith('continue-'));
    expect(freshStep?.sessionId).not.toBe(failedSession);
    expect(store.readEvents(record.id).some((event) => String(event.message ?? '').includes('compacting the conversation'))).toBe(true);
  }, 60_000);

  it('leaves the run failed with the hand-off hint when the opt-in is off', async () => {
    delete process.env.ONNI_CONTEXT_COMPACTION;
    manager = new RunManager(store, repoRoot);
    const record = manager.startRun(QUICK_TASK_WORKFLOW, { task: 'mock:context ship it', worktree: false });
    await expect.poll(() => store.getRun(record.id)?.status, { timeout: 20_000 }).toBe('failed');
    const failed = store.getRun(record.id)!;
    expect(failed.failureClass).toBe('context_too_large');
    expect(failed.autoResumeAttempts).toBeUndefined();
    expect(failed.steps.length).toBe(1);
    expect(store.readEvents(record.id).some((event) => String(event.message ?? '').includes('start a new task from this one'))).toBe(true);
  }, 40_000);
});
