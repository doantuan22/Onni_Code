import { execFile } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';
import type { TestCandidate } from '../types.ts';

export const RUNNER_TIMEOUT_MS = 30_000;
export const RUNNER_OUTPUT_CAP = 512 * 1024;

export interface RunnerOutcome {
  used: boolean;
  available: boolean;
  reason?: string;
  tests: TestCandidate[];
}

export interface ExecuteVitestOptions {
  cwd: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxBuffer: number;
  signal?: AbortSignal;
}

export type ExecuteVitest = (options: ExecuteVitestOptions) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

const executeVitest: ExecuteVitest = ({ cwd, args, env, timeoutMs, maxBuffer, signal }) => new Promise((resolvePromise, reject) => {
  execFile(process.execPath, args, {
    cwd,
    env,
    timeout: timeoutMs,
    maxBuffer,
    windowsHide: true,
    ...(signal ? { signal } : {}),
  }, (error, stdout, stderr) => {
    if (error) {
      const failure = error as NodeJS.ErrnoException & { killed?: boolean; code?: string | number };
      if (failure.code === 'ENOENT') reject(Object.assign(new Error('Node could not start the Vitest runner'), { code: 'ENOENT' }));
      else if (failure.killed || failure.code === 'ETIMEDOUT') reject(new Error('Vitest related timed out'));
      else if (signal?.aborted) reject(new Error('Vitest related was aborted'));
      else resolvePromise({ stdout: String(stdout), stderr: String(stderr), exitCode: typeof failure.code === 'number' ? failure.code : 1 });
      return;
    }
    resolvePromise({ stdout: String(stdout), stderr: String(stderr), exitCode: 0 });
  });
});

function runnerEnv(): NodeJS.ProcessEnv {
  const allowed = new Set(['PATH', 'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'CI', 'LANG', 'TZ']);
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (allowed.has(key.toUpperCase()) && value !== undefined) env[key] = value;
  }
  return env;
}

function parseVitestJson(stdout: string, root: string): string[] | undefined {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end < start) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(stdout.slice(start, end + 1));
  } catch {
    return undefined;
  }
  if (!value || typeof value !== 'object' || !Array.isArray((value as { testResults?: unknown }).testResults)) return undefined;
  const tests = new Set<string>();
  for (const result of (value as { testResults: unknown[] }).testResults) {
    if (!result || typeof result !== 'object' || typeof (result as { name?: unknown }).name !== 'string') continue;
    const name = (result as { name: string }).name;
    const absolute = resolve(root, name);
    const path = relative(root, absolute).split(sep).join('/');
    if (path && path !== '..' && !path.startsWith('../') && !/^[A-Za-z]:\//.test(path)) tests.add(path);
  }
  return [...tests].sort();
}

export interface RunVitestOptions {
  root: string;
  files: readonly string[];
  requested: boolean;
  signal?: AbortSignal;
  execute?: ExecuteVitest;
}

const unavailable = (reason: string): RunnerOutcome => ({ used: false, available: false, reason, tests: [] });

/** Run Vitest related only after both the env opt-in and caller request are present. */
export async function runVitestRelated(options: RunVitestOptions): Promise<RunnerOutcome> {
  if (!options.requested) return unavailable('runner was not requested');
  if (process.env.ONNI_PROJECT_GRAPH_TOOLS !== '1') return unavailable('set ONNI_PROJECT_GRAPH_TOOLS=1 to enable the Vitest runner');
  if (options.signal?.aborted) return unavailable('runner was aborted');

  const manifest = await import('node:fs/promises').then(({ readFile }) => readFile(resolve(options.root, 'package.json'), 'utf8')).catch(() => '');
  let hasVitest = false;
  try {
    const packageJson = JSON.parse(manifest) as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> };
    hasVitest = typeof packageJson.dependencies?.vitest === 'string' || typeof packageJson.devDependencies?.vitest === 'string';
  } catch {
    return unavailable('repository package.json is missing or invalid');
  }
  const bin = resolve(options.root, 'node_modules', 'vitest', 'vitest.mjs');
  const installed = await import('node:fs/promises').then(({ access }) => access(bin).then(() => true)).catch(() => false);
  if (!hasVitest || !installed) return unavailable('Vitest is not installed in this repository');
  if (!options.files.length) return { used: false, available: true, tests: [] };

  const args = [bin, 'related', '--run', '--reporter=json', '--passWithNoTests', ...options.files];
  try {
    const result = await (options.execute ?? executeVitest)({
      cwd: options.root,
      args,
      env: runnerEnv(),
      timeoutMs: RUNNER_TIMEOUT_MS,
      maxBuffer: RUNNER_OUTPUT_CAP,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const parsed = parseVitestJson(result.stdout.slice(0, RUNNER_OUTPUT_CAP), options.root);
    if (!parsed && result.exitCode !== 0) return unavailable(`Vitest related exited with code ${result.exitCode}`);
    if (!parsed) return unavailable('Vitest related did not produce JSON test results');
    const tests = parsed.map((path): TestCandidate => ({
      path,
      confidence: 'medium',
      reason: 'selected by vitest related',
      source: 'runner',
    }));
    return { used: true, available: true, tests };
  } catch (error) {
    const detail = (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, ' ').slice(0, 200);
    return unavailable(detail || 'Vitest related could not run');
  }
}
