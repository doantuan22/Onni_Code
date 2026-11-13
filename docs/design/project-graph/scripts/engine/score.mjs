// Precision/recall per kind on the 70 golden files.
// Usage: GRAPH_SPIKE_DIR=<dir> node score.mjs [--only oxc,regex] [--json] [--diff <id>] [--lenient-pkg]
import { listCorpus, loadSources, goldenFiles, goldenEdges, makeAll, runCandidate, score, pct } from './common.mjs';
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('--only')?.split(',');
const corpus = listCorpus(), fileSet = new Set(corpus);
const lenient = args.includes('--lenient-pkg'); // collapse every edge to '@onni/*' into kind package-dep (golden labels multi-line ones 'imports')
const fixPkg = (es) => (lenient ? es.map((e) => (e.to.startsWith('@onni/') ? { ...e, kind: 'package-dep' } : e)) : es);
const gFiles = goldenFiles(), golden = fixPkg(goldenEdges());
const sources = loadSources(corpus);
const cands = await makeAll({ only });
const result = {};
for (const c of cands) {
  const { edges, errors } = runCandidate(c, sources, fileSet, gFiles);
  const s = score(fixPkg(edges), golden);
  result[c.id] = { name: c.name, errorFiles: errors.length, errors: errors.slice(0, 5), rows: s.rows };
  if (opt('--diff') === c.id) { console.log('MISSING', s.missing.slice(0, 40)); console.log('EXTRA', s.extra.slice(0, 40)); }
}
if (args.includes('--json')) { console.log(JSON.stringify(result, null, 1)); process.exit(0); }
const kinds = ['imports', 'type-imports', 'reexports', 'dynamic-import', 'ext', 'package-dep', 'unresolved', 'ALL'];
console.log(`golden: ${gFiles.length} files, ${golden.length} edges; corpus ${corpus.length} files`);
console.log('| kind | ' + cands.map((c) => c.id + ' P / R').join(' | ') + ' |');
console.log('|---|' + cands.map(() => '---').join('|') + '|');
for (const k of kinds) console.log(`| ${k} | ` + cands.map((c) => { const r = result[c.id].rows[k]; return r ? `${pct(r.precision)} / ${pct(r.recall)} (tp${r.tp} fp${r.fp} fn${r.fn})` : '—'; }).join(' | ') + ' |');
for (const c of cands) console.log(`${c.id}: files with error = ${result[c.id].errorFiles}`, result[c.id].errors[0] ?? '');
