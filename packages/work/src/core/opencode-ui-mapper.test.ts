import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { UiEvent } from './ui-events.ts';
import {
  OPENCODE_AUTH_FAILURE_MESSAGE,
  createOpencodeUiState,
  mapOpencodeFrame,
  type OpencodeUiMapperState,
} from './opencode-ui-mapper.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '__fixtures__', 'opencode');

/** Replay a transcript exactly as the runner drives the mapper: every frame, both directions, in
 *  wire order (the header line is metadata, not wire). */
function replay(fixture: string): UiEvent[] {
  const lines = readFileSync(join(FIXTURES, `${fixture}.ndjson`), 'utf8').trim().split('\n');
  let state: OpencodeUiMapperState = createOpencodeUiState();
  const events: UiEvent[] = [];
  for (const line of lines) {
    const value = JSON.parse(line) as Record<string, unknown>;
    if ('fixture' in value) continue;
    const mapped = mapOpencodeFrame(value, state);
    state = mapped.state;
    events.push(...mapped.events);
  }
  // Round-trip: these events get persisted as NDJSON, so a stray `undefined` must fail here.
  return JSON.parse(JSON.stringify(events)) as UiEvent[];
}

const FIXTURE_NAMES = readdirSync(FIXTURES)
  .filter((file) => file.endsWith('.ndjson'))
  .map((file) => file.replace(/\.ndjson$/, ''))
  .sort();

function items(events: UiEvent[]) {
  return events.flatMap((e) =>
    e.type === 'item.started' || e.type === 'item.updated' || e.type === 'item.completed' ? [e.item] : []);
}

