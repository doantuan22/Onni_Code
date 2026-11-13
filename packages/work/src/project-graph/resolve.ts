import { posix } from 'node:path';
import { CODE_EXT } from './types.ts';

const RESOLVE_EXT = [...CODE_EXT, '.json'];

export interface WorkspacePackage {
  name: string;
  /** Repo-relative dir ('' for the root package). */
  dir: string;
  exports?: unknown;
  main?: string;
  dependencies: string[];
}
export interface PathAlias {
  prefix: string;
  /** Repo-relative target dir (or file when `exact`). */
  dir: string;
  exact: boolean;
  /** Only files under this repo-relative dir use the alias (the tsconfig that declared it). */
  scope: string;
}
export interface ResolveContext {
  fileSet: ReadonlySet<string>;
  workspaces: ReadonlyMap<string, WorkspacePackage>;
  aliases?: readonly PathAlias[];
}
export type Resolution = { type: 'file'; to: string } | { type: 'ext'; name: string } | { type: 'unresolved'; reason: string };

/** Builds the workspace map from parsed package.json files (paths POSIX, relative to the repo root). */
export function buildWorkspaceMap(manifests: readonly { path: string; json: unknown }[]): Map<string, WorkspacePackage> {
  const map = new Map<string, WorkspacePackage>();
  for (const { path, json } of manifests) {
    if (!json || typeof json !== 'object') continue;
    const j = json as Record<string, unknown>;
    if (typeof j.name !== 'string' || !j.name) continue;
    const dir = posix.dirname(path) === '.' ? '' : posix.dirname(path);
    const dependencies = [j.dependencies, j.devDependencies, j.peerDependencies, j.optionalDependencies].flatMap((d) =>
      d && typeof d === 'object' ? Object.keys(d) : [],
    );
    map.set(j.name, {
      name: j.name,
      dir,
      exports: j.exports,
      ...(typeof j.main === 'string' ? { main: j.main } : {}),
      dependencies: [...new Set(dependencies)],
    });
  }
  return map;
}

/** Strips `//` and block comments and trailing commas (tsconfig is JSONC), leaving string contents alone. */
export function parseJsonc(text: string): unknown {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      const j = text.indexOf('*/', i + 2);
      i = j < 0 ? text.length : j + 2;
    } else {
      out += c;
      i++;
    }
  }
  try {
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    return null;
  }
}

/** `compilerOptions.paths` of one tsconfig (at repo-relative `path`) → aliases. `baseUrl` is honoured when present. */
export function aliasesFromTsconfig(path: string, json: unknown): PathAlias[] {
  if (!json || typeof json !== 'object') return [];
  const co = (json as { compilerOptions?: { paths?: unknown; baseUrl?: unknown } }).compilerOptions;
  if (!co || !co.paths || typeof co.paths !== 'object') return [];
  const scope = posix.dirname(path) === '.' ? '' : posix.dirname(path);
  const base = posix.join(scope, typeof co.baseUrl === 'string' ? co.baseUrl : '.');
  const out: PathAlias[] = [];
  for (const [key, targets] of Object.entries(co.paths as Record<string, unknown>)) {
    const first = Array.isArray(targets) ? targets[0] : undefined;
    if (typeof first !== 'string') continue;
    const exact = !key.endsWith('*');
    out.push({
      prefix: exact ? key : key.slice(0, -1),
      dir: posix.normalize(posix.join(base, exact ? first : first.replace(/\*$/, ''))).replace(/\/$/, ''),
      exact,
      scope,
    });
  }
  return out;
}

function withTsVariants(p: string): string[] {
  const m = /\.(m|c)?js$/.exec(p);
  if (!m) return [p];
  const stem = p.slice(0, -m[0].length);
  return [p, `${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.cts`];
}

function toSourceCandidates(target: string): string[] {
  const t = target.replace(/^\.\//, '');
  const out = [t];
  if (t.startsWith('dist/')) out.push(`src/${t.slice(5)}`); // "./dist/x.js" -> "src/x.ts"
  return out.flatMap(withTsVariants);
}

function probe(base: string, fileSet: ReadonlySet<string>): string | null {
  if (fileSet.has(base)) return base;
  for (const c of withTsVariants(base)) if (fileSet.has(c)) return c;
  for (const e of RESOLVE_EXT) if (fileSet.has(base + e)) return base + e;
  for (const e of RESOLVE_EXT) if (fileSet.has(`${base}/index${e}`)) return `${base}/index${e}`;
  return null;
}

function exportTarget(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const e = entry as Record<string, unknown>;
    for (const k of ['import', 'default', 'types']) {
      const v = exportTarget(e[k]);
      if (v) return v;
    }
  }
  return undefined;
}

/** Resolves one specifier written in `fromFile`. Bare third-party packages are `ext`, never `unresolved`. */
export function resolveSpecifier(rawSpec: string, fromFile: string, ctx: ResolveContext): Resolution {
  const spec = rawSpec.replace(/\?.*$/, ''); // vite suffixes such as `?raw`
  if (spec.startsWith('node:')) return { type: 'ext', name: spec };
  if (spec.startsWith('.')) {
    const hit = probe(posix.normalize(posix.join(posix.dirname(fromFile), spec)), ctx.fileSet);
    return hit ? { type: 'file', to: hit } : { type: 'unresolved', reason: 'relative path not found' };
  }
  const fromDir = posix.dirname(fromFile);
  for (const a of ctx.aliases ?? []) {
    if (a.scope && fromDir !== a.scope && !fromDir.startsWith(`${a.scope}/`)) continue;
    if (a.exact ? spec !== a.prefix : !spec.startsWith(a.prefix)) continue;
    const hit = probe(a.exact ? a.dir : posix.join(a.dir, spec.slice(a.prefix.length)), ctx.fileSet);
    if (hit) return { type: 'file', to: hit };
  }
  for (const ws of ctx.workspaces.values()) {
    if (spec !== ws.name && !spec.startsWith(`${ws.name}/`)) continue;
    const sub = spec === ws.name ? '.' : `./${spec.slice(ws.name.length + 1)}`;
    let target: string | undefined;
    if (typeof ws.exports === 'string' && sub === '.') target = ws.exports;
    else if (ws.exports && typeof ws.exports === 'object') target = exportTarget((ws.exports as Record<string, unknown>)[sub]);
    if (!target && sub === '.') target = ws.main ?? 'index.ts';
    for (const c of target ? toSourceCandidates(target) : []) {
      const hit = probe(posix.join(ws.dir, c), ctx.fileSet);
      if (hit) return { type: 'file', to: hit };
    }
    const fallback = probe(posix.join(ws.dir, 'src', sub === '.' ? 'index' : sub.slice(2)), ctx.fileSet);
    return fallback ? { type: 'file', to: fallback } : { type: 'unresolved', reason: `workspace ${ws.name} target not found` };
  }
  const bare = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : (spec.split('/')[0] ?? spec);
  return { type: 'ext', name: bare };
}

/** Name of the workspace package that owns `file` (longest dir wins), or null. */
export function packageOf(file: string, workspaces: ReadonlyMap<string, WorkspacePackage>): string | null {
  let best: WorkspacePackage | null = null;
  for (const ws of workspaces.values()) {
    const pre = ws.dir ? `${ws.dir}/` : '';
    if (file.startsWith(pre) && (!best || pre.length > (best.dir ? best.dir.length + 1 : 0))) best = ws;
  }
  return best ? best.name : null;
}
