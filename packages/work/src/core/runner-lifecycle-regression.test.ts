import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JunieRunner } from './junie-runner.ts';
import { PiRunner } from './pi-runner.ts';
import type { AgentEvent } from './agent-runner.ts';

const hook = vi.hoisted(() => ({ child: null as unknown }));
vi.mock('node:child_process', async (original) => ({
  ...await original<typeof import('node:child_process')>(),
  spawn: () => hook.child,
}));

function fakeChild() {
  const signals: NodeJS.Signals[] = [];
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    exitCode: null as number | null, signalCode: null as NodeJS.Signals | null,
    killed: false,
    kill: (signal: NodeJS.Signals) => { signals.push(signal); child.killed = true; return true; },
  });
  const exit = (code: number) => {
    child.exitCode = code;
    child.stdout.end(); child.stderr.end();
    child.emit('exit', code, null); child.emit('close', code, null);
  };
  hook.child = child as unknown as ChildProcessWithoutNullStreams;
  return { child, signals, exit };
}
afterEach(() => { hook.child = null; vi.useRealTimers(); });

describe('Junie EOF closes bootstrap RPCs (A1)', () => {
  it.each(['initialize', 'authenticate', 'session/new'])('settles after dying during %s', async (method) => {
    const fake = fakeChild();
    let input = '';
    fake.child.stdin.on('data', (chunk: Buffer) => {
      input += chunk.toString();
      let newline: number;
      while ((newline = input.indexOf('\n')) >= 0) {
        const request = JSON.parse(input.slice(0, newline)) as { id: number; method: string };
        input = input.slice(newline + 1);
        // A real process cannot exit synchronously inside stdin.write().
        queueMicrotask(() => {
          if (request.method === method) { fake.child.stderr.write('fixture startup failure'); fake.exit(7); }
          else fake.child.stdout.write(JSON.stringify({ id: request.id, result: request.method === 'initialize' ? { authMethods: [{ id: 'test' }] } : {} }) + '\n');
        });
      }
    });
    const session = new JunieRunner({ bin: 'junie-audit', timeoutMs: 0 }).startSession({ cwd: process.cwd(), userPrompt: 'unused' });
    try {
      const result = await Promise.race([
        session.result.then(() => 'resolved', (error: Error) => error.message),
        new Promise<string>(resolve => setTimeout(() => resolve('still pending'), 500)),
      ]);
      expect(result).toMatch(/exited with code 7 before answering.*fixture startup failure/);
    } finally { session.hardStop?.(); }
  });
});

describe('Pi termination supervision (A2)', () => {
  it('bounds an unsolicited stdout close and never signals an exited child', async () => {
    vi.useFakeTimers();
    const fake = fakeChild();
    const session = new PiRunner({ bin: 'pi-audit', timeoutMs: 0 }).startSession({ cwd: process.cwd(), userPrompt: 'unused' });
    fake.child.stdout.end();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fake.signals).toEqual(['SIGTERM']);
    fake.exit(143);
    await session.result;
    session.interrupt(); session.end(); session.hardStop?.();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fake.signals).toEqual(['SIGTERM']);
  });

  it.each(['end', 'interrupt', 'hardStop', 'timeout'] as const)('escalates %s after stdout EOF when SIGTERM is ignored', async (mode) => {
    vi.useFakeTimers();
    const fake = fakeChild();
    const session = new PiRunner({ bin: 'pi-audit', timeoutMs: mode === 'timeout' ? 20 : 0 })
      .startSession({ cwd: process.cwd(), userPrompt: 'unused' });
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(20);
    else if (mode === 'hardStop') session.hardStop?.();
    else session[mode]();
    if (mode === 'end') await vi.advanceTimersByTimeAsync(10_000);
    expect(fake.signals).toEqual(['SIGTERM']);
    fake.child.stdout.end();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fake.signals).toEqual(['SIGTERM', 'SIGKILL']);
    fake.exit(137);
    await session.result;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fake.signals).toHaveLength(2);
  });

  it('treats an Onni-originated signal exit as cancellation and leaves real failures authoritative', async () => {
    for (const intentional of [true, false]) {
      const fake = fakeChild();
      const events: AgentEvent[] = [];
      const session = new PiRunner({ bin: 'pi-audit', timeoutMs: 0 }).startSession(
        { cwd: process.cwd(), userPrompt: 'unused' }, event => events.push(event),
      );
      if (intentional) session.interrupt();
      fake.exit(143);
      if (intentional) {
        await session.result;
        expect(events.some(event => event.type === 'error')).toBe(false);
        expect(events).toContainEqual(expect.objectContaining({ type: 'note', message: expect.stringContaining('terminated by onni') }));
      } else await expect(session.result).rejects.toThrow('exited with code 143');
    }
  });
});
