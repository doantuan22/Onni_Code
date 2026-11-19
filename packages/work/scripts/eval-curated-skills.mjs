// Explicit, manual model evaluation. Never imported or invoked by the service or test suites.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../skills-curated/', import.meta.url));
const repeats = Number(process.argv[2] ?? 3);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) throw new Error('repeats must be 1..3');
const output = resolve(process.argv[3] ?? '.tmp/curated-evaluation');
await mkdir(output, { recursive: true });
const cwd = await mkdtemp(join(tmpdir(), 'onni-skill-eval-'));
const cases = [
  { id: 'stale-response', skill: 'onni-debug', task: 'Review this code: let cache; async function load(){cache=await getProjects()} async function remove(id){await deleteProject(id);invalidateProjects()} An initial load starts before DELETE and resolves afterward. Identify the bug, a minimal fix and a deterministic regression test. Is restarting a fix?' },
  { id: 'scope-leak', skill: 'onni-react', task: 'A multi-project React app caches GET /p/:id/tasks under query key [tasks], and keeps an editor draft in useState(initialTask) while only the URL project parameter changes. Explain two concrete failure scenarios and scoped fixes. Do not migrate libraries.' },
  { id: 'partial-proof', skill: 'onni-verify', task: 'Assess this worker report: 12 unit tests passed. Browser provisioning failed; e2e script returned exit 0 with TEST_E2E_STATUS=skipped. npm run build is still running. Worker says all tests pass and installed desktop is fixed. State precisely what can be claimed and what evidence is missing.' },
];
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const results = [];
const cli = process.env.APPDATA ? join(process.env.APPDATA, 'npm/node_modules/@openai/codex/bin/codex.js') : null;
for (let repetition = 0; repetition < repeats; repetition++) {
  for (const test of cases) {
    for (const mode of repetition % 2 ? ['adapted', 'baseline'] : ['baseline', 'adapted']) {
      const instructions = mode === 'adapted' ? await readFile(join(root, `skills/${test.skill}/SKILL.md`), 'utf8') : '';
      const prompt = `This is a read-only synthetic evaluation. Do not use tools, files, commands, network or delegation. Answer from the fixture only in at most 180 words.\n${instructions}\nTask:\n${test.task}`;
      const args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '-C', cwd, '-'];
      const start = Date.now();
      const result = await new Promise(resolveResult => {
        const child = spawn(cli ? process.execPath : 'codex', cli ? [cli, ...args] : args, { stdio: ['pipe','pipe','pipe'], windowsHide: true });
        let stdout = '', stderr = '';
        const timer = setTimeout(() => child.kill(), 90_000);
        child.stdout.on('data', data => stdout += data);
        child.stderr.on('data', data => stderr += data);
        child.on('error', error => { clearTimeout(timer); resolveResult({code:null, stdout, error:error.message}); });
        child.on('close', code => { clearTimeout(timer); resolveResult({code, stdout, error: code === 0 ? null : stderr.slice(-1500)}); });
        child.stdin.end(prompt);
      });
      const events = result.stdout.split('\n').flatMap(line => { try {return [JSON.parse(line)]} catch {return []} });
      const answer = events.filter(e => e.item?.type === 'agent_message').map(e => e.item.text).join('\n');
      const usage = events.findLast(e => e.type === 'turn.completed')?.usage;
      const toolItems = events.filter(e => e.item && !['agent_message','reasoning'].includes(e.item.type)).map(e => ({type:e.item.type}));
      const toolCalls = toolItems.length;
      results.push({case:test.id, skill:test.skill, repetition, mode, code:result.code, elapsedMs:Date.now()-start, usage, toolCalls, toolItems, answer, error:result.error});
      await writeFile(join(output,'results.json'), JSON.stringify({manifestVersion:manifest.version, status:'pilot; manual rubric review required; not a statistical quality ranking', cases, results},null,2)+'\n');
      console.log(`${test.id}/${mode}/${repetition}: exit=${result.code}, tools=${toolCalls}, ${Date.now()-start}ms`);
      if (result.code !== 0 || toolCalls > 0) throw new Error('Evaluation stopped: failed run or fixture-only scope was exceeded; see results.json');
    }
  }
}
