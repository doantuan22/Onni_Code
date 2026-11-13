// Event-loop impact of a full graph build while a fake stream (setInterval 10 ms -> NDJSON file) runs.
// Scenarios per candidate: no batching vs batches of 10 / 50 files with `await setImmediate` between batches.
// Usage: GRAPH_SPIKE_DIR=<dir> node eventloop.mjs [--only oxc-raw,regex] [--batches 10,50]
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { setImmediate as yieldLoop } from 'node:timers/promises';
import { createWriteStream, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listCorpus, loadSources, makeAll, makeResolver, normalize } from './common.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const only = opt('--only')?.split(',') ?? ['regex', 'lexer-raw', 'oxc-raw', 'ts-pre', 'tree-sitter'];
const batches = [0, ...opt('--batches', '10,50').split(',').map(Number)]; // 0 = no batching

const files = listCorpus(), fileSet = new Set(files), sources = loadSources(files);
const resolve_ = makeResolver(fileSet);
const dir = mkdtempSync(join(tmpdir(), 'onni-eventloop-'));
const ms = (ns) => ns / 1e6;

async function scenario(cand, batch) {
  const out = createWriteStream(join(dir, 'stream.ndjson'));
  const h = monitorEventLoopDelay({ resolution: 10 });
  let last = performance.now(), maxGap = 0, ticks = 0;
  const timer = setInterval(() => {
    const now = performance.now(); maxGap = Math.max(maxGap, now - last); last = now; ticks++;
    out.write(JSON.stringify({ t: Date.now(), seq: ticks, kind: 'text', text: 'x'.repeat(64) }) + '\n');
  }, 10);
  await yieldLoop(50); // let the stream settle
  h.enable(); maxGap = 0; last = performance.now();
  const t0 = performance.now();
  let edges = 0;
  for (let i = 0; i < files.length; i++) {
    try { edges += normalize(files[i], cand.extract(files[i], sources.get(files[i])), resolve_).length; } catch { /* counted elsewhere */ }
    if (batch && (i + 1) % batch === 0) await yieldLoop();
  }
  const build = performance.now() - t0;
  await yieldLoop(30);
  h.disable(); clearInterval(timer); out.end();
  return { build, p50: ms(h.percentile(50)), p99: ms(h.percentile(99)), max: ms(h.max), maxGap, ticks, edges };
}

console.log(`corpus ${files.length} files; stream = setInterval 10 ms -> NDJSON; histogram resolution 10 ms (values include the 10 ms timer period)`);
console.log('| candidate | batch | build ms | loop delay p50 / p99 / max ms | worst stream tick gap ms | ticks |');
console.log('|---|---|---|---|---|---|');
for (const cand of await makeAll({ only })) {
  for (const b of batches) {
    if (b === batches[0]) await scenario(cand, 50); // warm-up (JIT, wasm, raw buffer), not reported
    const r = await scenario(cand, b);
    console.log(`| ${cand.id} | ${b || 'none'} | ${r.build.toFixed(0)} | ${r.p50.toFixed(1)} / ${r.p99.toFixed(1)} / ${r.max.toFixed(1)} | ${r.maxGap.toFixed(1)} | ${r.ticks} |`);
  }
}
rmSync(dir, { recursive: true, force: true });
