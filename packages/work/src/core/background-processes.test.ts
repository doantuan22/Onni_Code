import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ exec: vi.fn(), spawn: vi.fn() }));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const { promisify } = await import('node:util');
  const execFile = (...args: unknown[]) => {
    calls.exec(...args);
    const callback = args.at(-1) as (error: null, stdout: string, stderr: string) => void;
    callback(null, '1.2.3\n', '');
  };
  Object.defineProperty(execFile, promisify.custom, {
    value: async (...args: unknown[]) => {
      calls.exec(...args);
      return { stdout: '1.2.3\n', stderr: '' };
    },
  });
  return {
    ...actual,
    execFile,
    spawn: (...args: unknown[]) => {
      calls.spawn(...args);
      throw new Error('CLI launch stopped by test');
    },
  };
});

import { detectEnvironment } from './backend-detect.ts';
import { discoverClaudeModels } from './claude-model-catalog.ts';
import { discoverClineModels } from './cline-model-catalog.ts';
import { spawnCodexAppServer } from './codex-app-server-transport.ts';
import { discoverCursorModels } from './cursor-model-catalog.ts';
import { spawnJunieAcp } from './junie-acp-transport.ts';
import { discoverOpencodeModels } from './opencode-model-catalog.ts';
import { discoverPiModels } from './pi-model-catalog.ts';
import { spawnTaskProcess } from './task-process-spawn.ts';
import { localBranchExists, worktreeChangedFilesReadOnly } from '../git-worktree.ts';
import { getDiff } from '../server/git.ts';
import { collectChanges } from '../server/git-changes.ts';
import { repoSyncStatus } from '../server/repo-sync.ts';

beforeEach(() => {
  calls.exec.mockClear();
  calls.spawn.mockClear();
  vi.stubEnv('ONNI_DRY_RUN', '0');
  vi.stubEnv('ONNI_TASK_ID', '');
});
afterEach(() => vi.unstubAllEnvs());

// A desktop sidecar has no console to inherit; even a short read-only probe can open one.
describe('background CLI commands stay hidden on Windows', () => {
  it.each([
    ['environment detection', () => detectEnvironment()],
    ['repository diff', () => getDiff(process.cwd())],
    ['repository changes', () => collectChanges(process.cwd(), 'HEAD')],
    ['repository sync status', () => repoSyncStatus(process.cwd())],
    ['task branch probe', () => localBranchExists(process.cwd(), 'task')],
    ['read-only task changes', () => worktreeChangedFilesReadOnly(process.cwd(), 'HEAD')],
    ['Cursor model discovery', () => discoverCursorModels({ bin: 'cursor-test' })],
  ] as const)('%s hides every subprocess', async (_name, run) => {
    await run().catch(() => undefined);
    expect(calls.exec.mock.calls.length).toBeGreaterThan(0);
    for (const args of calls.exec.mock.calls) {
      expect((args[2] as { windowsHide?: boolean }).windowsHide).toBe(true);
    }
  });

  it.each([
    ['Claude models', () => discoverClaudeModels({ cwd: process.cwd(), bin: 'claude-test' })],
    ['Cline models', () => discoverClineModels({ cwd: process.cwd(), bin: 'cline-test' })],
    ['OpenCode models', () => discoverOpencodeModels({ cwd: process.cwd(), bin: 'opencode-test' })],
    ['Pi models', () => discoverPiModels({ cwd: process.cwd(), bin: 'pi-test' })],
    ['Codex discovery transport', () => spawnCodexAppServer('codex-test', process.cwd())],
    ['Junie discovery transport', () => spawnJunieAcp('junie-test', process.cwd())],
    ['task process without a task id', () => spawnTaskProcess('agent-test', [], { cwd: process.cwd() })],
  ] as const)('%s hides its launcher', async (_name, run) => {
    await Promise.resolve().then(async () => { await run(); }).catch(() => undefined);
    expect(calls.spawn).toHaveBeenCalledOnce();
    expect((calls.spawn.mock.calls[0]?.[2] as { windowsHide?: boolean }).windowsHide).toBe(true);
  });

  it('preserves discovery cwd, environment and process options while hiding the launcher', () => {
    const env = { PATH: '/tools', ONNI_TASK_ID: '' };
    expect(() => spawnTaskProcess('agent-test', ['models'], {
      cwd: process.cwd(), env, detached: true, windowsHide: false,
    })).toThrow('CLI launch stopped by test');
    const [file, args, options] = calls.spawn.mock.calls[0] ?? [];
    expect(file).toBe('agent-test');
    expect(args).toEqual(['models']);
    expect(options).toEqual({ cwd: process.cwd(), env, detached: true, windowsHide: true });
  });
});
