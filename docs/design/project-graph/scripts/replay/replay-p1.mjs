#!/usr/bin/env node
// G-B trên engine SẢN PHẨM (P1): cùng khung với replay.mjs (R1), nhưng đồ thị/impact/chọn test lấy từ
// packages/work/src/project-graph/*.ts. Mỗi commit đo CẢ HAI engine (prototype R1 và sản phẩm) trên cùng sự thật → so cặp.
// Engine .ts được import thẳng bằng Node (--experimental-transform-types, tự chạy lại với cờ này); không cần npm ci/build.
// Adapter mỏng: dựng ProjectGraph từ `git ls-tree` + blob ở commit CHA (không checkout, không sửa code sản phẩm).
//
//   node replay-p1.mjs [--root .] [--limit 600] [--val 0.3] [--max-files 30] [--budget-s 900] [--boot 1000]
//                      [--engine <dir project-graph>] [--json out.json] [--md out.md] [--no-cache]

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

if (!process.execArgv.includes('--experimental-transform-types')) {
  const r = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

import * as R1 from '../proto/lib.mjs';
const { FILE_CAP, isDenied, isTest, isCode, percentile, readGitLog, gitHead, groupDir, filterCommits, coChangeFor } = R1;

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const ROOT = String(opt('root', process.cwd()));
const LIMIT = Number(opt('limit', 600));
const VAL_FRAC = Number(opt('val', 0.3));
const MAX_FILES = Number(opt('max-files', 30));
const BUDGET_MS = Number(opt('budget-s', 900)) * 1000;
const BOOT = Number(opt('boot', 1000));
const ENGINE = String(opt('engine', fileURLToPath(new URL('../../../../../packages/work/src/project-graph/', import.meta.url))));
const t0 = Date.now();

const imp = (f) => import(pathToFileURL(join(ENGINE, f)).href);
const [G, I, S, X, RS, TY, DN] = await Promise.all(['graph.ts', 'impact.ts', 'tests-select/graph-select.ts', 'extract.ts', 'resolve.ts', 'types.ts', 'denylist.ts'].map(imp));
const P_FILE_CAP = TY.FILE_CAP;

const git = (args, input) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 30, input, stdio: ['pipe', 'pipe', 'pipe'] });

// ---------------------------------------------------------------- blob cache
const CACHE_FILE = join(tmpdir(), 'onni-graph-replay-p1-cache.v1.json');
let cache = { r1: {}, p1: {}, text: {} }; // r1/p1: blob -> {i:[[spec,kind,line]],d} | null(too big); text: blob -> raw manifest/tsconfig text | null
if (!opt('no-cache', false) && existsSync(CACHE_FILE)) { try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch { /* fresh */ } }
let blobReads = 0, extractMs = 0;

function fillBlobs(items) { // items: {sha, text:boolean}[]
  const need = items.filter((i) => !(i.text ? i.sha in cache.text : i.sha in cache.p1));
  for (let k = 0; k < need.length; k += 1500) {
    const chunk = need.slice(k, k + 1500);
    const out = git(['cat-file', '--batch'], chunk.map((c) => c.sha).join('\n') + '\n');
    let pos = 0;
    for (const c of chunk) {
      const nl = out.indexOf(10, pos);
      const [, type, sizeStr] = out.toString('utf8', pos, nl).split(' ');
      const size = Number(sizeStr);
      if (type !== 'blob') { pos = nl + 1; if (c.text) cache.text[c.sha] = null; else { cache.p1[c.sha] = null; cache.r1[c.sha] = null; } continue; }
      const body = out.subarray(nl + 1, nl + 1 + size);
      pos = nl + 1 + size + 1;
      blobReads++;
      if (c.text) { cache.text[c.sha] = size > P_FILE_CAP ? null : body.toString('utf8'); continue; }
      if (size > FILE_CAP && size > P_FILE_CAP) { cache.p1[c.sha] = null; cache.r1[c.sha] = null; continue; }
      const src = body.toString('utf8');
      const te = performance.now();
      const a = R1.extractImports(src);
      cache.r1[c.sha] = size > FILE_CAP ? null : { i: a.map((m) => [m.specifier, m.kind, m.line]), d: a.unresolvedDynamic };
      const b = X.extractImports(src);
      cache.p1[c.sha] = size > P_FILE_CAP ? null : { imports: b.imports, unresolvedDynamic: b.unresolvedDynamic };
      extractMs += performance.now() - te;
    }
  }
}

