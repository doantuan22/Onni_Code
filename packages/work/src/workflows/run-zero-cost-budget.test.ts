import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { RunStore } from '../runs/store.ts';
import { RunManager } from './run.ts';
import type { AgentRunResult } from '../core/agent-runner.ts';
import { OpencodeAcpRunner } from '../core/opencode-acp-runner.ts';
import { WorkspaceSemaphore } from '../workspace/semaphore.ts';
import { remainingBudgetUsd } from '../dispatch/engine.ts';
import { removeTempDir } from '../test-fixtures/remove-temp-dir.testkit.ts';

it('retains the child reservation after preliminary zero and failure before final cost', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'onni-zero-incomplete-'));
  vi.stubEnv('ONNI_HOME', join(dir, 'home'));
  vi.stubEnv('ONNI_FOLLOWUPS', '0');
  const store = RunStore.open(join(dir, '.ai/onni'));
  // The HTTP/SSE runner was retired; exercise the engine's stable runner seam
  // with incomplete cost evidence, without starting a legacy localhost server.
  vi.spyOn(OpencodeAcpRunner.prototype, 'startSession').mockImplementation((_spec, onEvent) => {
    let open = true;
    const result = new Promise<AgentRunResult>((_resolve, reject) => {
      queueMicrotask(() => {
        onEvent?.({ type: 'cost', usd: 0 });
        onEvent?.({ type: 'token-usage', tokensUsed: 0 });
        onEvent?.({ type: 'token-usage', tokensUsed: 10500 });
        open = false;
        reject(new Error('backend failed before final cost report'));
      });
    });
    return { result, get open() { return open; }, sendMessage: () => false,
      end() { open = false; }, interrupt() { open = false; } };
  });
  const manager = new RunManager(store, dir, {
    semaphore: new WorkspaceSemaphore({ initial: { maxParallel: 1 } }),
  });
  try {
    const child = manager.startRun(
      { name: 'repro', source: 'built-in', steps: [{ id: 'a', name: 'A', prompt: '{{task}}', runner: 'opencode' }] },
      { task: 'work', worktree: false, runner: 'opencode' },
    );
    store.updateRun(child.id, { dispatch: { rootRunId: 'p', parentRunId: 'p', budgetUsd: 2 } });
    await vi.waitFor(() => expect(child.status).toBe('failed'), { timeout: 10000 });
    const parent = { ...child, id: 'p', dispatch: { rootRunId: 'p', budgetUsd: 5 }, costUsd: 0 };
    expect(child.status).toBe('failed');
    expect(child.steps[0]?.tokensUsed).toBe(10500);
    expect(child.costUsd).toBe(0);
    expect(remainingBudgetUsd(parent, [child])).toBe(3);
  } finally {
    manager.dispose();
    vi.restoreAllMocks();
    store.flush();
    vi.unstubAllEnvs();
    await removeTempDir(dir);
  }
}, 15000);
