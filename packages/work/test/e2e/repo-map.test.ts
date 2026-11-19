import assert from 'node:assert/strict';
import { execFile as callback } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { firstPackReport, REPO_MAP_ASSETS } from '../../src/pack-check.ts';

const execFile = promisify(callback);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const npmCli = process.env.npm_execpath;

test('the production tarball provides native-free WASM navigation', { timeout: 120_000 }, async () => {
  assert.ok(npmCli, 'run through npm run test:package');
  const root = await mkdtemp(join(tmpdir(), 'onni-wasm-package-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'npm_config_allow_scripts'));
  try {
    const packDir = join(root, 'pack');
    await mkdir(packDir);
    const packed = await execFile(process.execPath, [npmCli, 'pack', '--json', '--ignore-scripts', '--pack-destination', packDir], { cwd: repoRoot, env, maxBuffer: 10 * 1024 * 1024 });
    const record = firstPackReport(JSON.parse(packed.stdout));
    assert.ok(record?.filename && record.files);
    for (const asset of REPO_MAP_ASSETS) assert.ok(record.files.some((file) => file.path === asset), asset);
    const consumer = join(root, 'consumer');
    await mkdir(consumer);
    await writeFile(join(consumer, 'package.json'), '{"private":true}\n');
    await execFile(process.execPath, [npmCli, 'install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', join(packDir, record.filename)], { cwd: consumer, env, maxBuffer: 10 * 1024 * 1024 });
    const packageRoot = join(consumer, 'node_modules', '@onni', 'work');
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
    assert.equal(manifest.dependencies['@snevins/repo-mapper'], undefined);
    const fixtureRepo = join(root, 'fixture');
    await mkdir(fixtureRepo);
    await execFile('git', ['init', '-q'], { cwd: fixtureRepo });
    // Spec 2026-11-18: a consumer gets WASM, never native grammar installation.
    await writeFile(join(fixtureRepo, 'parser.ts'), 'export function parsePayload(raw: string) { return raw.trim(); }\n');
    await execFile('git', ['add', 'parser.ts'], { cwd: fixtureRepo });
    await execFile('git', ['-c', 'user.name=Onni CI', '-c', 'user.email=ci@example.invalid', 'commit', '-m', 'parser fixture'], { cwd: fixtureRepo });
    const probePath = join(root, 'probe-map.mjs');
    await writeFile(probePath, `
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = process.argv[2];
const require = createRequire(pathToFileURL(root + '/package.json'));
for (const name of ['@snevins/repo-mapper', 'tree-sitter', 'tree-sitter-typescript', 'node-gyp-build']) {
  let found = false;
  try { require.resolve(name); found = true; } catch {}
  if (found) throw new Error('Unexpected native mapper dependency: ' + name);
}
const { workerRepoMap } = await import(pathToFileURL(root + '/dist/dispatch/worker-context.js'));
const map = await workerRepoMap(process.cwd(), process.cwd(), 'parser.ts', { ...process.env, ONNI_WORKER_REPO_MAP: '1' });
if (map.state !== 'ready' || !map.text.includes('parsePayload')) throw new Error('Packaged WASM mapper failed: ' + JSON.stringify(map));
console.log('packaged WASM mapper ready');
`);
    const probe = await execFile(process.execPath, [probePath, packageRoot], { cwd: fixtureRepo, timeout: 20_000 });
    assert.match(probe.stdout, /packaged WASM mapper ready/);

  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