// ---------------------------------------------------------------- tree at a commit
const treeMemo = new Map();
function treeAt(rev) {
  if (treeMemo.has(rev)) return treeMemo.get(rev);
  const raw = git(['ls-tree', '-r', '-z', rev]).toString('utf8');
  const files = new Map();
  for (const rec of raw.split('\0')) {
    if (!rec) continue;
    const tab = rec.indexOf('\t');
    const [, type, sha] = rec.slice(0, tab).split(' ');
    const path = rec.slice(tab + 1);
    if (type === 'blob' && !isDenied(path) && !DN.isDenied(path)) files.set(path, sha);
  }
  if (treeMemo.size > 4) treeMemo.delete(treeMemo.keys().next().value);
  treeMemo.set(rev, files);
  return files;
}

const timing = { r1: [], p1: [] };

/** Both graphs at `rev`. P1 mirrors build.ts: all files are nodes, code files get records, big files are `unparsed`. */
function graphsAt(rev) {
  const files = treeAt(rev);
  const fileSet = new Set(files.keys());
  const paths = [...files.keys()];
  const codePaths = paths.filter(isCode);
  const shallow = paths.filter((f) => f.split('/').length <= 4);
  const manifestP1 = shallow.filter((f) => /(^|\/)package\.json$/.test(f));
  const tsconfigP1 = shallow.filter((f) => /(^|\/)tsconfig[^/]*\.json$/.test(f));
  const manifestR1 = paths.filter((f) => /(^|\/)package\.json$/.test(f) && f.split('/').length <= 3);
  fillBlobs([...new Set([...manifestP1, ...tsconfigP1, ...manifestR1])].map((p) => ({ sha: files.get(p), text: true })));
  fillBlobs(codePaths.map((p) => ({ sha: files.get(p), text: false })));

  // ---- R1 prototype graph (identical to replay.mjs)
  let ta = performance.now();
  const jsonR1 = (p) => { const t = cache.text[files.get(p)]; if (t == null) return null; try { const j = JSON.parse(t); return { name: j.name, exports: j.exports, main: j.main }; } catch { return null; } };
  const wsR1 = R1.buildWorkspaceMap(manifestR1.map((p) => ({ path: p, json: jsonR1(p) })));
  const aliasesR1 = fileSet.has('packages/web/vite.config.ts') ? [{ prefix: '@/', dir: 'packages/web/src' }] : [];
  const ctxR1 = { fileSet, workspaces: wsR1, aliases: aliasesR1 };
  const reverse = new Map(), forward = new Map();
  let unresolved = 0, unresolvedDynamic = 0;
  for (const p of codePaths) {
    const rec = cache.r1[files.get(p)];
    if (!rec) continue;
    unresolvedDynamic += rec.d;
    for (const [specifier, kind, line] of rec.i) {
      const r = R1.resolveSpecifier(specifier, p, ctxR1);
      if (r.type === 'file') {
        if (r.to === p) continue;
        const e = { from: p, to: r.to, kind, line };
        (reverse.get(r.to) ?? reverse.set(r.to, []).get(r.to)).push(e);
        (forward.get(p) ?? forward.set(p, []).get(p)).push(e);
      } else if (r.type === 'unresolved') unresolved++;
    }
  }
  const proto = { reverse, forward, unresolved, unresolvedDynamic, edges: [] };
  timing.r1.push(performance.now() - ta);

  // ---- P1 product graph
  ta = performance.now();
  const parse = (p) => { const t = cache.text[files.get(p)]; return t == null ? null : RS.parseJsonc(t); };
  const workspaces = RS.buildWorkspaceMap(manifestP1.map((path) => ({ path, json: parse(path) })));
  const aliases = tsconfigP1.flatMap((path) => RS.aliasesFromTsconfig(path, parse(path)));
  const graph = new G.ProjectGraph(workspaces, aliases);
  graph.addNodes(paths);
  for (const p of codePaths) {
    const rec = cache.p1[files.get(p)];
    if (!rec) graph.markUnparsed(p);
    else graph.setRecord(p, { hash: files.get(p), imports: rec.imports, unresolvedDynamic: rec.unresolvedDynamic });
  }
  timing.p1.push(performance.now() - ta);
  return { proto, graph, fileSet, workspacesR1: wsR1 };
}