describe('opencode acp → v2 golden fixtures', () => {
  it('has a fixture for every scenario Step 2.3 covers', () => {
    expect(FIXTURE_NAMES).toEqual(['auth-required', 'cancel', 'malformed', 'subagent', 'tool-lifecycle']);
  });

  for (const name of FIXTURE_NAMES) {
    it(`maps ${name} exactly`, () => {
      const expected = JSON.parse(readFileSync(join(FIXTURES, `${name}.expected.json`), 'utf8')) as UiEvent[];
      expect(replay(name)).toStrictEqual(expected);
    });

    it(`${name}: the header cites the CLI version and the wire source`, () => {
      const header = JSON.parse(readFileSync(join(FIXTURES, `${name}.ndjson`), 'utf8').split('\n')[0]!) as {
        fixture?: { cli?: string; docs?: string; record?: string };
      };
      expect(header.fixture?.cli).toBe('OpenCode 2.3.0');
      expect(header.fixture?.docs).toContain('agentclientprotocol.com');
      expect(header.fixture?.record).toBe('__fixtures__/opencode/README.md');
    });
  }

  it('keeps a `pending` announcement as a PENDING tool — OpenCode sends real `in_progress`', () => {
    const events = replay('tool-lifecycle');
    const started = events.find((e) => e.type === 'item.started' && e.item.kind === 'tool');
    expect(started && started.type === 'item.started' && started.item.kind === 'tool' && started.item.status)
      .toBe('pending');
    // …then in_progress flips it to running, and it still settles.
    expect(items(events).filter((i) => i.kind === 'tool' && i.status === 'running')).not.toHaveLength(0);
    expect(items(events).filter((i) => i.kind === 'tool' && i.status === 'completed')).not.toHaveLength(0);
    expect(items(events).filter((i) => i.kind === 'tool' && i.status === 'failed')).not.toHaveLength(0);
  });

  it('reads the plan off the `todowrite` tool call, not a native plan channel', () => {
    const plans = replay('tool-lifecycle').filter((e) => e.type === 'plan.updated');
    expect(plans).toHaveLength(1);
    expect(plans[0]).toEqual({
      type: 'plan.updated',
      entries: [
        { content: 'Read calc.py', status: 'in_progress', priority: 'high' },
        { content: 'Fix add() so it returns a + b', status: 'pending', priority: 'medium' },
        { content: 'Run the checks', status: 'pending', priority: 'low' },
      ],
    });
  });

  it('reads per-turn usage off the prompt result’s top-level `usage`, directionally', () => {
    const completed = replay('tool-lifecycle').find((e) => e.type === 'turn.completed');
    expect(completed).toMatchObject({
      stopReason: 'end_turn',
      usage: { input: 13777, output: 38, total: 30041, reasoning: 98, cacheRead: 16128 },
    });
  });

  it('does not map `usage_update` — it is a context gauge, not token counts', () => {
    // `{used, size, cost}` says how full the context window is; mapping it as usage would report
    // the window size as tokens spent. See __fixtures__/opencode/README.md.
    const usage = replay('tool-lifecycle').filter((e) => e.type === 'usage.updated');
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ usage: { total: 30041 } });
  });

  it('maps a subagent delegation to a task item but does NOT nest its child tools', () => {
    // The child's `_meta["opencode/child-session"].parentID` is the ROOT session id, not the
    // delegating call's id, so there is no real parent attribution — the cards sit flat.
    const events = replay('subagent');
    const task = items(events).find((i) => i.kind === 'tool' && i.toolKind === 'task');
    expect(task?.id).toBe('call_sub_1');
    const child = items(events).find((i) => i.id === 'call_grep_1');
    expect(child).toMatchObject({ kind: 'tool', toolKind: 'search' });
    expect(child && 'parentItemId' in child).toBe(false);
    expect(task && 'parentItemId' in task).toBe(false);
  });

  it('settles a tool the cancelled turn left pending, instead of spinning forever', () => {
    const events = replay('cancel');
    const shell = items(events).filter((i) => i.id === 'call_shell_1');
    expect(shell.at(-1)).toMatchObject({ status: 'failed' });
    expect(events.filter((e) => e.type === 'turn.completed').map((e) => e.type === 'turn.completed' && e.stopReason))
      .toEqual(['cancelled', 'end_turn']);
  });

  it('turns the unauthenticated `session/new` answer into a fatal session error in onni’s words', () => {
    expect(replay('auth-required')).toEqual([
      { type: 'session.error', message: OPENCODE_AUTH_FAILURE_MESSAGE, fatal: true },
    ]);
  });

  it('renders nothing at all for the malformed and not-yet-mapped frames', () => {
    expect(replay('malformed').map((e) => e.type)).toEqual(['session.started', 'turn.started', 'usage.updated', 'turn.completed']);
  });

  it('ignores a child-session `_meta` rather than fabricating a parent', () => {
    // `parentID` naming the ROOT session is not a delegating call's id, so the mapper must not
    // turn it into a parentItemId — the tool card still appears, flat.
    let state = createOpencodeUiState();
    state = mapOpencodeFrame({ dir: 'out', frame: { jsonrpc: '2.0', id: 0, method: 'session/prompt', params: {} } }, state).state;
    const mapped = mapOpencodeFrame(
      {
        dir: 'in',
        frame: {
          method: 'session/update',
          params: {
            update: {
              sessionUpdate: 'tool_call',
              toolCallId: 'x',
              name: 'grep',
              kind: 'search',
              status: 'pending',
              _meta: { 'opencode/child-session': { parentID: 'ses_root' } },
            },
          },
        },
      },
      state,
    );
    expect(mapped.events).toHaveLength(1);
    const [started] = mapped.events;
    const item = started?.type === 'item.started' ? started.item : undefined;
    expect(item).toMatchObject({ kind: 'tool', id: 'x', status: 'pending' });
    expect(item && 'parentItemId' in item).toBe(false);
  });

  it('ignores malformed and unknown frames without throwing', () => {
    let state = createOpencodeUiState();
    state = mapOpencodeFrame({ dir: 'out', frame: { jsonrpc: '2.0', id: 0, method: 'session/prompt', params: {} } }, state).state;
    for (const value of [
      null,
      42,
      'text',
      [],
      {},
      { dir: 'sideways', frame: {} },
      { dir: 'in' },
      { dir: 'in', frame: null },
      { dir: 'in', frame: { method: 'session/update' } },
      { dir: 'in', frame: { method: 'session/update', params: { update: { sessionUpdate: 'future_kind', x: 1 } } } },
      { dir: 'in', frame: { method: 'session/update', params: { update: { sessionUpdate: 'agent_message_chunk', content: null } } } },
      { dir: 'in', frame: { method: 'session/update', params: { update: { sessionUpdate: 'tool_call' } } } },
      { dir: 'in', frame: { method: 'session/update', params: { update: { sessionUpdate: 'plan', entries: 'nope' } } } },
      { dir: 'in', frame: { id: 12345, result: {} } },
      { dir: 'in', frame: { method: 'some/future_notification', params: {} } },
    ]) {
      const mapped = mapOpencodeFrame(value, state);
      expect(mapped.events).toEqual([]);
    }
  });
});
