/**
 * `onni graph …` — Project Graph from a shell (P1, PLAN §5). With `ONNI_API_URL` it is a thin HTTP client of the
 * cockpit's `/graph*` family; without it, it runs the graph in-process on the current directory (as `onni run`
 * runs without a server). Off (`ONNI_PROJECT_GRAPH` unset) the cockpit answers 409, which is relayed with exit 1.
 * Every text answer states complete/truncated/stale and, when the answer is partial, points back at grep.
 */
import { parseArgs } from 'node:util';
import type { GraphImpactResult, GraphRebuildResult, GraphStatus, GraphTestsResult, GraphUnavailable } from '@onni/contract';
import { createGraphService, graphToolsEnabled } from './registry.ts';
import { selectTests } from './tests-select/index.ts';

export interface GraphCliEnv {
  ONNI_API_URL?: string | undefined;
  ONNI_PROJECT_ID?: string | undefined;
  ONNI_PROJECT_GRAPH?: string | undefined;
  ONNI_PROJECT_GRAPH_TOOLS?: string | undefined;
}

export interface GraphCliIo {
  fetch: typeof fetch;
  log: (line: string) => void;
  error: (line: string) => void;
  cwd: () => string;
}

const USAGE = `onni graph — what a change affects, and which tests cover it (needs ONNI_PROJECT_GRAPH=1)

  onni graph status
  onni graph build [--full]
  onni graph impact <file…> | --run <id> [--expand <dir>] [--max-items N] [--format text|json]
  onni graph tests <file…> | --run <id> [--runner] [--max-items N] [--format text|json]

With ONNI_API_URL (and optionally ONNI_PROJECT_ID) it asks the running cockpit; otherwise it works on the current
directory in-process (--run needs a cockpit). --runner also runs \`vitest related\` and needs ONNI_PROJECT_GRAPH_TOOLS=1.`;

const FALLBACK = 'Not complete — fall back to grep and reading the source for what this answer cannot cover.';
const OFF = 'Project Graph is off — set ONNI_PROJECT_GRAPH=1 (on the cockpit, or in this shell for in-process use)';

const list = (title: string, rows: string[]): string[] => (rows.length ? [`${title} (${rows.length}):`, ...rows.map((r) => `  ${r}`)] : []);

export function formatStatus(s: GraphStatus): string {
  const parts = [`graph: ${s.state}`];
  if (s.files !== undefined) parts.push(`${s.files} files`);
  if (s.edges !== undefined) parts.push(`${s.edges} edges`);
  if (s.builtAt) parts.push(`built ${s.builtAt}`);
  if (s.head) parts.push(`head ${s.head.slice(0, 10)}`);
  const lines = [parts.join(' · ')];
  if (s.reason) lines.push(`reason: ${s.reason}`);
  if (s.state === 'empty') lines.push('No graph yet — run `onni graph build`.');
  if (s.state === 'stale') lines.push('HEAD moved since the build — answers refresh the files they touch; `onni graph build` refreshes all.');
  return lines.join('\n');
}

function verdict(r: { complete: boolean; truncated: boolean; snapshot: { stale: boolean } }): string {
  return `complete: ${r.complete} · truncated: ${r.truncated} · stale: ${r.snapshot.stale}`;
}

