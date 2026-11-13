import type { ExtractResult, RawImport } from './types.ts';

/**
 * Replaces comments and template-literal bodies with spaces (offsets and newlines kept so line numbers survive).
 * Heuristic: a regex literal containing quotes or `//` can fool it — such a file only loses edges, never gains bogus ones.
 */
export function blankNonCode(src: string): string {
  const n = src.length;
  const parts: string[] = [];
  let last = 0;
  let i = 0;
  const blank = (a: number, b: number): void => {
    parts.push(src.slice(last, a), src.slice(a, b).replace(/[^\n]/g, ' '));
    last = b;
  };
  while (i < n) {
    const c = src.charCodeAt(i);
    const d = src.charCodeAt(i + 1);
    if (c === 47 && d === 47) {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      blank(i, j);
      i = j;
    } else if (c === 47 && d === 42) {
      const j = src.indexOf('*/', i + 2);
      const e = j < 0 ? n : j + 2;
      blank(i, e);
      i = e;
    } else if (c === 34 || c === 39) {
      let j = i + 1;
      while (j < n && src.charCodeAt(j) !== c && src.charCodeAt(j) !== 10) {
        if (src.charCodeAt(j) === 92) j++;
        j++;
      }
      i = j + 1;
    } else if (c === 96) {
      let j = i + 1;
      while (j < n && src.charCodeAt(j) !== 96) {
        if (src.charCodeAt(j) === 92) j++;
        j++;
      }
      blank(i + 1, Math.min(j, n));
      i = j + 1;
    } else i++;
  }
  parts.push(src.slice(last));
  return parts.join('');
}

// `import|export [type] <clause> from 'x'`. The clause may span lines (multi-line imports, spikes/golden-graph.md) but may
// not contain `;` or another import/export keyword, so a semicolon-less file cannot merge two statements into one match.
const FROM_RE = /\b(import|export)\s+(type\s+)?((?:(?!\b(?:import|export)\b)[^;'"`])*?)\bfrom\s*(['"])([^'"\n]+)\4/g;
const SIDE_RE = /\bimport\s*(['"])([^'"\n]+)\1/g;
const DYN_RE = /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;
const REQ_RE = /\brequire\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;
const MOCK_RE = /\bvi\.(?:mock|doMock|importActual|importMock)\s*\(\s*(['"])([^'"\n]+)\1/g;

/** Static import/export-from, `import type`, side-effect import, constant `import()`, `require`, `vi.mock`. */
export function extractImports(source: string): ExtractResult {
  const s = blankNonCode(source);
  const found: RawImport[] = [];
  const lineIndex = [0];
  for (let k = 0; k < s.length; k++) if (s.charCodeAt(k) === 10) lineIndex.push(k + 1);
  const lineOf = (idx: number): number => {
    let lo = 0;
    let hi = lineIndex.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((lineIndex[mid] ?? 0) <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  let m: RegExpExecArray | null;
  FROM_RE.lastIndex = 0;
  while ((m = FROM_RE.exec(s))) {
    const kind = m[1] === 'export' ? 'reexport' : m[2] ? 'type' : 'import';
    found.push({ specifier: m[5] ?? '', kind, line: lineOf(m.index) });
  }
  const scan = (re: RegExp, kind: RawImport['kind']): void => {
    re.lastIndex = 0;
    let x: RegExpExecArray | null;
    while ((x = re.exec(s))) found.push({ specifier: x[2] ?? '', kind, line: lineOf(x.index) });
  };
  scan(SIDE_RE, 'import');
  // `typeof import('x').y` and `import('x').Type` are type positions (no runtime load): report them as type imports.
  DYN_RE.lastIndex = 0;
  while ((m = DYN_RE.exec(s))) {
    const before = s.slice(Math.max(0, m.index - 12), m.index);
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 40);
    const typePosition = /\btypeof\s+$/.test(before) || (/^\s*\.\s*[A-Z]\w*/.test(after) && !/^\s*\.\s*(?:then|catch|finally)\b/.test(after));
    found.push({ specifier: m[2] ?? '', kind: typePosition ? 'type' : 'dynamic', line: lineOf(m.index) });
  }
  scan(REQ_RE, 'require');
  scan(MOCK_RE, 'mock');
  const allDyn = (s.match(/\bimport\s*\(/g) ?? []).length;
  const constDyn = (s.match(/\bimport\s*\(\s*['"]/g) ?? []).length;
  return { imports: found, unresolvedDynamic: Math.max(0, allDyn - constDyn) };
}
