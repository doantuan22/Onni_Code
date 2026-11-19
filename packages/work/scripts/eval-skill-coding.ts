// Manual, bounded coding evaluation. Never runs during build, tests or application startup.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunner } from '../src/core/runner-factory.ts';
import type { AgentEvent, AgentSession } from '../src/core/agent-runner.ts';
import type { UiEvent } from '../src/core/ui-events.ts';
import { parseFrontmatter } from '../src/skills.ts';
import { codingFixtures } from './skill-coding-fixtures.ts';
import { disclaimedCommand } from '../src/core/disclaim-spawn.ts';
import { resolveCodexExecutable } from '../src/core/codex-app-server-transport.ts';

const options = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!key || !value || !['--model', '--out', '--seed', '--repetitions', '--case', '--preflight-only'].includes(key)) throw Error('Expected --model ID [--out DIR --seed N --repetitions 1..3 --case B01 --preflight-only 1]');
  options.set(key, value);
}
const model = options.get('--model');
if (!model && !options.has('--preflight-only')) throw Error('--model must name an explicit installed backend model; no silent default');
const repetitions = Number(options.get('--repetitions') ?? 1);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3) throw Error('repetitions must be 1..3');
let seed = Number(options.get('--seed') ?? 20261120);
if (!Number.isSafeInteger(seed)) throw Error('seed must be an integer');
const originalSeed = seed;
const shuffle = <T>(items: readonly T[]): T[] => [...items].map(value => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { value, order: seed };
}).sort((a, b) => a.order - b.order).map(entry => entry.value);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const output = resolve(options.get('--out') ?? '.tmp/skill-coding-smoke');
await mkdir(output, { recursive: true });
const selected = codingFixtures.filter(test => !options.has('--case') || options.get('--case') === test.id);
if (!selected.length) throw Error('Unknown fixture');
const scratch = await mkdtemp(join(tmpdir(), 'onni-coding-smoke-'));
const repository = fileURLToPath(new URL('../../..', import.meta.url));
const sourceCommit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).stdout?.trim();
const sourceDiff = spawnSync('git', ['diff', '--', 'packages/work/src', 'packages/contract/src'], { cwd: repository, encoding: 'utf8', maxBuffer: 8_000_000 }).stdout ?? '';
const results: Record<string, unknown>[] = [];
const preflight: Record<string, unknown>[] = [];
const [versionFile, versionArgs] = disclaimedCommand(resolveCodexExecutable(), ['--version'], process.env);
const version = spawnSync(versionFile, versionArgs, { encoding: 'utf8', timeout: 10_000, windowsHide: true });
const cliVersion = version.status === 0 ? version.stdout.trim() : 'unavailable';
const nativeModelVersionLimit = 'Requested model ID is pinned; the runner may expose an alias, not an immutable model snapshot. Native user configuration is shared across all arms.';
const base = 'Work only in this synthetic fixture workspace. Follow its AGENTS.md. Do not access parent directories, credentials, network, plugins or other projects. Do not delegate, commit, push or install dependencies. Implement the task; report the actual commands and results concisely.';
process.env.ONNI_CODEX_NETWORK = '0'; // Existing runner switch: workspace-write instead of full host access.
delete process.env.ONNI_DRY_RUN;
let current: AgentSession | undefined;
let stopping = false;
process.once('SIGINT', () => { stopping = true; current?.interrupt(); });
async function save() {
  const target = join(output, 'results.json');
  const temporary = `${target}.tmp`;
  await writeFile(temporary, JSON.stringify({
    status: 'exploratory smoke; no automatic promotion', backend: 'codex', model, nativeModelVersionLimit,
    sourceCommit, sourceDiffSha256: digest(sourceDiff), cliVersion, seed: originalSeed, repetitions,
    sandbox: 'workspace-write', network: false, maxRunMs: 600_000, scratch, preflight, results,
  }, null, 2) + '\n', { mode: 0o600 });
  await rename(temporary, target);
}
async function snapshot(directory: string, prefix = ''): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, await snapshot(join(directory, entry.name), relative));
    else if (entry.isFile()) files[relative] = digest(await readFile(join(directory, entry.name), 'utf8'));
  }
  return files;
}
await save();
for (const fixture of selected) {
  const checks: number[] = [];
  for (const condition of ['original', 'reference'] as const) {
    const cwd = join(scratch, `preflight-${fixture.id}-${condition}`);
    await mkdir(cwd);
    for (const [path, content] of Object.entries({ ...fixture.files, ...(condition === 'reference' ? fixture.solution : {}) })) {
      await mkdir(dirname(join(cwd, path)), { recursive: true }); await writeFile(join(cwd, path), content);
    }
    await writeFile(join(cwd, 'judge.test.mjs'), `import assert from 'node:assert/strict';\nimport test from 'node:test';\n${fixture.judge}\n`);
    const checked = spawnSync(process.execPath, ['--test', 'judge.test.mjs'], { cwd, encoding: 'utf8', timeout: 10_000 });
    if (checked.error || checked.status === null) throw Error(`Grader infrastructure failed: ${fixture.id}`);
    checks.push(checked.status);
    preflight.push({ case: fixture.id, condition, exit: checked.status, output: checked.stdout + checked.stderr });
  }
  await save();
  if (checks[0] === 0 || checks[1] !== 0) throw Error(`Grader must reject original and accept reference: ${fixture.id}; see results.json`);
}
if (options.has('--preflight-only')) {
  console.log(`Preflight valid: ${selected.length} graders rejected original and accepted reference; no model runs`);
  process.exitCode = 0;
} else {
for (let repetition = 0; repetition < repetitions && !stopping; repetition++) {
  for (const fixture of shuffle(selected)) {
    const raw = await readFile(new URL(`../skills-curated/skills/${fixture.skill}/SKILL.md`, import.meta.url), 'utf8');
    const pilot = parseFrontmatter(raw).body.trim();
    // Keep role restrictions identical; candidate instructions are unshipped hypotheses.
    const footer = pilot.slice(pilot.lastIndexOf("Apply the user's scope"));
    for (const arm of shuffle(['baseline', 'pilot', 'candidate'] as const)) {
      if (stopping) break;
      const key = `${fixture.id}-${repetition}-${arm}`;
      const cwd = join(scratch, key);
      await mkdir(cwd);
      const files = { ...fixture.files, 'AGENTS.md': base + '\n',
        'package.json': JSON.stringify({ private: true, type: 'module', scripts: { test: 'node --test' } }) + '\n' };
      for (const [path, content] of Object.entries(files)) {
        await mkdir(dirname(join(cwd, path)), { recursive: true }); await writeFile(join(cwd, path), content);
      }
      const before = await snapshot(cwd);
      const instructions = arm === 'baseline' ? '' : arm === 'pilot' ? pilot : `${fixture.candidate}\n\n${footer}`;
      const systemPrompt = instructions ? `${base}\n\nSelected skill: /${fixture.skill}\n${instructions}` : base;
      const events: AgentEvent[] = [], uiEvents: UiEvent[] = [];
      const startedAt = Date.now();
      let timeToSessionMs: number | undefined, timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let escalation: ReturnType<typeof setTimeout> | undefined;
      let error: string | undefined;
      let answer = '', tokensUsed: number | undefined;
      try {
        current = createRunner('codex').startSession({
          cwd, model, userPrompt: fixture.task, systemPrompt, timeoutMs: 600_000,
        }, event => {
          events.push(event);
          if (event.type === 'session' && timeToSessionMs === undefined) timeToSessionMs = Date.now() - startedAt;
        }, { autoEndAfterFirstTurn: true, onUiEvent: event => { uiEvents.push(event); } });
        const owned = current;
        timer = setTimeout(() => {
          timedOut = true; owned.interrupt();
          escalation = setTimeout(() => owned.hardStop?.(), 5_000);
        }, 600_000);
        const result = await owned.result; // The runner settles only after its owned process exits.
        answer = result.text; tokensUsed = result.tokensUsed;
      } catch (failure) { error = failure instanceof Error ? failure.message : String(failure); }
      finally { clearTimeout(timer); clearTimeout(escalation); current = undefined; }
      const elapsedMs = Date.now() - startedAt;
      const after = await snapshot(cwd);
      const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(path => before[path] !== after[path]);
      const judgeDir = join(scratch, `${key}-judge`);
      await cp(cwd, judgeDir, { recursive: true, filter: source => !/(?:^|[\\/])(?:node_modules|\.git)(?:[\\/]|$)/.test(source) });
      await writeFile(join(judgeDir, 'judge.test.mjs'), `import assert from 'node:assert/strict';\nimport test from 'node:test';\n${fixture.judge}\n`);
      const judge = spawnSync(process.execPath, ['--test', 'judge.test.mjs'], { cwd: judgeDir, encoding: 'utf8', timeout: 10_000, maxBuffer: 2_000_000, windowsHide: true });
      const scopePassed = fixture.id !== 'B12' || changed.every(path => path === 'README.md');
      const errors = events.filter(event => event.type === 'error');
      const launchFailure = /registered Core launch requires an installed app|sandbox setup failed|failed to create (?:command|process).*sandbox/i
        .test(JSON.stringify(events.filter(event => event.type === 'tool-result')));
      const valid = !timedOut && !error && !errors.length && !launchFailure && timeToSessionMs !== undefined && events.some(event => event.type === 'turn-end');
      const record = {
        case: fixture.id, skill: fixture.skill, arm, repetition, elapsedMs, timeToSessionMs,
        promptSha256: digest(systemPrompt + '\n' + fixture.task), skillSha256: digest(instructions), fixtureSha256: digest(JSON.stringify(files)),
        valid, timedOut, error, errors, launchFailure, tokensUsed,
        reportedModels: uiEvents.flatMap(event => event.type === 'session.started' && event.model ? [event.model] : []),
        usage: uiEvents.filter(event => event.type === 'usage.updated'),
        toolCalls: events.filter(event => event.type === 'tool-call').length,
        passed: valid && judge.status === 0 && scopePassed, scopePassed, changed,
        judgeExit: judge.status, judgeError: judge.error?.message, judgeOutput: judge.stdout + judge.stderr, answer,
      };
      results.push(record);
      await writeFile(join(output, `${key}-events.json`), JSON.stringify({ events, uiEvents }, null, 2) + '\n', { mode: 0o600 });
      await save();
      console.log(`${key}: valid=${valid} passed=${record.passed} elapsed=${elapsedMs}ms tools=${record.toolCalls}`);
      if (!valid) throw Error(`Smoke stopped on infrastructure-invalid result: ${key}; inspect ${join(output, 'results.json')}`);
    }
  }
}
console.log(`Saved ${results.length} results; fixtures retained at ${scratch}`);
}
