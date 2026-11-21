import { expect, it, vi } from 'vitest';

const calls: Array<{ args: string[]; options: { maxBuffer?: number; timeout?: number } }> = [];

vi.mock('node:child_process', () => ({
  execFile: (
    _file: string,
    args: string[],
    options: { maxBuffer?: number; timeout?: number },
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ) => {
    calls.push({ args, options });
    if (args[0] === 'show-ref') callback(new Error('not found'), '', '');
    else callback(null, '', '');
  },
}));

it('bounds local git commands while retaining their output limit', async () => {
  const { uniqueBranchName } = await import('./git-worktree.ts');

  await expect(uniqueBranchName('unused', 'feature/fix-login', '11111111-1111-4111-8111-111111111111')).resolves.toBe(
    'feature/fix-login',
  );
  expect(calls).not.toHaveLength(0);
  for (const { options } of calls) {
    expect(options).toMatchObject({ maxBuffer: 32 * 1024 * 1024, timeout: 120_000 });
  }
});
