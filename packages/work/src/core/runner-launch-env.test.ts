import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpencodeAcpRunner } from './opencode-acp-runner.ts';
import { CopilotAcpRunner } from './copilot-acp-runner.ts';
import { ClineAcpRunner } from './cline-acp-runner.ts';
import { JunieRunner } from './junie-runner.ts';
import { AntigravityRunner } from './antigravity-runner.ts';

const calls = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', async original => ({
  ...await original<typeof import('node:child_process')>(),
  spawn: (...args: unknown[]) => { calls.spawn(...args); throw new Error('audit stopped before launch'); },
}));
afterEach(() => { vi.unstubAllEnvs(); calls.spawn.mockClear(); });

describe('runner executable lookup uses the child environment (A3)', () => {
  it('rejects a full Antigravity command that exceeds Windows limits even with a short prompt (A5)', () => {
    if (process.platform !== 'win32') return;
    expect(() => new AntigravityRunner({ bin: 'agy-audit' }).startSession({
      cwd: process.cwd(), userPrompt: 'short', permissionLevel: 'allow-rules',
      bashAllowlist: ['echo ' + 'x'.repeat(33000)],
    })).toThrow(/command line.*32767/);
    expect(calls.spawn).not.toHaveBeenCalled();
  });
  it.each([
    ['opencode', OpencodeAcpRunner], ['copilot', CopilotAcpRunner], ['cline', ClineAcpRunner],
    ['junie', JunieRunner], ['agy', AntigravityRunner],
  ] as const)('%s selects the child PATH instead of the engine PATH', (name, Runner) => {
    if (process.platform !== 'win32') return;
    const dir = mkdtempSync(path.join(tmpdir(), 'onni-env-audit-'));
    const parent = path.join(dir, 'parent'); const child = path.join(dir, 'child');
    mkdirSync(parent); mkdirSync(child);
    writeFileSync(path.join(parent, `${name}.exe`), 'fixture');
    writeFileSync(path.join(child, `${name}.exe`), 'fixture');
    vi.stubEnv('PATH', parent); vi.stubEnv('ONNI_DRY_RUN', '0');
    try {
      const runner = new Runner();
      expect(() => runner.startSession({ cwd: dir, userPrompt: 'unused', env: { PATH: child } })).toThrow('audit stopped before launch');
      const [file, , options] = calls.spawn.mock.calls[0] ?? [];
      expect(file).toBe(path.join(child, `${name}.exe`));
      expect(options.env.PATH).toBe(child);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
