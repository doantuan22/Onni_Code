// S1b engine spike — shared pieces: spike-dir loader, corpus, candidate extractors, normalizer, scoring.
// Candidates only return RAW records {spec, kind, typePos?, nonLiteral?}; ONE normalizer turns them into
// golden-format edges so differences come from the engine, not from the resolver.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const PG = resolve(here, '../..'); // docs/design/project-graph
export const REPO = resolve(PG, '../../..');
export const SPIKE_DIR = process.env.GRAPH_SPIKE_DIR || join(tmpdir(), 'onni-graph-spike');
export const spikeRequire = createRequire(join(SPIKE_DIR, 'noop.js'));
export const spikeImport = (name) => import(pathToFileURL(spikeRequire.resolve(name)).href);

// ---------------------------------------------------------------- corpus (same walk as scripts/golden/build-golden.mjs)
export const ROOTS = ['packages/work/src', 'packages/contract/src', 'packages/api-client/src', 'packages/web/src'];
export function listCorpus(repo = REPO) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (!['dist', 'node_modules', '__fixtures__'].includes(e.name)) walk(full); continue; }
      if (/\.(?:ts|tsx)$/.test(e.name) && !/\.(?:test|spec|generated|gen)\.(?:ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts'))
        out.push(full.slice(repo.length + 1).replace(/\\/g, '/'));
    }
  };
  for (const r of ROOTS) walk(join(repo, r));
  return out;
}
export const loadSources = (files, repo = REPO) => new Map(files.map((f) => [f, readFileSync(join(repo, f), 'utf8')]));
export const goldenFiles = () => JSON.parse(readFileSync(join(PG, 'spikes/golden/files.json'), 'utf8'));
export const goldenEdges = () => JSON.parse(readFileSync(join(PG, 'spikes/golden/edges.json'), 'utf8'));

// ---------------------------------------------------------------- resolver (golden's resolveLocal semantics)
export function makeResolver(fileSet) {
  return (from, spec) => {
    spec = spec.replace(/\?.*$/, '');
    const base = posix.normalize(posix.join(posix.dirname(from), spec));
    for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx')])
      if (fileSet.has(c)) return c;
    return null;
  };
}

/** raw records -> golden-format edges. Mirrors build-golden.mjs rules (see engine.md "chuẩn hóa"). */
export function normalize(from, raws, resolve_) {
  const edges = [];
  for (const r of raws) {
    const spec = r.spec;
    const isDyn = r.kind === 'dynamic';
    if (r.nonLiteral) { edges.push({ from, to: 'unresolved:non-literal-dynamic-import', kind: 'unresolved' }); continue; }
    if (spec == null) continue;
    let kind, to;
    if (spec.startsWith('@onni/')) { kind = 'package-dep'; to = spec; }
    else if (spec.startsWith('.')) {
      to = resolve_(from, spec);
      if (isDyn) kind = r.typePos ? 'type-imports' : to ? 'dynamic-import' : 'unresolved';
      else kind = r.kind === 'reexport' ? 'reexports' : r.kind === 'type' ? 'type-imports' : 'imports';
    } else { kind = isDyn ? 'unresolved' : 'ext'; to = spec; }
    if (to) edges.push({ from, to, kind });
  }
  return edges;
}

// ---------------------------------------------------------------- candidate extractors
// Each: async make() -> { name, extract(file, src) -> raw[] }
const lit = (s) => /^['"]/.test(s);
const typePosBefore = (src, idx) => /(?:\?|:|\btypeof)\s*$/.test(src.slice(Math.max(0, idx - 40), idx));

export async function makeRegex() {
  const lib = await import(pathToFileURL(join(PG, 'scripts/proto/lib.mjs')).href);
  return { name: 'regex (proto/lib.mjs)', extract(file, src) {
    const imps = lib.extractImports(src);
    const raws = imps.filter((i) => i.kind !== 'require' && i.kind !== 'mock').map((i) => ({ spec: i.specifier, kind: i.kind }));
    // non-literal dynamic import: lib counts them (unresolvedDynamic) but gives no position; emit one record each
    for (let k = 0; k < imps.unresolvedDynamic; k++) raws.push({ nonLiteral: true, kind: 'dynamic' });
    return raws;
  } };
}

export async function makeLexer({ strip }) {
  const { init, parse } = await spikeImport('es-module-lexer');
  await init;
  const esbuild = strip ? await spikeImport('esbuild') : null;
  return { name: strip ? 'es-module-lexer + esbuild strip' : 'es-module-lexer (raw)', extract(file, src) {
    let code = src;
    if (strip) {
      try {
        code = esbuild.transformSync(src, { loader: file.endsWith('x') ? 'tsx' : 'ts', jsx: 'transform', jsxFactory: '__h', jsxFragment: '__f', tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } }, logLevel: 'silent' }).code;
      } catch (e) { throw new Error('esbuild: ' + String(e.message).split('\n')[0]); }
    }
    const [imports] = parse(code); // es-module-lexer 3.x: {type:'static'|'dynamic'|'reexport-*'|'export-*', specifier, typeOnly}
    const raws = [];
    for (const i of imports) {
      if (i.type === 'dynamic') {
        if (i.specifier === undefined) raws.push({ nonLiteral: true, kind: 'dynamic' });
        else raws.push({ spec: i.specifier, kind: 'dynamic', typePos: !strip && typePosBefore(code, i.importStart) });
      } else if (i.specifier !== undefined) {
        const isExp = /^reexport|^export/.test(i.type) || /^export\b/.test(code.slice(i.importStart, i.importStart + 8)); // `export … from` is reported as 'static'
        const kind = isExp ? 'reexport' : i.typeOnly ? 'type' : 'import';
        raws.push({ spec: i.specifier, kind });
      }
    }
    return raws;
  } };
}