// ---------------------------------------------------------------- commit list
const all = readGitLog(ROOT, LIMIT).reverse();
const parents = new Map(git(['rev-list', '--no-merges', '--parents', '-n', String(LIMIT), 'HEAD']).toString('utf8').split('\n').filter(Boolean).map((l) => { const [h, p] = l.split(' '); return [h, p]; }));
const splitAt = Math.floor(all.length * (1 - VAL_FRAC));
const dropped = { 'no parent (root)': 0, 'docs/config only (no code file)': 0, [`too large (> ${MAX_FILES} files)`]: 0, 'no usable seed': 0, 'time budget': 0 };
const lockfile = (f) => /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock)$/.test(f);

// ---------------------------------------------------------------- metrics
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a) => percentile(a, 50);
function score(pred, truth) {
  const hit = [...truth].filter((t) => pred.has(t)).length;
  return { size: pred.size, recall: truth.size ? hit / truth.size : NaN, precision: pred.size ? hit / pred.size : NaN, hit };
}
function scoreImpact(files, groupDirs, truth) {
  const fileHit = [...truth].filter((t) => files.has(t));
  const dirHit = [...truth].filter((t) => files.has(t) || groupDirs.has(groupDir(t)));
  const items = files.size + groupDirs.size;
  const hitItems = fileHit.length + [...groupDirs].filter((d) => [...truth].some((t) => groupDir(t) === d && !files.has(t))).length;
  return { size: items, files: files.size, recall: fileHit.length / truth.size, recallDir: dirHit.length / truth.size, precision: items ? hitItems / items : NaN };
}
const SNAP = { head: null, builtAt: 'replay', stale: false };
const dirKey = (d) => (d === '.' ? '(root)' : d);
const whyIncomplete = (res) => {
  const w = [];
  if (res.truncated) w.push('truncated');
  if (res.coverage.notInGraph.length) w.push('notInGraph');
  if (res.coverage.unresolvedImports) w.push('unresolved');
  if (res.coverage.unparsedFiles) w.push('unparsed');
  return w;
};

// ---------------------------------------------------------------- replay
const impactRows = [], testRows = [], testAllRows = [], completeRows = [];
const hubThr = [], hubSizes = [], graphStats = [], tImpact = [];
let analysed = 0;

