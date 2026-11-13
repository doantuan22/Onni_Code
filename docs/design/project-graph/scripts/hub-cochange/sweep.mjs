#!/usr/bin/env node
// Bounded S5 sweep. Instruments one R1 replay pass so all variants share the same commits/graphs.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../../../');
const replayPath = resolve(repo, 'docs/design/project-graph/scripts/replay/replay.mjs');
const protoPath = resolve(repo, 'docs/design/project-graph/scripts/proto/lib.mjs');
const budgetMs = Number(process.env.HUB_SWEEP_BUDGET_MS ?? 3_600_000);
const started = Date.now();
const tmp = mkdtempSync(join(tmpdir(), 'onni-hub-cochange-'));
const output = join(tmp, 'replay.json');
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
};

function instrument(source) {
  let out = source.replace("'../proto/lib.mjs'", JSON.stringify(pathToFileURL(protoPath).href));
  out = out.replace(
    'const lx = new Set(coRows(p.seeds, {}).map((r) => r.file));',
    `const lx = new Set(coRows(p.seeds, {}).map((r) => r.file));
    let hubGrid = [], variants = [];
    if (p.name === 'A: 1 seed') {
      variants = [];
      const role = (f) => isTest(f) ? 'test' : /\\.(json|ya?ml|toml)$/i.test(f) ? 'config' : 'code';
      const usable = filterCommits(prior, { maxFiles: Number.MAX_SAFE_INTEGER, exists: (f) => fileSet.has(f) });
      const caps = [90, 95, 99].map((p) => ({ p, n: percentile(usable.map((c) => c.files.length), p) }));
      for (const cap of caps) for (const halfLife of [0, 90, 180]) for (const splitTest of [false, true]) for (const splitConfig of [false, true])
        for (const support of [2, 3, 5]) for (const confidence of [0.2, 0.3, 0.5]) {
          const eligible = usable.filter((c) => c.files.length <= cap.n);
          const seedCommits = eligible.filter((c) => c.files.includes(p.seeds[0]));
          const anchor = c.date || 0;
          const weight = (c) => halfLife ? 2 ** (-Math.max(0, anchor - c.date) / (halfLife * 86400)) : 1;
          const denom = seedCommits.reduce((n, c) => n + weight(c), 0);
          const candidates = new Map();
          for (const c of seedCommits) for (const b of c.files) {
            if (b === p.seeds[0] || !fileSet.has(b)) continue;
            const rb = role(b);
            if (splitTest && rb === 'test' || splitConfig && rb === 'config' || rb === 'doc') continue;
            if (!candidates.has(b)) candidates.set(b, 0);
            candidates.set(b, candidates.get(b) + weight(c));
          }
          const pred = new Set([...candidates].filter(([, sup]) => sup + 1e-9 >= support && denom > 0 && sup / denom + 1e-9 >= confidence).map(([f]) => f));
          const hits = [...pred].filter((f) => truth.has(f)).length;
          variants.push({ capPercentile: cap.p, maxFiles: cap.n, halfLifeDays: halfLife || null, splitTest, splitConfig, support, confidence,
            precision: pred.size ? hits / pred.size : null, recall: truth.size ? hits / truth.size : null, size: pred.size,
            importOverlap: [...pred].filter((f) => raw.has(f)).length, edges: pred.size });
        }
      hubGrid = [];
      for (const percent of [90, 95, 99]) for (const minDegree of [10, 20, 40]) {
        const cut = hubThreshold(graph, { percent, minDegree });
        const hubImp = computeImpact(graph, { files: p.seeds, fileSet, workspaces, hub: {}, hubThreshold: cut });
        const dirs = new Set(hubImp.layers.L1.hubs.flatMap((h) => h.groups.map((g) => g.group)));
        const direct = new Set(hubImp.layers.L1.files.map((r) => r.file).filter((f) => !isTest(f)));
        const score = scoreImpact(direct, dirs, truth);
        const degs = [...graph.reverse.keys()].map((f) => dependentsOf(graph, f).length);
        const hubCount = degs.filter((n) => n >= cut).length;
        const hubFiles = [...graph.reverse.keys()].filter((f) => dependentsOf(graph, f).length >= cut);
        const impactSizes = hubFiles.map((f) => dependentsOf(graph, f).length).sort((a,b) => a-b);
        hubGrid.push({ percent, minDegree, threshold: cut, hubCount, precision: score.precision, recall: score.recall, size: score.size,
          impactMedian: percentile(impactSizes, 50), impactP90: percentile(impactSizes, 90) });
      }
    }`
  );
  out = out.replace(
    'impactRows.push({ set, proto: p.name, hash: c.hash, m, hubSeeds: hubSeedCount, truth: truth.size, seeds: p.seeds });',
    'impactRows.push({ set, proto: p.name, hash: c.hash, m, hubSeeds: hubSeedCount, truth: truth.size, seeds: p.seeds, ...(p.name === \'A: 1 seed\' ? { hubGrid, variants } : {}) });'
  );
  return out;
}

