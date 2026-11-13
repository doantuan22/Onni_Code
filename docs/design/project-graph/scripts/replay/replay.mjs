#!/usr/bin/env node
// R1 replay (PLAN.md §9.2 G-B bản thử): precision/recall của impact + ứng viên test trên lịch sử git của repo này.
// Đồ thị mỗi commit dựng tại commit CHA từ `git ls-tree` + blob (cache theo hash blob, không checkout).
// Co-change chỉ học từ commit TRƯỚC commit đang đo. Chỉ đọc git; không ghi vào repo.
//
//   node replay.mjs [--root .] [--limit 600] [--val 0.3] [--max-files 30] [--budget-s 900]
//                   [--boot 1000] [--json out.json] [--md out.md] [--no-cache]

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FILE_CAP, isDenied, isTest, isCode, extractImports, buildWorkspaceMap, resolveSpecifier,
  dependentsOf, computeImpact, hubThreshold, coChangeFor, filterCommits, readGitLog, percentile, gitHead, groupDir,
} from '../proto/lib.mjs';

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const ROOT = String(opt('root', process.cwd()));
const LIMIT = Number(opt('limit', 600));
const VAL_FRAC = Number(opt('val', 0.3));
const MAX_FILES = Number(opt('max-files', 30));
const BUDGET_MS = Number(opt('budget-s', 900)) * 1000;
const BOOT = Number(opt('boot', 1000));
const t0 = Date.now();

const git = (args, input) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 30, input, stdio: ['pipe', 'pipe', 'pipe'] });

// ---------------------------------------------------------------- blob cache (imports per blob hash)
const CACHE_FILE = join(tmpdir(), 'onni-graph-replay-cache.v1.json');
let cache = { imports: {}, manifests: {} }; // blob -> [[spec,kind,line]...] | null(too big) ; blob -> {name,exports,main}|null
if (!opt('no-cache', false) && existsSync(CACHE_FILE)) { try { cache = JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch { /* fresh */ } }
let blobReads = 0;

/** Read blobs in one `git cat-file --batch` call and fill the cache. */
function fillBlobs(items) { // items: {sha, manifest:boolean}[]
  const need = items.filter((i) => !(i.manifest ? i.sha in cache.manifests : i.sha in cache.imports));
  for (let k = 0; k < need.length; k += 1500) {
    const chunk = need.slice(k, k + 1500);
    const out = git(['cat-file', '--batch'], chunk.map((c) => c.sha).join('\n') + '\n');
    let pos = 0;
    for (const c of chunk) {
      const nl = out.indexOf(10, pos);
      const [, type, sizeStr] = out.toString('utf8', pos, nl).split(' ');
      const size = Number(sizeStr);
      if (type !== 'blob') { pos = nl + 1; (c.manifest ? cache.manifests : cache.imports)[c.sha] = null; continue; }
      const body = out.subarray(nl + 1, nl + 1 + size);
      pos = nl + 1 + size + 1;
      blobReads++;
      if (c.manifest) {
        try { const j = JSON.parse(body.toString('utf8')); cache.manifests[c.sha] = { name: j.name, exports: j.exports, main: j.main }; } catch { cache.manifests[c.sha] = null; }
      } else if (size > FILE_CAP) cache.imports[c.sha] = null;
      else {
        const imps = extractImports(body.toString('utf8'));
        cache.imports[c.sha] = { i: imps.map((m) => [m.specifier, m.kind, m.line]), d: imps.unresolvedDynamic };
      }
    }
  }
}

// ---------------------------------------------------------------- tree at a commit -> graph
const treeMemo = new Map();
function treeAt(rev) {
  if (treeMemo.has(rev)) return treeMemo.get(rev);
  const raw = git(['ls-tree', '-r', '-z', rev]).toString('utf8');
  const files = new Map(); // path -> blob
  for (const rec of raw.split('\0')) {
    if (!rec) continue;
    const tab = rec.indexOf('\t');
    const [, type, sha] = rec.slice(0, tab).split(' ');
    const path = rec.slice(tab + 1);
    if (type === 'blob' && !isDenied(path)) files.set(path, sha);
  }
  if (treeMemo.size > 4) treeMemo.delete(treeMemo.keys().next().value);
  treeMemo.set(rev, files);
  return files;
}

function graphAt(rev) {
  const files = treeAt(rev);
  const fileSet = new Set(files.keys());
  const manifestPaths = [...files.keys()].filter((f) => /(^|\/)package\.json$/.test(f) && f.split('/').length <= 3);
  const codePaths = [...files.keys()].filter(isCode);
  fillBlobs([...manifestPaths.map((p) => ({ sha: files.get(p), manifest: true })), ...codePaths.map((p) => ({ sha: files.get(p), manifest: false }))]);
  const workspaces = buildWorkspaceMap(manifestPaths.map((p) => ({ path: p, json: cache.manifests[files.get(p)] })));
  const aliases = fileSet.has('packages/web/vite.config.ts') ? [{ prefix: '@/', dir: 'packages/web/src' }] : [];
  const ctx = { fileSet, workspaces, aliases };
  const reverse = new Map(), forward = new Map();
  let unresolved = 0, unresolvedDynamic = 0;
  for (const p of codePaths) {
    const rec = cache.imports[files.get(p)];
    if (!rec) continue;
    unresolvedDynamic += rec.d;
    for (const [specifier, kind, line] of rec.i) {
      const r = resolveSpecifier(specifier, p, ctx);
      if (r.type === 'file') {
        if (r.to === p) continue;
        const e = { from: p, to: r.to, kind, line };
        (reverse.get(r.to) ?? reverse.set(r.to, []).get(r.to)).push(e);
        (forward.get(p) ?? forward.set(p, []).get(p)).push(e);
      } else if (r.type === 'unresolved') unresolved++;
    }
  }
  return { graph: { reverse, forward, unresolved, unresolvedDynamic, edges: [] }, fileSet, workspaces };
}

// ---------------------------------------------------------------- commit list
const all = readGitLog(ROOT, LIMIT).reverse(); // oldest first
const parents = new Map(git(['rev-list', '--no-merges', '--parents', '-n', String(LIMIT), 'HEAD']).toString('utf8').split('\n').filter(Boolean).map((l) => { const [h, p] = l.split(' '); return [h, p]; }));
const splitAt = Math.floor(all.length * (1 - VAL_FRAC));
const dropped = { 'no parent (root)': 0, 'docs/config only (no code file)': 0, [`too large (> ${MAX_FILES} files)`]: 0, 'no usable seed': 0, 'no truth': 0, 'time budget': 0 };
const lockfile = (f) => /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock)$/.test(f);

