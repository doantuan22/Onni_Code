import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildGraph } from './build.ts';
import { gitAvailable } from './fixture.testkit.ts';

// Golden set from docs/design/project-graph/spikes (70 files, ~1.07k hand-verified edges). Recall of `imports` and
// `reexports` is the P1 gate (>= 97%); the other kinds are measured and printed, not gated.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const goldenDir = join(repoRoot, 'docs/design/project-graph/spikes/golden');

interface GoldenEdge {
  from: string;
  to: string;
  kind: string;
  evidence: string;
}

describe('golden graph (real repo)', () => {
  it('reaches >= 97% recall on imports and reexports', async () => {
    if (!gitAvailable() || !existsSync(join(goldenDir, 'edges.json')) || !existsSync(join(repoRoot, '.git'))) return;
    const edges = JSON.parse(readFileSync(join(goldenDir, 'edges.json'), 'utf8')) as GoldenEdge[];
    const goldenFiles = new Set(JSON.parse(readFileSync(join(goldenDir, 'files.json'), 'utf8')) as string[]);

    const r = await buildGraph(repoRoot, { persist: false });
    if (!r.available) throw new Error(r.reason);
    const g = r.graph;

    const lines: string[] = [];
    const gate: Record<string, number> = {};
    for (const kind of ['imports', 'reexports', 'type-imports', 'dynamic-import']) {
      const truth = edges.filter((e) => e.kind === kind && g.fileSet.has(e.from));
      const found = truth.filter((e) => (g.forward.get(e.from) ?? []).some((x) => x.to === e.to && x.kind === kind));
      const missing = truth.filter((e) => !found.includes(e));
      // precision over the golden files only: what we extract from them that the golden set does not list
      const truthKeys = new Set(truth.map((e) => `${e.from}\0${e.to}`));
      let produced = 0;
      let confirmed = 0;
      for (const f of goldenFiles) {
        for (const x of g.forward.get(f) ?? []) {
          if (x.kind !== kind) continue;
          produced++;
          if (truthKeys.has(`${x.from}\0${x.to}`)) confirmed++;
        }
      }
      const recall = truth.length ? found.length / truth.length : 1;
      gate[kind] = recall;
      lines.push(
        `${kind.padEnd(14)} recall ${(recall * 100).toFixed(2)}% (${found.length}/${truth.length})  precision ${produced ? ((confirmed / produced) * 100).toFixed(2) : 'n/a'}% (${confirmed}/${produced})`,
      );
      for (const m of missing.slice(0, 20)) lines.push(`   MISSING ${m.from} -> ${m.to}  (${m.evidence})`);
    }
    console.info(`[project-graph golden] ${r.stats.files} files / ${r.stats.edges} edges in ${r.stats.ms} ms\n${lines.join('\n')}`);

    expect(gate.imports).toBeGreaterThanOrEqual(0.97);
    expect(gate.reexports).toBeGreaterThanOrEqual(0.97);
  }, 120_000);
});