export async function makeOxc({ walk, raw = false }) {
  const mod = await spikeImport('oxc-parser');
  const { parseSync, Visitor } = mod;
  return { name: 'oxc-parser (module' + (walk ? ' + TSImportType walk' : '') + (raw ? ', rawTransfer' : '') + ')', extract(file, src) {
    const r = parseSync(file, src, raw ? { experimentalRawTransfer: true } : {});
    if (r.errors.length) throw new Error('oxc: ' + r.errors[0].message);
    const m = r.module, raws = [];
    for (const s of m.staticImports) raws.push({ spec: s.moduleRequest.value, kind: /^import\s+type\b/.test(src.slice(s.start, s.end)) ? 'type' : 'import' });
    for (const s of m.staticExports) for (const e of s.entries) if (e.moduleRequest) raws.push({ spec: e.moduleRequest.value, kind: 'reexport' });
    for (const d of m.dynamicImports) {
      const text = src.slice(d.moduleRequest.start, d.moduleRequest.end);
      if (!lit(text)) raws.push({ nonLiteral: true, kind: 'dynamic' });
      else raws.push({ spec: text.slice(1, -1), kind: 'dynamic', typePos: typePosBefore(src, d.start) });
    }
    // module.dynamicImports does NOT include `import('x')` type nodes (TSImportType): walk the AST for them.
    if (walk && src.includes('import(')) new Visitor({ TSImportType(n) { raws.push({ spec: n.source.value, kind: 'dynamic', typePos: true }); } }).visit(r.program);
    return raws;
  } };
}

export async function makeTsPre() {
  const ts = spikeRequire('typescript');
  return { name: `typescript ${ts.version} preProcessFile`, extract(file, src) {
    const info = ts.preProcessFile(src, true, true);
    const raws = [];
    for (const f of info.importedFiles) {
      // preProcessFile gives only {fileName,pos,end}: kind is inferred from the statement text before the specifier.
      const from = Math.max(src.lastIndexOf(';', f.pos) + 1, src.lastIndexOf('\n\n', f.pos));
      const compact = src.slice(Math.max(0, from), f.pos).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ' ').trim();
      if (/\bimport\s*\(\s*$/.test(compact)) raws.push({ spec: f.fileName, kind: 'dynamic', typePos: typePosBefore(src, f.pos - 8) });
      else if (/(^|\s)export\b/.test(compact) && /\bfrom\s*$/.test(compact)) raws.push({ spec: f.fileName, kind: 'reexport' });
      else if (/(^|\s)import\s+type\b/.test(compact)) raws.push({ spec: f.fileName, kind: 'type' });
      else raws.push({ spec: f.fileName, kind: 'import' });
    }
    // non-literal dynamic imports are invisible to preProcessFile (it only reports string literals)
    return raws;
  } };
}

// ---------------------------------------------------------------- run a candidate over files
export function runCandidate(cand, sources, fileSet, files) {
  const res = makeResolver(fileSet);
  const edges = [], errors = [];
  for (const f of files) {
    try { edges.push(...normalize(f, cand.extract(f, sources.get(f)), res)); }
    catch (e) { errors.push({ file: f, error: String(e.message).slice(0, 160) }); }
  }
  return { edges, errors };
}

// ---------------------------------------------------------------- scoring
export const key = (e) => `${e.from}\0${e.to}\0${e.kind}`;
export function score(found, golden) {
  const G = new Map(), F = new Map();
  for (const e of golden) G.set(key(e), e);
  for (const e of found) F.set(key(e), e);
  const rows = {};
  const bump = (k, f, g) => {
    const r = rows[k] ??= { tp: 0, fp: 0, fn: 0 };
    if (f && g) r.tp++; else if (f) r.fp++; else r.fn++;
  };
  for (const [k, e] of F) { bump(e.kind, true, G.has(k)); bump('ALL', true, G.has(k)); }
  for (const [k, e] of G) if (!F.has(k)) { bump(e.kind, false, true); bump('ALL', false, true); }
  for (const r of Object.values(rows)) {
    r.precision = r.tp + r.fp ? r.tp / (r.tp + r.fp) : null;
    r.recall = r.tp + r.fn ? r.tp / (r.tp + r.fn) : null;
  }
  const missing = [...G].filter(([k]) => !F.has(k)).map(([, e]) => e);
  const extra = [...F].filter(([k]) => !G.has(k)).map(([, e]) => e);
  return { rows, missing, extra };
}
export const pct = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');
export const mib = (b) => (b / 1048576).toFixed(1);

export async function makeAll({ only } = {}) {
  const all = {
    regex: makeRegex, 'lexer-raw': () => makeLexer({ strip: false }), 'lexer-strip': () => makeLexer({ strip: true }),
    'oxc-lite': () => makeOxc({ walk: false }), oxc: () => makeOxc({ walk: true }), 'oxc-raw': () => makeOxc({ walk: true, raw: true }), 'ts-pre': makeTsPre,
    'tree-sitter': async () => (await import('./treesitter.mjs')).makeTreeSitter(),
  };
  const out = [];
  for (const [id, mk] of Object.entries(all)) if (!only || only.includes(id)) out.push({ id, ...(await mk()) });
  return out;
}
