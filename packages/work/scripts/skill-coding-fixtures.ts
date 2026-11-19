/** Synthetic coding smoke cases; judge code is never placed in the agent's workspace. */
export interface CodingFixture {
  id: string;
  skill: string;
  task: string;
  files: Record<string, string>;
  judge: string;
  candidate: string;
  solution: Record<string, string>;
}

export const codingFixtures: CodingFixture[] = [
  {
    id: 'B01', skill: 'onni-debug',
    task: 'Fix cache.mjs: a load started before a successful remove can restore the deleted row. Concurrent loads must use the newest invocation. Keep the exported API and immediate removal; failed removal must preserve data. Add a deterministic regression test with controlled promises. Do not add polling or dependencies.',
    files: {
      'cache.mjs': `export function createCache(read, removeRemote) {
  let data = [];
  return {
    get data() { return data; },
    async load() { data = await read(); },
    async remove(id) { await removeRemote(id); data = data.filter(row => row.id !== id); },
  };
}
`,
    },
    judge: `import { createCache } from './cache.mjs';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test('delete dominates an earlier unfinished read', async () => {
  const old = deferred(); let calls = 0;
  const cache = createCache(() => ++calls === 1 ? Promise.resolve([{id:'a'},{id:'b'}]) : old.promise, async () => {});
  await cache.load(); const pending = cache.load(); await cache.remove('a');
  assert.deepEqual(cache.data, [{id:'b'}]); old.resolve([{id:'a'},{id:'b'}]); await pending;
  assert.deepEqual(cache.data, [{id:'b'}]);
});
test('newer load wins and failed deletion retains data', async () => {
  const a = deferred(), b = deferred(); let count = 0;
  const cache = createCache(() => ++count === 1 ? a.promise : b.promise, async () => { throw Error('offline'); });
  const first = cache.load(), next = cache.load(); b.resolve([{id:'new'}]); await next;
  a.resolve([{id:'old'}]); await first; assert.deepEqual(cache.data, [{id:'new'}]);
  await assert.rejects(cache.remove('new')); assert.deepEqual(cache.data, [{id:'new'}]);
});`,
    candidate: 'Reproduce the concrete failure with controlled inputs before editing. Trace async operations and ownership of shared state; distinguish invocation order from completion order. Fix the demonstrated cause at its owner, preserve error behavior and public interfaces, and prove the regression fails against the original code. Report the commands and observed results. Avoid timers, polling, new transports or broad rewrites unless evidence requires them.',
    solution: { 'cache.mjs': `export function createCache(read, removeRemote) {
  let data = [], version = 0;
  return { get data() { return data; }, async load() { const current = ++version; const next = await read(); if (current === version) data = next; },
    async remove(id) { await removeRemote(id); version++; data = data.filter(row => row.id !== id); } };
}` },
  },
  {
    id: 'B03', skill: 'onni-react',
    task: 'Fix state.mjs for a multi-project UI: server cache entries and editor drafts must not leak between projects. Draft edits belong to the (project, task) pair. Returning to the same pair must retain unsaved edits; a different pair uses its own initial text. Preserve API. Add behavior tests; do not introduce React, a new cache library or persistence.',
    files: {
      'state.mjs': `export function createState() {
  const cache = new Map(); let draft;
  return {
    setTasks(project, tasks) { cache.set('tasks', tasks); },
    tasks(project) { return cache.get('tasks') ?? []; },
    open(project, task, initial) { draft ??= initial; return draft; },
    edit(project, task, text) { draft = text; },
  };
}
`,
    },
    judge: `import { createState } from './state.mjs';
test('cache and drafts belong to their identities', () => {
  const state = createState(); state.setTasks('p1', ['one']); state.setTasks('p2', ['two']);
  assert.deepEqual(state.tasks('p1'), ['one']); assert.deepEqual(state.tasks('p2'), ['two']); assert.deepEqual(state.tasks('p3'), []);
  assert.equal(state.open('p1','t','initial'), 'initial'); state.edit('p1','t','unsaved');
  assert.equal(state.open('p2','t','other'), 'other'); assert.equal(state.open('p1','t','server refresh'), 'unsaved');
  assert.equal(state.open('p1','t2','second task'), 'second task');
});
test('composite keys cannot collide by delimiter', () => {
  const state = createState(); state.open('a/b','c','first'); state.edit('a/b','c','draft');
  assert.equal(state.open('a','b/c','second'), 'second'); assert.equal(state.open('a/b','c','changed'), 'draft');
});`,
    candidate: 'Identify which values are server facts and which are unsaved drafts. Give each value an owner and identity including every project/resource dimension that affects it. Reuse the current cache and transport, preserve intentional edits during refetch, and verify project switches, remounts, concurrent responses and cleanup where relevant. Apply React-specific advice only when React code is involved; do not add a framework or memoization without a measured need.',
    solution: { 'state.mjs': `export function createState() {
  const cache = new Map(), drafts = new Map(); const key = (project, task) => JSON.stringify([project, task]);
  return { setTasks(project, tasks) { cache.set(project, tasks); }, tasks(project) { return cache.get(project) ?? []; },
    open(project, task, initial) { const id = key(project,task); if (!drafts.has(id)) drafts.set(id, initial); return drafts.get(id); },
    edit(project, task, text) { drafts.set(key(project,task), text); } };
}` },
  },
  {
    id: 'B06', skill: 'onni-design',
    task: 'Extend monitor.mjs with an optional timeoutMs parameter, including 0 to disable the inactivity timer. Preserve the existing 60-second default and one-shot terminal behavior. Invalid timeout values must degrade to the default. A stop() must cancel outstanding work and never call onTimeout. Add tests using injected scheduling, without real waits or dependencies.',
    files: {
      'monitor.mjs': `export function monitor({ schedule, cancel, onTimeout }) {
  let stopped = false;
  const timer = schedule(() => { if (!stopped) { stopped = true; onTimeout(); } }, 60000);
  return { stop() { if (!stopped) { stopped = true; cancel(timer); } } };
}
`,
    },
    judge: `import { monitor } from './monitor.mjs';
function setup(timeoutMs) {
  const calls = []; let fire; let fired = 0; const cancelled = [];
  const owner = monitor({ ...(timeoutMs === undefined ? {} : {timeoutMs}), schedule: (fn, ms) => { fire = fn; calls.push(ms); return 'owned'; }, cancel: id => cancelled.push(id), onTimeout: () => fired++ });
  return { calls, cancelled, owner, fire: () => fire?.(), get fired() { return fired; } };
}
test('default is bounded and terminal callback is one shot', () => { const m=setup(); assert.deepEqual(m.calls,[60000]); m.fire(); m.fire(); m.owner.stop(); assert.equal(m.fired,1); });
test('explicit zero disables timer; custom value is honored', () => { assert.deepEqual(setup(0).calls,[]); assert.deepEqual(setup(123).calls,[123]); });
test('invalid values restore the working default', () => { for (const value of [-1, NaN, Infinity, '100']) assert.deepEqual(setup(value).calls,[60000]); });
test('stop cancels its own timer and stale callback cannot fire', () => { const m=setup(10); m.owner.stop(); m.owner.stop(); m.fire(); assert.deepEqual(m.cancelled,['owned']); assert.equal(m.fired,0); });`,
    candidate: 'Before changing a working mechanism, name the guarantee it supplies on the default path. Enumerate ownership, failure behavior and transitions into terminal states. Make the smallest design that satisfies the requested extension while preserving those guarantees, including cleanup and invalid inputs. Use existing seams to verify behavior deterministically. Add abstractions only when the concrete change needs them; explain any remaining tradeoff using evidence.',
    solution: { 'monitor.mjs': `export function monitor({schedule, cancel, onTimeout, timeoutMs}) {
  const delay = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : 60000;
  let stopped = false; const timer = delay === 0 ? undefined : schedule(() => { if (!stopped) { stopped = true; onTimeout(); } }, delay);
  return { stop() { if (!stopped) { stopped = true; if (delay !== 0) cancel(timer); } } };
}` },
  },
  {
    id: 'B12', skill: 'onni-tdd',
    task: 'Documentation only: change README.md so its Start section says exactly "Run npm run dev to start the local cockpit." Keep the Title and Storage sections unchanged. Do not change code, add tests or run the test suite for this copy edit.',
    files: {
      'README.md': '# Fixture cockpit\n\n## Start\n\nRun the old launcher.\n\n## Storage\n\nState stays local.\n',
      'app.mjs': 'export const local = true;\n',
    },
    judge: `import { readFileSync, readdirSync } from 'node:fs';
test('copy edit preserves surrounding content and introduces no tests', () => {
  const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
  assert.equal(readme, '# Fixture cockpit\\n\\n## Start\\n\\nRun npm run dev to start the local cockpit.\\n\\n## Storage\\n\\nState stays local.\\n');
  assert.equal(readFileSync(new URL('./app.mjs', import.meta.url), 'utf8'), 'export const local = true;\\n');
  assert.equal(readdirSync(new URL('.', import.meta.url)).some(name => name !== 'judge.test.mjs' && /(?:test|spec)/i.test(name)), false);
});`,
    candidate: 'Use red/green cycles for changed behavior: choose an observable failing case, confirm it fails for the intended reason, implement the smallest fix, then refactor while green. Use the repository runner and public behavior rather than tests that mirror implementation. For documentation or cosmetic copy changes with no behavior change, inspect the diff and preserve scope; do not manufacture tests or dispatch extra workers. Report evidence accurately.',
    solution: { 'README.md': '# Fixture cockpit\n\n## Start\n\nRun npm run dev to start the local cockpit.\n\n## Storage\n\nState stays local.\n' },
  },
];
