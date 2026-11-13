import { describe, expect, it } from 'vitest';
import { isDenied } from './denylist.ts';

describe('isDenied', () => {
  it.each([
    '.env',
    '.env.local',
    '.env.production',
    'packages/work/.env',
    'certs/server.pem',
    'a/b/tls.KEY',
    'store.p12',
    'id_rsa',
    '.ssh/id_rsa.pub',
    '.npmrc',
    'packages/web/.npmrc',
    '.git/config',
    'node_modules/x/index.js',
    'packages/work/node_modules/y/a.ts',
    'packages/work/dist/index.js',
    'packages/work/web/dist/index.html',
    String.raw`a\b\.env`,
  ])('blocks %s', (p) => {
    expect(isDenied(p)).toBe(true);
  });

  it.each(['.env.example', 'src/env.ts', 'src/keys.ts', 'src/environment.ts', 'docs/pem.md', 'packages/work/src/index.ts', 'distinct/a.ts'])(
    'allows %s',
    (p) => {
      expect(isDenied(p)).toBe(false);
    },
  );
});
