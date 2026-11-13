// Project Graph V1a prototype — pure functions (PLAN.md §3.1, §3.2, §4.4, §4.5, §4.7).
// Not a product engine: regex lexer, no dependency. Exported so R1/S5 replay can import it.
// Everything here is side-effect free except `listFiles`/`readGitLog` (git) and `buildGraph` (reads files).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { posix, join } from 'node:path';

export const FILE_CAP = 512_000; // §4.7, same size as FILE_CONTENT_CAP in server/git-changes.ts
export const CODE_EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const RESOLVE_EXT = [...CODE_EXT, '.json'];

// ---------------------------------------------------------------- denylist (§4.7)
export function isDenied(path) {
  const p = path.replace(/\\/g, '/');
  const segs = p.split('/');
  const base = segs[segs.length - 1];
  if (segs.includes('node_modules') || segs.includes('.git')) return true;
  if (segs.includes('dist')) return true; // dist/ and web/dist
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) return true;
  if (/\.(pem|key|p12)$/i.test(base)) return true;
  if (/^id_rsa/i.test(base)) return true;
  if (base === '.npmrc') return true;
  return false;
}

export function isTest(path) {
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /(^|\/)(__tests__|test|tests)\//.test(path);
}
export const isCode = (path) => CODE_EXT.some((e) => path.endsWith(e));
const isLockfile = (path) => /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock)$/.test(path);

// ---------------------------------------------------------------- git
function git(root, args, maxBuffer = 256 * 1024 * 1024) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer, stdio: ['ignore', 'pipe', 'pipe'] });
}
export function gitHead(root) {
  try { return git(root, ['rev-parse', '--short', 'HEAD']).trim(); } catch { return 'unknown'; }
}
/** Tracked files minus denylist. Denied names never leave this function (§4.7). */
export function listFiles(root) {
  return git(root, ['ls-files', '-z']).split('\0').filter(Boolean).filter((f) => !isDenied(f));
}
export function changedFiles(root, ref) {
  const out = git(root, ['diff', '--name-only', '-M', `${ref}`, '--']).split('\n').filter(Boolean);
  return out.filter((f) => !isDenied(f));
}

// ---------------------------------------------------------------- lexer: blank comments + template bodies
/** Replaces comments and template-literal bodies with spaces (keeps offsets and newlines). Heuristic:
 *  regex literals containing quotes or `//` can fool it — those files only lose edges, never gain bogus ones. */
export function blankNonCode(src) {
  const n = src.length;
  const parts = [];
  let last = 0, i = 0;
  // blank [a,b): keep newlines so line numbers survive
  const blank = (a, b) => { parts.push(src.slice(last, a), src.slice(a, b).replace(/[^\n]/g, ' ')); last = b; };
  while (i < n) {
    const c = src.charCodeAt(i), d = src.charCodeAt(i + 1);
    if (c === 47 && d === 47) { let j = src.indexOf('\n', i); if (j < 0) j = n; blank(i, j); i = j; }
    else if (c === 47 && d === 42) { const j = src.indexOf('*/', i + 2); const e = j < 0 ? n : j + 2; blank(i, e); i = e; }
    else if (c === 34 || c === 39) {
      let j = i + 1;
      while (j < n && src.charCodeAt(j) !== c && src.charCodeAt(j) !== 10) { if (src.charCodeAt(j) === 92) j++; j++; }
      i = j + 1;
    } else if (c === 96) {
      let j = i + 1;
      while (j < n && src.charCodeAt(j) !== 96) { if (src.charCodeAt(j) === 92) j++; j++; }
      blank(i + 1, Math.min(j, n)); i = j + 1;
    } else i++;
  }
  parts.push(src.slice(last));
  return parts.join('');
}

// ---------------------------------------------------------------- import extraction
/** @returns {{specifier:string, kind:'import'|'type'|'reexport'|'dynamic'|'require'|'mock', line:number}[]
 *           & {unresolvedDynamic:number}} */
