import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gitHead, listFiles } from './list-files.ts';

function gitAvailable(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3 });
});
function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'pg-list-'));
  dirs.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
  execFileSync('git', ['add', '-A', '-f'], { cwd: root });
  return root;
}

describe('listFiles', () => {
  it('lists tracked files and drops denylisted ones', async () => {
    if (!gitAvailable()) return;
    const root = repo({ 'src/a.ts': 'x', '.env': 'SECRET=1', 'keys/a.pem': 'k', 'node_modules/x/i.js': '1', '.env.example': 'A=' });
    const r = await listFiles(root);
    expect(r.available).toBe(true);
    if (r.available) {
      expect([...r.files].sort()).toEqual(['.env.example', 'src/a.ts']);
      expect(r.truncated).toBe(false);
    }
  });

  it('truncates past the cap and says so', async () => {
    if (!gitAvailable()) return;
    const root = repo({ 'a.ts': '1', 'b.ts': '1', 'c.ts': '1' });
    const r = await listFiles(root, { maxFiles: 2 });
    expect(r.available && r.truncated).toBe(true);
    if (r.available) expect(r.files.length).toBe(2);
  });

  it('degrades to a value when git fails', async () => {
    const run = () => Promise.reject(new Error('not a git repository'));
    const r = await listFiles('.', { run });
    expect(r).toEqual({ available: false, reason: expect.stringContaining('git ls-files failed') });
    expect(await gitHead('.', { run })).toBeNull();
  });
});
