import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const base = path.join(repo, 'docs/design/project-graph/spikes/golden');
const files = JSON.parse(fs.readFileSync(path.join(base, 'files.json'), 'utf8'));
const candidate = JSON.parse(fs.readFileSync(path.join(base, 'edges.json'), 'utf8'));
const fileSet = new Set(files);
const key = (from, to) => `${from}\0${to}`;
const result = await esbuild.build({
  absWorkingDir: repo, entryPoints: files, outdir: '.tmp-golden-metafile', bundle: true, write: false, metafile: true, treeShaking: false,
  packages: 'external', logLevel: 'silent', platform: 'node', format: 'esm', loader: { '.png': 'file', '.svg': 'dataurl', '.css': 'empty' },
  plugins: [{ name: 'unresolved-as-external', setup(build) {
    build.onResolve({ filter: /^\./ }, (args) => {
      const base = path.resolve(args.resolveDir, args.path);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.js`.replace(/\.js$/, '.ts'), path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
      return candidates.some((f) => fs.existsSync(f)) ? undefined : { path: args.path, external: true };
    });
  } }],
});
const expected = new Set();
for (const [input, info] of Object.entries(result.metafile.inputs)) {
  const from = input.replaceAll('\\', '/');
  if (!fileSet.has(from)) continue;
  for (const imported of info.imports) {
    if (imported.external || !imported.path) continue;
    const to = imported.path.replaceAll('\\', '/');
    if (fileSet.has(to)) expected.add(key(from, to));
  }
}
const actual = new Set(candidate.filter((e) => files.includes(e.from) && files.includes(e.to) && ['imports', 'type-imports', 'reexports', 'dynamic-import'].includes(e.kind)).map((e) => key(e.from, e.to)));
const missing = [...expected].filter((x) => !actual.has(x));
const extra = [...actual].filter((x) => !expected.has(x));
const evidenceErrors = candidate.filter((edge) => {
  const [source, lineText] = edge.evidence.split(':');
  const lines = fs.readFileSync(path.join(repo, source), 'utf8').split(/\r?\n/);
  const line = lines.slice(Number(lineText) - 1, Number(lineText) + 39).join('\n');
  return !(/\b(import|export)\b/.test(line) && (edge.kind === 'unresolved' || /['"]/.test(line) || /\bimport\s*\(/.test(line)));
});
console.log(JSON.stringify({
  method: 'esbuild metafile resolution (bundle:true, write:false; type-only/dead imports may be omitted)',
  regexPairs: actual.size, esbuildResolvedPairs: expected.size, intersection: actual.size - extra.length,
  regexPairsRetainedByEsbuild: actual.size - extra.length, esbuildPairsMissedByRegex: missing.length,
  candidateEvidenceLines: candidate.length, evidenceLinesWithImportSyntax: candidate.length - evidenceErrors.length,
  evidenceErrorExamples: evidenceErrors.slice(0, 5).map((edge) => edge.evidence),
  note: 'Pair agreement is diagnostic only: esbuild removes type-only and tree-shaken imports, while the golden includes source-level edges.',
  missingExamples: missing.slice(0, 5), extraExamples: extra.slice(0, 5),
}, null, 2));