export function extractImports(source) {
  const s = blankNonCode(source);
  const found = [];
  const lineIndex = [0];
  for (let k = 0; k < s.length; k++) if (s.charCodeAt(k) === 10) lineIndex.push(k + 1);
  const lineOf = (idx) => { let lo = 0, hi = lineIndex.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineIndex[m] <= idx) lo = m; else hi = m - 1; } return lo + 1; };
  let m;
  // import … from 'x' / export … from 'x'  (no `;` allowed inside the clause, so statements cannot merge)
  const fromRe = /\b(import|export)\s+(type\s+)?([^;'"`]*?)\bfrom\s*(['"])([^'"\n]+)\4/g;
  while ((m = fromRe.exec(s))) {
    const kind = m[1] === 'export' ? 'reexport' : m[2] ? 'type' : 'import';
    found.push({ specifier: m[5], kind, line: lineOf(m.index) });
  }
  const sideRe = /\bimport\s*(['"])([^'"\n]+)\1/g; // import 'x'
  while ((m = sideRe.exec(s))) found.push({ specifier: m[2], kind: 'import', line: lineOf(m.index) });
  const dynRe = /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;
  while ((m = dynRe.exec(s))) found.push({ specifier: m[2], kind: 'dynamic', line: lineOf(m.index) });
  const reqRe = /\brequire\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;
  while ((m = reqRe.exec(s))) found.push({ specifier: m[2], kind: 'require', line: lineOf(m.index) });
  const mockRe = /\bvi\.(?:mock|doMock|importActual|importMock)\s*\(\s*(['"])([^'"\n]+)\1/g;
  while ((m = mockRe.exec(s))) found.push({ specifier: m[2], kind: 'mock', line: lineOf(m.index) });
  const allDyn = (s.match(/\bimport\s*\(/g) || []).length;
  const constDyn = (s.match(/\bimport\s*\(\s*['"]/g) || []).length;
  found.unresolvedDynamic = Math.max(0, allDyn - constDyn);
  return found;
}

/** Exported names with line numbers (for `context`). */
export function extractExports(source) {
  const lines = source.split('\n');
  const out = [];
  const re = /^export\s+(?:declare\s+)?(?:default\s+)?(async\s+function|function\*?|class|abstract\s+class|const|let|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
  lines.forEach((ln, i) => {
    const m = re.exec(ln);
    if (m) out.push({ name: m[2], kind: m[1].replace(/\s+/g, ' '), line: i + 1, signature: ln.trim().slice(0, 140) });
  });
  return out;
}

// ---------------------------------------------------------------- workspace packages + resolver
/** @param {{path:string, json:any}[]} manifests package.json files (path relative to repo root, POSIX) */
export function buildWorkspaceMap(manifests) {
  const map = new Map();
  for (const { path, json } of manifests) {
    if (!json || !json.name) continue;
    map.set(json.name, { name: json.name, dir: posix.dirname(path) === '.' ? '' : posix.dirname(path), exports: json.exports, main: json.main });
  }
  return map;
}

const toSourceCandidates = (target) => {
  // "./dist/server/app-type.js" -> "src/server/app-type.ts" candidates; "./src/index.ts" stays
  let t = target.replace(/^\.\//, '');
  const out = [t];
  if (t.startsWith('dist/')) out.push('src/' + t.slice(5));
  return out.flatMap((c) => withTsVariants(c));
};

function withTsVariants(p) {
  const m = /\.(m|c)?js$/.exec(p);
  if (!m) return [p];
  const stem = p.slice(0, -m[0].length);
  return [p, stem + '.ts', stem + '.tsx', stem + '.mts', stem + '.cts'];
}

function probe(base, fileSet) {
  if (fileSet.has(base) && !base.endsWith('/')) return base;
  for (const c of withTsVariants(base)) if (fileSet.has(c)) return c;
  for (const e of RESOLVE_EXT) if (fileSet.has(base + e)) return base + e;
  for (const e of RESOLVE_EXT) if (fileSet.has(`${base}/index${e}`)) return `${base}/index${e}`;
  return null;
}

/**
 * @returns {{type:'file',to:string}|{type:'ext',name:string}|{type:'unresolved',reason:string}}
 */
export function resolveSpecifier(spec, fromFile, ctx) {
  const { fileSet, workspaces, aliases = [] } = ctx;
  spec = spec.replace(/\?.*$/, ''); // vite suffixes such as `?raw`
  if (spec.startsWith('node:')) return { type: 'ext', name: spec };
  if (spec.startsWith('.')) {
    const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
    const hit = probe(base, fileSet);
    return hit ? { type: 'file', to: hit } : { type: 'unresolved', reason: 'relative path not found' };
  }
  for (const { prefix, dir } of aliases) {
    if (spec.startsWith(prefix) && posix.dirname(fromFile).startsWith(dir.split('/')[0])) {
      const hit = probe(posix.join(dir, spec.slice(prefix.length)), fileSet);
      if (hit) return { type: 'file', to: hit };
    }
  }
  for (const ws of workspaces.values()) {
    if (spec !== ws.name && !spec.startsWith(ws.name + '/')) continue;
    const sub = spec === ws.name ? '.' : './' + spec.slice(ws.name.length + 1);
    const ex = ws.exports;
    let target;
    if (typeof ex === 'string' && sub === '.') target = ex;
    else if (ex && typeof ex === 'object') {
      const e = ex[sub];
      target = typeof e === 'string' ? e : e && (e.import || e.default || e.types);
    }
    if (!target && sub === '.') target = ws.main || 'index.ts';
    const cands = target ? toSourceCandidates(target).map((c) => posix.join(ws.dir, c)) : [];
    for (const c of cands) { const hit = probe(c, fileSet); if (hit) return { type: 'file', to: hit }; }
    const fallback = probe(posix.join(ws.dir, 'src', sub === '.' ? 'index' : sub.slice(2)), fileSet);
    if (fallback) return { type: 'file', to: fallback };
    return { type: 'unresolved', reason: `workspace ${ws.name} target not found` };
  }
  const bare = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  return { type: 'ext', name: bare };
}

// ---------------------------------------------------------------- graph
/**
 * @param {Map<string,string>|Record<string,string>} sources path -> source (already denylist/cap filtered)
 * @param {{fileSet:Set<string>, workspaces:Map, aliases?:any[]}} ctx
 */
export function buildGraphFromSources(sources, ctx) {
  const edges = []; // {from,to,kind,line}
  const reverse = new Map();
  const forward = new Map();
  const ext = new Map();
  let unresolved = 0, unresolvedDynamic = 0;
  const unresolvedList = [];
  for (const [path, src] of sources instanceof Map ? sources : Object.entries(sources)) {
    const imps = extractImports(src);
    unresolvedDynamic += imps.unresolvedDynamic;
    for (const imp of imps) {
      const r = resolveSpecifier(imp.specifier, path, ctx);
      if (r.type === 'file') {
        if (r.to === path) continue;
        const e = { from: path, to: r.to, kind: imp.kind, line: imp.line };
        edges.push(e);
        (reverse.get(r.to) ?? reverse.set(r.to, []).get(r.to)).push(e);
        (forward.get(path) ?? forward.set(path, []).get(path)).push(e);
      } else if (r.type === 'ext') {
        ext.set(r.name, (ext.get(r.name) ?? 0) + 1);
      } else {
        unresolved++;
        if (unresolvedList.length < 50) unresolvedList.push({ from: path, specifier: imp.specifier, reason: r.reason });
      }
    }
  }
  return { edges, reverse, forward, ext, unresolved, unresolvedDynamic, unresolvedList };
}

/** Distinct dependents (files) of a node. */
export function dependentsOf(graph, file) {
  const seen = new Map();
  for (const e of graph.reverse.get(file) ?? []) if (!seen.has(e.from)) seen.set(e.from, e);
  return [...seen.values()];
}

// ---------------------------------------------------------------- hubs (§4.4)
export function percentile(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}
/** hub threshold: in-degree >= max(pXX of in-degrees over files that have >=1 dependent, N). */
export function hubThreshold(graph, { percent = 95, minDegree = 15 } = {}) {
  const degs = [...graph.reverse.keys()].map((k) => dependentsOf(graph, k).length);
  return Math.max(percentile(degs, percent), minDegree);
}
export function groupDir(file, depth = 0) {
  const d = posix.dirname(file);
  if (!depth) return d === '.' ? '(root)' : d;
  return d.split('/').slice(0, depth).join('/') || '(root)';
}
/** Group file paths by directory; each group has count + up to `reps` representatives. */
export function groupByDirectory(files, { reps = 3 } = {}) {
  const m = new Map();
  for (const f of files) (m.get(groupDir(f)) ?? m.set(groupDir(f), []).get(groupDir(f))).push(f);
  return [...m.entries()]
    .map(([dir, list]) => ({ group: dir, count: list.length, representatives: list.slice().sort().slice(0, reps) }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}

export function packageOf(file, workspaces) {
  let best = null;
  for (const ws of workspaces.values()) {
    const pre = ws.dir ? ws.dir + '/' : '';
    if (file.startsWith(pre) && (!best || pre.length > (best.dir ? best.dir.length + 1 : 0))) best = ws;
  }
  return best ? best.name : null;
}

// ---------------------------------------------------------------- co-change (§4.5)
const BOT_RE = /\[bot\]|dependabot|renovate|github-actions/i;
const NOISE_SUBJECT_RE = /^(chore\(deps|build\(deps|bump |format|style:|chore: (format|lint)|revert)/i;

/**
 * @param {{hash:string, author?:string, subject?:string, date?:number, files:string[]}[]} commits newest first
 * @returns {Map<string, {hash:string,subject:string,date:number,files:string[]}[]>} file -> usable commits
 */
export function filterCommits(commits, { maxFiles = 30, exists } = {}) {
  const usable = [];
  for (const c of commits) {
    if (BOT_RE.test(c.author ?? '') || NOISE_SUBJECT_RE.test(c.subject ?? '')) continue;
    const files = c.files.filter((f) => !isLockfile(f) && !isDenied(f) && (!exists || exists(f)));
    if (c.files.length > maxFiles) continue; // judged on the raw count: mass renames/format sweeps
    if (files.length < 2) continue;
    usable.push({ ...c, files });
  }
  return usable;
}

const roleOf = (f) => (isTest(f) ? 'test' : /\.(md|mdx|txt)$/i.test(f) ? 'doc' : /\.(json|ya?ml|toml)$/i.test(f) ? 'config' : 'code');

/**
 * For each seed A, partners B with support = #commits containing both, confidence = support / #commits containing A.
 * Seeds' test/doc/config partners are dropped (separate lanes: tests go to L3). Partners already in `exclude` are dropped.
 */
export function coChangeFor(seeds, commits, { minSupport = 3, minConfidence = 0.3, maxFiles = 30, exists, exclude = [], samples = 2, limit = 15 } = {}) {
  const usable = filterCommits(commits, { maxFiles, exists });
  const skip = new Set([...seeds, ...exclude]);
  const results = new Map(); // partner -> best row
  const stats = { commitsSeen: commits.length, commitsUsable: usable.length };
  for (const a of seeds) {
    const withA = usable.filter((c) => c.files.includes(a));
    if (!withA.length) continue;
    const count = new Map();
    for (const c of withA) for (const b of c.files) if (!skip.has(b) && roleOf(b) === roleOf(a)) count.set(b, [...(count.get(b) ?? []), c]);
    for (const [b, cs] of count) {
      const support = cs.length, confidence = support / withA.length;
      if (support < minSupport || confidence < minConfidence) continue;
      const prev = results.get(b);
      if (prev && prev.confidence >= confidence) continue;
      results.set(b, {
        file: b, via: a, support, seedCommits: withA.length, confidence: Number(confidence.toFixed(2)),
        lastCommit: cs[0].hash.slice(0, 8), lastDate: cs[0].date ? new Date(cs[0].date * 1000).toISOString().slice(0, 10) : undefined,
        sampleCommits: cs.slice(0, samples).map((c) => `${c.hash.slice(0, 8)} ${c.subject ?? ''}`.trim()),
      });
    }
  }
  const rows = [...results.values()].sort((x, y) => y.confidence - x.confidence || y.support - x.support).slice(0, limit);
  return { rows, stats };
}

export function readGitLog(root, n = 500) {
  const raw = git(root, ['log', '--no-merges', '-n', String(n), '--name-only', '--pretty=format:%x1e%H%x1f%an%x1f%ct%x1f%s']);
  const commits = [];
  for (const block of raw.split('\x1e')) {
    if (!block.trim()) continue;
    const [head, ...rest] = block.split('\n');
    const [hash, author, ct, subject] = head.split('\x1f');
    commits.push({ hash, author, date: Number(ct), subject, files: rest.map((l) => l.trim()).filter(Boolean) });
  }
  return commits;
}

// ---------------------------------------------------------------- tests (§3.2 rung 3)
export function siblingTests(file, fileSet) {
  const m = /^(.*?)(\.[cm]?[jt]sx?)$/.exec(file);
  if (!m) return [];
  const out = [];
  for (const mid of ['.test', '.spec']) for (const e of ['.ts', '.tsx', '.mjs', '.js']) {
    const c = m[1] + mid + e;
    if (fileSet.has(c)) out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------- impact (§3.1)
/**
 * @param {object} graph from buildGraphFromSources
 * @param {{files:string[], fileSet:Set<string>, workspaces:Map, hub:{percent?:number,minDegree?:number}, expand?:string,
 *          coChange?:ReturnType<typeof coChangeFor>, runnerTests?:string[]}} opts
 */
export function computeImpact(graph, opts) {
  const { files, fileSet, workspaces } = opts;
  const threshold = opts.hubThreshold ?? hubThreshold(graph, opts.hub);
  const known = files.filter((f) => fileSet.has(f));
  const notInGraph = files.filter((f) => !fileSet.has(f));

  // L0
  const L0 = known.map((f) => ({ file: f, provenance: 'extracted', reason: 'changed', via: null, dependents: dependentsOf(graph, f).length }));
  const l0set = new Set(known);

  // L1 — dependents, hub seeds collapsed into groups
  const l1Files = new Map(); // file -> row
  const hubGroups = [];
  const hubSeeds = [];
  for (const seed of known) {
    const deps = dependentsOf(graph, seed).filter((e) => !l0set.has(e.from));
    const isHub = dependentsOf(graph, seed).length >= threshold;
    if (isHub) {
      hubSeeds.push(seed);
      const groups = groupByDirectory(deps.map((e) => e.from));
      const dirs = groups.length;
      hubGroups.push({ seed, total: deps.length, directories: dirs, summary: `${deps.length} file ở ${dirs} thư mục`, hub: 'coarse', provenance: 'extracted', via: seed,
        groups: opts.expand ? groups.filter((g) => g.group === opts.expand || g.group.startsWith(opts.expand + '/')).map((g) => ({ ...g, files: deps.map((e) => e.from).filter((f) => groupDir(f) === g.group).sort() })) : groups });
      if (opts.expand) for (const e of deps) if (groupDir(e.from) === opts.expand || groupDir(e.from).startsWith(opts.expand + '/')) l1Files.set(e.from, rowFor(e, seed));
    } else {
      for (const e of deps) if (!l1Files.has(e.from)) l1Files.set(e.from, rowFor(e, seed));
    }
  }
  function rowFor(e, seed) {
    return { file: e.from, provenance: 'extracted', reason: `${e.kind === 'reexport' ? 'reexports' : e.kind === 'mock' ? 'mocks' : e.kind === 'type' ? 'imports (type)' : 'imports'} \`${posix.basename(seed)}\`${e.line ? ` (line ${e.line})` : ''}`, via: seed };
  }
  const L1 = { files: [...l1Files.values()].sort((a, b) => a.file.localeCompare(b.file)), hubs: hubGroups };
  const allDependentFiles = new Set(known.flatMap((s) => dependentsOf(graph, s).map((e) => e.from)));

  // L2 — workspace packages pulled in
  const pkgCounts = new Map();
  for (const f of [...known, ...allDependentFiles]) {
    const p = packageOf(f, workspaces) ?? '(root)';
    pkgCounts.set(p, pkgCounts.get(p) ?? { files: 0, changed: 0 });
    pkgCounts.get(p).files++;
    if (l0set.has(f)) pkgCounts.get(p).changed++;
  }
  const L2 = [...pkgCounts.entries()].map(([pkg, c]) => ({ package: pkg, changed: c.changed, dependentFiles: c.files - c.changed, provenance: 'extracted', reason: c.changed ? 'contains changed files' : 'imports changed files' })).sort((a, b) => b.dependentFiles - a.dependentFiles);

  // L3 — test candidates
  const tests = new Map();
  const add = (file, row) => { const p = tests.get(file); if (!p || p.rank < row.rank) tests.set(file, row); };
  for (const f of known) {
    if (isTest(f)) add(f, { file: f, rank: 4, provenance: 'declared', confidence: 'high', reason: 'test file itself changed', via: f });
    for (const t of siblingTests(f, fileSet)) add(t, { file: t, rank: 3, provenance: 'declared', confidence: 'high', reason: `sibling test of \`${posix.basename(f)}\``, via: f });
    // a hub's importers are mostly incidental users, so their confidence is lower
    const seedIsHub = dependentsOf(graph, f).length >= threshold;
    for (const e of dependentsOf(graph, f)) if (isTest(e.from)) add(e.from, { file: e.from, rank: seedIsHub ? 2 : 3, provenance: 'extracted', confidence: seedIsHub ? 'medium' : 'high', reason: `${e.kind === 'mock' ? 'mocks' : 'imports'} ${seedIsHub ? 'hub' : 'changed'} \`${posix.basename(f)}\``, via: f });
  }
  const direct = new Set([...l0set]);
  for (const f of known) {
    if (hubSeeds.includes(f) && !opts.expand) continue; // 1-hop tests through a hub = noise; the hub's tests are reached via direct imports above
    for (const e of dependentsOf(graph, f)) {
      if (isTest(e.from)) continue;
      direct.add(e.from);
      for (const t of siblingTests(e.from, fileSet)) add(t, { file: t, rank: 2, provenance: 'inferred', confidence: 'medium', reason: `sibling test of dependent \`${posix.basename(e.from)}\``, via: f });
      if (dependentsOf(graph, e.from).length >= threshold) continue; // 2 hops through a hub = half the repo
      for (const e2 of dependentsOf(graph, e.from)) if (isTest(e2.from)) add(e2.from, { file: e2.from, rank: 1, provenance: 'inferred', confidence: 'low', reason: `imports dependent \`${posix.basename(e.from)}\` (2 hops)`, via: f });
    }
  }
  for (const t of opts.runnerTests ?? []) add(t, { file: t, rank: tests.get(t)?.rank ?? 2, provenance: 'extracted', confidence: tests.get(t)?.confidence ?? 'medium', reason: tests.has(t) ? tests.get(t).reason + ' + vitest related' : 'vitest related', via: 'runner' });
  const L3 = [...tests.values()].sort((a, b) => b.rank - a.rank || a.file.localeCompare(b.file)).map(({ rank, ...r }) => r);

  // LX — co-change
  const LX = (opts.coChange?.rows ?? []).map((r) => ({
    file: r.file, provenance: 'inferred', confidence: r.confidence, support: r.support, reason: `changed with \`${posix.basename(r.via)}\` in ${r.support}/${r.seedCommits} commits`, via: r.via, sampleCommits: r.sampleCommits, lastCommit: r.lastCommit,
  }));

  // coverage — what we could not judge
  const coverage = {
    changedFilesNotInGraph: notInGraph.length ? notInGraph : undefined,
    unparsedFiles: opts.coverage?.unparsedFiles ?? 0,
    unresolvedImports: graph.unresolved,
    unresolvedDynamicImports: graph.unresolvedDynamic,
    note: (notInGraph.length || graph.unresolved || graph.unresolvedDynamic)
      ? 'Một phần import không giải được: đồ thị có thể thiếu cạnh — dùng grep/đọc source để xác nhận.' : undefined,
  };
  return { layers: { L0, L1, L2, L3, LX }, hubThreshold: threshold, coverage, counts: { dependentFiles: allDependentFiles.size } };
}

// ---------------------------------------------------------------- budget (never silent)
export const estimateTokens = (chars) => Math.ceil(chars / 4);

/** Greedy by priority L0, L2, L1, L3, LX. Items that do not fit are counted in `omitted`, never dropped silently. */
export function applyBudget(layers, maxTokens) {
  if (!maxTokens) return { layers, truncated: false, omitted: {} };
  let budget = maxTokens * 4;
  const out = { L0: [], L1: { files: [], hubs: layers.L1.hubs }, L2: [], L3: [], LX: [] };
  const omitted = {};
  const take = (name, list, setter) => {
    for (const item of list) {
      const cost = JSON.stringify(item).length;
      if (cost <= budget) { setter(item); budget -= cost; } else omitted[name] = (omitted[name] ?? 0) + 1;
    }
  };
  take('L0', layers.L0, (i) => out.L0.push(i));
  take('L2', layers.L2, (i) => out.L2.push(i));
  budget -= JSON.stringify(layers.L1.hubs).length; // hub summaries are always kept
  take('L1', layers.L1.files, (i) => out.L1.files.push(i));
  take('L3', layers.L3, (i) => out.L3.push(i));
  take('LX', layers.LX, (i) => out.LX.push(i));
  return { layers: out, truncated: Object.keys(omitted).length > 0, omitted };
}

// ---------------------------------------------------------------- text rendering
export function renderImpactText(res) {
  const L = res.layers, lines = [];
  lines.push(`# impact @ ${res.head} (built ${res.builtAt}, ${res.build.ms} ms, ${res.build.files} files / ${res.build.edges} edges)`);
  lines.push(`complete=${res.complete} truncated=${res.truncated} hubThreshold=${res.hubThreshold}`);
  if (res.omitted && Object.keys(res.omitted).length) lines.push(`CẮT: ${Object.entries(res.omitted).map(([k, v]) => `${k} -${v}`).join(', ')} mục — tăng --max-tokens hoặc dùng --expand`);
  lines.push('', `## L0 đã đổi (${L.L0.length})`);
  for (const r of L.L0) lines.push(`- ${r.file}  [${r.dependents} dependents]`);
  lines.push('', `## L1 dependents trực tiếp`);
  for (const h of L.L1.hubs) {
    lines.push(`- HUB \`${h.seed}\`: ${h.summary} (hub: coarse, dùng --expand <thư mục> để mở)`);
    for (const g of h.groups.slice(0, 40)) {
      lines.push(`    ${String(g.count).padStart(3)}  ${g.group}  ← ${g.representatives.map((x) => posix.basename(x)).join(', ')}`);
    }
    if (h.groups.length > 40) lines.push(`    … +${h.groups.length - 40} thư mục`);
  }
  for (const r of L.L1.files) lines.push(`- ${r.file}  — ${r.reason}`);
  if (!L.L1.hubs.length && !L.L1.files.length) lines.push('- (không có)');
  lines.push('', `## L2 package (${L.L2.length})`);
  for (const r of L.L2) lines.push(`- ${r.package}: ${r.changed} đổi, ${r.dependentFiles} dependent — ${r.reason}`);
  lines.push('', `## L3 ứng viên test (${L.L3.length})`);
  for (const r of L.L3.slice(0, 30)) lines.push(`- ${r.file}  [${r.confidence}, ${r.provenance}] ${r.reason}`);
  if (L.L3.length > 30) lines.push(`- … +${L.L3.length - 30} test nữa (hiển thị 30 đầu theo confidence; dùng \`tests\` hoặc --format json để lấy đủ)`);
  lines.push('', `## LX co-change, inferred (${L.LX.length})`);
  for (const r of L.LX) lines.push(`- ${r.file}  [conf ${r.confidence}, ${r.support}x] ${r.reason}${r.sampleCommits?.length ? `\n    vd: ${r.sampleCommits.join(' | ')}` : ''}`);
  const c = res.coverage;
  lines.push('', `## coverage`, `- import không giải được: ${c.unresolvedImports}; dynamic import không hằng: ${c.unresolvedDynamicImports}; file không parse: ${c.unparsedFiles}`);
  if (c.changedFilesNotInGraph) lines.push(`- file đổi không có trong đồ thị: ${c.changedFilesNotInGraph.join(', ')}`);
  if (c.note) lines.push(`- ${c.note}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- context (outline within scope)
export function buildContext({ scopeFiles, sources, graph, fileSet, maxTokens = 3000 }) {
  const budget = maxTokens * 4;
  const entries = [];
  let used = 0, omitted = 0;
  for (const f of scopeFiles.filter((x) => !isTest(x))) { // tests are listed under each file's `tests:`
    const src = sources.get(f);
    const exports = src ? extractExports(src) : [];
    const deps = dependentsOf(graph, f);
    const imports = [...new Set((graph.forward.get(f) ?? []).map((e) => e.to))];
    const e = {
      file: f, lines: src ? src.split('\n').length : undefined, imports: imports.length, dependents: deps.length,
      tests: siblingTests(f, fileSet).concat(deps.filter((d) => isTest(d.from)).map((d) => d.from)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
      exports: exports.map((x) => `${x.kind} ${x.name} :${x.line}`),
    };
    const cost = JSON.stringify(e).length;
    if (used + cost > budget) { omitted++; continue; }
    used += cost; entries.push(e);
  }
  return { entries, truncated: omitted > 0, omittedFiles: omitted };
}

export function renderContextText(res) {
  const lines = [`# context @ ${res.head} (built ${res.builtAt}) complete=${res.complete} truncated=${res.truncated}${res.omittedFiles ? ` CẮT ${res.omittedFiles} file` : ''}`];
  for (const e of res.entries) {
    lines.push(`\n## ${e.file}  (${e.lines ?? '?'} dòng, import ${e.imports}, dependents ${e.dependents})`);
    if (e.tests.length) lines.push(`tests: ${e.tests.join(', ')}`);
    for (const x of e.exports) lines.push(`- ${x}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- repo-level build (reads files)
export function loadWorkspaceMap(root, files) {
  const manifests = files.filter((f) => /(^|\/)package\.json$/.test(f) && f.split('/').length <= 3).map((f) => {
    try { return { path: f, json: JSON.parse(readFileSync(join(root, f), 'utf8')) }; } catch { return { path: f, json: null }; }
  });
  return buildWorkspaceMap(manifests);
}

export async function buildGraph(root, { extraAliases } = {}) {
  const t0 = performance.now();
  const files = listFiles(root);
  const tList = performance.now();
  const fileSet = new Set(files);
  const workspaces = loadWorkspaceMap(root, files);
  const aliases = extraAliases ?? (fileSet.has('packages/web/vite.config.ts') ? [{ prefix: '@/', dir: 'packages/web/src' }] : []);
  const sources = new Map();
  let unparsed = 0, tooBig = 0;
  // Parallel batches: sequential readFileSync took ~20 s on a loaded Windows box, 64-wide async ~1 s (see README).
  const codeFiles = files.filter(isCode);
  for (let i = 0; i < codeFiles.length; i += 64) {
    await Promise.all(codeFiles.slice(i, i + 64).map(async (f) => {
      try {
        if ((await stat(join(root, f))).size > FILE_CAP) { tooBig++; unparsed++; return; }
        sources.set(f, await readFile(join(root, f), 'utf8'));
      } catch { unparsed++; }
    }));
  }
  const tRead = performance.now();
  const graph = buildGraphFromSources(sources, { fileSet, workspaces, aliases });
  const ms = Math.round(performance.now() - t0);
  const breakdown = { listMs: Math.round(tList - t0), readMs: Math.round(tRead - tList), parseMs: Math.round(performance.now() - tRead) };
  return { files, fileSet, workspaces, sources, graph, unparsed, tooBig, ms, breakdown, head: gitHead(root), builtAt: new Date().toISOString() };
}