export function formatImpact(r: GraphImpactResult): string {
  const lines = [verdict(r)];
  lines.push(...list('changed', r.changed.map((i) => `${i.path} — ${i.reason}`)));
  lines.push(...list('dependents', r.dependents.map((i) => `${i.path} — ${i.reason}${i.confidence ? ` [${i.confidence}]` : ''}`)));
  lines.push(...list(`hubs (> ${r.hubThreshold} dependents; --expand <dir> to open)`, r.hubGroups.map((h) => `${h.hub} → ${h.count} in ${h.dir}/ e.g. ${h.sample.slice(0, 3).join(', ')}`)));
  lines.push(...list('packages', r.packages.map((i) => `${i.path} — ${i.reason}`)));
  lines.push(...list('tests', r.tests.map((t) => `${t.path} [${t.confidence}] — ${t.reason}`)));
  const c = r.coverage;
  if (c.unresolvedImports || c.unparsedFiles || c.notInGraph.length) {
    lines.push(`coverage: ${c.unresolvedImports} unresolved imports, ${c.unparsedFiles} unparsed files${c.notInGraph.length ? `, not in graph: ${c.notInGraph.join(', ')}` : ''}`);
  }
  if (c.note) lines.push(c.note);
  if (!r.complete || r.truncated || r.snapshot.stale) lines.push(FALLBACK);
  return lines.join('\n');
}

export function formatTests(r: GraphTestsResult): string {
  const lines = [verdict(r)];
  lines.push(...list('tests', r.tests.map((t) => `${t.path} [${t.confidence}, ${t.source}] — ${t.reason}`)));
  if (r.tests.length === 0) lines.push('tests: none found');
  lines.push(`runner: ${r.runner.used ? 'used' : 'not used'}${r.runner.reason ? ` (${r.runner.reason})` : ''}`);
  if (r.coverage.note) lines.push(r.coverage.note);
  if (!r.complete || r.truncated || r.snapshot.stale) lines.push(FALLBACK);
  return lines.join('\n');
}

export function formatRebuild(r: GraphRebuildResult): string {
  return `${r.accepted ? 'build finished' : `build not started${r.reason ? `: ${r.reason}` : ''}`}\n${formatStatus(r.status)}`;
}

const isUnavailable = (v: unknown): v is GraphUnavailable => !!v && typeof v === 'object' && (v as { available?: unknown }).available === false;

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return body.error;
  } catch {
    // not JSON
  }
  return `${response.status} ${response.statusText}`;
}

interface Query { files: string[]; runId?: string; expand?: string; maxItems?: number; runner?: boolean }

/** The transport: the cockpit over HTTP, or a service in this process. Both return the contract shapes. */
interface Backend {
  status(): Promise<GraphStatus>;
  build(full: boolean): Promise<GraphRebuildResult>;
  impact(q: Query): Promise<GraphImpactResult | GraphUnavailable>;
  tests(q: Query): Promise<GraphTestsResult | GraphUnavailable>;
}

function httpBackend(env: GraphCliEnv, io: GraphCliIo): Backend {
  const url = (env.ONNI_API_URL ?? '').replace(/\/+$/, '');
  const scope = env.ONNI_PROJECT_ID ? `${url}/api/v1/p/${encodeURIComponent(env.ONNI_PROJECT_ID)}` : `${url}/api/v1`;
  const get = async <T>(path: string, params?: URLSearchParams): Promise<T> => {
    const query = params && [...params.keys()].length > 0 ? `?${params.toString()}` : '';
    const response = await io.fetch(`${scope}${path}${query}`);
    if (!response.ok) throw new Error(await readError(response));
    return (await response.json()) as T;
  };
  const params = (q: Query): URLSearchParams => {
    const p = new URLSearchParams();
    for (const f of q.files) p.append('file', f);
    if (q.runId) p.set('runId', q.runId);
    if (q.expand) p.set('expand', q.expand);
    if (q.maxItems) p.set('maxItems', String(q.maxItems));
    if (q.runner) p.set('runner', '1');
    return p;
  };
  return {
    status: () => get<GraphStatus>('/graph'),
    build: async (full) => {
      const response = await io.fetch(`${scope}/graph/rebuild`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(full ? { full: true } : {}) });
      if (!response.ok) throw new Error(await readError(response));
      return (await response.json()) as GraphRebuildResult;
    },
    impact: (q) => get('/graph/impact', params(q)),
    tests: (q) => get('/graph/tests', params(q)),
  };
}