// ---------------------------------------------------------------- metrics
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a) => percentile(a, 50);
function score(pred, truth) {
  const hit = [...truth].filter((t) => pred.has(t)).length;
  return { size: pred.size, recall: truth.size ? hit / truth.size : NaN, precision: pred.size ? hit / pred.size : NaN, hit };
}
// Impact, with hub groups counted as one item each. A group is "hit" if it holds a truth file.
function scoreImpact(files, groupDirs, truth) {
  const fileHit = [...truth].filter((t) => files.has(t));
  const dirHit = [...truth].filter((t) => files.has(t) || groupDirs.has(groupDir(t)));
  const items = files.size + groupDirs.size;
  const hitItems = fileHit.length + [...groupDirs].filter((d) => [...truth].some((t) => groupDir(t) === d && !files.has(t))).length;
  return { size: items, files: files.size, recall: fileHit.length / truth.size, recallDir: dirHit.length / truth.size,
    precision: items ? hitItems / items : NaN };
}

// ---------------------------------------------------------------- replay
const impactRows = []; // per commit per protocol: {set, proto, method -> metrics}
const testRows = [];
const testAllRows = []; // commits without truth tests: only cost
const cases = [];
let analysed = 0;
const hubSizes = [];

for (let idx = 0; idx < all.length; idx++) {
  if (Date.now() - t0 > BUDGET_MS) { dropped['time budget'] += all.length - idx; break; }
  const c = all[idx];
  const parent = parents.get(c.hash);
  const set = idx < splitAt ? 'train' : 'val';
  if (!parent) { dropped['no parent (root)']++; continue; }
  const rawFiles = c.files.filter((f) => !isDenied(f) && !lockfile(f));
  if (c.files.length > MAX_FILES) { dropped[`too large (> ${MAX_FILES} files)`]++; continue; }
  const { graph, fileSet, workspaces } = graphAt(parent);
  const codeChanged = rawFiles.filter(isCode);
  const seedsAll = codeChanged.filter((f) => !isTest(f) && fileSet.has(f)); // non-test code that existed at the parent
  const truthTests = new Set(rawFiles.filter((f) => isTest(f) && fileSet.has(f)));
  const addedTests = rawFiles.filter((f) => isTest(f) && !fileSet.has(f)).length;
  if (!codeChanged.length) { dropped['docs/config only (no code file)']++; continue; }
  if (!seedsAll.length) { dropped['no usable seed']++; continue; }
  analysed++;

  const prior = all.slice(0, idx).reverse(); // newest first, strictly before this commit
  const threshold = hubThreshold(graph);
  const testsTotal = [...fileSet].filter((f) => isTest(f) && isCode(f)).length;

  const rawDeps = (seeds) => new Set(seeds.flatMap((s) => dependentsOf(graph, s).map((e) => e.from)).filter((f) => !seeds.includes(f) && !isTest(f)));
  const coRows = (seeds, o) => coChangeFor(seeds, prior, { exists: (f) => fileSet.has(f), ...o }).rows.filter((r) => !isTest(r.file) && isCode(r.file));

  // ---- impact, two protocols
  const protos = [];
  const sorted = [...seedsAll].sort();
  const truthOthers = (seedSet) => new Set(codeChanged.filter((f) => !isTest(f) && fileSet.has(f) && !seedSet.includes(f)));
  protos.push({ name: 'A: 1 seed', seeds: [sorted[0]] });
  if (sorted.length >= 2) protos.push({ name: 'B: bỏ 1 file', seeds: sorted.slice(0, -1) });
  for (const p of protos) {
    const truth = truthOthers(p.seeds);
    if (!truth.size) { continue; }
    const imp = computeImpact(graph, { files: p.seeds, fileSet, workspaces, hub: {}, hubThreshold: threshold });
    const hubFiles = new Set(imp.layers.L1.files.map((r) => r.file).filter((f) => !isTest(f)));
    const hubDirs = new Set(imp.layers.L1.hubs.flatMap((h) => h.groups.filter((g) => g.representatives.some((r) => !isTest(r)) || true).map((g) => g.group)));
    const raw = rawDeps(p.seeds);
    const lx = new Set(coRows(p.seeds, {}).map((r) => r.file));
    const lxLoose = new Set(coRows(p.seeds, { minSupport: 2, minConfidence: 0.2 }).map((r) => r.file));
    const none = new Set();
    const union = (a, b) => new Set([...a, ...b]);
    const m = {
      'L1 thô': scoreImpact(raw, none, truth),
      'L1 nhóm hub': scoreImpact(hubFiles, hubDirs, truth),
      'LX (sup≥3, conf≥0.3)': scoreImpact(lx, none, truth),
      'LX lỏng (sup≥2, conf≥0.2)': scoreImpact(lxLoose, none, truth),
      'L1 thô ∪ LX': scoreImpact(union(raw, lx), none, truth),
      'L1 nhóm hub ∪ LX': scoreImpact(union(hubFiles, lx), hubDirs, truth),
    };
    const hubSeedCount = p.seeds.filter((s) => dependentsOf(graph, s).length >= threshold).length;
    impactRows.push({ set, proto: p.name, hash: c.hash, m, hubSeeds: hubSeedCount, truth: truth.size, seeds: p.seeds });
    if (hubSeedCount) hubSizes.push({ set, raw: raw.size, items: m['L1 nhóm hub'].size });
  }

  // ---- tests: seeds = all changed non-test code (what the agent knows), truth = modified existing tests
  const imp = computeImpact(graph, { files: seedsAll, fileSet, workspaces, hub: {}, hubThreshold: threshold });
  const byConf = (min) => new Set(imp.layers.L3.filter((r) => r.reason !== 'test file itself changed' && min(r)).map((r) => r.file));
  const high = byConf((r) => r.confidence === 'high');
  const medUp = byConf((r) => r.confidence !== 'low');
  const allG = byConf(() => true);
  // test-specific co-change: tests that changed together with a seed in prior (usable) commits
  const usable = filterCommits(prior, { maxFiles: MAX_FILES, exists: (f) => fileSet.has(f) });
  const coTests = new Set();
  for (const a of seedsAll) {
    const withA = usable.filter((u) => u.files.includes(a));
    if (withA.length < 2) continue;
    const cnt = new Map();
    for (const u of withA) for (const b of u.files) if (isTest(b) && fileSet.has(b)) cnt.set(b, (cnt.get(b) ?? 0) + 1);
    for (const [b, n] of cnt) if (n >= 2 && n / withA.length >= 0.3) coTests.add(b);
  }
  const union = (...s) => new Set(s.flatMap((x) => [...x]));
  const methods = {
    'nấc 3 cao (import trực tiếp + cùng tên)': high,
    'nấc 3 cao+vừa (+ sibling của dependent, qua hub)': medUp,
    'nấc 3 mọi mức (+ 2 hop)': allG,
    'co-change test (sup≥2, conf≥0.3)': coTests,
    'nấc 3 cao+vừa ∪ co-change test': union(medUp, coTests),
    'nấc 3 mọi mức ∪ co-change test': union(allG, coTests),
  };
  if (truthTests.size) {
    const m = {};
    for (const [k, v] of Object.entries(methods)) { const s = score(v, truthTests); m[k] = { ...s, ratio: v.size / testsTotal }; }
    testRows.push({ set, hash: c.hash, subject: c.subject, truth: truthTests.size, added: addedTests, m, seeds: seedsAll, picked: Object.fromEntries(Object.entries(methods).map(([k, v]) => [k, [...v]])), truthList: [...truthTests] });
  } else {
    testAllRows.push({ set, ratios: Object.fromEntries(Object.entries(methods).map(([k, v]) => [k, v.size / testsTotal])), sizes: Object.fromEntries(Object.entries(methods).map(([k, v]) => [k, v.size])) });
  }
  if (analysed % 50 === 0) console.error(`[replay] ${analysed} commits, ${Math.round((Date.now() - t0) / 1000)}s, blobs read ${blobReads}`);
}

