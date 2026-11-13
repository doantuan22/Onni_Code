// Scores tree-sitter Python/Go extraction against spikes/golden/fixtures/{python,go}/expected-edges.json.
// Usage: GRAPH_SPIKE_DIR=<dir> node fixtures.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PG, key } from './common.mjs';
import { loadTreeSitter, pyEdges, goEdges } from './treesitter.mjs';

const FX = join(PG, 'spikes/golden/fixtures');
const load = (dir, ext) => new Map(readdirSyncDeep(join(FX, dir)).filter((f) => f.endsWith(ext)).map((f) => [f, readFileSync(join(FX, dir, f), 'utf8')]));
function readdirSyncDeep(root, rel = '') {
  return readdirSync(join(root, rel), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? readdirSyncDeep(root, rel ? `${rel}/${e.name}` : e.name) : [rel ? `${rel}/${e.name}` : e.name]);
}
const ts = await loadTreeSitter();
console.log('versions', JSON.stringify(ts.versions), 'ABI', JSON.stringify(ts.abi));
const cases = [
  ['python', pyEdges(ts, load('python', '.py'))],
  ['go', goEdges(ts, load('go', '.go'), /^module\s+(\S+)/m.exec(readFileSync(join(FX, 'go/go.mod'), 'utf8'))[1])],
];
for (const [lang, found] of cases) {
  const exp = JSON.parse(readFileSync(join(FX, lang, 'expected-edges.json'), 'utf8'));
  const E = new Set(exp.map(key)), F = new Set(found.map(key));
  const tp = [...F].filter((k) => E.has(k)).length;
  console.log(`${lang}: expected ${E.size}, found ${F.size}, tp ${tp}, precision ${(tp / F.size * 100).toFixed(1)}%, recall ${(tp / E.size * 100).toFixed(1)}%`);
  for (const k of E) if (!F.has(k)) console.log('  MISSING', k.replace(/\0/g, ' | '));
  for (const k of F) if (!E.has(k)) console.log('  EXTRA  ', k.replace(/\0/g, ' | '));
}
