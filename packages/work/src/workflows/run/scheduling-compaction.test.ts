import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RunRecord } from '../../runs/store.ts';
import { armContextCompaction } from './scheduling.ts';
import type { SchedulingContext } from './internal-types.ts';

const run = (extra: Partial<RunRecord> = {}): RunRecord => ({
  id: 'r1', title: 'Ship it', workflow: 'quick-task', task: 'Prompt is too long ship it',
  status: 'failed', error: 'Prompt is too long', createdAt: '2026-09-04T09:00:00Z',
  tokensUsed: 12, archived: false, branch: 'onni/r1', runner: 'claude',
  steps: [{ id: 'task', name: 'Work', kind: 'agent', status: 'failed', iterations: 1, tokensUsed: 12, sessionId: 's1', backend: 'claude' }],
  ...extra,
});

type Harness = {
  continueRun: ReturnType<typeof vi.fn>;
  updateRun: ReturnType<typeof vi.fn>;
  appendEvent: ReturnType<typeof vi.fn>;
};

function harness(overrides: Record<string, unknown> = {}): SchedulingContext & Harness {
  return {
    semaphore: { autoResumeOnUsageLimit: () => true },
    continueRun: vi.fn(() => ({ ok: true })),
    store: { updateRun: vi.fn(), appendEvent: vi.fn() },
    ...overrides,
  } as unknown as SchedulingContext & Harness;
}

const saved = process.env.ONNI_CONTEXT_COMPACTION;
afterEach(() => {
  if (saved === undefined) delete process.env.ONNI_CONTEXT_COMPACTION;
  else process.env.ONNI_CONTEXT_COMPACTION = saved;
});

describe('armContextCompaction', () => {
  it('hands the failed run a compacted continuation on the same model and stamps the counter', () => {
    process.env.ONNI_CONTEXT_COMPACTION = '1';
    const context = harness();
    const result = armContextCompaction(context, run());
    expect(result).toBe(true);
    expect(context.continueRun).toHaveBeenCalledWith('r1', { compact: true });
    expect(context.store.updateRun).toHaveBeenCalledWith('r1', { autoResumeAttempts: 1 });
    expect(context.store.appendEvent).toHaveBeenCalledWith('r1', {
      type: 'lifecycle',
      message: 'context window exceeded — compacting the conversation and continuing on claude',
    });
  });

  it('is off unless the exact opt-in spelling is set', () => {
    const context = harness();
    expect(armContextCompaction(context, run())).toBe(false);
    process.env.ONNI_CONTEXT_COMPACTION = '0';
    expect(armContextCompaction(harness(), run())).toBe(false);
    process.env.ONNI_CONTEXT_COMPACTION = 'true';
    expect(armContextCompaction(harness(), run())).toBe(false);
    expect(context.continueRun).not.toHaveBeenCalled();
  });

  it('does nothing when auto-resume is switched off', () => {
    process.env.ONNI_CONTEXT_COMPACTION = '1';
    const context = harness({ semaphore: { autoResumeOnUsageLimit: () => false } });
    expect(armContextCompaction(context, run())).toBe(false);
    expect(context.continueRun).not.toHaveBeenCalled();
  });

  it('does nothing when the run has no session to leave behind', () => {
    process.env.ONNI_CONTEXT_COMPACTION = '1';
    const context = harness();
    expect(armContextCompaction(context, run({ steps: [] }))).toBe(false);
    expect(context.continueRun).not.toHaveBeenCalled();
  });

  it('does nothing for an archived run', () => {
    process.env.ONNI_CONTEXT_COMPACTION = '1';
    const context = harness();
    expect(armContextCompaction(context, run({ archived: true }))).toBe(false);
    expect(context.continueRun).not.toHaveBeenCalled();
  });

  it('compacts at most once per run — a later stop waits like any other', () => {
    process.env.ONNI_CONTEXT_COMPACTION = '1';
    const context = harness();
    expect(armContextCompaction(context, run({ autoResumeAttempts: 1 }))).toBe(false);
    expect(context.continueRun).not.toHaveBeenCalled();
  });

  it('does not stamp the counter when the continuation refuses', () => {
    process.env.ONNI_CONTEXT_COMPACTION = '1';
    const context = harness({ continueRun: vi.fn(() => ({ ok: false, error: 'no agent session to resume' })) });
    expect(armContextCompaction(context, run())).toBe(false);
    expect(context.store.updateRun).not.toHaveBeenCalled();
  });
});
