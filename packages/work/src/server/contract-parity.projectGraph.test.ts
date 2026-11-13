import type { InferRequestType, InferResponseType } from 'hono/client';
import { hc } from 'hono/client';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type {
  graphImpactResponseSchema, graphRebuildBodySchema, graphRebuildResultSchema, graphStatusSchema, graphTestsResponseSchema,
} from '@onni/contract';
import type { AppType } from './app-type.ts';

/**
 * `packages/contract/src/project-graph.ts` must describe EXACTLY what the `/graph*` routes send,
 * checked in both directions (same guard as `contract-parity.automations.test.ts`).
 * Compile-time; `npm run typecheck` enforces it.
 */
describe('project graph schemas match the routes exactly', () => {
  const client = hc<AppType>('http://127.0.0.1');

  type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : 'route-is-wider') : 'schema-is-wider';
  type Assert<T extends true> = T;

  type Status200 = InferResponseType<typeof client.api.v1.graph.$get, 200>;
  type Impact200 = InferResponseType<typeof client.api.v1.graph.impact.$get, 200>;
  type Tests200 = InferResponseType<typeof client.api.v1.graph.tests.$get, 200>;
  type Rebuild200 = InferResponseType<typeof client.api.v1.graph.rebuild.$post, 200>;
  type RebuildBody = InferRequestType<typeof client.api.v1.graph.rebuild.$post>['json'];

  type _Checks = [
    Assert<Mutual<z.infer<typeof graphStatusSchema>, Status200>>,
    Assert<Mutual<z.infer<typeof graphImpactResponseSchema>, Impact200>>,
    Assert<Mutual<z.infer<typeof graphTestsResponseSchema>, Tests200>>,
    Assert<Mutual<z.infer<typeof graphRebuildResultSchema>, Rebuild200>>,
    Assert<Mutual<z.input<typeof graphRebuildBodySchema>, RebuildBody>>,
  ];

  it('is enforced by tsc, not at runtime', () => {
    const wider: Mutual<{ a: string }, { a: string; b: number }> = 'schema-is-wider';
    const narrower: Mutual<{ a: string; b: number }, { a: string }> = 'route-is-wider';
    expect([wider, narrower]).toEqual(['schema-is-wider', 'route-is-wider']);
  });
});
