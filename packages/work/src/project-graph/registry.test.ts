import { describe, expect, it } from 'vitest';
import { graphToolsEnabled, ProjectGraphRegistry, REBUILD_MIN_INTERVAL_MS } from './registry.ts';

describe('ProjectGraphRegistry', () => {
  it('returns one service per root and never builds on creation', async () => {
    const r = new ProjectGraphRegistry();
    expect(r.service('/a')).toBe(r.service('/a'));
    expect(r.service('/a')).not.toBe(r.service('/b'));
    expect((await r.service('/a').getStatus()).state).toBe('empty');
  });

  it('throttles a second rebuild inside the window', async () => {
    let t = 1_000;
    const r = new ProjectGraphRegistry(() => t);
    const first = await r.rebuild('/nonexistent-root-for-graph');
    expect('throttled' in first).toBe(false);
    const second = await r.rebuild('/nonexistent-root-for-graph');
    expect(second).toMatchObject({ started: false, throttled: true });
    t += REBUILD_MIN_INTERVAL_MS;
    const third = await r.rebuild('/nonexistent-root-for-graph');
    expect('throttled' in third).toBe(false);
  });

  it('gates the runner on ONNI_PROJECT_GRAPH_TOOLS=1', () => {
    expect(graphToolsEnabled({})).toBe(false);
    expect(graphToolsEnabled({ ONNI_PROJECT_GRAPH_TOOLS: '1' })).toBe(true);
  });
});
