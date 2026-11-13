import { afterEach, describe, expect, it } from 'vitest';
import { FixtureRepo, gitAvailable } from './fixture.testkit.ts';
import { formatImpact, formatStatus, runGraphCommand, type GraphCliIo } from './graph-cli.ts';

function harness(cwd = process.cwd(), fetchImpl?: typeof fetch) {
  const out: string[] = [];
  const err: string[] = [];
  const calls: Array<{ url: string; init?: RequestInit | undefined }> = [];
  const io: GraphCliIo = {
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return fetchImpl ? fetchImpl(url, init) : new Response('{}');
    }) as typeof fetch,
    log: (l) => out.push(l),
    error: (l) => err.push(l),
    cwd: () => cwd,
  };
  return { io, out, err, calls };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const impactBody = {
  snapshot: { head: 'abc', builtAt: 't', stale: false }, complete: false, truncated: false,
  coverage: { unresolvedImports: 1, unparsedFiles: 0, notInGraph: [] }, hubThreshold: 25,
  changed: [{ path: 'src/a.ts', provenance: 'extracted', reason: 'given' }],
  dependents: [{ path: 'src/b.ts', provenance: 'extracted', reason: 'imports `a.ts`' }],
  hubGroups: [], packages: [], tests: [],
};

describe('onni graph (HTTP)', () => {
  const env = { ONNI_API_URL: 'http://127.0.0.1:4321/', ONNI_PROJECT_ID: 'proj' };

  it('sends repeated file params to the scoped impact route and prints the verdict line', async () => {
    const h = harness(undefined, async () => json(impactBody));
    const code = await runGraphCommand(['impact', 'src/a.ts', 'src/c.ts', '--max-items', '5'], env, h.io);
    expect(code).toBe(0);
    expect(h.calls[0]?.url).toBe('http://127.0.0.1:4321/api/v1/p/proj/graph/impact?file=src%2Fa.ts&file=src%2Fc.ts&maxItems=5');
    const text = h.out.join('\n');
    expect(text).toContain('complete: false · truncated: false · stale: false');
    expect(text).toContain('fall back to grep');
  });

  it('relays the 409 of a cockpit with the graph off and exits 1', async () => {
    const h = harness(undefined, async () => json({ error: 'Project Graph is off' }, 409));
    expect(await runGraphCommand(['status'], env, h.io)).toBe(1);
    expect(h.err.join('\n')).toContain('Project Graph is off');
  });

  it('prints raw JSON with --format json and POSTs full rebuilds', async () => {
    const h = harness(undefined, async () => json({ accepted: true, status: { state: 'ready' } }));
    expect(await runGraphCommand(['build', '--full', '--format', 'json'], env, h.io)).toBe(0);
    expect(h.calls[0]?.init?.method).toBe('POST');
    expect(h.calls[0]?.init?.body).toBe('{"full":true}');
    expect(JSON.parse(h.out.join('\n'))).toMatchObject({ accepted: true });
  });

  it('exits 1 on an unavailable engine answer', async () => {
    const h = harness(undefined, async () => json({ available: false, reason: 'no graph yet' }));
    expect(await runGraphCommand(['tests', 'src/a.ts'], env, h.io)).toBe(1);
    expect(h.out.join('\n')).toContain('no graph yet');
  });
});

describe('onni graph (usage)', () => {
  it('rejects a missing subject, an unknown command and bad flags with exit 2', async () => {
    const h = harness();
    expect(await runGraphCommand(['impact'], {}, h.io)).toBe(2);
    expect(await runGraphCommand(['nope'], {}, h.io)).toBe(2);
    expect(await runGraphCommand(['impact', 'a.ts', '--max-items', '0'], {}, h.io)).toBe(2);
    expect(await runGraphCommand(['status', '--format', 'xml'], {}, h.io)).toBe(2);
  });

  it('says the graph is off in-process without ONNI_PROJECT_GRAPH=1', async () => {
    const h = harness();
    expect(await runGraphCommand(['status'], {}, h.io)).toBe(1);
    expect(h.err.join('\n')).toContain('ONNI_PROJECT_GRAPH=1');
  });
});

describe('onni graph (in-process)', () => {
  let repo: FixtureRepo | undefined;
  afterEach(() => {
    repo?.dispose();
    repo = undefined;
  });

  it('builds on demand and answers impact and tests for the current directory', async () => {
    if (!gitAvailable()) return;
    repo = new FixtureRepo('onni-graph-cli-');
    repo.write({
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': "import { a } from './a.ts';\nexport const b = a;\n",
      'src/b.test.ts': "import { b } from './b.ts';\nit('x', () => { expect(b).toBe(1); });\n",
    }).commit('init');
    const env = { ONNI_PROJECT_GRAPH: '1' };
    const h = harness(repo.root);
    expect(await runGraphCommand(['impact', 'src/a.ts'], env, h.io)).toBe(0);
    expect(h.out.join('\n')).toContain('src/b.ts');
    const t = harness(repo.root);
    expect(await runGraphCommand(['tests', 'src/b.ts', '--runner'], env, t.io)).toBe(0);
    expect(t.out.join('\n')).toContain('src/b.test.ts');
    expect(t.out.join('\n')).toContain('runner: not used');
    const r = harness(repo.root);
    expect(await runGraphCommand(['impact', '--run', 'abc'], env, r.io)).toBe(1);
    expect(r.err.join('\n')).toContain('--run needs a cockpit');
  });
});

describe('formatters', () => {
  it('formatStatus hints at a build when empty', () => {
    expect(formatStatus({ state: 'empty' })).toContain('onni graph build');
  });
  it('formatImpact stays quiet about grep when the answer is complete', () => {
    expect(formatImpact({ ...impactBody, complete: true } as Parameters<typeof formatImpact>[0])).not.toContain('grep');
  });
});
