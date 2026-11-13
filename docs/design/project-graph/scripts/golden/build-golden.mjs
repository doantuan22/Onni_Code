import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const out = path.join(repo, 'docs/design/project-graph/spikes/golden');
const slash = (s) => s.split(path.sep).join('/');
const rel = (s) => slash(path.relative(repo, s));
const roots = ['packages/work/src', 'packages/contract/src', 'packages/api-client/src', 'packages/web/src'];
const all = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (!['dist', 'node_modules', '__fixtures__'].includes(ent.name)) walk(full); continue; }
    if (/\.(?:ts|tsx)$/.test(ent.name) && !/\.(?:test|spec|generated|gen)\.(?:ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) all.push(full);
  }
}
for (const root of roots) walk(path.join(repo, root));
const byRel = new Map(all.map((f) => [rel(f), f]));
function resolveLocal(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(candidate) && byRel.has(rel(candidate))) return rel(candidate);
    const tsSub = candidate.replace(/\.js$/, '.ts');
    if (fs.existsSync(tsSub) && byRel.has(rel(tsSub))) return rel(tsSub);
  }
  return null;
}
const store = 'packages/work/src/runs/store.ts';
const hubClients = all.filter((file) => {
  const text = fs.readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from\s*|import\s*\()(['"])([^'"]+)\1/g)].some((m) => resolveLocal(file, m[2]) === store);
}).map(rel);
const picks = new Set([store, 'packages/contract/src/index.ts', 'packages/work/src/index.ts', 'packages/work/src/automations/scheduler.ts', 'packages/work/src/server/terminal/pty-module.ts', 'packages/web/src/routes.tsx', 'packages/work/src/core/process-jobs.ts', ...hubClients]);
const patterns = [
  /^packages\/work\/src\/(?:runs|automations|dispatch|server|workflows)\//,
  /^packages\/contract\/src\//, /^packages\/api-client\/src\//, /^packages\/web\/src\/(?:routes|api)\//,
];
for (const p of patterns) for (const f of all.map(rel).filter((x) => p.test(x))) { if (picks.size >= 70) break; picks.add(f); }
const files = [...picks].filter((f) => byRel.has(f)).slice(0, 80).sort();
if (files.length < 50 || hubClients.length < 10) throw new Error(`Corpus invariant failed: files=${files.length}, store importers=${hubClients.length}`);

const edges = [];
for (const from of files) {
  const source = fs.readFileSync(path.join(repo, from), 'utf8');
  const lines = source.split(/\r?\n/);
  const seen = new Set();
  const record = (edge) => {
    const id = `${edge.evidence}\0${edge.to}\0${edge.kind}`;
    if (!seen.has(id)) { seen.add(id); edges.push(edge); }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const re = /\b(import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?(['"])([^'"]+)\3|\bimport\s*\(\s*(['"])([^'"]+)\5\s*\)/g;
    for (const m of line.matchAll(re)) {
      const spec = m[4] ?? m[6];
      const isDynamic = m[6] !== undefined;
      const beforeDynamic = isDynamic ? line.slice(0, m.index) : '';
      const isDynamicType = isDynamic && /(?:\?|:|\btypeof)\s*$/.test(beforeDynamic);
      const isExport = m[1] === 'export';
      let kind;
      let to;
      if (spec.startsWith('@onni/')) { kind = 'package-dep'; to = spec; }
      else if (spec.startsWith('.') && !isDynamic) { to = resolveLocal(path.join(repo, from), spec); kind = isExport ? 'reexports' : m[2] ? 'type-imports' : 'imports'; }
      else if (spec.startsWith('.') && isDynamic) { to = resolveLocal(path.join(repo, from), spec); kind = isDynamicType ? 'type-imports' : to ? 'dynamic-import' : 'unresolved'; }
      else { kind = isDynamic ? 'unresolved' : 'ext'; to = spec; }
      if (to) record({ from, to, kind, evidence: `${from}:${i + 1}` });
    }
    for (const m of line.matchAll(/\bimport\s*\(\s*([A-Za-z_$][\w$.[\]'"`]*)\s*\)/g)) {
      if (/^['"]/.test(m[1])) continue;
      record({ from, to: 'unresolved:non-literal-dynamic-import', kind: 'unresolved', evidence: `${from}:${i + 1}` });
    }
  }
  for (const m of source.matchAll(/\b(import|export)\s+(type\s+)?[^;\n]{0,240}\n[^;]{0,240}?\bfrom\s*(['"])([^'"]+)\3/g)) {
    const lineNo = source.slice(0, m.index).split(/\r?\n/).length;
    const spec = m[4];
    const to = spec.startsWith('@onni/') ? spec : resolveLocal(path.join(repo, from), spec);
    if (to) record({ from, to, kind: m[1] === 'export' ? 'reexports' : m[2] ? 'type-imports' : 'imports', evidence: `${from}:${lineNo}` });
  }
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'files.json'), `${JSON.stringify(files, null, 2)}\n`);
fs.writeFileSync(path.join(out, 'edges.json'), `${JSON.stringify(edges, null, 2)}\n`);
console.log(JSON.stringify({ files: files.length, storeImporters: hubClients.length, edges: edges.length }, null, 2));
