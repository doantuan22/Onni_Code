import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectGraphService } from '../index.ts';
import { FixtureRepo, gitAvailable } from '../fixture.testkit.ts';
import { selectTests } from './index.ts';

describe('selectTests', () => {
  let fixture: FixtureRepo | undefined;
  afterEach(() => {
    vi.unstubAllEnvs();
    fixture?.dispose();
    fixture = undefined;
  });

  it('returns bounded graph suggestions and explicit scoped completeness', async () => {
    if (!gitAvailable()) return;
    fixture = new FixtureRepo();
    fixture.write({
      'src/base.ts': 'export const base = 1;\n',
      'src/base.test.ts': "import { base } from './base';\nvoid base;\n",
      'src/direct.test.ts': "import { base } from './base';\nvoid base;\n",
      'src/child.ts': "import { base } from './base';\nexport const child = base;\n",
      'src/child.test.ts': "import { child } from './child';\nvoid child;\n",
    }).commit();
    const service = new ProjectGraphService(fixture.root);
    expect((await service.build()).started).toBe(true);

    const result = await selectTests(service, { files: ['src/base.ts'], maxItems: 2 });
    if ('available' in result) throw new Error(result.reason);
    expect(result.tests.map(({ path }) => path)).toEqual(['src/base.test.ts', 'src/direct.test.ts']);
    expect(result.truncated).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.runner).toMatchObject({ used: false, available: false });
    expect(result.coverage.note).toContain('broader test suite');
  });

  it('returns unavailable before a graph exists', async () => {
    if (!gitAvailable()) return;
    fixture = new FixtureRepo();
    const result = await selectTests(new ProjectGraphService(fixture.root), { files: ['src/base.ts'] });
    expect(result).toMatchObject({ available: false });
  });

  it('selects the existing git-changes test high on this repository', async () => {
    if (!gitAvailable()) return;
    const root = resolve(import.meta.dirname, '../../../../..');
    const service = new ProjectGraphService(root, { freshnessDeadlineMs: 10_000 });
    const build = await service.build();
    expect(build.started).toBe(true);
    const result = await selectTests(service, { files: ['packages/work/src/server/git-changes.ts'] });
    if ('available' in result) throw new Error(result.reason);
    expect(result.tests).toContainEqual(expect.objectContaining({
      path: 'packages/work/src/server/git-changes.test.ts',
      confidence: 'high',
      source: 'graph',
    }));
  }, 45_000);
});
