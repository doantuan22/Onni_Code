import { describe, expect, it } from 'vitest';
import {
  graphImpactQuerySchema,
  graphStatusSchema,
  graphTestsQuerySchema,
} from '@onni/contract';

describe('project graph contract', () => {
  it('normalizes a single impact file into an array', () => {
    expect(graphImpactQuerySchema.parse({ file: 'packages/work/src/index.ts' })).toEqual({
      file: ['packages/work/src/index.ts'],
      maxItems: 200,
    });
  });

  it('accepts a run subject and runner query opt-in', () => {
    expect(graphTestsQuerySchema.parse({ runId: 'run-123', runner: 'true', maxItems: '10' })).toEqual({
      runId: 'run-123',
      runner: true,
      maxItems: 10,
    });
  });

  it('accepts the disabled status', () => {
    expect(graphStatusSchema.parse({ state: 'disabled', reason: 'ONNI_PROJECT_GRAPH is not enabled' })).toEqual({
      state: 'disabled',
      reason: 'ONNI_PROJECT_GRAPH is not enabled',
    });
  });

  it.each([
    { file: '/absolute/path.ts' },
    { file: 'packages/../secret.ts' },
    {},
    { file: 'packages/work/src/index.ts', maxItems: 0 },
    { file: 'packages/work/src/index.ts', maxItems: 1001 },
  ])('rejects invalid graph impact query %#', (query) => {
    expect(graphImpactQuerySchema.safeParse(query).success).toBe(false);
  });
});
