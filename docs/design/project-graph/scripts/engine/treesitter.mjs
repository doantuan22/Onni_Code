// tree-sitter candidate: web-tree-sitter + OFFICIAL grammar .wasm files shipped in the npm packages
// (tree-sitter-typescript / -javascript / -python / -go, all MIT). Also exports the Python/Go fixture extractors.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { spikeRequire, spikeImport, SPIKE_DIR } from './common.mjs';

const wasm = (pkg, file) => join(SPIKE_DIR, 'node_modules', pkg, file + '.wasm');

export async function loadTreeSitter() {
  const { Parser, Language } = await spikeImport('web-tree-sitter');
  await Parser.init();
  const langs = {};
  const load = async (id, pkg, file) => { langs[id] = await Language.load(wasm(pkg, file)); };
  await load('ts', 'tree-sitter-typescript', 'tree-sitter-typescript');
  await load('tsx', 'tree-sitter-typescript', 'tree-sitter-tsx');
  await load('js', 'tree-sitter-javascript', 'tree-sitter-javascript');
  await load('py', 'tree-sitter-python', 'tree-sitter-python');
  await load('go', 'tree-sitter-go', 'tree-sitter-go');
  const parser = new Parser();
  const parse = (id, src) => { parser.setLanguage(langs[id]); return parser.parse(src); };
  const versions = Object.fromEntries(['web-tree-sitter', 'tree-sitter-typescript', 'tree-sitter-javascript', 'tree-sitter-python', 'tree-sitter-go']
    .map((p) => { try { return [p, JSON.parse(readFileSync(join(SPIKE_DIR, 'node_modules', p, 'package.json'), 'utf8')).version]; } catch { return [p, '?']; } }));
  return { parse, langs, versions, abi: Object.fromEntries(Object.entries(langs).map(([k, l]) => [k, l.abiVersion])) };
}

const TYPE_ANCESTORS = new Set(['type_annotation', 'type_alias_declaration', 'type_arguments', 'type_query', 'as_expression', 'satisfies_expression']);
const strVal = (n) => n.text.slice(1, -1);

export async function makeTreeSitter() {
  const ts = await loadTreeSitter();
  return { name: 'tree-sitter (web-tree-sitter + official TS/TSX grammar)', meta: ts, extract(file, src) {
    const tree = ts.parse(file.endsWith('x') ? 'tsx' : 'ts', src);
    try {
      if (tree.rootNode.hasError) { /* still extract: tree-sitter recovers; record that errors exist */ }
      const raws = [];
      for (const n of tree.rootNode.descendantsOfType(['import_statement', 'export_statement', 'call_expression'])) {
        if (n.type === 'import_statement') {
          const s = n.childForFieldName('source') ?? n.namedChildren.find((c) => c.type === 'import_require_clause')?.childForFieldName('source');
          if (s) raws.push({ spec: strVal(s), kind: /^import\s+type\b/.test(n.text.slice(0, 20)) ? 'type' : 'import' });
        } else if (n.type === 'export_statement') {
          const s = n.childForFieldName('source');
          if (s) raws.push({ spec: strVal(s), kind: 'reexport' });
        } else if (n.childForFieldName('function')?.type === 'import') {
          const a = n.childForFieldName('arguments')?.namedChildren[0];
          if (!a || a.type !== 'string') { raws.push({ nonLiteral: true, kind: 'dynamic' }); continue; }
          let typePos = false;
          for (let p = n.parent; p; p = p.parent) { if (TYPE_ANCESTORS.has(p.type)) { typePos = true; break; } }
          raws.push({ spec: strVal(a), kind: 'dynamic', typePos });
        }
      }
      return raws;
    } finally { tree.delete(); }
  } };
}

// ------------------------------------------------------------- fixtures: Python + Go (breadth check, §4.2)
import { posix } from 'node:path';

export function pyEdges(ts, files /* Map path->src */) {
  const out = [];
  const has = (p) => files.has(p);
  for (const [from, src] of files) {
    const tree = ts.parse('py', src);
    for (const n of tree.rootNode.descendantsOfType(['import_statement', 'import_from_statement'])) {
      const mods = [];
      if (n.type === 'import_from_statement') mods.push(n.childForFieldName('module_name').text);
      else for (const c of n.namedChildren) mods.push(c.type === 'aliased_import' ? c.childForFieldName('name').text : c.text);
      for (const m of mods) {
        const dots = /^\.+/.exec(m)?.[0].length ?? 0;
        const rest = m.slice(dots).replace(/\./g, '/');
        const base = dots ? posix.join(posix.dirname(from), ...Array(dots - 1).fill('..'), rest) : rest;
        const hit = [`${base}.py`, `${base}/__init__.py`].find((c) => has(c)) ?? (dots === 0 ? [`${posix.dirname(from) === '.' ? '' : posix.dirname(from) + '/'}${rest}.py`].find((c) => has(c)) : undefined);
        if (hit) out.push({ from, to: hit, kind: 'imports' });
        else if (dots) out.push({ from, to: m.slice(dots), kind: 'unresolved' });
        else out.push({ from, to: m.split('.')[0], kind: 'package-dep' });
      }
    }
    tree.delete();
  }
  return out;
}

export function goEdges(ts, files, modulePath) {
  const out = [];
  for (const [from, src] of files) {
    const tree = ts.parse('go', src);
    for (const n of tree.rootNode.descendantsOfType('import_spec')) {
      const spec = n.childForFieldName('path').text.slice(1, -1);
      if (spec === modulePath || spec.startsWith(modulePath + '/')) {
        const dir = spec.slice(modulePath.length + 1);
        const hit = [...files.keys()].filter((f) => posix.dirname(f) === dir && f !== from && !f.endsWith('_test.go')).sort()[0];
        out.push(hit ? { from, to: hit, kind: 'imports' } : { from, to: spec, kind: 'unresolved' });
      } else if (!spec.split('/')[0].includes('.')) out.push({ from, to: spec, kind: 'ext' });
      else out.push({ from, to: spec, kind: 'unresolved' });
    }
    tree.delete();
  }
  return out;
}
