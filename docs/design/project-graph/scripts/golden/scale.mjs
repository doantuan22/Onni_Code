import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const roots = ['packages/work/src', 'packages/contract/src', 'packages/api-client/src', 'packages/web/src'];
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (!['dist', 'node_modules', '__fixtures__', 'generated'].includes(ent.name)) walk(full); }
    else if (/\.(?:ts|tsx)$/.test(ent.name) && !/\.(?:test|spec|generated|gen)\.(?:ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) files.push(full);
  }
}
for (const root of roots) walk(path.join(repo, root));
const known = new Set(files.map((f) => path.resolve(f)));
function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const f of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    const ts = f.replace(/\.js$/, '.ts');
    if (known.has(path.resolve(f))) return f;
    if (known.has(path.resolve(ts))) return ts;
  }
  return null;
}
const packages = {};
for (const file of files) { const pkg = path.relative(repo, file).split(path.sep)[1]; packages[pkg] = (packages[pkg] ?? 0) + 1; }
let edges = 0;
for (const from of files) {
  const source = fs.readFileSync(from, 'utf8').split(/\r?\n/);
  for (const line of source) {
    const matches = [...line.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];
    for (const match of matches) {
      const spec = match[1] ?? match[2];
      if (spec.startsWith('@onni/')) edges++;
      else if (resolve(from, spec)) edges++;
    }
  }
}
console.log(JSON.stringify({ asOf: new Date().toISOString(), node: process.version, files: files.length, packages, internalImportEdges: edges }, null, 2));
