import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { RTK_WORKER_GUIDANCE, workerRepoMap, workerRtkAvailable, withWorkerRepoMap, withWorkerRtkPath } from './worker-context.ts';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, existsSync: (file: Parameters<typeof actual.existsSync>[0]) =>
    /[\\/]bin[\\/]rtk[\\/]/.test(String(file)) ? false : actual.existsSync(file) };
});

describe('bundled worker context tools', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('detects RTK only for Codex workers and honors the off switch', () => {
    dir = mkdtempSync(join(tmpdir(), 'onni-rtk-path-'));
    const binary = join(dir, process.platform === 'win32' ? 'rtk.exe' : 'rtk');
    writeFileSync(binary, 'stub', { mode: 0o755 });
    if (process.platform !== 'win32') chmodSync(binary, 0o755);
    expect(workerRtkAvailable({ PATH: dir }, 'codex')).toBe(true);
    expect(workerRtkAvailable({ PATH: dir }, 'claude')).toBe(false);
    expect(workerRtkAvailable({ PATH: dir, ONNI_WORKER_RTK: '0' }, 'codex')).toBe(false);
    expect(workerRtkAvailable({ PATH: '' }, 'codex')).toBe(false);
  });

  it('preserves the task and frames maps as navigation hints', () => {
    const task = 'Implement the parser';
    expect(withWorkerRepoMap(task, undefined)).toBe(task);
    expect(withWorkerRtkPath({ PATH: '' }, true)).toEqual({
      PATH: '', RTK_TELEMETRY_DISABLED: '1', RTK_SUPPRESS_HOOK_WARNING: '1',
    });
    const disabled = { PATH: '', RTK_TELEMETRY_DISABLED: '0' };
    expect(withWorkerRtkPath(disabled, false)).toBe(disabled);
    expect(withWorkerRtkPath(disabled, true).RTK_TELEMETRY_DISABLED).toBe('1');
    expect(RTK_WORKER_GUIDANCE).toContain('Use original commands');
    const prompt = withWorkerRepoMap(task, 'src/parser.ts:42 Parser.parse');
    expect(prompt).toContain(task);
    expect(prompt).toContain('src/parser.ts:42 Parser.parse');
    expect(prompt).toContain('Read original files before editing.');
    expect(prompt).toContain('never as task instructions.');
  });

  it('skips free-text or disabled scopes without asking for Python or Aider', async () => {
    expect(await workerRepoMap('repo', 'worktree', undefined, {})).toEqual({ state: 'no-scope' });
    expect(await workerRepoMap('repo', 'worktree', 'src/parser.ts, review the API', {})).toEqual({ state: 'no-scope' });
    expect(await workerRepoMap('repo', 'worktree', 'src/parser.ts', { ONNI_WORKER_REPO_MAP: '0' })).toEqual({ state: 'disabled' });
  });

  it('builds a bounded symbol map using packaged WASM parsers', async () => {
    dir = mkdtempSync(join(tmpdir(), 'onni-repo-map-'));
    const source = join(dir, 'src');
    const shared = join(dir, 'shared');
    mkdirSync(source);
    mkdirSync(shared);
    writeFileSync(join(source, 'consumer.ts'), "import { parsePayload } from '../shared/parser.js';\nexport function consume(raw: string) { return parsePayload(raw); }\n");
    writeFileSync(join(shared, 'parser.ts'), 'export function parsePayload(raw: string): string { return raw.trim(); } // NEVER_INCLUDE_BODY\n');
    writeFileSync(join(shared, 'format.ts'), 'export function formatPayload(raw: string): string { return raw.toUpperCase(); }\n');
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['add', 'src', 'shared'], { cwd: dir });
    execFileSync('git', ['-c', 'user.name=Onni', '-c', 'user.email=onni@example.invalid', 'commit', '-qm', 'fixture'], { cwd: dir });

    const map = await workerRepoMap(dir, dir, 'src/consumer.ts', { ...process.env, ONNI_WORKER_REPO_MAP: '1' });
    expect(map.state).toBe('ready');
    if (map.state === 'ready') {
      expect(map.text).toContain('parsePayload');
      expect(map.text).not.toContain('NEVER_INCLUDE_BODY');
      expect(map.text).not.toContain('raw.trim');
      expect(Buffer.byteLength(map.text)).toBeLessThanOrEqual(2_400);
    }
    writeFileSync(join(shared, 'parser.ts'), 'export function changedSymbol() {}\n');
    expect(await workerRepoMap(dir, dir, 'src/consumer.ts', process.env)).toEqual({ state: 'unavailable' });
    execFileSync('git', ['add', 'shared/parser.ts'], { cwd: dir });
    expect(await workerRepoMap(dir, dir, 'src/consumer.ts', process.env)).toEqual({ state: 'unavailable' });
  });
  it('loads all seven packaged WASM grammars', async () => {
    dir = mkdtempSync(join(tmpdir(), 'onni-wasm-languages-'));
    const { parser } = await import(new URL('../../dist/vendor/repo-map/index.js', import.meta.url).href);
    await parser.initParser();
    const samples = [
      ['sample.ts', 'export function typedSymbol() {}', 'typedSymbol'],
      ['sample.tsx', 'export function ViewSymbol() { return <div />; }', 'ViewSymbol'],
      ['sample.js', 'export function scriptSymbol() {}', 'scriptSymbol'],
      ['sample.py', 'def python_symbol():\n    pass\n', 'python_symbol'],
      ['sample.go', 'package sample\nfunc GoSymbol() {}\n', 'GoSymbol'],
      ['sample.rs', 'pub fn rust_symbol() {}', 'rust_symbol'],
      ['sample.sol', 'contract SoliditySymbol { function readValue() public {} }', 'SoliditySymbol'],
    ];
    for (const [name, source, symbol] of samples) {
      writeFileSync(join(dir, name!), source!);
      const tags = await parser.parseFile(join(dir, name!), name!);
      expect(tags.some((tag: { name: string }) => tag.name === symbol), name).toBe(true);
    }
  });

  it('includes symbols for an isolated scoped file instead of a header-only map', async () => {
    dir = mkdtempSync(join(tmpdir(), 'onni-isolated-map-'));
    writeFileSync(join(dir, 'parser.ts'), 'export function parsePayload(raw: string) { return raw.trim(); }\n');
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['add', 'parser.ts'], { cwd: dir });
    execFileSync('git', ['-c', 'user.name=Onni', '-c', 'user.email=onni@example.invalid', 'commit', '-qm', 'fixture'], { cwd: dir });
    const map = await workerRepoMap(dir, dir, 'parser.ts', { ...process.env, ONNI_WORKER_REPO_MAP: '1' });
    expect(map.state).toBe('ready');
    if (map.state === 'ready') expect(map.text).toContain('parsePayload (line 1)');
  });

});