function localBackend(env: GraphCliEnv, io: GraphCliIo): Backend {
  if (env.ONNI_PROJECT_GRAPH !== '1') throw new Error(OFF);
  const service = createGraphService(io.cwd());
  const noRun = (q: Query): void => {
    if (q.runId) throw new Error('--run needs a cockpit: set ONNI_API_URL, or pass the files explicitly');
  };
  // A one-shot process has no graph in memory, so questions build (incrementally, cache-backed) first.
  const ready = async (): Promise<void> => {
    if ((await service.getStatus()).state === 'empty') await service.build();
  };
  return {
    status: () => service.getStatus(),
    build: async (full) => {
      const outcome = await service.build(full ? { full: true } : {});
      return { accepted: outcome.started, status: outcome.status, ...(outcome.started ? {} : { reason: outcome.reason }) };
    },
    impact: async (q) => {
      noRun(q);
      await ready();
      return service.impact({ files: q.files, ...(q.expand ? { expand: q.expand } : {}), ...(q.maxItems ? { maxItems: q.maxItems } : {}) });
    },
    tests: async (q) => {
      noRun(q);
      await ready();
      return selectTests(service, { files: q.files, runner: q.runner === true && graphToolsEnabled(env as NodeJS.ProcessEnv), ...(q.maxItems ? { maxItems: q.maxItems } : {}) });
    },
  };
}

export async function runGraphCommand(
  argv: string[],
  env: GraphCliEnv = process.env,
  io: GraphCliIo = { fetch, log: (l) => console.log(l), error: (l) => console.error(l), cwd: () => process.cwd() },
): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    io.log(USAGE);
    return command ? 0 : 2;
  }
  if (!['status', 'build', 'impact', 'tests'].includes(command)) {
    io.error(`onni graph: unknown command "${command}"\n${USAGE}`);
    return 2;
  }
  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        full: { type: 'boolean', default: false },
        run: { type: 'string' },
        expand: { type: 'string' },
        'max-items': { type: 'string' },
        format: { type: 'string', default: 'text' },
        runner: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    io.error(`onni graph: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const format = values.format;
  if (format !== 'text' && format !== 'json') {
    io.error('onni graph: --format must be text or json');
    return 2;
  }
  const maxItems = values['max-items'] === undefined ? undefined : Number(values['max-items']);
  if (maxItems !== undefined && (!Number.isInteger(maxItems) || maxItems < 1)) {
    io.error('onni graph: --max-items must be a positive integer');
    return 2;
  }
  if ((command === 'impact' || command === 'tests') && positionals.length === 0 && !values.run) {
    io.error(`onni graph ${command}: give at least one file, or --run <id>\n${USAGE}`);
    return 2;
  }
  const query: Query = {
    files: positionals,
    ...(values.run ? { runId: values.run } : {}),
    ...(values.expand ? { expand: values.expand } : {}),
    ...(maxItems ? { maxItems } : {}),
    ...(values.runner ? { runner: true } : {}),
  };
  const out = (value: unknown, text: string): void => io.log(format === 'json' ? JSON.stringify(value, null, 2) : text);

  try {
    const backend = env.ONNI_API_URL ? httpBackend(env, io) : localBackend(env, io);
    if (command === 'status') {
      const status = await backend.status();
      out(status, formatStatus(status));
      return 0;
    }
    if (command === 'build') {
      const result = await backend.build(values.full === true);
      out(result, formatRebuild(result));
      return result.accepted ? 0 : 1;
    }
    if (command === 'impact') {
      const result = await backend.impact(query);
      out(result, isUnavailable(result) ? `graph unavailable: ${result.reason}` : formatImpact(result));
      return isUnavailable(result) ? 1 : 0;
    }
    const result = await backend.tests(query);
    out(result, isUnavailable(result) ? `graph unavailable: ${result.reason}` : formatTests(result));
    return isUnavailable(result) ? 1 : 0;
  } catch (error) {
    io.error(`onni graph: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
