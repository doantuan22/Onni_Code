import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** True when a `git` binary can run (tests that need one return early otherwise — guarded inside the test, never skipped). */
export function gitAvailable(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export class FixtureRepo {
  readonly root: string;
  constructor(prefix = 'pg-fixture-') {
    this.root = mkdtempSync(join(tmpdir(), prefix));
    this.git('init', '-q');
    this.git('config', 'user.email', 'graph@example.invalid');
    this.git('config', 'user.name', 'graph');
    this.git('config', 'commit.gpgsign', 'false');
  }
  git(...args: string[]): string {
    return execFileSync('git', args, { cwd: this.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  }
  write(files: Record<string, string>): this {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(this.root, p)), { recursive: true });
      writeFileSync(join(this.root, p), c);
    }
    return this;
  }
  remove(path: string): this {
    unlinkSync(join(this.root, path));
    return this;
  }
  commit(message = 'wip'): string {
    this.git('add', '-A', '-f');
    this.git('commit', '-q', '--allow-empty', '-m', message);
    return this.git('rev-parse', 'HEAD').trim();
  }
  dispose(): void {
    rmSync(this.root, { recursive: true, force: true, maxRetries: 5 });
  }
}
