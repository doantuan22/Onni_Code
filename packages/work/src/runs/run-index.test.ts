import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRunIndexReader, readRunIndexFromDisk } from './run-index.ts';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});

const roots: string[] = [];
const initialTime = new Date('2026-01-01T00:00:00.000Z');
const laterTime = new Date('2026-01-02T00:00:00.000Z');
const record = (id: string, title = id) => ({
  id, title, workflow: 'test', task: 'task', status: 'done',
  createdAt: '2026-01-01T00:00:00.000Z', tokensUsed: 0, archived: false, steps: [],
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'onni-index-cache-'));
  roots.push(dir);
  return dir;
}

function disk(dir: string, rows: unknown, time = initialTime) {
  const path = join(dir, 'runs.json');
  writeFileSync(path, JSON.stringify(rows));
  utimesSync(path, time, time);
  return path;
}

const indexReads = (path: string) => vi.mocked(readFileSync).mock.calls.filter(([file]) => file === path).length;

beforeEach(() => { vi.mocked(readFileSync).mockClear(); });
afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('createRunIndexReader', () => {
  it('hits the cache for unchanged mtime and size and gives callers independent arrays', () => {
    const dir = fixture();
    const path = disk(dir, [record('first'), record('second')]);
    const reader = createRunIndexReader();
    const first = reader.read(dir);
    expect(first.map(run => run.id)).toEqual(['first', 'second']);
    const second = reader.read(dir);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    first.reverse();
    second.pop();
    expect(reader.read(dir).map(run => run.id)).toEqual(['first', 'second']);
    expect(indexReads(path)).toBe(1);
  });

  it('invalidates when only mtime changes', () => {
    const dir = fixture();
    const path = disk(dir, [record('run', 'before')]);
    const reader = createRunIndexReader();
    expect(reader.read(dir)[0]?.title).toBe('before');
    const before = statSync(path);
    disk(dir, [record('run', 'after!')], laterTime);
    expect(statSync(path).size).toBe(before.size);
    expect(statSync(path).mtimeMs).not.toBe(before.mtimeMs);
    expect(reader.read(dir)[0]?.title).toBe('after!');
    expect(indexReads(path)).toBe(2);
  });

  it('invalidates when only size changes', () => {
    const dir = fixture();
    const path = disk(dir, [record('run', 'before')]);
    const reader = createRunIndexReader();
    expect(reader.read(dir)[0]?.title).toBe('before');
    const before = statSync(path);
    disk(dir, [record('run', 'a longer title')]);
    expect(statSync(path).mtimeMs).toBe(before.mtimeMs);
    expect(statSync(path).size).not.toBe(before.size);
    expect(reader.read(dir)[0]?.title).toBe('a longer title');
    expect(indexReads(path)).toBe(2);
  });

  it('retries a transient read failure with unchanged metadata instead of caching an empty result', () => {
    const dir = fixture();
    const path = disk(dir, [record('run')]);
    const before = statSync(path);
    const reader = createRunIndexReader();
    vi.mocked(readFileSync).mockImplementationOnce(() => { throw new Error('transient read failure'); });
    expect(reader.read(dir)).toEqual([]);
    expect(statSync(path).mtimeMs).toBe(before.mtimeMs);
    expect(statSync(path).size).toBe(before.size);
    expect(reader.read(dir).map(run => run.id)).toEqual(['run']);
    expect(reader.read(dir).map(run => run.id)).toEqual(['run']);
    expect(indexReads(path)).toBe(2);
  });

  it('discards an older cache entry after a failed refresh and retries the new index', () => {
    const dir = fixture();
    const path = disk(dir, [record('old')]);
    const reader = createRunIndexReader();
    expect(reader.read(dir).map(run => run.id)).toEqual(['old']);
    disk(dir, [record('new')], laterTime);
    vi.mocked(readFileSync).mockImplementationOnce(() => { throw new Error('transient refresh failure'); });
    expect(reader.read(dir)).toEqual([]);
    expect(reader.read(dir).map(run => run.id)).toEqual(['new']);
    expect(indexReads(path)).toBe(3);
  });

  it('omits tombstoned runs even when the saved index still contains them', () => {
    const dir = fixture();
    disk(dir, [record('deleted'), record('kept')]);
    mkdirSync(join(dir, 'runs'));
    writeFileSync(join(dir, 'runs', '.index-tombstones.json'), JSON.stringify(['deleted']));
    const reader = createRunIndexReader();
    expect(reader.read(dir).map(run => run.id)).toEqual(['kept']);
    expect(reader.read(dir).map(run => run.id)).toEqual(['kept']);
  });

  it('drops workflowDef on both fresh and cached reads without changing disk or the legacy reader', () => {
    const dir = fixture();
    const workflowDef = { name: 'test', steps: [], source: 'file' };
    const rows = [{ ...record('run'), workflowDef }];
    const path = disk(dir, rows);
    const reader = createRunIndexReader();
    for (const runs of [reader.read(dir), reader.read(dir)]) {
      expect(runs).toEqual([record('run')]);
      expect(runs[0]).not.toHaveProperty('workflowDef');
    }
    expect(indexReads(path)).toBe(1);
    expect(readRunIndexFromDisk(dir)[0]?.workflowDef).toEqual(workflowDef);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(rows);
  });

  it('retain prunes removed projects while preserving cached retained projects', () => {
    const removed = fixture();
    const retained = fixture();
    const removedPath = disk(removed, [record('removed')]);
    const retainedPath = disk(retained, [record('retained')]);
    const reader = createRunIndexReader();
    expect(reader.read(removed).map(run => run.id)).toEqual(['removed']);
    expect(reader.read(retained).map(run => run.id)).toEqual(['retained']);
    reader.retain([retained]);
    expect(reader.read(retained).map(run => run.id)).toEqual(['retained']);
    expect(indexReads(retainedPath)).toBe(1);
    expect(reader.read(removed).map(run => run.id)).toEqual(['removed']);
    expect(indexReads(removedPath)).toBe(2);
    reader.retain([]);
    expect(reader.read(retained).map(run => run.id)).toEqual(['retained']);
    expect(indexReads(retainedPath)).toBe(2);
  });
});
