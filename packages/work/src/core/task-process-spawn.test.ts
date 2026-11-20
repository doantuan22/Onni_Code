import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { spawnTaskProcess } from './task-process-spawn.ts';

async function output(child: ReturnType<typeof spawn>) {
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
  child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
  child.stdin?.on('error', () => {});
  child.stdin?.end();
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('Windows task executable resolution (2026-11-20 launch audit)', () => {
  it('resolves a bare native command on the child PATH before entering the job', async () => {
    if (process.platform !== 'win32') return;
    const child = spawnTaskProcess(path.basename(process.execPath), ['-e', 'process.stdout.write("ready")'], {
      cwd: tmpdir(), env: { ...process.env, PATH: path.dirname(process.execPath), ONNI_TASK_ID: 'launch-audit-native' },
    });
    expect(await output(child)).toEqual({ code: 0, stdout: 'ready', stderr: '' });
  }, 15_000);

  it('unwraps a relative npm shim in the child cwd and preserves literal arguments', async () => {
    if (process.platform !== 'win32') return;
    const dir = mkdtempSync(path.join(tmpdir(), 'onni launch '));
    try {
      writeFileSync(path.join(dir, 'agent.js'), 'process.stdout.write(JSON.stringify(process.argv.slice(2)))');
      writeFileSync(path.join(dir, 'agent.cmd'), '@echo off\r\nnode "%~dp0\\agent.js" %*');
      const args = ['space here', 'a&b', '$(echo nope)', 'a"b', 'trailing\\'];
      const result = await output(spawnTaskProcess('./agent.cmd', args, {
        cwd: dir, env: { ...process.env, ONNI_TASK_ID: 'launch-audit-shim' },
      }));
      expect(result).toEqual({ code: 0, stdout: JSON.stringify(args), stderr: '' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it('keeps native error codes and launch context without exposing argv', async () => {
    if (process.platform !== 'win32') return;
    const script = fileURLToPath(new URL('../../scripts/windows-job-spawn.ps1', import.meta.url));
    const file = path.join(tmpdir(), 'onni-definitely-missing-agent.exe');
    const payload = Buffer.from(JSON.stringify({ file, args: ['private-prompt-marker'], cwd: process.cwd() })).toString('base64');
    const result = await output(spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
      env: { ...process.env, ONNI_INTERNAL_TASK_JOB_PAYLOAD: payload }, windowsHide: true,
    }));
    expect(result.code).toBe(125);
    expect(result.stderr).toContain('win32=2');
    expect(result.stderr).toContain(file);
    expect(result.stderr).toContain(process.cwd());
    expect(result.stderr).not.toContain('private-prompt-marker');
  }, 15_000);
});
