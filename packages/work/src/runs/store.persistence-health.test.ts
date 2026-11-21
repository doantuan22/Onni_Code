import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { runRecordSchema as wireRunSchema } from '@onni/contract';
import { RunStore, runRecordSchema } from './store.ts';

const failure = vi.hoisted(() => ({ path: '', code: '' }));
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return {
    ...fs,
    appendFileSync: (...args: Parameters<typeof fs.appendFileSync>) => {
      if (String(args[0]) === failure.path && failure.code) {
        throw Object.assign(new Error('refused'), { code: failure.code });
      }
      return fs.appendFileSync(...args);
    },
  };
});

let store: RunStore | undefined;
let dataDir: string | undefined;
afterEach(() => {
  failure.code = '';
  store?.flush();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

it.each(['EACCES', 'EPERM'])('exposes live-only history on %s and publishes recovery without replaying lost events', (code) => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  dataDir = mkdtempSync(join(tmpdir(), 'onni-history-health-'));
  store = RunStore.open(dataDir);
  const run = store.createRun({ title: 't', workflow: 'w', task: 't', steps: [] });
  const other = store.createRun({ title: 'other', workflow: 'w', task: 'other', steps: [] });
  failure.path = join(dataDir, 'runs', `${run.id}.ndjson`);
  const changes: unknown[] = [];
  const live: unknown[] = [];
  store.on('run', (record) => changes.push(record.historyLiveOnly));
  store.on('event', (event) => live.push(event));
  expect(run).not.toHaveProperty('historyLiveOnly');
  store.appendEvent(run.id, { type: 'note', text: 'saved' });
  failure.code = code;
  store.appendEvent(run.id, { type: 'note', text: 'lost' });
  expect(store.getRun(run.id)?.historyLiveOnly).toBe(true);
  expect(other).not.toHaveProperty('historyLiveOnly');
  expect(changes).toEqual([true]);
  store.appendEvent(run.id, { type: 'note', text: 'also lost' });
  expect(changes).toEqual([true]);
  for (const schema of [runRecordSchema, wireRunSchema]) {
    expect(schema.parse(run).historyLiveOnly).toBe(true);
    const { historyLiveOnly: _, ...legacy } = run;
    expect(schema.parse(legacy)).not.toHaveProperty('historyLiveOnly');
  }
  failure.code = '';
  store.appendEvent(run.id, { type: 'note', text: 'recovered' });
  expect(run.historyLiveOnly).toBe(false);
  expect(changes).toEqual([true, false]);
  expect(live).toHaveLength(4);
  const history = readFileSync(failure.path, 'utf8');
  expect(history).toContain('recovered');
  expect(history).not.toContain('lost');
});
