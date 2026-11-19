import { execFile } from 'node:child_process';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { lstat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { globToRegExp, parseScope } from './conflicts.ts';
import { resolveProgram } from '../core/disclaim-spawn.ts';

const exec = promisify(execFile);
const maps = new Map<string, Promise<string | undefined>>();
let building = 0;
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_BYTES = 48 * 1024;
const MAX_FILES = 56;
const TOKEN_BUDGET = 560;
const MAX_OUTPUT_BYTES = 2_400;
const EXCLUDED = new Set(['node_modules', 'dist', 'build', 'vendor', 'target', 'coverage', 'fixtures', '__fixtures__']);


interface RepoTag {
  relPath: string;
  absPath: string;
  line: number;
  name: string;
  kind: 'def' | 'ref';
  signature?: string;
  isExported?: boolean;
  parent?: string;
}

interface RepoGraph {
  nodes: string[];
}

interface RepoMapEngine {
  parser: {
    initParser(): Promise<void>;
    parseFile(absolutePath: string, relativePath: string): Promise<RepoTag[]>;
    shutdownParser(): void;
  };
  graph: {
    buildImportGraph(tags: RepoTag[], options: { edgeWeightMultiplier(path: string): number }): RepoGraph;
    buildFileGraph(tags: RepoTag[], options: { edgeWeightMultiplier(path: string): number }): RepoGraph;
    computeFileDegrees(graph: RepoGraph): Map<string, unknown>;
  };
  ranking: {
    buildFocusPersonalization(files: string[], graph: RepoGraph): Map<string, number>;
    buildEntrypointPersonalization(files: string[]): Map<string, number>;
    combineRanks(structural: Map<string, number>, graph: RepoGraph): Map<string, number>;
    adjustFileRanks(raw: Map<string, number>, degrees: Map<string, unknown>, files: string[], duplicates: Map<string, unknown>): Map<string, number>;
    rankDefinitions(graph: RepoGraph, ranks: Map<string, number>, focus: Set<string>): { file: string; ident: string; rank: number }[];
  };
  pagerank: { computePageRank(graph: RepoGraph, options: { personalization?: Map<string, number> }): Map<string, number> };
  dedup: { detectDuplicates(files: Map<string, RepoTag[]>): Map<string, unknown> };
  output: { fitToTokenBudget(definitions: unknown[], graph: RepoGraph, ranks: Map<string, number>, tokens: number, focus: string[]): string };
  files: { isTestOrScriptPath(path: string): boolean };
}

let enginePromise: Promise<RepoMapEngine> | undefined;

// The production bundle contains only JavaScript and WASM; mapper is a build dependency.
function loadRepoMapEngine(): Promise<RepoMapEngine> {
  if (enginePromise) return enginePromise;
  enginePromise = import(new URL('../../dist/vendor/repo-map/index.js', import.meta.url).href)
    .catch((error) => { enginePromise = undefined; throw error; });
  return enginePromise;
}

function pathMatchesScope(path: string, scope: string): boolean {
  const normalized = scope.replace(/\\/g, '/').replace(/^\.\//, '');
  if (path === normalized || path.startsWith(`${normalized.replace(/\/?$/, '/')}`)) return true;
  return globToRegExp(normalized).test(path);
}

async function trackedSourcePath(root: string, path: string): Promise<string | undefined> {
  if (!/^[A-Za-z0-9_@+./-]{1,220}$/.test(path)) return undefined;
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.') || EXCLUDED.has(part.toLowerCase()))) return undefined;
  const absolute = resolve(root, ...parts);
  const fromRoot = relative(root, absolute);
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) return undefined;
  let current = root;
  try {
    for (let index = 0; index < parts.length; index += 1) {
      current = join(current, parts[index]!);
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) return undefined;
      if (index === parts.length - 1) {
        if (!stat.isFile() || stat.size > MAX_SOURCE_BYTES) return undefined;
      } else if (!stat.isDirectory()) return undefined;
    }
  } catch {
    return undefined;
  }
  return absolute;
}

function chooseScopedFiles(paths: string[], scopes: string[]): string[] {
  const scoped = paths.filter((path) => scopes.some((scope) => pathMatchesScope(path, scope)));
  if (scoped.length === 0) return [];
  const stems = new Set(scoped.map((path) => basename(path).replace(/\.(?:test|spec)\.[^.]+$/i, '').replace(/\.[^.]+$/, '').toLowerCase()));
  const parents = new Set(scoped.map((path) => dirname(path)));
  return [...paths].sort((left, right) => {
    const rank = (path: string) => [
      Number(!scoped.includes(path)),
      Number(!stems.has(basename(path).replace(/\.(?:test|spec)\.[^.]+$/i, '').replace(/\.[^.]+$/, '').toLowerCase())),
      Number(!parents.has(dirname(path))),
      path,
    ] as const;
    const a = rank(left);
    const b = rank(right);
    return Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1]) || Number(a[2]) - Number(b[2]) || String(a[3]).localeCompare(String(b[3]));
  }).slice(0, MAX_FILES);
}

