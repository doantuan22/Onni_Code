import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../../../scripts/check-env-reference.mjs');

function withFixture(envExample: string, reference: string, run: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'onni-env-reference-'));
  try {
    writeFileSync(join(directory, '.env.example'), envExample);
    writeFileSync(join(directory, 'reference.md'), reference);
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('check-env-reference', () => {
  it('reports ONNI_* names absent from the reference environment table', () => {
    withFixture(
      '# ONNI_DOCUMENTED=1\n# ONNI_MISSING=1\n',
      'Useful environment variables:\n\n| Var | Effect |\n|---|---|\n| `ONNI_DOCUMENTED=1` | Present. |\n',
      (directory) => {
        const result = spawnSync(process.execPath, [
          script,
          '--env-example', join(directory, '.env.example'),
          '--reference', join(directory, 'reference.md'),
        ], { encoding: 'utf8' });
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('ONNI_MISSING');
      },
    );
  });

  it('succeeds when every ONNI_* name has a reference-table row', () => {
    withFixture(
      '# ONNI_DOCUMENTED=1\n',
      'Useful environment variables:\n\n| Var | Effect |\n|---|---|\n| `ONNI_DOCUMENTED=1` | Present. |\n',
      (directory) => {
        const result = spawnSync(process.execPath, [
          script,
          '--env-example', join(directory, '.env.example'),
          '--reference', join(directory, 'reference.md'),
        ], { encoding: 'utf8' });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('All ONNI_* names');
      },
    );
  });

  it('ignores runtime-injected, test-only, and desktop-managed names', () => {
    withFixture(
      '# ONNI_API_URL=http://127.0.0.1:4321\n# ONNI_MOCK_PACE=slow\n# ONNI_DESKTOP_DEBUG_IPC=1\n',
      'Useful environment variables:\n\n| Var | Effect |\n|---|---|\n',
      (directory) => {
        const result = spawnSync(process.execPath, [
          script,
          '--env-example', join(directory, '.env.example'),
          '--reference', join(directory, 'reference.md'),
        ], { encoding: 'utf8' });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('All ONNI_* names');
      },
    );
  });
});