for (let idx = 0; idx < all.length; idx++) {
  if (Date.now() - t0 > BUDGET_MS) { dropped['time budget'] += all.length - idx; break; }
  const c = all[idx];
  const parent = parents.get(c.hash);
  const set = idx < splitAt ? 'train' : 'val';
  if (!parent) { dropped['no parent (root)']++; continue; }
  const rawFiles = c.files.filter((f) => !isDenied(f) && !lockfile(f));
  if (c.files.length > MAX_FILES) { dropped[`too large (> ${MAX_FILES} files)`]++; continue; }
  const { proto, graph, fileSet, workspacesR1 } = graphsAt(parent);
  const codeChanged = rawFiles.filter(isCode);
  const seedsAll = codeChanged.filter((f) => !isTest(f) && fileSet.has(f));
  const truthTests = new Set(rawFiles.filter((f) => isTest(f) && fileSet.has(f)));
  const addedTests = rawFiles.filter((f) => isTest(f) && !fileSet.has(f)).length;
  if (!codeChanged.length) { dropped['docs/config only (no code file)']++; continue; }
  if (!seedsAll.length) { dropped['no usable seed']++; continue; }
  analysed++;
  graphStats.push({ files: graph.fileCount, edges: graph.edgeTotal, unparsed: graph.unparsed.size });
  hubThr.push(graph.hubThreshold());

  const prior = all.slice(0, idx).reverse();
  const thr1 = R1.hubThreshold(proto);
  const testsTotal = [...fileSet].filter((f) => isTest(f) && isCode(f)).length;
  const rawDeps = (g, seeds) => new Set(seeds.flatMap((s) => g(s)).filter((f) => !seeds.includes(f) && !isTest(f)));
  const r1Deps = (s) => R1.dependentsOf(proto, s).map((e) => e.from);
  const p1Deps = (s) => graph.dependentsOf(s);

  // ---- impact, two protocols
  const sorted = [...seedsAll].sort();
  const protos = [{ name: 'A: 1 seed', seeds: [sorted[0]] }];
  if (sorted.length >= 2) protos.push({ name: 'B: bỏ 1 file', seeds: sorted.slice(0, -1) });
  for (const p of protos) {
    const truth = new Set(codeChanged.filter((f) => !isTest(f) && fileSet.has(f) && !p.seeds.includes(f)));
    if (!truth.size) continue;
    const none = new Set();
    // R1 prototype
    const imp1 = R1.computeImpact(proto, { files: p.seeds, fileSet, workspaces: workspacesR1, hub: {}, hubThreshold: thr1 });
    const r1HubFiles = new Set(imp1.layers.L1.files.map((r) => r.file).filter((f) => !isTest(f)));
    const r1HubDirs = new Set(imp1.layers.L1.hubs.flatMap((h) => h.groups.map((g) => g.group)));
    // Sản phẩm
    const tp = performance.now();
    const res = I.computeImpact(graph, SNAP, { files: p.seeds }, { selectTests: S.selectTestsAdapter });
    tImpact.push(performance.now() - tp);
    const pFiles = new Set(res.dependents.map((d) => d.path).filter((f) => !isTest(f)));
    const pDirs = new Set(res.hubGroups.map((h) => dirKey(h.dir)));
    const m = {
      'R1 prototype · L1 thô': scoreImpact(rawDeps(r1Deps, p.seeds), none, truth),
      'R1 prototype · L1 nhóm hub': scoreImpact(r1HubFiles, r1HubDirs, truth),
      'P1 sản phẩm · L1 thô': scoreImpact(rawDeps(p1Deps, p.seeds), none, truth),
      'P1 sản phẩm · L1 nhóm hub': scoreImpact(pFiles, pDirs, truth),
    };
    const hubSeeds = p.seeds.filter((s) => graph.isHub(s)).length;
    impactRows.push({ set, proto: p.name, hash: c.hash, m, complete: res.complete, why: whyIncomplete(res), hubSeeds, truth: truth.size });
    completeRows.push({ set, q: `impact ${p.name}`, complete: res.complete, why: whyIncomplete(res) });
    if (hubSeeds) hubSizes.push({ set, raw: m['P1 sản phẩm · L1 thô'].size, items: m['P1 sản phẩm · L1 nhóm hub'].size, rawR1: m['R1 prototype · L1 thô'].size, itemsR1: m['R1 prototype · L1 nhóm hub'].size });
  }

  // ---- tests: seeds = mọi file code không-test đổi, truth = test sẵn có bị sửa
  const imp1 = R1.computeImpact(proto, { files: seedsAll, fileSet, workspaces: workspacesR1, hub: {}, hubThreshold: thr1 });
  const byConf1 = (min) => new Set(imp1.layers.L3.filter((r) => r.reason !== 'test file itself changed' && min(r)).map((r) => r.file));
  const r1High = byConf1((r) => r.confidence === 'high');
  const r1MedUp = byConf1((r) => r.confidence !== 'low');
  const tp = performance.now();
  const resT = I.computeImpact(graph, SNAP, { files: seedsAll }, { selectTests: S.selectTestsAdapter });
  const resD = I.computeImpact(graph, SNAP, { files: seedsAll }); // defaultTests trong impact.ts (không qua graph-select)
  tImpact.push(performance.now() - tp);
  const pick = (res, min) => new Set(res.tests.filter((t) => t.reason !== 'changed test file' && t.reason !== 'test file itself changed' && min(t)).map((t) => t.path));
  completeRows.push({ set, q: 'tests (impact+tests)', complete: resT.complete, why: whyIncomplete(resT) });
  // R1 co-change test (tham chiếu; P1 KHÔNG có co-change theo G0)
  const usable = filterCommits(prior, { maxFiles: MAX_FILES, exists: (f) => fileSet.has(f) });
  const coTests = new Set();
  for (const a of seedsAll) {
    const withA = usable.filter((u) => u.files.includes(a));
    if (withA.length < 2) continue;
    const cnt = new Map();
    for (const u of withA) for (const b of u.files) if (isTest(b) && fileSet.has(b)) cnt.set(b, (cnt.get(b) ?? 0) + 1);
    for (const [b, n] of cnt) if (n >= 2 && n / withA.length >= 0.3) coTests.add(b);
  }
  const methods = {
    'R1 prototype · cao': r1High,
    'R1 prototype · cao+vừa': r1MedUp,
    'R1 prototype · cao+vừa ∪ co-change (tham chiếu, P1 không có)': new Set([...r1MedUp, ...coTests]),
    'P1 sản phẩm · cao (graph-select)': pick(resT, (t) => t.confidence === 'high'),
    'P1 sản phẩm · cao+vừa (graph-select)': pick(resT, () => true),
    'P1 impact.ts defaultTests · cao+vừa (đối chứng)': pick(resD, () => true),
  };
  if (truthTests.size) {
    const m = {};
    for (const [k, v] of Object.entries(methods)) m[k] = { ...score(v, truthTests), ratio: v.size / testsTotal };
    testRows.push({ set, hash: c.hash, subject: c.subject, truth: truthTests.size, added: addedTests, m, seeds: seedsAll, truthList: [...truthTests], complete: resT.complete,
      missed: Object.fromEntries(Object.entries(methods).map(([k, v]) => [k, [...truthTests].filter((t) => !v.has(t))])) });
  } else {
    testAllRows.push({ set, sizes: Object.fromEntries(Object.entries(methods).map(([k, v]) => [k, v.size])) });
  }
  if (analysed % 50 === 0) console.error(`[replay-p1] ${analysed} commits, ${Math.round((Date.now() - t0) / 1000)}s, blobs read ${blobReads}`);
}
if (!opt('no-cache', false)) { try { writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch { /* read-only tmp */ } }

// ---------------------------------------------------------------- bootstrap
let seed = 12345;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function boot(values, stat = mean) {
  const v = values.filter((x) => !Number.isNaN(x));
  if (v.length < 2) return [NaN, NaN];
  const res = [];
  for (let b = 0; b < BOOT; b++) { const s = []; for (let i = 0; i < v.length; i++) s.push(v[Math.floor(rnd() * v.length)]); res.push(stat(s)); }
  res.sort((a, b) => a - b);
  return [res[Math.floor(0.025 * BOOT)], res[Math.min(BOOT - 1, Math.floor(0.975 * BOOT))]];
}
const pct = (x) => (Number.isNaN(x) ? '–' : (x * 100).toFixed(1) + '%');
const ci = (v) => { const [lo, hi] = boot(v); return Number.isNaN(lo) ? '–' : `[${pct(lo)}, ${pct(hi)}]`; };
const fix = (x) => (Number.isNaN(x) ? '–' : String(Math.round(x * 10) / 10));
const SET = { train: 'TRAIN', val: 'VALIDATION' };

// ---------------------------------------------------------------- tables
const md = [];
const out = (s = '') => md.push(s);
const impactMethods = Object.keys(impactRows[0]?.m ?? {});
for (const setName of ['train', 'val']) {
  for (const proto of ['A: 1 seed', 'B: bỏ 1 file']) {
    const rows = impactRows.filter((r) => r.set === setName && r.proto === proto);
    out(`#### Impact — ${SET[setName]}, giao thức ${proto} (n=${rows.length} commit)`);
    out();
    out('| Engine · cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |');
    out('|---|---|---|---|---|---|---|---|');
    for (const k of impactMethods) {
      const rec = rows.map((r) => r.m[k].recall), pre = rows.map((r) => r.m[k].precision), dir = rows.map((r) => r.m[k].recallDir), sz = rows.map((r) => r.m[k].size);
      out(`| ${k} | ${pct(mean(rec))} | ${ci(rec)} | ${pct(mean(pre.filter((x) => !Number.isNaN(x))))} | ${ci(pre)} | ${pct(mean(dir))} | ${fix(med(sz))} | ${fix(percentile(sz, 90))} |`);
    }
    out();
  }
}
out('#### Hiệu ứng hub (commit có seed là hub của sản phẩm: bậc không tính test ≥ max(p95, 20))');
out();
out('| Tập | số (commit×giao thức) | P1 L1 thô median / p90 | P1 nhóm hub (mục) median / p90 | R1 L1 thô median / p90 | R1 nhóm hub median / p90 |');
out('|---|---|---|---|---|---|');
for (const s of ['train', 'val']) {
  const h = hubSizes.filter((x) => x.set === s);
  const f = (k) => `${fix(med(h.map((x) => x[k])))} / ${fix(percentile(h.map((x) => x[k]), 90))}`;
  out(`| ${s} | ${h.length} | ${f('raw')} | ${f('items')} | ${f('rawR1')} | ${f('itemsR1')} |`);
}
out();
out(`Ngưỡng hub sản phẩm trên các đồ thị đã dựng: median ${fix(med(hubThr))}, min ${Math.min(...hubThr)}, max ${Math.max(...hubThr)} (R1: p95 tối thiểu 15).`);
out();

const testMethods = Object.keys(testRows[0]?.m ?? {});
for (const setName of ['train', 'val']) {
  const rows = testRows.filter((r) => r.set === setName);
  const noT = testAllRows.filter((r) => r.set === setName);
  out(`#### Ứng viên test — ${SET[setName]} (n=${rows.length} commit có sửa test sẵn có; ${noT.length} commit không sửa test chỉ đo chi phí)`);
  out();
  out('| Engine · cách chọn | recall TB | CI95 | commit recall=100% | CI95 | commit recall=0 | precision TB | tập test (median/p90) | chọn/toàn bộ test (median) | tập ở commit không sửa test (median) | số commit bỏ sót |');
  out('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of testMethods) {
    const rec = rows.map((r) => r.m[k].recall), full = rows.map((r) => (r.m[k].recall === 1 ? 1 : 0)), zero = rows.map((r) => (r.m[k].recall === 0 ? 1 : 0));
    const pre = rows.map((r) => r.m[k].precision).filter((x) => !Number.isNaN(x)), sz = rows.map((r) => r.m[k].size), ra = rows.map((r) => r.m[k].ratio);
    out(`| ${k} | ${pct(mean(rec))} | ${ci(rec)} | ${pct(mean(full))} | ${ci(full)} | ${pct(mean(zero))} | ${pct(mean(pre))} | ${fix(med(sz))} / ${fix(percentile(sz, 90))} | ${pct(med(ra))} | ${fix(med(noT.map((r) => r.sizes[k])))} | ${rows.filter((r) => r.m[k].recall < 1).length}/${rows.length} |`);
  }
  out();
}
out(`Commit sửa test: ${testRows.length}; test mới thêm cùng commit (không dự đoán được bằng đồ thị tại cha): ${testRows.reduce((a, r) => a + r.added, 0)} file.`);
out();

out('#### Tỉ lệ `complete=true` theo câu hỏi (chỉ engine sản phẩm; prototype không có cờ này = luôn false)');
out();
out('| Tập | Câu hỏi | n | complete=true | CI95 | lý do không đầy đủ (số câu hỏi, có thể chồng) |');
out('|---|---|---|---|---|---|');
for (const s of ['train', 'val', 'all']) {
  for (const q of ['impact A: 1 seed', 'impact B: bỏ 1 file', 'tests (impact+tests)']) {
    const rows = completeRows.filter((r) => (s === 'all' || r.set === s) && r.q === q);
    const why = {};
    for (const r of rows) for (const w of r.why) why[w] = (why[w] ?? 0) + 1;
    out(`| ${s} | ${q} | ${rows.length} | ${pct(mean(rows.map((r) => (r.complete ? 1 : 0))))} | ${ci(rows.map((r) => (r.complete ? 1 : 0)))} | ${Object.entries(why).map(([k, v]) => `${k}: ${v}`).join('; ') || '–'} |`);
  }
}
out();
const t = (a) => `median ${fix(med(a))} ms / p90 ${fix(percentile(a, 90))} ms`;
out('#### Thời gian dựng');
out();
out(`- Dựng đồ thị từ blob đã trích (adapter: buildWorkspaceMap + aliases + setRecord/resolve toàn bộ file), mỗi commit cha: sản phẩm ${t(timing.p1)}; prototype ${t(timing.r1)} (n=${timing.p1.length} lần dựng, gồm cả commit bị bỏ sau đó).`);
out(`- computeImpact sản phẩm (1 lần gọi): ${t(tImpact)}.`);
out(`- Trích import (cả hai engine, chỉ blob mới, cache lạnh): tổng ${Math.round(extractMs)} ms cho ${blobReads} blob đọc mới.`);
out(`- Kích thước đồ thị sản phẩm: files median ${fix(med(graphStats.map((x) => x.files)))}, edges median ${fix(med(graphStats.map((x) => x.edges)))}, unparsed median ${fix(med(graphStats.map((x) => x.unparsed)))}.`);
out();
out('#### Commit bị bỏ');
out();
out('| Lý do | số commit |');
out('|---|---|');
for (const [k, v] of Object.entries(dropped)) out(`| ${k} | ${v} |`);
out(`| (đo được ở ít nhất một phần) | ${analysed} |`);
out();

// ---- G-B verdict inputs (ngưỡng D2, replay.md §Ngưỡng đề xuất)
const P = 'P1 sản phẩm · cao+vừa (graph-select)';
const valRows = testRows.filter((r) => r.set === 'val');
const fullV = valRows.map((r) => (r.m[P].recall === 1 ? 1 : 0));
const [lo] = boot(fullV);
const missV = valRows.filter((r) => r.m[P].recall < 1);
out('#### Đối chiếu ngưỡng D2 (chế độ tự chọn subset) — engine sản phẩm, validation');
out();
out(`- Điều kiện mẫu: ≥150 commit sửa test ở validation và có proxy "test fail thật": có ${valRows.length} commit sửa test ở validation; proxy fail: chưa có → **không đạt**.`);
out(`- (a) tỉ lệ commit đủ 100%: ${pct(mean(fullV))}, cận dưới CI95 ${pct(lo)} (cần ≥ 97%) → ${lo >= 0.97 ? 'đạt' : '**không đạt**'}.`);
out(`- (b) trung vị tập chọn / toàn bộ test: ${pct(med(valRows.map((r) => r.m[P].ratio)))} (cần ≤ 20%) → ${med(valRows.map((r) => r.m[P].ratio)) <= 0.2 ? 'đạt' : '**không đạt**'}.`);
out(`- (c) failure bị bỏ sót ở validation: ${missV.length}/${valRows.length} commit (cần 0) → ${missV.length === 0 ? 'đạt' : '**không đạt**'}.`);
out();
out('#### Commit validation bị bỏ sót test (P1 cao+vừa; path)');
out();
for (const r of missV) out(`- \`${r.hash.slice(0, 8)}\` seed: ${r.seeds.slice(0, 3).map((s) => '`' + s + '`').join(', ')}${r.seeds.length > 3 ? ` (+${r.seeds.length - 3})` : ''}; thiếu: ${r.missed[P].slice(0, 3).map((s) => '`' + s + '`').join(', ')}${r.missed[P].length > 3 ? ` (+${r.missed[P].length - 3})` : ''}`);
out();
out(`Thời gian chạy: ${Math.round((Date.now() - t0) / 1000)}s; blob đọc mới: ${blobReads}; HEAD ${gitHead(ROOT)}; Node ${process.version}; commit tổng ${all.length} (train ${splitAt}, validation ${all.length - splitAt}).`);

const text = md.join('\n');
if (opt('md', false)) writeFileSync(String(opt('md')), text + '\n');
if (opt('json', false)) writeFileSync(String(opt('json')), JSON.stringify({ impactRows, testRows, completeRows, dropped, analysed }, null, 1));
console.log(text);
