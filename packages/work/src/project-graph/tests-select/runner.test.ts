import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runVitestRelated } from './runner.ts';

describe('Vitest related runner', () => {
  let root: string | undefined;
  afterEach(() => {
    vi.unstubAllEnvs();
    if (root) rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    root = undefined;
  });

  function makeRepo(): string {
    root = mkdtempSync(join(tmpdir(), 'pg-runner-'));
    mkdirSync(join(root, 'node_modules', 'vitest'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ devDependencies: { vitest: '^4.0.0' } }));
    writeFileSync(join(root, 'node_modules', 'vitest', 'vitest.mjs'), '');
    return root;
  }

  it('does not spawn unless both requested and opted in', async () => {
    const execute = vi.fn();
    const cwd = makeRepo();
    vi.stubEnv('ONNI_PROJECT_GRAPH_TOOLS', '0');
    expect((await runVitestRelated({ root: cwd, files: ['src/a.ts'], requested: true, execute })).available).toBe(false);
    vi.stubEnv('ONNI_PROJECT_GRAPH_TOOLS', '1');
    expect((await runVitestRelated({ root: cwd, files: ['src/a.ts'], requested: false, execute })).available).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses bounded, shell-free related invocation with a minimal env and parses JSON candidates', async () => {
    const cwd = makeRepo();
    vi.stubEnv('ONNI_PROJECT_GRAPH_TOOLS', '1');
    vi.stubEnv('GITHUB_TOKEN', 'must-not-cross-boundary');
    const execute = vi.fn(async ({ args, env, timeoutMs, maxBuffer, cwd: childCwd }) => ({
      stdout: JSON.stringify({ testResults: [{ name: join(cwd, 'src', 'a.test.ts').replace(/\\/g, '/') }] }),
      stderr: '',
      exitCode: args.includes('related') && childCwd === cwd && timeoutMs > 0 && maxBuffer > 0 ? 0 : 1,
    }));
    const result = await runVitestRelated({ root: cwd, files: ['src/a.ts'], requested: true, execute });
    expect(result).toMatchObject({ used: true, available: true, tests: [{ path: 'src/a.test.ts', confidence: 'medium', source: 'runner' }] });
    expect(execute).toHaveBeenCalledOnce();
    const invocation = execute.mock.calls[0]?.[0];
    expect(invocation?.args.slice(1)).toEqual(['related', '--run', '--reporter=json', '--passWithNoTests', 'src/a.ts']);
    expect(invocation?.env).not.toHaveProperty('GITHUB_TOKEN');
  });

  it('returns a value when Vitest is absent or the process fails', async () => {
    const missing = mkdtempSync(join(tmpdir(), 'pg-no-vitest-'));
    try {
      writeFileSync(join(missing, 'package.json'), JSON.stringify({ devDependencies: { vitest: '^4.0.0' } }));
      vi.stubEnv('ONNI_PROJECT_GRAPH_TOOLS', '1');
      expect(await runVitestRelated({ root: missing, files: ['x.ts'], requested: true })).toMatchObject({ used: false, available: false });
    } finally {
      rmSync(missing, { recursive: true, force: true, maxRetries: 5 });
    }
    expect(await runVitestRelated({ root: makeRepo(), files: ['x.ts'], requested: true, execute: async () => { throw new Error('timed out\nraw output'); } }))
      .toMatchObject({ used: false, available: false, reason: 'timed out raw output' });
  });
});
