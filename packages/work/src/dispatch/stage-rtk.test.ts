import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { stageRtkBinary } = await import(new URL('../../../desktop/scripts/stage-rtk.mjs', import.meta.url).href);
const manifest = readFileSync(new URL('./__fixtures__/rtk/checksums.txt', import.meta.url));

describe('RTK installer integrity', () => {
  let root: string | undefined;
  afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = undefined; });

  it('rejects unsupported targets before fetching anything', async () => {
    const fetchImpl = vi.fn();
    await expect(stageRtkBinary('unused', { platform: 'win32', arch: 'arm64', fetchImpl })).rejects.toThrow('No RTK OSS binary');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a modified checksum manifest', async () => {
    const fetchImpl = vi.fn(async () => new Response('tampered manifest'));
    await expect(stageRtkBinary('unused', { fetchImpl })).rejects.toThrow('pinned digest');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a corrupt archive without touching the last working binary', async () => {
    root = mkdtempSync(join(tmpdir(), 'onni-rtk-integrity-'));
    const destination = join(root, 'bin', 'rtk');
    mkdirSync(destination, { recursive: true });
    const previous = join(destination, process.platform === 'win32' ? 'rtk.exe' : 'rtk');
    writeFileSync(previous, 'last working binary');
    const fetchImpl = vi.fn(async (url: string) => new Response(url.endsWith('checksums.txt') ? manifest : 'corrupt archive'));
    await expect(stageRtkBinary(root, { fetchImpl })).rejects.toThrow('published SHA-256');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(readFileSync(previous, 'utf8')).toBe('last working binary');
  });

  it('bounds downloads and reports unavailable releases', async () => {
    await expect(stageRtkBinary('unused', {
      fetchImpl: async () => new Response('large', { headers: { 'content-length': '1000000' } }),
    })).rejects.toThrow('size limit');
    await expect(stageRtkBinary('unused', {
      fetchImpl: async () => new Response('missing', { status: 404 }),
    })).rejects.toThrow('404');
  });
});
