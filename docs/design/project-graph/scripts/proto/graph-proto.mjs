#!/usr/bin/env node
// Project Graph V1a prototype CLI (PLAN.md §5.3 naming). Read-only; optional cache in .ai/onni/tmp/graph-proto/.
//   node graph-proto.mjs impact <file…> | --diff <ref> [--expand <dir>] [--max-tokens N] [--format text|json]
//   node graph-proto.mjs tests  <file…> | --diff <ref> [--runner | --runner-exec]
//   node graph-proto.mjs context --scope <path…> [--max-tokens 3000] [--format text|json]
// Tuning: --hub-percent 95 --hub-min 15 --git-window 500 --min-support 3 --min-confidence 0.3 --max-commit-files 30 --no-cochange --root <dir>

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { buildGraph, changedFiles, coChangeFor, computeImpact, applyBudget, renderImpactText, buildContext, renderContextText, readGitLog, isTest } from './lib.mjs';

const BOOL = new Set(['runner', 'runner-exec', 'no-cochange', 'json', 'no-cache']);
function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (BOOL.has(k)) opt[k] = true;
      else if (k === 'scope') { opt.scope = []; while (argv[i + 1] && !argv[i + 1].startsWith('--')) opt.scope.push(argv[++i]); }
      else opt[k] = argv[++i];
    } else pos.push(a);
  }
  return { cmd: pos[0], files: pos.slice(1), opt };
}

function usage() {
  console.error('usage: graph-proto.mjs impact|tests <file…> | --diff <ref>   |   context --scope <path…>\n  flags: --expand <dir> --max-tokens N --format text|json --runner --runner-exec --root <dir>');
  process.exit(2);
}

