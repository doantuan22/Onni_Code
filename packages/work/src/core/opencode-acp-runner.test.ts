import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AgentEvent, AgentSession } from './agent-runner.ts';
import { createRunner } from './runner-factory.ts';
import { OPENCODE_AUTH_FAILURE_MESSAGE } from './opencode-ui-mapper.ts';
import { OpencodeAcpRunner, buildOpencodeArgs, opencodeExitMessage } from './opencode-acp-runner.ts';
import type { UiEvent } from './ui-events.ts';

/**
 * The `opencode` runner over the bundled `scripts/mock-opencode-acp.mjs`, whose frames mirror the
 * wire recorded live from `opencode acp` 2.3.0 (`__fixtures__/opencode/README.md`).
 */
const MOCK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'mock-opencode-acp.mjs');

let cwd: string;
beforeEach(() => {
  cwd = realpathSync(mkdtempSync(join(tmpdir(), 'onni-opencode-run-')));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function collect() {
  const events: AgentEvent[] = [];
  const ui: UiEvent[] = [];
  return { events, ui, onEvent: (e: AgentEvent) => events.push(e), onUiEvent: (e: UiEvent) => ui.push(e) };
}

function waitFor(predicate: () => boolean, ms = 10_000): Promise<void> {
  return new Promise((resolveWait, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) return resolveWait();
      if (Date.now() - started > ms) return reject(new Error('timed out waiting'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('buildOpencodeArgs', () => {
  it('starts only the ACP server — model, worktree and MCP are config-file channels, not flags', () => {
    expect(buildOpencodeArgs()).toEqual(['acp']);
  });
});

describe('opencodeExitMessage', () => {
  it('translates an authentication failure into the line the server latches on', () => {
    expect(opencodeExitMessage(1, 'error: Authentication required')).toBe(OPENCODE_AUTH_FAILURE_MESSAGE);
  });

  it('otherwise reports the code and the tail of stderr, inventing no exit-code meanings', () => {
    expect(opencodeExitMessage(7, 'line one\nline two')).toBe('OpenCode exited with code 7 — line one | line two');
    expect(opencodeExitMessage(null, '')).toBe('OpenCode exited with code null');
  });

  it('says a mid-turn exit dropped the prompt, so a code 0 does not read as success', () => {
    expect(opencodeExitMessage(0, '', true)).toBe('OpenCode quit mid-turn without answering the prompt (exit code 0)');
  });
});

describe('OpencodeAcpRunner — one turn over the mock', () => {
  const saved = process.env.ONNI_DRY_RUN;
  afterEach(() => {
    if (saved === undefined) delete process.env.ONNI_DRY_RUN;
    else process.env.ONNI_DRY_RUN = saved;
  });

  it('ONNI_DRY_RUN=1 swaps in the bundled mock and streams both protocols to one done', async () => {
    process.env.ONNI_DRY_RUN = '1';
    const argsFile = join(cwd, 'args.json');
    const c = collect();
    const session = new OpencodeAcpRunner().startSession(
      {
        userPrompt: 'fix the login redirect',
        systemPrompt: 'Be terse.',
        cwd,
        model: 'anthropic/claude-sonnet-5-5',
        env: { ONNI_MOCK_OPENCODE_ARGS_FILE: argsFile },
      },
      c.onEvent,
      { autoEndAfterFirstTurn: true, onUiEvent: c.onUiEvent },
    );
    const result = await session.result;

    const types = c.events.map((e) => e.type);
    expect(types).toContain('session');
    expect(types).toContain('text');
    expect(types).toContain('tool-call');
    expect(types).toContain('tool-result');
    expect(types).toContain('token-usage');
    expect(types.filter((t) => t === 'turn-end')).toHaveLength(1);
    expect(types.filter((t) => t === 'done')).toHaveLength(1);
    expect(types).not.toContain('error');
    // OpenCode reports usage on the prompt result, so it is not invented — and no note is needed.
    expect(result.tokensUsed).toBe(120);
    expect(c.events.some((e) => e.type === 'note' && e.message.includes('usage not reported'))).toBe(false);
    // The system prompt rides in the first message (ACP has no native channel), so the mock echoes it.
    expect(result.text).toContain('Be terse.');
    expect(result.text).toContain('fix the login redirect');
    expect(result.sessionId).toBe('1700000000000_mockOp_acp');

    const spawned = JSON.parse(readFileSync(argsFile, 'utf8')) as { argv: string[]; cwd: string };
    // The model is NOT a flag: `session/set_model` answers -32601, so it rides OPENCODE_CONFIG_CONTENT.
    expect(spawned.argv).toEqual(['acp']);
    // The session's working directory is the spawn cwd, so the agent's tools are rooted in it.
    expect(spawned.cwd).toBe(cwd);

    expect(c.ui.slice(0, 2).map((e) => e.type)).toEqual(['session.started', 'turn.started']);
    expect(c.ui).toContainEqual(expect.objectContaining({ type: 'session.started', backend: 'opencode', cwd }));
    expect(c.ui).toContainEqual(expect.objectContaining({ type: 'turn.completed', stopReason: 'end_turn' }));
    expect(c.ui.at(-1)).toEqual({ type: 'session.ended', reason: 'end_turn' });
  });

  it('names a tool from its wire `name` and follows pending → running → completed', async () => {
    process.env.ONNI_DRY_RUN = '1';
    const c = collect();
    await new OpencodeAcpRunner().startSession({ userPrompt: 'go', cwd }, c.onEvent, {
      autoEndAfterFirstTurn: true,
      onUiEvent: c.onUiEvent,
    }).result;

    const tools = c.ui.flatMap((e) => (e.type === 'item.started' && e.item.kind === 'tool' ? [e.item.name] : []));
    expect(tools).toEqual(['read']);
    const statuses = c.ui.flatMap((e) =>
      (e.type === 'item.started' || e.type === 'item.updated' || e.type === 'item.completed') && e.item.kind === 'tool'
        ? [e.item.status]
        : []);
    expect(statuses[0]).toBe('pending');
    expect(statuses).toContain('running');
    expect(statuses.at(-1)).toBe('completed');
  });

  it('is what the factory builds for `opencode` — never Claude by fallthrough', () => {
    expect(createRunner('opencode')).toBeInstanceOf(OpencodeAcpRunner);
    expect(createRunner('opencode').backend).toBe('opencode');
  });
});

describe('OpencodeAcpRunner — permissions, failures and cancel', () => {
  it('auto-approves a permission request ONCE, never "always", and notes it', async () => {
    // `allow_always` would write a standing rule into the user's own OpenCode config, so it is not
    // picked; `allow_once` first keeps the run moving without persisting anything.
    const c = collect();
    const session = new OpencodeAcpRunner({ bin: MOCK }).startSession(
      { userPrompt: 'go', cwd, env: { ONNI_MOCK_OPENCODE_ASK_PERMISSION: '1' } },
      c.onEvent,
      { autoEndAfterFirstTurn: true, onUiEvent: c.onUiEvent },
    );
    const result = await session.result;

    expect(c.events).toContainEqual({
      type: 'note',
      message: 'OpenCode asked permission for read; auto-approved (allow_once) — onni runs OpenCode in auto mode',
    });
    // The choice really reached the agent, and the turn continued to a normal end.
    expect(result.text).toContain('[permission:allow_once]');
    expect(c.ui).toContainEqual(expect.objectContaining({ type: 'turn.completed', stopReason: 'end_turn' }));
  });

  it('surfaces an unauthenticated agent as a fatal, actionable session error', async () => {
    const c = collect();
    const session = new OpencodeAcpRunner({ bin: MOCK }).startSession(
      { userPrompt: 'go', cwd, env: { ONNI_MOCK_OPENCODE_UNAUTHENTICATED: '1' } },
      c.onEvent,
      { onUiEvent: c.onUiEvent },
    );
    await session.result;

    expect(c.events).toContainEqual({ type: 'error', message: OPENCODE_AUTH_FAILURE_MESSAGE });
    expect(c.ui).toContainEqual({ type: 'session.error', message: OPENCODE_AUTH_FAILURE_MESSAGE, fatal: true });
    expect(c.ui.at(-1)).toEqual({ type: 'session.ended', reason: 'error' });
  });

  it('a CLI that quits cleanly mid-turn on its own says the prompt went unanswered', async () => {
    const c = collect();
    const session = new OpencodeAcpRunner({ bin: MOCK }).startSession(
      { userPrompt: 'go', cwd, env: { ONNI_MOCK_OPENCODE_EXIT_MID_TURN: '1' } },
      c.onEvent,
      { onUiEvent: c.onUiEvent },
    );
    await session.result;
    expect(c.events).toContainEqual({ type: 'error', message: 'OpenCode quit mid-turn without answering the prompt (exit code 0)' });
  });

  it('reports a missing binary as an install instruction, never as a silent no-op', async () => {
    const session = new OpencodeAcpRunner({ bin: join(cwd, 'definitely-not-opencode') }).startSession(
      { userPrompt: 'go', cwd },
      () => {},
      { autoEndAfterFirstTurn: true },
    );
    await expect(session.result).rejects.toThrow(/not found on PATH.*opencode auth login/s);
  });

  it('times out, kills the child, and says so', async () => {
    const c = collect();
    const session = new OpencodeAcpRunner({ bin: MOCK, timeoutMs: 1 }).startSession({ userPrompt: 'go', cwd }, c.onEvent, {
      onUiEvent: c.onUiEvent,
    });
    await session.result;
    expect(c.events.some((e) => e.type === 'error' && /timed out/.test(e.message))).toBe(true);
    expect(session.open).toBe(false);
  });
});

describe('OpencodeAcpRunner — session lifecycle', () => {
  it('queues a follow-up behind the in-flight ACP turn without claiming a receipt', async () => {
    const c = collect();
    let session!: AgentSession;
    let followUpAccepted: boolean | undefined;
    let turnEnds = 0;
    let resolveTwoTurns!: () => void;
    const twoTurnsEnded = new Promise<void>((resolve) => {
      resolveTwoTurns = resolve;
    });

    session = new OpencodeAcpRunner({ bin: MOCK }).startSession(
      { userPrompt: 'first', cwd },
      (event) => {
        c.events.push(event);
        if (event.type === 'tool-call' && followUpAccepted === undefined) {
          // ACP cannot steer the active turn; the runner holds this prompt until that turn ends.
          followUpAccepted = session.sendMessage([{ type: 'text', text: 'manager direction' }]);
        }
        if (event.type === 'turn-end' && ++turnEnds === 2) resolveTwoTurns();
      },
      { onUiEvent: c.onUiEvent },
    );

    try {
      expect(session.sendMessageWithReceipt).toBeUndefined();
      await twoTurnsEnded;
      expect(followUpAccepted).toBe(true);
      expect(c.events.some((event) => event.type === 'text' && event.text.includes('OpenCode mock answering turn 2: manager direction'))).toBe(true);
      expect(c.ui.filter((event) => event.type === 'turn.started')).toHaveLength(2);
    } finally {
      session.end();
      await session.result;
    }
  });

  it('keeps the same ACP session across a follow-up, in order', async () => {
    const c = collect();
    const session = new OpencodeAcpRunner({ bin: MOCK }).startSession({ userPrompt: 'first', cwd }, c.onEvent, {
      onUiEvent: c.onUiEvent,
    });
    await waitFor(() => c.events.filter((e) => e.type === 'turn-end').length === 1);
    expect(session.sendMessage([{ type: 'text', text: 'second' }])).toBe(true);
    await waitFor(() => c.events.filter((e) => e.type === 'turn-end').length === 2);
    session.end();
    const result = await session.result;

    expect(c.ui.filter((e) => e.type === 'session.started')).toHaveLength(1);
    expect(c.ui.filter((e) => e.type === 'turn.started').map((e) => e.type === 'turn.started' && e.turnId))
      .toEqual(['turn_1', 'turn_2']);
    expect(result.text).toContain('turn 2');
    // `usage.updated` is cumulative for the session: 120 then 120 + 220.
    expect(result.tokensUsed).toBe(340);
  });

  it('refuses a message once the session is closed', async () => {
    const c = collect();
    const session = new OpencodeAcpRunner({ bin: MOCK }).startSession({ userPrompt: 'hi', cwd }, c.onEvent, {
      autoEndAfterFirstTurn: true,
    });
    await session.result;
    expect(session.open).toBe(false);
    expect(session.sendMessage([{ type: 'text', text: 'too late' }])).toBe(false);
  });

  it('resumes an existing session with session/load instead of minting a new one', async () => {
    const c = collect();
    const session = new OpencodeAcpRunner({ bin: MOCK }).startSession(
      { userPrompt: 'continue', cwd, resume: true, sessionId: '1700000000001_resume_acp' },
      c.onEvent,
      { autoEndAfterFirstTurn: true, onUiEvent: c.onUiEvent },
    );
    const result = await session.result;

    expect(result.sessionId).toBe('1700000000001_resume_acp');
    expect(c.events).toContainEqual({ type: 'session', sessionId: '1700000000001_resume_acp' });
    expect(c.events.some((e) => e.type === 'note' && e.message.includes('could not resume'))).toBe(false);
  });

  it('cancel settles the turn as cancelled and leaves a usable result', async () => {
    const c = collect();
    const session = new OpencodeAcpRunner({ bin: MOCK }).startSession({ userPrompt: 'long job', cwd }, c.onEvent, {
      onUiEvent: c.onUiEvent,
    });
    await waitFor(() => c.ui.some((e) => e.type === 'item.started' && e.item.kind === 'tool'));
    session.interrupt();
    await session.result;

    const completed = c.ui.filter((e) => e.type === 'turn.completed');
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ stopReason: 'cancelled' });
    // onni asked for the stop, so its own teardown signal is not reported as an agent failure.
    expect(c.events.filter((e) => e.type === 'error')).toEqual([]);
  });

  it('end() during a turn is onni closing the session, not an agent failure', async () => {
    const c = collect();
    const session = new OpencodeAcpRunner({ bin: MOCK }).startSession(
      { userPrompt: 'go', cwd, env: { ONNI_MOCK_OPENCODE_PROMPT_HANGS: '1' } },
      c.onEvent,
      { onUiEvent: c.onUiEvent },
    );
    await waitFor(() => c.ui.some((e) => e.type === 'turn.started'));
    session.end();
    await session.result;

    expect(c.events.filter((e) => e.type === 'error')).toEqual([]);
    expect(c.ui.filter((e) => e.type === 'session.error')).toEqual([]);
    expect(c.ui).toContainEqual(expect.objectContaining({ type: 'turn.completed', stopReason: 'cancelled' }));
  });
});
