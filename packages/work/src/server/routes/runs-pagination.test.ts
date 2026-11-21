import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunStore } from '../../runs/store.ts';
import type { RunManager } from '../../workflows/run.ts';
import { apiRequest } from '../loopback-request.testkit.ts';
import { createApp } from '../server.ts';

describe('GET /runs pagination', () => {
  let repoRoot: string;
  let store: RunStore;
  let app: ReturnType<typeof createApp>;
  let ids: string[];

  beforeEach(() => {
    repoRoot = mkdtempSync(join(realpathSync(tmpdir()), 'onni-runs-pagination-'));
    store = RunStore.open(join(repoRoot, '.ai/onni'));
    for (let day = 1; day <= 3; day++) {
      const run = store.createRun({ title: `run ${day}`, workflow: 'test', task: 'task', steps: [] });
      store.updateRun(run.id, {
        createdAt: `2026-11-0${day}T00:00:00.000Z`,
        workflowDef: { name: 'test', steps: [], source: 'file' },
      });
    }
    ids = store.listRuns().map(run => run.id);
    app = createApp({ repoRoot, store, manager: {} as RunManager, version: '0.0.0-test' });
  });

  afterEach(() => {
    store.flush();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('keeps the complete slim array and newest-created-first order by default', async () => {
    const response = await apiRequest(app, '/api/v1/runs');
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Next-Cursor')).toBeNull();
    const expected = store.listRuns().map(({ workflowDef: _workflowDef, ...run }) => run);
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(expected)));
    expect(store.listRuns().every(run => run.workflowDef !== undefined)).toBe(true);
  });

  it.each(['/api/v1', '/api/v1/p/default'])('limits the array and supplies the exclusive cursor at %s', async (prefix) => {
    const response = await apiRequest(app, `${prefix}/runs?limit=2`);
    expect(response.status).toBe(200);
    const rows = await response.json() as Array<{ id: string; workflowDef?: unknown }>;
    expect(rows.map(run => run.id)).toEqual(ids.slice(0, 2));
    expect(rows.every(run => !('workflowDef' in run))).toBe(true);
    expect(response.headers.get('X-Next-Cursor')).toBe(ids[1]);
  });

  it('continues exclusively after the cursor without duplicates or gaps', async () => {
    const first = await apiRequest(app, '/api/v1/runs?limit=1');
    expect(first.status).toBe(200);
    const firstRows = await first.json() as Array<{ id: string }>;
    expect(firstRows.map(run => run.id)).toEqual(ids.slice(0, 1));
    expect(first.headers.get('X-Next-Cursor')).toBe(ids[0]);
    const second = await apiRequest(app, `/api/v1/runs?limit=1&cursor=${first.headers.get('X-Next-Cursor')}`);
    expect(second.status).toBe(200);
    expect((await second.json() as Array<{ id: string }>).map(run => run.id)).toEqual(ids.slice(1, 2));
    expect(second.headers.get('X-Next-Cursor')).toBe(ids[1]);
    const last = await apiRequest(app, `/api/v1/runs?limit=1&cursor=${second.headers.get('X-Next-Cursor')}`);
    expect(last.status).toBe(200);
    expect((await last.json() as Array<{ id: string }>).map(run => run.id)).toEqual(ids.slice(2));
    expect(last.headers.get('X-Next-Cursor')).toBeNull();
  });

  it('allows a cursor without a limit and returns the remaining array without a next header', async () => {
    const response = await apiRequest(app, `/api/v1/runs?cursor=${ids[0]}`);
    expect(response.status).toBe(200);
    expect((await response.json() as Array<{ id: string }>).map(run => run.id)).toEqual(ids.slice(1));
    expect(response.headers.get('X-Next-Cursor')).toBeNull();
  });

  it.each(['', '&limit=1'])('returns an empty array for an unknown or deleted cursor%s', async (query) => {
    const response = await apiRequest(app, `/api/v1/runs?cursor=missing-run${query}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(response.headers.get('X-Next-Cursor')).toBeNull();
  });

  it.each([3, 4, 500])('omits the next header when limit=%i exhausts the list', async (limit) => {
    const response = await apiRequest(app, `/api/v1/runs?limit=${limit}`);
    expect(response.status).toBe(200);
    expect((await response.json() as Array<{ id: string }>).map(run => run.id)).toEqual(ids);
    expect(response.headers.get('X-Next-Cursor')).toBeNull();
  });

  it('omits the next header after the final cursor and for an empty store', async () => {
    const end = await apiRequest(app, `/api/v1/runs?limit=1&cursor=${ids[2]}`);
    expect(end.status).toBe(200);
    expect(await end.json()).toEqual([]);
    expect(end.headers.get('X-Next-Cursor')).toBeNull();
    for (const id of ids) store.deleteRun(id);
    const empty = await apiRequest(app, '/api/v1/runs?limit=1');
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);
    expect(empty.headers.get('X-Next-Cursor')).toBeNull();
  });

  it('preserves full=1 with pagination', async () => {
    const response = await apiRequest(app, '/api/v1/runs?limit=1&full=1');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([JSON.parse(JSON.stringify(store.listRuns()[0]))]);
    expect(response.headers.get('X-Next-Cursor')).toBe(ids[0]);
  });

  it.each(['', '0', '-1', '1.5', 'abc', '01', '501', '1000'])('rejects bad limit %j with 400', async (limit) => {
    const response = await apiRequest(app, `/api/v1/runs?limit=${limit}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringContaining('limit') });
    expect(response.headers.get('X-Next-Cursor')).toBeNull();
  });
});
