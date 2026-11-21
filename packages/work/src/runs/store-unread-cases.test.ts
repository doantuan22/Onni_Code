import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RunStore, type RunRecord } from './store.ts';

// Load test-only golden data without expanding the service's TypeScript root or public API.
const { unreadCases } = await import(
  new URL('../../../api-client/src/fixtures/unread-cases.ts', import.meta.url).href
) as { unreadCases: readonly { name: string; run: Partial<RunRecord>; unread: boolean }[] };

describe('markAllRead shared timestamp cases (survey Part A §3.5)', () => {
  it.each(unreadCases)('$name', ({ run: input, unread }) => {
    const dataDir = mkdtempSync(join(tmpdir(), 'onni-unread-cases-'));
    const store = RunStore.open(dataDir);
    try {
      const run = store.createRun({ title: 'unread case', workflow: 'quick-task', task: 'test', steps: [] });
      // Load the exact fixture, including transitional/stale fields that updateRun normalizes.
      Object.assign(run, input);
      expect(store.markAllRead()).toBe(unread ? 1 : 0);
      expect(run.seenAt).toEqual(unread ? expect.any(String) : input.seenAt);
      expect(store.markAllRead()).toBe(0);
    } finally {
      store.flush();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