try {
  const source = instrument(readFileSync(replayPath, 'utf8'));
  const script = join(tmp, 'replay.mjs');
  writeFileSync(script, source);
  const remaining = budgetMs - (Date.now() - started);
  execFileSync(process.execPath, [script, '--root', repo, '--limit', '600', '--val', '0.3', '--max-files', '30',
    '--budget-s', String(Math.max(1, Math.floor(remaining / 1000))), '--boot', '0', '--json', output],
  { timeout: Math.min(3_600_000, remaining), stdio: ['ignore', 'ignore', 'inherit'] });
  const replay = JSON.parse(readFileSync(output, 'utf8'));
  const summarize = (rows) => {
    const avg = (xs) => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((a,b) => a+b, 0) / v.length : null; };
    const quant = (xs, q) => percentile(xs, q * 100);
    const configs = new Map();
    for (const row of rows) for (const x of row.variants) {
      const key = [x.capPercentile, x.halfLifeDays ?? 0, x.splitTest, x.splitConfig, x.support, x.confidence].join('/');
      (configs.get(key) ?? configs.set(key, { ...x, precision: [], recall: [], size: [], overlap: [], caps: [] }).get(key)).precision.push(x.precision);
      const a = configs.get(key); a.recall.push(x.recall); a.size.push(x.size); a.overlap.push(x.edges ? x.importOverlap / x.edges : 0); a.caps.push(x.maxFiles);
    }
    const coChange = [...configs.values()].map((x) => ({ ...x, precision: avg(x.precision), recall: avg(x.recall),
      maxFilesMedian: quant(x.caps, .5), maxFilesP90: quant(x.caps, .9), medianSize: quant(x.size, .5), p90Size: quant(x.size, .9), importOverlapRate: avg(x.overlap), commits: x.size.length }));
    const hubs = new Map();
    for (const row of rows) for (const x of row.hubGrid) {
      const key = `${x.percent}/${x.minDegree}`;
      (hubs.get(key) ?? hubs.set(key, { ...x, precision: [], recall: [], size: [], impactMedian: [], impactP90: [] }).get(key)).precision.push(x.precision);
      const a = hubs.get(key); a.recall.push(x.recall); a.size.push(x.size); a.impactMedian.push(x.impactMedian); a.impactP90.push(x.impactP90);
    }
    const hub = [...hubs.values()].map((x) => ({ percent: x.percent, minDegree: x.minDegree, threshold: x.threshold, hubCount: x.hubCount,
      precision: avg(x.precision), recall: avg(x.recall), medianSize: quant(x.size, .5), p90Size: quant(x.size, .9),
      impactMedian: avg(x.impactMedian), impactP90: avg(x.impactP90), commits: x.size.length }));
    return { hub, coChange };
  };
  const results = { measuredAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    node: process.version, elapsedMs: Date.now() - started, train: summarize(replay.impactRows.filter((r) => r.set === 'train' && r.proto === 'A: 1 seed')),
    validation: summarize(replay.impactRows.filter((r) => r.set === 'val' && r.proto === 'A: 1 seed')) };
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
} finally { rmSync(tmp, { recursive: true, force: true }); }