if (!opt('no-cache', false)) { try { writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch { /* read-only tmp: fine */ } }

// ---------------------------------------------------------------- bootstrap
let seed = 12345; // mulberry32: deterministic CI
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function boot(values, stat = mean) { // resample commits
  const v = values.filter((x) => !Number.isNaN(x));
  if (v.length < 2) return [NaN, NaN];
  const res = [];
  for (let b = 0; b < BOOT; b++) { const s = []; for (let i = 0; i < v.length; i++) s.push(v[Math.floor(rnd() * v.length)]); res.push(stat(s)); }
  res.sort((a, b) => a - b);
  return [res[Math.floor(0.025 * BOOT)], res[Math.min(BOOT - 1, Math.floor(0.975 * BOOT))]];
}
const pct = (x) => (Number.isNaN(x) ? '–' : (x * 100).toFixed(1) + '%');
const ci = (v, stat) => { const [lo, hi] = boot(v, stat); return Number.isNaN(lo) ? '–' : `[${pct(lo)}, ${pct(hi)}]`; };
const fix = (x) => (Number.isNaN(x) ? '–' : String(Math.round(x * 10) / 10));

// ---------------------------------------------------------------- tables
const md = [];
const out = (s = '') => md.push(s);
const impactMethods = Object.keys(impactRows[0]?.m ?? {});
for (const setName of ['train', 'val']) {
  for (const proto of ['A: 1 seed', 'B: bỏ 1 file']) {
    const rows = impactRows.filter((r) => r.set === setName && r.proto === proto);
    out(`#### Impact — ${setName === 'train' ? 'TRAIN' : 'VALIDATION'}, giao thức ${proto} (n=${rows.length} commit)`);
    out();
    out('| Cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |');
    out('|---|---|---|---|---|---|---|---|');
    for (const k of impactMethods) {
      const rec = rows.map((r) => r.m[k].recall), pre = rows.map((r) => r.m[k].precision), dir = rows.map((r) => r.m[k].recallDir), sz = rows.map((r) => r.m[k].size);
      out(`| ${k} | ${pct(mean(rec))} | ${ci(rec)} | ${pct(mean(pre.filter((x) => !Number.isNaN(x))))} | ${ci(pre)} | ${pct(mean(dir))} | ${fix(med(sz))} | ${fix(percentile(sz, 90))} |`);
    }
    out();
  }
}
out('#### Hiệu ứng hub (commit có seed là hub)');
out();
out('| Tập | số (commit×giao thức) | L1 thô median | L1 thô p90 | L1 nhóm hub (mục) median | p90 |');
out('|---|---|---|---|---|---|');
for (const s of ['train', 'val']) {
  const h = hubSizes.filter((x) => x.set === s);
  out(`| ${s} | ${h.length} | ${fix(med(h.map((x) => x.raw)))} | ${fix(percentile(h.map((x) => x.raw), 90))} | ${fix(med(h.map((x) => x.items)))} | ${fix(percentile(h.map((x) => x.items), 90))} |`);
}
out();
const testMethods = Object.keys(testRows[0]?.m ?? {});
for (const setName of ['train', 'val']) {
  const rows = testRows.filter((r) => r.set === setName);
  const noT = testAllRows.filter((r) => r.set === setName);
  out(`#### Ứng viên test — ${setName === 'train' ? 'TRAIN' : 'VALIDATION'} (n=${rows.length} commit có sửa test sẵn có; ${noT.length} commit không sửa test chỉ đo chi phí)`);
  out();
  out('| Cách chọn | recall TB | CI95 | commit recall=100% | CI95 | commit recall=0 | precision TB | tập test (median/p90) | tỉ lệ chọn/toàn bộ test (median) | tập ở commit không sửa test (median) |');
  out('|---|---|---|---|---|---|---|---|---|---|');
  for (const k of testMethods) {
    const rec = rows.map((r) => r.m[k].recall), full = rows.map((r) => (r.m[k].recall === 1 ? 1 : 0)), zero = rows.map((r) => (r.m[k].recall === 0 ? 1 : 0));
    const pre = rows.map((r) => r.m[k].precision).filter((x) => !Number.isNaN(x)), sz = rows.map((r) => r.m[k].size), ra = rows.map((r) => r.m[k].ratio);
    out(`| ${k} | ${pct(mean(rec))} | ${ci(rec)} | ${pct(mean(full))} | ${ci(full)} | ${pct(mean(zero))} | ${pct(mean(pre))} | ${fix(med(sz))} / ${fix(percentile(sz, 90))} | ${pct(med(ra))} | ${fix(med(noT.map((r) => r.sizes[k])))} |`);
  }
  out();
}
const tot = testRows.length;
out(`Commit sửa test: ${tot}; test mới thêm cùng commit (không thể dự đoán bằng đồ thị tại cha): ${testRows.reduce((a, r) => a + r.added, 0)} file.`);
out();
out('#### Commit bị bỏ');
out();
out('| Lý do | số commit |');
out('|---|---|');
for (const [k, v] of Object.entries(dropped)) out(`| ${k} | ${v} |`);
out(`| (đo được ở ít nhất một phần) | ${analysed} |`);
out();

// good / bad cases (tests, validation first then train); path-only
const pick = (rows, good) => rows.filter((r) => (good ? r.m['nấc 3 cao+vừa ∪ co-change test'].recall === 1 && r.truth >= 1 : r.m['nấc 3 mọi mức ∪ co-change test'].recall === 0))
  .sort((a, b) => (good ? a.m['nấc 3 cao+vừa ∪ co-change test'].size - b.m['nấc 3 cao+vừa ∪ co-change test'].size : b.seeds.length - a.seeds.length))
  .slice(0, 3);
const valRows = testRows.filter((r) => r.set === 'val');
out('#### Ví dụ (test, chỉ path; tốt = recall 100% với tập nhỏ nhất; xấu = bỏ sót hết kể cả khi lấy mọi mức ∪ co-change)');
out();
const showCase = (r, label) => {
  out(`- ${label} \`${r.hash.slice(0, 8)}\` [${r.set}] — seed: ${r.seeds.slice(0, 3).map((s) => '`' + s + '`').join(', ')}${r.seeds.length > 3 ? ` (+${r.seeds.length - 3})` : ''}; test thật: ${r.truthList.slice(0, 3).map((s) => '`' + s + '`').join(', ')}; chọn (cao+vừa∪co-change): ${r.m['nấc 3 cao+vừa ∪ co-change test'].size} file`);
};
for (const r of pick(valRows.length >= 3 ? valRows : testRows, true)) showCase(r, 'TỐT');
for (const r of pick(valRows.length >= 3 ? valRows : testRows, false)) showCase(r, 'XẤU');
out();

// G-B numbers: validation misses
const vMiss = {};
for (const k of testMethods) vMiss[k] = valRows.filter((r) => r.m[k].recall < 1).length;
out(`Số commit validation có test bị bỏ sót (recall<100%) theo cách chọn (trên ${valRows.length}): ` + testMethods.map((k) => `${k}: ${vMiss[k]}`).join('; '));
out();
out(`Thời gian chạy: ${Math.round((Date.now() - t0) / 1000)}s; blob đọc mới: ${blobReads}; HEAD ${gitHead(ROOT)}; Node ${process.version}; commit tổng ${all.length} (train ${splitAt}, validation ${all.length - splitAt}).`);

const text = md.join('\n');
if (opt('md', false)) writeFileSync(String(opt('md')), text + '\n');
if (opt('json', false)) writeFileSync(String(opt('json')), JSON.stringify({ impactRows, testRows: testRows.map(({ picked, ...r }) => r), dropped, analysed }, null, 1));
console.log(text);
