// Build time / RSS / incremental update per candidate over all 897 production files.
// Each candidate runs in its own child process so RSS peaks do not leak between them.
// Usage: GRAPH_SPIKE_DIR=<dir> node bench.mjs [--only oxc,regex] [--runs 3]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listCorpus, loadSources, makeAll, runCandidate, mib } from './common.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

if (args[0] === '--child') {
  const id = args[1];
  const runs = Number(opt('--runs', 3));
  const files = listCorpus(), fileSet = new Set(files);
  const t0 = performance.now();
  const sources = loadSources(files);
  const readMs = performance.now() - t0;
  const [cand] = await makeAll({ only: [id] });
  global.gc?.();
  const rssBase = process.memoryUsage().rss; // libs loaded, sources in memory, nothing parsed yet
  let peak = rssBase;
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 5);
  const times = [];
  let last;
  for (let r = 0; r < runs; r++) {
    const s = performance.now();
    last = runCandidate(cand, sources, fileSet, files);
    times.push(performance.now() - s);
    peak = Math.max(peak, process.memoryUsage().rss);
  }
  // incremental: re-extract one mid-size file (hot path of a watcher), median of 30
  const f = 'packages/work/src/workflows/run.ts';
  const inc = [];
  for (let i = 0; i < 30; i++) { const s = performance.now(); runCandidate(cand, sources, fileSet, [f]); inc.push(performance.now() - s); }
  clearInterval(timer);
  inc.sort((a, b) => a - b);
  const ru = process.resourceUsage();
  console.log(JSON.stringify({
    id, name: cand.name, files: files.length, readMs, coldMs: times[0], warmMs: Math.min(...times.slice(1).concat(times[0])), runs: times,
    edges: last.edges.length, errorFiles: last.errors.length, rssBase, rssPeakSampled: peak, maxRssResource: ru.maxRSS * 1024,
    incrementalMs: { file: f, bytes: sources.get(f).length, median: inc[15], max: inc[29] },
  }));
  process.exit(0);
}

const only = opt('--only')?.split(',');
const all = only ?? ['regex', 'lexer-raw', 'lexer-strip', 'oxc-lite', 'oxc', 'oxc-raw', 'ts-pre', 'tree-sitter'];
const rows = [];
for (const id of all) {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child', id, '--runs', opt('--runs', '3')], { encoding: 'utf8', env: process.env, timeout: 300000 });
  if (r.status !== 0) { console.log(id, 'FAILED', (r.stderr || '').split('\n').slice(0, 3).join(' | ')); continue; }
  rows.push(JSON.parse(r.stdout.trim().split('\n').pop()));
}
console.log(`corpus: ${rows[0]?.files} files, read ${rows[0]?.readMs.toFixed(0)} ms (excluded from times)`);
console.log('| candidate | run1 (cold) ms | runs 2..N ms | RSS base MiB | RSS peak MiB (sampled / maxRSS) | err files | incr. run.ts ms (median/max) |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.id} | ${r.coldMs.toFixed(0)} | ${r.runs.slice(1).map((x) => x.toFixed(0)).join(' / ')} | ${mib(r.rssBase)} | ${mib(r.rssPeakSampled)} / ${mib(r.maxRssResource)} | ${r.errorFiles} | ${r.incrementalMs.median.toFixed(2)} / ${r.incrementalMs.max.toFixed(2)} |`);