/** Vitest listing without running tests (Vitest 4: `list --filesOnly --changed <ref>`). */
function runnerRelated(root, { diff, files, exec }) {
  const vitest = join(root, 'node_modules/vitest/vitest.mjs');
  try { statSync(vitest); } catch { return { available: false, reason: 'node_modules/vitest chưa cài (cần npm ci)', tests: [] }; }
  try {
    if (diff) {
      const out = execFileSync(process.execPath, [vitest, 'list', '--filesOnly', '--changed', diff], { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
      const tests = out.split('\n').map((l) => l.replace(/^\[[^\]]*\]\s*/, '').trim()).filter((l) => /\.(test|spec)\./.test(l)).map((l) => l.replace(/\\/g, '/'));
      return { available: true, mode: 'vitest list --filesOnly --changed (không chạy test)', tests: [...new Set(tests)] };
    }
    if (!exec) return { available: false, reason: 'vitest list chỉ lọc theo --changed <ref>, không nhận danh sách file; dùng --diff <ref> hoặc --runner-exec (chạy test thật bằng `vitest related --run`)', tests: [] };
    const outFile = join(root, '.ai/onni/tmp/graph-proto/related.json');
    mkdirSync(join(root, '.ai/onni/tmp/graph-proto'), { recursive: true });
    try { execFileSync(process.execPath, [vitest, 'related', '--run', '--passWithNoTests', '--reporter=json', `--outputFile=${outFile}`, ...files], { cwd: root, encoding: 'utf8', timeout: 600_000, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { /* failing tests still write the report */ }
    const json = JSON.parse(readFileSync(outFile, 'utf8'));
    const tests = (json.testResults ?? []).map((r) => relative(root, r.name).replace(/\\/g, '/'));
    return { available: true, mode: 'vitest related --run (đã CHẠY test)', tests };
  } catch (e) {
    return { available: false, reason: `vitest lỗi: ${String(e.message).split('\n')[0]}`, tests: [] };
  }
}

function loadCached(root, head) {
  // Optional cache: only the cheap build metadata; the graph itself is rebuilt (cold ≈ 1 s, not worth stale risk).
  void root; void head;
}

async function main() {
  const { cmd, files, opt } = parseArgs(process.argv.slice(2));
  if (!cmd || !['impact', 'tests', 'context'].includes(cmd)) usage();
  const root = resolve(opt.root ?? process.cwd());
  const asJson = (opt.format ?? (opt.json ? 'json' : 'text')) === 'json';
  const num = (k, d) => (opt[k] !== undefined ? Number(opt[k]) : d);
  void loadCached;

  const b = await buildGraph(root);
  const base = { head: b.head, builtAt: b.builtAt, build: { ms: b.ms, ...b.breakdown, files: b.files.length, codeFiles: b.sources.size, edges: b.graph.edges.length, extPackages: b.graph.ext.size } };
  const coverageBase = { unparsedFiles: b.unparsed };

  if (cmd === 'context') {
    const scope = (opt.scope ?? files).map((s) => s.replace(/\\/g, '/').replace(/\/$/, ''));
    if (!scope.length) usage();
    const scopeFiles = b.files.filter((f) => scope.some((s) => f === s || f.startsWith(s + '/'))).filter((f) => b.sources.has(f));
    const ctx = buildContext({ scopeFiles, sources: b.sources, graph: b.graph, fileSet: b.fileSet, maxTokens: num('max-tokens', 3000) });
    const res = { ...base, complete: !ctx.truncated && b.unparsed === 0, truncated: ctx.truncated, omittedFiles: ctx.omittedFiles, scope, matchedFiles: scopeFiles.length, entries: ctx.entries,
      coverage: { unparsedFiles: b.unparsed, note: b.unparsed ? 'Có file không đọc được/quá 512.000 byte — dùng grep/đọc source.' : undefined } };
    console.log(asJson ? JSON.stringify(res, null, 2) : renderContextText(res));
    return;
  }

  const diff = opt.diff;
  const input = diff ? changedFiles(root, diff) : files.map((f) => f.replace(/\\/g, '/'));
  if (!input.length) { console.error(diff ? `không có file đổi so với ${diff}` : 'thiếu <file…> hoặc --diff <ref>'); process.exit(2); }

  let coChange;
  if (!opt['no-cochange'] && cmd === 'impact') {
    const commits = readGitLog(root, num('git-window', 500));
    coChange = coChangeFor(input.filter((f) => b.fileSet.has(f)), commits, {
      minSupport: num('min-support', 3), minConfidence: num('min-confidence', 0.3), maxFiles: num('max-commit-files', 30),
      exists: (f) => b.fileSet.has(f), exclude: [],
    });
  }
  let runner;
  if (opt.runner || opt['runner-exec']) runner = runnerRelated(root, { diff, files: input, exec: !!opt['runner-exec'] });

  const imp = computeImpact(b.graph, {
    files: input, fileSet: b.fileSet, workspaces: b.workspaces, expand: opt.expand, coChange, runnerTests: runner?.tests,
    hub: { percent: num('hub-percent', 95), minDegree: num('hub-min', 15) }, coverage: coverageBase,
  });
  const budgeted = applyBudget(imp.layers, opt['max-tokens'] ? Number(opt['max-tokens']) : cmd === 'tests' ? 0 : 0);
  const stale = false; // no cache => always built from the working tree at HEAD
  const res = {
    ...base, input: { files: input, diff: diff ?? null }, stale,
    complete: !budgeted.truncated && imp.coverage.unresolvedImports === 0 && b.unparsed === 0 && !imp.coverage.changedFilesNotInGraph,
    truncated: budgeted.truncated, omitted: budgeted.omitted, hubThreshold: imp.hubThreshold, coverage: imp.coverage,
    cochangeStats: coChange?.stats, runner: runner ? { available: runner.available, mode: runner.mode, reason: runner.reason, count: runner.tests.length } : undefined,
    layers: budgeted.layers,
  };
  if (cmd === 'tests') {
    const out = { ...res, layers: { L3: res.layers.L3 } };
    if (asJson) console.log(JSON.stringify(out, null, 2));
    else {
      console.log(`# tests @ ${res.head}  (${res.layers.L3.length} ứng viên; complete=${res.complete} truncated=${res.truncated})`);
      for (const r of res.layers.L3) console.log(`- ${r.file}  [${r.confidence}, ${r.provenance}] ${r.reason}`);
      if (runner) console.log(`\nrunner: ${runner.available ? runner.mode + `, ${runner.tests.length} file` : 'không khả dụng — ' + runner.reason}`);
      console.log(`\nLưới an toàn: nếu danh sách trống hoặc không chắc, chạy toàn bộ kiểm tra như hôm nay. unresolved imports=${res.coverage.unresolvedImports}.`);
    }
    return;
  }
  console.log(asJson ? JSON.stringify(res, null, 2) : renderImpactText(res));
  void isTest;
}

main();
