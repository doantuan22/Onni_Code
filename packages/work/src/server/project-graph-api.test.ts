import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  graphImpactResponseSchema, graphRebuildResultSchema, graphStatusSchema, graphTestsResponseSchema,
} from '@onni/contract';
import { FixtureRepo, gitAvailable } from '../project-graph/fixture.testkit.ts';
import { RunStore } from '../runs/store.ts';
import type { RunManager } from '../workflows/run.ts';
import { clearProjectProbeCache, listProjects, registerProject } from '../workspace/projects.ts';
import { removeTempDir } from '../test-fixtures/remove-temp-dir.testkit.ts';
import { apiRequest } from './loopback-request.testkit.ts';
import { ProjectContexts } from './project-context.ts';
import { createApp } from './server.ts';

describe('project graph routes', () => {
  const saved = { home: process.env.ONNI_HOME, graph: process.env.ONNI_PROJECT_GRAPH, dry: process.env.ONNI_DRY_RUN };
  let home: string;
  let repo: FixtureRepo;
  let store: RunStore;
  let contexts: ProjectContexts;
  let app: Hono;
  let bootId: string;

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), 'onni-graph-home-'));
    process.env.ONNI_HOME = home;
    process.env.ONNI_DRY_RUN = '1';
    delete process.env.ONNI_PROJECT_GRAPH;
    repo = new FixtureRepo('onni-graph-api-');
    repo.write({
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': "import { a } from './a.ts';\nexport const b = a + 1;\n",
      'src/b.test.ts': "import { b } from './b.ts';\nit('b', () => { expect(b).toBe(2); });\n",
    }).commit('init');
    mkdirSync(join(repo.root, '.ai/onni'), { recursive: true });
    writeFileSync(join(repo.root, '.ai/onni', 'config.json'), '{"skillsRepos": []}\n', 'utf8');
    clearProjectProbeCache();
    store = RunStore.open(join(repo.root, '.ai/onni'), { keepLive: true });
    contexts = new ProjectContexts({ listProjects });
    bootId = (await registerProject(repo.root)).id;
    app = createApp({
      repoRoot: repo.root, store, version: '0.0.0-test', contexts,
      manager: { isActive: () => false, cancel: () => true } as unknown as RunManager,
    });
  });

  afterEach(async () => {
    contexts.disposeAll();
    store.flush();
    await removeTempDir(home);
    repo.dispose();
    for (const [key, value] of [['ONNI_HOME', saved.home], ['ONNI_PROJECT_GRAPH', saved.graph], ['ONNI_DRY_RUN', saved.dry]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const get = (path: string) => apiRequest(app, `/api/v1${path}`);
  const post = (path: string, body: unknown) =>
    apiRequest(app, `/api/v1${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

  it('answers 409 on every graph route while ONNI_PROJECT_GRAPH is unset', async () => {
    for (const res of [await get('/graph'), await get('/graph/impact?file=src/a.ts'), await get('/graph/tests?file=src/a.ts'), await post('/graph/rebuild', {}), await get(`/p/${bootId}/graph`)]) {
      expect(res.status).toBe(409);
      expect(await res.text()).toContain('ONNI_PROJECT_GRAPH=1');
    }
  });

  it('reports empty, refuses reads without a build, then answers impact and tests after a rebuild', async () => {
    if (!gitAvailable()) return;
    process.env.ONNI_PROJECT_GRAPH = '1';
    const status = graphStatusSchema.parse(await (await get('/graph')).json());
    expect(status.state).toBe('empty');

    const early = graphImpactResponseSchema.parse(await (await get('/graph/impact?file=src/a.ts')).json());
    expect(early).toMatchObject({ available: false });

    const rebuilt = graphRebuildResultSchema.parse(await (await post('/graph/rebuild', {})).json());
    expect(rebuilt.accepted).toBe(true);
    expect(rebuilt.status.state).toBe('ready');

    const again = graphRebuildResultSchema.parse(await (await post('/graph/rebuild', {})).json());
    expect(again.accepted).toBe(false);

    const impact = graphImpactResponseSchema.parse(await (await get(`/p/${bootId}/graph/impact?file=src/a.ts`)).json());
    if ('available' in impact) throw new Error('expected a result');
    expect(impact.dependents.map((d) => d.path)).toContain('src/b.ts');
    expect(impact.complete).toBe(true);

    const tests = graphTestsResponseSchema.parse(await (await get('/graph/tests?file=src/b.ts&file=src/a.ts')).json());
    if ('available' in tests) throw new Error('expected a result');
    expect(tests.tests.map((t) => t.path)).toContain('src/b.test.ts');
    expect(tests.runner.used).toBe(false);
  });

  it('validates queries and answers a one-line 404 for an unknown run', async () => {
    process.env.ONNI_PROJECT_GRAPH = '1';
    expect((await get('/graph/impact')).status).toBe(400);
    expect((await get('/graph/impact?file=../etc/passwd')).status).toBe(400);
    const res = await get('/graph/tests?runId=no-such-run');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toContain('no-such-run');
  });
});
