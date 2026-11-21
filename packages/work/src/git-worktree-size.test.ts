import { afterEach, describe, expect, it, vi } from 'vitest';

const exec = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFile: exec }));
const { worktreeSizeBytes } = await import('./git-worktree.ts');

afterEach(() => { vi.useRealTimers(); exec.mockReset(); });

describe('worktree size probe deadline', () => {
  it('kills only the hung probe and allows the next size probe to succeed', async () => {
    vi.useFakeTimers();
    const kill = vi.fn();
    let lateAnswer: (err: Error | null, stdout: string) => void = () => {};
    exec.mockImplementationOnce((_cmd, _args, _opts, cb) => {
      lateAnswer = cb;
      return { pid: 12345, kill };
    });
    const hung = worktreeSizeBytes('/tree');
    await vi.advanceTimersByTimeAsync(4_999);
    expect(kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(hung).resolves.toBeNull();
    expect(kill).toHaveBeenCalledExactlyOnceWith('SIGKILL');
    exec.mockImplementationOnce((_cmd, _args, _opts, cb) => cb(null, '12\t/tree\n'));
    await expect(worktreeSizeBytes('/tree')).resolves.toBe(12288);
    lateAnswer(null, '999\t/tree\n');
    await expect(hung).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans the deadline on command failure or synchronous spawn failure', async () => {
    vi.useFakeTimers();
    exec.mockImplementationOnce((_cmd, _args, _opts, cb) => cb(new Error('unavailable'), ''));
    await expect(worktreeSizeBytes('/tree')).resolves.toBeNull();
    exec.mockImplementationOnce(() => { throw new Error('spawn failed'); });
    await expect(worktreeSizeBytes('/tree')).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
