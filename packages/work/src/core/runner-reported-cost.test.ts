import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentEvent } from './agent-runner.ts';
import { ClaudeCliRunner } from './claude-cli-runner.ts';
import { PiRunner } from './pi-runner.ts';

// Exercise the public runner seam with wire-shaped reports from local stub processes.
// A cost of zero is a report; absent, malformed, and negative costs are not.
describe.each(['claude', 'pi'] as const)('%s reported cost', (backend) => {
  it.each([
    { label: 'zero', cost: 0, expected: [0] },
    { label: 'positive', cost: 0.125, expected: [0.125] },
    { label: 'missing', cost: undefined, expected: [] },
    { label: 'null', cost: null, expected: [] },
    { label: 'negative', cost: -1, expected: [] },
    { label: 'string', cost: '0', expected: [] },
  ])('preserves $label without fabricating a report', async ({ cost, expected }) => {
    const dir = mkdtempSync(join(tmpdir(), 'onni-cost-wire-'));
    const bin = join(dir, 'stub.mjs');
    const frame = backend === 'claude'
      ? { type: 'result', subtype: 'success', ...(cost === undefined ? {} : { total_cost_usd: cost }) }
      : { type: 'message_end', message: { role: 'assistant', usage: { input: 1, output: 1, ...(cost === undefined ? {} : { cost: { total: cost } }) } } };
    const source = `
process.stdin.once('data', () => {
  console.log(${JSON.stringify(JSON.stringify(frame))});
  process.stdin.destroy();
});
`;
    writeFileSync(bin, '#!/usr/bin/env node\n' + source, { mode: 0o700 });
    try {
      const Runner = backend === 'claude' ? ClaudeCliRunner : PiRunner;
      const events: AgentEvent[] = [];
      await new Runner({ bin, timeoutMs: 5_000 }).run({ cwd: dir, userPrompt: 'report usage' }, (event) => events.push(event));
      expect(events.filter((event) => event.type === 'error')).toEqual([]);
      expect(events.filter((event) => event.type === 'cost').map((event) => event.usd)).toEqual(expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
