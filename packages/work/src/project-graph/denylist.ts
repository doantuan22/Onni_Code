// Project Graph denylist (PLAN §4.7). A denied path is never read, hashed, or made a graph node.

/** True when `path` (repo-relative) must never be read, hashed or indexed. */
export function isDenied(path: string): boolean {
  const segs = path.replace(/\\/g, '/').split('/');
  const base = segs[segs.length - 1] ?? '';
  if (segs.includes('node_modules') || segs.includes('.git')) return true;
  if (segs.includes('dist')) return true; // `dist/` and `web/dist`
  if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) return true;
  if (/\.(pem|key|p12)$/i.test(base)) return true;
  if (/^id_rsa/i.test(base)) return true;
  if (base === '.npmrc') return true;
  return false;
}