/** Build a bounded Aider-style symbol map from the worker's clean initial Git tree. */
export async function createAiderRepoMap(
  repoRoot: string, cwd: string, scope: string | undefined, env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  const parsed = parseScope(scope);
  if (parsed.state !== 'checked') return undefined;
  const git = process.platform === 'win32' ? 'git.exe' : 'git';
  const pathEnv = env.PATH ?? env.Path ?? process.env.PATH ?? process.env.Path;
  const gitBinary = resolveProgram(git, pathEnv);
  if (!gitBinary) return undefined;
  let files: string[];
  let tree: string;
  try {
    const [head, tracked, dirty] = await Promise.all([
      exec(gitBinary, ['rev-parse', '--verify', 'HEAD^{tree}'], { cwd, timeout: 1_000, maxBuffer: 1_024, windowsHide: true }),
      exec(gitBinary, ['ls-files', '-z'], {
        cwd, timeout: 2_000, maxBuffer: MAX_INDEX_BYTES, windowsHide: true, encoding: 'buffer',
        env: { ...env, GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: '' },
      }),
      exec(gitBinary, ['status', '--porcelain', '--untracked-files=no'], {
        cwd, timeout: 2_000, maxBuffer: MAX_INDEX_BYTES, windowsHide: true,
        env: { ...env, GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: '' },
      }),
    ]);
    // A tree-keyed cache must never reuse an uncommitted worktree's symbols.
    if (dirty.stdout.trim()) return undefined;
    tree = head.stdout.trim();
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(tree)) return undefined;
    files = (tracked.stdout as Buffer).toString('utf8').split('\0').filter(Boolean)
      .filter((path) => /\.(?:ts|tsx|js|jsx|mts|cts|py|go|rs|java|rb|c|cpp|h|cs|sol)$/i.test(path))
      .filter((path) => !/(?:generated|\.min\.|(?:secret|credential|private.?key))/i.test(path));
  } catch {
    return undefined;
  }
  const selected = chooseScopedFiles(files, parsed.tokens);
  if (selected.length === 0) return undefined;
  const checked = (await Promise.all(selected.map(async (file) => ({ file, absolute: await trackedSourcePath(cwd, file) }))))
    .filter((entry): entry is { file: string; absolute: string } => entry.absolute !== undefined);
  if (checked.length === 0) return undefined;
  const mapKey = JSON.stringify([repoRoot, tree, parsed.tokens, '@snevins/repo-mapper@1.5.3']);
  const cached = maps.get(mapKey);
  if (cached) return await cached;
  // RepoMapper uses a process-global Tree-sitter parser; serialize access so a second
  // worker cannot shut down the first worker's parser mid-file.
  if (building >= 1) return undefined;
  building += 1;
  const pending = (async () => {
    const deadline = Date.now() + 2_000;
    const engine = await loadRepoMapEngine();
    const tags: RepoTag[] = [];
    await engine.parser.initParser();
    // Reuse the serialized parser: upstream shutdown drops its handle without deleting WASM memory.
    for (const item of checked) {
      if (Date.now() > deadline) return undefined;
      const parsedTags = await engine.parser.parseFile(item.absolute, item.file);
      // Never include source lines, string literals or comments in navigation data.
      for (const tag of parsedTags) tags.push({ ...tag, signature: `${tag.name} (line ${tag.line})` });
    }
    if (tags.length === 0) return undefined;
    const graphOptions = { edgeWeightMultiplier: (path: string) => engine.files.isTestOrScriptPath(path) ? 0.2 : 1 };
    const imports = engine.graph.buildImportGraph(tags, graphOptions);
    const references = engine.graph.buildFileGraph(tags, graphOptions);
    const focus = checked.map((item) => item.file).filter((file) => parsed.tokens.some((token) => pathMatchesScope(file, token)));
    if (focus.length === 0) return undefined;
    const personalization = engine.ranking.buildFocusPersonalization(focus, references);
    const structural = engine.pagerank.computePageRank(imports, { personalization });
    const raw = engine.ranking.combineRanks(structural, references);
    const byFile = new Map<string, RepoTag[]>();
    for (const tag of tags) byFile.set(tag.relPath, [...(byFile.get(tag.relPath) ?? []), tag]);
    const duplicates = engine.dedup.detectDuplicates(byFile);
    const degrees = engine.graph.computeFileDegrees(references);
    const ranks = engine.ranking.adjustFileRanks(raw, degrees, references.nodes, duplicates);
    const definitions = engine.ranking.rankDefinitions(references, ranks, new Set(focus));
    // Upstream excludes focus definitions; isolated scopes otherwise produce only a header.
    if (definitions.length === 0) {
      definitions.push(...tags.filter((tag) => tag.kind === 'def').map((tag) => ({
        file: tag.relPath, ident: tag.name, rank: ranks.get(tag.relPath) ?? 0,
      })).sort((left, right) => right.rank - left.rank || left.file.localeCompare(right.file)));
    }
    const output = engine.output.fitToTokenBudget(definitions, references, ranks, TOKEN_BUDGET, focus);
    if (!output.includes('\n  ') || Buffer.byteLength(output) > MAX_OUTPUT_BYTES) return undefined;
    return output;
  })().catch(() => undefined).finally(() => { building -= 1; });
  maps.set(mapKey, pending);
  if (maps.size > 64) maps.delete(maps.keys().next().value!);
  const result = await pending;
  if (!result && maps.get(mapKey) === pending) maps.delete(mapKey);
  return result;
}
