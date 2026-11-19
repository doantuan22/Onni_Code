// Build-only RepoMapper dependencies include native bindings; consumers need only WASM.
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const entry = require.resolve('@snevins/repo-mapper');
const mapperRequire = createRequire(entry);
const source = dirname(entry);
const destination = fileURLToPath(new URL('../dist/vendor/repo-map/', import.meta.url));
const grammars = {
  typescript: 'tree-sitter-typescript', tsx: 'tree-sitter-typescript',
  javascript: 'tree-sitter-javascript', python: 'tree-sitter-python',
  go: 'tree-sitter-go', rust: 'tree-sitter-rust', solidity: 'tree-sitter-solidity',
};
mkdirSync(join(destination, 'grammars'), { recursive: true });
const notices = [
  'RepoMapper 1.5.3 (MIT)\n' + readFileSync(join(source, '..', 'LICENSE'), 'utf8'),
  'ignore (MIT)\n' + readFileSync(join(dirname(mapperRequire.resolve('ignore')), 'LICENSE-MIT'), 'utf8'),
];
for (const [language, name] of Object.entries(grammars)) {
  const packageRoot = dirname(mapperRequire.resolve(name + '/package.json'));
  const wasm = 'tree-sitter-' + language + '.wasm';
  copyFileSync(join(packageRoot, wasm), join(destination, 'grammars', wasm));
  const license = readFileSync(join(packageRoot, 'LICENSE'), 'utf8');
  notices.push(name + '\n' + license);
}
writeFileSync(join(destination, 'LICENSES.txt'), notices.join('\n\n'));
writeFileSync(join(destination, 'NOTICE.txt'),
  'RepoMapper 1.5.3 (MIT), https://github.com/stevennevins/repo-mapper\n' +
  'Tree-sitter grammar licenses are reproduced in LICENSES.txt. Native bindings are not bundled.\n');
await build({
  stdin: {
    contents: [
      "import { LANGUAGE_REGISTRY } from './languages.js';",
      "import { fileURLToPath } from 'node:url';",
      "for (const config of Object.values(LANGUAGE_REGISTRY)) {",
      "  config.wasmPath = () => fileURLToPath(new URL('./grammars/tree-sitter-' + config.grammarName + '.wasm', import.meta.url));",
      "}",
      ...['parser', 'graph', 'ranking', 'pagerank', 'dedup', 'output', 'files']
        .map(name => 'export * as ' + name + ' from "./' + name + '.js";'),
    ].join('\n'),
    resolveDir: source, sourcefile: 'onni-repo-map.js',
  },
  outfile: join(destination, 'index.js'),
  bundle: true, platform: 'node', format: 'esm', target: 'node20',
  external: ['web-tree-sitter'],
});
console.log('bundle-repo-map ok — JavaScript + seven WASM grammars; no native install scripts');
