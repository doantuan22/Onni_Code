// Real consumer smoke test: download RTK, install the tarball, and use only staged assets.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stageEngine } from './stage-engine.mjs';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const temporary = join(repo, '.tmp');
mkdirSync(temporary, { recursive: true });
const stage = mkdtempSync(join(temporary, 'rtk-engine-'));
const engine = await stageEngine(stage);
const work = join(engine, 'node_modules', '@onni', 'work');
const binary = join(work, 'dist', 'bin', 'rtk', process.platform === 'win32' ? 'rtk.exe' : 'rtk');
for (const name of ['LICENSE', 'NOTICE.txt']) {
  assert.ok(existsSync(join(dirname(binary), name)), 'RTK ' + name);
}
const version = execFileSync(binary, ['--version'], { encoding: 'utf8', windowsHide: true }).trim();
assert.match(version, /1\.2\.0/);
const context = await import(pathToFileURL(join(work, 'dist', 'dispatch', 'worker-context.js')).href);
assert.equal(context.workerRtkAvailable({ PATH: '' }, 'codex'), true);
const env = context.withWorkerRtkPath({ PATH: process.env.PATH ?? '' }, true);
assert.equal(env.RTK_TELEMETRY_DISABLED, '1');
assert.ok(env.PATH.startsWith(dirname(binary)));

const fixture = join(stage, 'fixture');
mkdirSync(fixture);
writeFileSync(join(fixture, 'parser.ts'), 'export function parsePayload(raw: string) { return raw.trim(); }\n');
execFileSync('git', ['init', '-q'], { cwd: fixture, windowsHide: true });
execFileSync('git', ['add', 'parser.ts'], { cwd: fixture, windowsHide: true });
execFileSync('git', ['-c', 'user.name=Onni CI', '-c', 'user.email=ci@example.invalid', 'commit', '-qm', 'fixture'], { cwd: fixture, windowsHide: true });
const map = await context.workerRepoMap(fixture, fixture, 'parser.ts', { ...process.env, ONNI_WORKER_REPO_MAP: '1' });
assert.equal(map.state, 'ready');
assert.ok(map.text.includes('parsePayload'));
const log = execFileSync(binary, ['git', 'log', '-n', '1'], { cwd: fixture, env, encoding: 'utf8', windowsHide: true });
assert.ok(log.includes('fixture'));
const status = execFileSync(binary, ['git', 'status'], { cwd: fixture, env, encoding: 'utf8', windowsHide: true });
const result = { stage, engine, version, mapBytes: Buffer.byteLength(map.text), gitLog: 'ok', gitStatus: status.trim() };
writeFileSync(join(stage, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
