import { afterEach, describe, expect, it } from 'vitest';
import { ProjectGraphService } from '../index.ts';
import { FixtureRepo, gitAvailable } from '../fixture.testkit.ts';
import { selectGraphTests, selectTestsAdapter } from './graph-select.ts';

describe('graph test selection', () => {
  let fixture: FixtureRepo | undefined;
  afterEach(() => fixture?.dispose());

  it('ranks direct and same-name tests high and one-hop dependent siblings medium without walking two hops', async () => {
    if (!gitAvailable()) return;
    fixture = new FixtureRepo();
    fixture.write({
      'src/base.ts': 'export const base = 1;\n',
      'src/base.test.ts': "import { base } from './base';\nvoid base;\n",
      'src/direct.test.ts': "import { base } from './base';\nvoid base;\n",
      'src/child.ts': "import { base } from './base';\nexport const child = base;\n",
      'src/child.test.ts': "import { child } from './child';\nvoid child;\n",
      'src/grandchild.ts': "import { child } from './child';\nexport const grandchild = child;\n",
      'src/grandchild.test.ts': "import { grandchild } from './grandchild';\nvoid grandchild;\n",
    }).commit();
    const service = new ProjectGraphService(fixture.root);
    expect((await service.build()).started).toBe(true);

    const result = selectGraphTests(service, ['src/base.ts']);
    expect(result.map(({ path, confidence }) => [path, confidence])).toEqual([
      ['src/base.test.ts', 'high'],
      ['src/direct.test.ts', 'high'],
      ['src/child.test.ts', 'medium'],
    ]);
    expect(result.every(({ source, reason }) => source === 'graph' && reason.split('\n').length === 1)).toBe(true);
  });

  it('marks a direct test import of a hub as medium', async () => {
    if (!gitAvailable()) return;
    fixture = new FixtureRepo();
    const files: Record<string, string> = { 'src/shared.ts': 'export const shared = 1;\n' };
    for (let i = 0; i < 20; i++) files[`src/uses/use-${i}.ts`] = "import { shared } from '../shared';\nvoid shared;\n";
    files['src/__tests__/hub-consumer.test.ts'] = "import { shared } from '../shared';\nvoid shared;\n";
    fixture.write(files).commit();
    const service = new ProjectGraphService(fixture.root);
    expect((await service.build()).started).toBe(true);
    expect(service.isHub('src/shared.ts')).toBe(true);
    expect(selectGraphTests(service, ['src/shared.ts'])).toContainEqual({
      path: 'src/__tests__/hub-consumer.test.ts',
      confidence: 'medium',
      reason: 'imports hub `shared.ts`',
      source: 'graph',
    });
  });

  it('adapts the same selector into impact().tests', async () => {
    if (!gitAvailable()) return;
    fixture = new FixtureRepo();
    fixture.write({
      'src/base.ts': 'export const base = 1;\n',
      'src/base.test.ts': "import { base } from './base';\nvoid base;\n",
      'src/child.ts': "import { base } from './base';\nexport const child = base;\n",
      'src/child.test.ts': "import { child } from './child';\nvoid child;\n",
    }).commit();
    const service = new ProjectGraphService(fixture.root, { selectTests: selectTestsAdapter });
    expect((await service.build()).started).toBe(true);
    const impact = await service.impact({ files: ['src/base.ts'] });
    expect(impact).not.toHaveProperty('available', false);
    if ('available' in impact) throw new Error(impact.reason);
    expect(impact.tests.map(({ path, confidence }) => [path, confidence])).toEqual([
      ['src/base.test.ts', 'high'],
      ['src/child.test.ts', 'medium'],
    ]);
  });
});
