import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Roster } from '@onni/contract';
import { RunStore } from '../../runs/store.ts';
import { removeTempDir } from '../../test-fixtures/remove-temp-dir.testkit.ts';
import { WorkspaceSemaphore } from '../../workspace/semaphore.ts';
import { RunManager } from '../run.ts';
import type { WorkflowDef } from '../types.ts';

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

  it('refuses to admit a pair while unrelated checkout changes are uncommitted', async () => {
    manager.dispose();
    manager = new RunManager(store, root, {
      semaphore: new WorkspaceSemaphore({ initial: { maxParallel: 1 } }),
    });
    const saved = process.env.ONNI_DRY_RUN;
    process.env.ONNI_DRY_RUN = '1';
    try {
      writeFileSync(join(root, 'unrelated.txt'), 'user work\n', 'utf8');
      const record = manager.startRun(workflow, { task: 'Coordinate one implementation', roster });
      await vi.waitFor(() => expect(store.getRun(record.id)?.status).toBe('failed'), { timeout: 10_000 });
      expect(store.getRun(record.id)?.error).toContain('clean');
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
});
