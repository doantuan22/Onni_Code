import { describe, expect, it, vi } from 'vitest';
import type { RunRecord } from '../../runs/store.ts';
import { sweepLimits } from './scheduling.ts';

describe('sweepLimits', () => {
  it('uses one indexed run snapshot for wall-clock updates and limit evaluation', () => {
    const run = {
      id: 'run',
      status: 'running',
      runner: 'claude',
      steps: [{ iterations: 0 }],
    } as RunRecord;
    const store = {
      listRuns: vi.fn(() => [run]),
      updateRun: vi.fn((_id: string, patch: Partial<RunRecord>) => Object.assign(run, patch)),
    };
    const context = { store, lastLimitTick: { value: 0 } } as never;

    sweepLimits(context, 1_000);

    expect(store.listRuns).toHaveBeenCalledTimes(1);
    expect(run.limitUsage).toEqual({ wallMs: 1_000 });
  });
});
