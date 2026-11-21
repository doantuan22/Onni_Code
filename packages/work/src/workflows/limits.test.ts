import { describe, expect, it } from 'vitest';
import type { RunRecord } from '../runs/store.ts';
import {
  carveChildLimits,
  describeHit,
  evaluateLimits,
  indexLimitTree,
  raiseLimits,
  resolveLimits,
  subtreeUsage,
  subtreeUsageIndexed,
} from './limits.ts';

const DEFAULT = { mode: 'capped', maxCostUsd: 10, maxTokens: 10_000_000, maxWallClockMinutes: 240, maxStepIterations: 30 } as const;
function run(id: string, patch: Record<string, unknown> = {}) {
  return { id, steps: [{ iterations: 1 }], tokensUsed: 0, runner: 'claude', ...patch } as never;
}

function legacySubtreeUsage(runs: Array<Pick<RunRecord, 'id' | 'costUsd' | 'tokensUsed' | 'limitUsage' | 'steps' | 'dispatch'>>, rootId: string) {
  const total = { cost: 0, tokens: 0, wallMs: 0, iterations: 0 };
  const seen = new Set([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const member = runs.find((candidate) => candidate.id === id);
    if (member) {
      total.cost += member.costUsd ?? 0;
      total.tokens += member.tokensUsed ?? 0;
      total.iterations += member.steps.reduce((sum, step) => sum + step.iterations, 0);
      if (member.id === rootId) total.wallMs = member.limitUsage?.wallMs ?? 0;
    }
    for (const child of runs) {
      if (child.dispatch?.parentRunId === id && !seen.has(child.id)) {
        seen.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return total;
}

describe('resolveLimits', () => {
  it('uses the workspace default, a clean "none", or exactly the numbers given', () => {
    expect(resolveLimits(undefined, DEFAULT)).toEqual(DEFAULT);
    expect(resolveLimits({ mode: 'default' }, DEFAULT)).toEqual(DEFAULT);
    expect(resolveLimits({ mode: 'none', maxCostUsd: 1 }, DEFAULT)).toEqual({ mode: 'none' });
    expect(resolveLimits({ mode: 'capped', maxCostUsd: 5 }, DEFAULT)).toEqual({ mode: 'capped', maxCostUsd: 5 });
  });
});

describe('evaluateLimits', () => {
  it('applies nothing in "none" mode however much is used', () => {
    const r = run('a', { limits: { mode: 'none' }, costUsd: 1e6, tokensUsed: 1e12 });
    expect(evaluateLimits(r, [r])).toBeUndefined();
  });
  it.each([
    ['cost', { costUsd: 5 }, { mode: 'capped', maxCostUsd: 5 }],
    ['tokens', { tokensUsed: 100 }, { mode: 'capped', maxTokens: 100 }],
    ['time', { limitUsage: { wallMs: 120 * 60_000 } }, { mode: 'capped', maxWallClockMinutes: 120 }],
    ['iterations', { steps: [{ iterations: 3 }, { iterations: 2 }] }, { mode: 'capped', maxStepIterations: 5 }],
  ])('hits the %s ceiling', (kind, usage, limits) => {
    const r = run('a', { ...usage, limits });
    expect(evaluateLimits(r, [r])).toMatchObject({ kind, scope: 'run' });
  });
  it('treats a blank axis as unlimited', () => {
    const r = run('a', { limits: { mode: 'capped', maxCostUsd: 5 }, tokensUsed: 1e12 });
    expect(evaluateLimits(r, [r])).toBeUndefined();
  });
  it('does not apply a USD ceiling to a backend that reports no USD', () => {
    const r = run('a', { runner: 'codex', limits: { mode: 'capped', maxCostUsd: 1, maxTokens: 50 }, costUsd: 99, tokensUsed: 10 });
    expect(evaluateLimits(r, [r])).toBeUndefined();
    const over = run('a', { runner: 'codex', limits: { mode: 'capped', maxCostUsd: 1, maxTokens: 50 }, tokensUsed: 60 });
    expect(evaluateLimits(over, [over])).toMatchObject({ kind: 'tokens' });
  });
  it('charges the whole tree against the root: two children cannot together exceed it', () => {
    const root = run('root', { limits: { mode: 'capped', maxCostUsd: 10 }, costUsd: 4, dispatch: { rootRunId: 'root' } });
    const a = run('a', { limits: { mode: 'capped', maxCostUsd: 6 }, costUsd: 3, dispatch: { rootRunId: 'root', parentRunId: 'root' } });
    const b = run('b', { limits: { mode: 'capped', maxCostUsd: 6 }, costUsd: 3.5, dispatch: { rootRunId: 'root', parentRunId: 'root' } });
    const all = [root, a, b];
    expect(subtreeUsage(all, 'root').cost).toBe(10.5);
    expect(evaluateLimits(a, all)).toMatchObject({ kind: 'cost', scope: 'tree', limit: 10 });
  });
  it('counts only the root wall-clock for the tree', () => {
    const root = run('root', { limits: { mode: 'capped', maxWallClockMinutes: 10 }, limitUsage: { wallMs: 5 * 60_000 }, dispatch: { rootRunId: 'root' } });
    const kid = run('k', { limitUsage: { wallMs: 60 * 60_000 }, dispatch: { rootRunId: 'root', parentRunId: 'root' } });
    expect(evaluateLimits(kid, [root, kid])).toBeUndefined();
  });
  it('matches the previous breadth-first subtree results from one indexed sweep snapshot', () => {
    const root = run('root', { limits: { mode: 'capped', maxCostUsd: 10 }, costUsd: 2, limitUsage: { wallMs: 1_000 }, dispatch: { rootRunId: 'root' } });
    const first = run('first', { costUsd: 3, dispatch: { rootRunId: 'root', parentRunId: 'root' } });
    const second = run('second', { costUsd: 4, dispatch: { rootRunId: 'root', parentRunId: 'root' } });
    const leaf = run('leaf', { costUsd: 5, dispatch: { rootRunId: 'root', parentRunId: 'first' } });
    const unrelated = run('unrelated', { costUsd: 99 });
    const all = [root, first, second, leaf, unrelated];
    const tree = indexLimitTree(all);

    expect(subtreeUsageIndexed(tree, root.id)).toEqual(legacySubtreeUsage(all, root.id));
    expect(tree.subtreeUsage.size).toBe(4);
    for (const member of all) {
      expect(subtreeUsageIndexed(tree, member.id)).toEqual(legacySubtreeUsage(all, member.id));
      expect(evaluateLimits(member, all, 'now', tree)).toEqual(evaluateLimits(member, all, 'now'));
    }
    expect(tree.subtreeUsage.size).toBe(all.length);
  });
});

describe('carveChildLimits', () => {
  it('inherits the mode and hands the child what the parent has left', () => {
    const parent = run('p', { limits: DEFAULT, costUsd: 4, tokensUsed: 1_000_000 });
    expect(carveChildLimits(parent, [parent])).toMatchObject({ mode: 'capped', maxCostUsd: 6, maxTokens: 9_000_000, maxWallClockMinutes: 240 });
  });
  it('lets a request tighten but never loosen', () => {
    const parent = run('p', { limits: DEFAULT, costUsd: 4 });
    expect(carveChildLimits(parent, [parent], { maxCostUsd: 2 }).maxCostUsd).toBe(2);
    expect(carveChildLimits(parent, [parent], { maxCostUsd: 500 }).maxCostUsd).toBe(6);
  });
  it('a child of an unlimited parent is unlimited; a blank axis stays blank', () => {
    expect(carveChildLimits(run('p', { limits: { mode: 'none' } }), [])).toEqual({ mode: 'none' });
    const parent = run('p', { limits: { mode: 'capped', maxTokens: 100 } });
    expect(carveChildLimits(parent, [parent])).not.toHaveProperty('maxCostUsd');
  });
});

describe('raiseLimits', () => {
  it('adds one more allowance of the axis that was hit', () => {
    const hit = { kind: 'cost', limit: 10, used: 10.4, scope: 'run', at: 'now' } as const;
    expect(raiseLimits(DEFAULT, hit)?.maxCostUsd).toBe(20.4);
    expect(raiseLimits({ mode: 'none' }, hit)).toEqual({ mode: 'none' });
    expect(describeHit(hit)).toContain('maxCostUsd');
  });
});
