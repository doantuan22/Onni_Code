import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunStore } from '../runs/store.ts';
import type { RunManager } from '../workflows/run.ts';
import { createApp } from './server.ts';
import { AssetCache, compressible, wantsGzip } from './static-assets.ts';
import { ASSET_CACHE_CONTROL } from './static-ui.ts';

describe('the asset route caches the bytes it serves', () => {
  let dir: string;
  let assets: AssetCache;
  const BUNDLE = `console.log(${JSON.stringify('x'.repeat(4_000))});`;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'onni-assets-'));
    writeFileSync(join(dir, 'index-abc123.js'), BUNDLE);
    writeFileSync(join(dir, 'small-a1.js'), 'x'.repeat(100));
    writeFileSync(join(dir, 'font-ab12.woff2'), 'w'.repeat(4_000));
    writeFileSync(join(dir, 'style-cd34.css'), 'body{color:red}'.repeat(200));
    assets = new AssetCache(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the cache headers and content type it already sent', () => {
    const plan = assets.respond('index-abc123.js')!;
    expect(plan.headers['content-type']).toContain('text/javascript');
    expect(plan.headers['cache-control']).toBe(ASSET_CACHE_CONTROL);
    expect(plan.headers['content-encoding']).toBeUndefined();
  });

  it('reads a fingerprint once, so a later request survives the file leaving the disk', () => {
    expect(assets.respond('style-cd34.css')).toBeDefined();
    rmSync(join(dir, 'style-cd34.css'));
    expect(Buffer.from(assets.respond('style-cd34.css')!.body).toString()).toContain('color:red');
  });

  it('does not cache a miss, so a build that lands later is picked up', () => {
    expect(assets.respond('late-ef56.js')).toBeUndefined();
    writeFileSync(join(dir, 'late-ef56.js'), BUNDLE);
    expect(assets.respond('late-ef56.js')).toBeDefined();
  });

  it('answers gzip when the client accepts it, and the bytes inflate to the file', () => {
    const plan = assets.respond('index-abc123.js', 'gzip, deflate, br')!;
    expect(plan.headers['content-encoding']).toBe('gzip');
    expect(plan.headers.vary).toBe('accept-encoding');
    expect(Buffer.from(gunzipSync(plan.body)).toString()).toBe(BUNDLE);
  });

  it('serves the raw bytes to a client that cannot take gzip', () => {
    for (const header of [undefined, 'deflate', 'gzip;q=0']) {
      const plan = assets.respond('index-abc123.js', header)!;
      expect(plan.headers['content-encoding']).toBeUndefined();
      expect(Buffer.from(plan.body).toString()).toBe(BUNDLE);
    }
  });

  it('skips gzip where it would add bytes: small files and compressed formats', () => {
    expect(compresses('small-a1.js')).toBe(false);
    expect(compresses('font-ab12.woff2')).toBe(false);
    expect(compresses('style-cd34.css')).toBe(true);
  });

  function compresses(file: string): boolean {
    return assets.respond(file, 'gzip')!.headers['content-encoding'] === 'gzip';
  }

  it('refuses the paths the route must 404: dot-segments, separators and missing files', () => {
    for (const file of ['', '.', '..', 'a/b.js', 'a\\b.js', 'a\0b.js', 'nope.js']) {
      expect(assets.respond(file, 'gzip')).toBeUndefined();
    }
  });
});

describe('wantsGzip reads Accept-Encoding', () => {
  it('accepts the coding by name or wildcard, unless q=0 refuses it', () => {
    expect(wantsGzip(undefined)).toBe(false);
    expect(wantsGzip('')).toBe(false);
    expect(wantsGzip('gzip')).toBe(true);
    expect(wantsGzip('deflate, GZIP;q=0.5')).toBe(true);
    expect(wantsGzip('*')).toBe(true);
    expect(wantsGzip('gzip;q=0')).toBe(false);
    expect(wantsGzip('deflate, br')).toBe(false);
  });
});

describe('the scenery thumbnail route', () => {
  let repoRoot: string;
  let store: RunStore;
  let app: Hono;
  const thumbsDir = join(process.cwd(), 'packages/work/web/dist/scenery-thumbs');
  const thumb = 'scenery-route-test-light.png';
  let createdThumbsDir = false;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'onni-scenery-thumbs-'));
    mkdirSync(join(repoRoot, '.ai/onni'), { recursive: true });
    createdThumbsDir = !existsSync(thumbsDir);
    mkdirSync(thumbsDir, { recursive: true });
    writeFileSync(join(thumbsDir, thumb), 'png bytes');
    store = RunStore.open(join(repoRoot, '.ai/onni'));
    app = createApp({ repoRoot, store, manager: {} as RunManager, version: '0.0.0-test' });
  });

  afterEach(() => {
    store.flush();
    rmSync(repoRoot, { recursive: true, force: true });
    unlinkSync(join(thumbsDir, thumb));
    if (createdThumbsDir) rmSync(thumbsDir, { recursive: true, force: true });
  });

  it('serves known PNG thumbnails and rejects traversal, unknown, and malformed names', async () => {
    const valid = await app.request(`/scenery-thumbs/${thumb}`);
    expect(valid.status).toBe(200);
    expect(valid.headers.get('content-type')).toBe('image/png');
    expect(await valid.text()).toBe('png bytes');

    for (const file of ['..%2Fscenery-route-test-light.png', 'unknown-light.png', 'vn-halong-light.jpg', 'vn_halong-light.png']) {
      expect((await app.request(`/scenery-thumbs/${file}`)).status).toBe(404);
    }
  });
});
