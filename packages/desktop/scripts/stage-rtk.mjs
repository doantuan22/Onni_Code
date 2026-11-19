import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const VERSION = '1.2.0';
const RELEASE = `https://github.com/rtk-ai/rtk/releases/download/v${VERSION}`;
// GitHub's release metadata publishes this digest for the versioned checksums.txt asset.
const CHECKSUMS_SHA256 = 'cb6c58f0a063ee1ec2313d61d3ba7da6b4af95edf7a333739a692c099af4f48e';
const TARGETS = {
  'win32-x64': { asset: 'rtk-oss-x86_64-pc-windows-msvc.zip', archive: 'zip', executable: 'rtk.exe' },
  'darwin-x64': { asset: 'rtk-oss-x86_64-apple-darwin.tar.gz', archive: 'tar', executable: 'rtk' },
  'darwin-arm64': { asset: 'rtk-oss-aarch64-apple-darwin.tar.gz', archive: 'tar', executable: 'rtk' },
  'linux-x64': { asset: 'rtk-oss-x86_64-unknown-linux-musl.tar.gz', archive: 'tar', executable: 'rtk' },
  'linux-arm64': { asset: 'rtk-oss-aarch64-unknown-linux-musl.tar.gz', archive: 'tar', executable: 'rtk' },
};
const MAX_ASSET_BYTES = 20 * 1024 * 1024;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function download(url, fetchImpl, maximum) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
  if (!response.ok) throw new Error(`RTK download failed (${response.status})`);
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximum) throw new Error('RTK release asset exceeded its size limit');
  if (!response.body) throw new Error('RTK release asset had no response body');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error('RTK release asset exceeded its size limit');
    }
    chunks.push(Buffer.from(value));
  }
  if (size === 0) throw new Error('RTK release asset was empty');
  return Buffer.concat(chunks, size);
}

function collectExecutables(root, name, at = root) {
  const matches = [];
  for (const entry of readdirSync(at, { withFileTypes: true })) {
    const full = path.join(at, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) matches.push(...collectExecutables(root, name, full));
    else if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) matches.push(full);
  }
  return matches;
}

/** Download the pinned Apache-2.0 RTK OSS release for the current installer host and verify it. */
export async function stageRtkBinary(workPackageDir, options = {}) {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const target = TARGETS[`${platform}-${arch}`];
  if (!target) throw new Error(`No RTK OSS binary is published for ${platform}-${arch}`);
  const fetchImpl = options.fetchImpl ?? fetch;
  const checksums = await download(`${RELEASE}/checksums.txt`, fetchImpl, 64 * 1024);
  if (sha256(checksums) !== CHECKSUMS_SHA256) throw new Error('The RTK release checksum manifest did not match its pinned digest');
  const row = checksums.toString('utf8').split(/\r?\n/)
    .map((line) => line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i))
    .find((match) => match?.[2] === target.asset);
  const expected = row?.[1]?.toLowerCase();
  if (!expected) throw new Error(`The RTK checksum manifest has no entry for ${target.asset}`);
  const archive = await download(`${RELEASE}/${target.asset}`, fetchImpl, MAX_ASSET_BYTES);
  if (sha256(archive) !== expected) throw new Error('The downloaded RTK release did not match its published SHA-256 checksum');

  const root = path.resolve(workPackageDir);
  const destination = path.join(root, 'bin', 'rtk');
  if (path.relative(root, destination) !== path.join('bin', 'rtk')) throw new Error('Refusing an invalid RTK staging path');
  const scratch = mkdtempSync(path.join(tmpdir(), 'onni-rtk-'));
  try {
    const archivePath = path.join(scratch, target.asset);
    const extracted = path.join(scratch, 'extract');
    mkdirSync(extracted);
    writeFileSync(archivePath, archive, { mode: 0o600 });
    if (target.archive === 'zip') {
      const powershell = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:ONNI_RTK_ARCHIVE -DestinationPath $env:ONNI_RTK_EXTRACT -Force'], {
        env: { ...process.env, ONNI_RTK_ARCHIVE: archivePath, ONNI_RTK_EXTRACT: extracted },
        stdio: 'ignore', windowsHide: true, timeout: 30_000,
      });
    } else {
      execFileSync('tar', ['-xzf', archivePath, '-C', extracted], { stdio: 'ignore', timeout: 30_000 });
    }
    const candidates = collectExecutables(extracted, target.executable);
    if (candidates.length !== 1) throw new Error(`Expected one RTK executable in the verified release, found ${candidates.length}`);
    const executable = path.join(scratch, target.executable);
    copyFileSync(candidates[0], executable);
    if (platform !== 'win32') chmodSync(executable, 0o755);
    const versionText = execFileSync(executable, ['--version'], { encoding: 'utf8', timeout: 10_000, windowsHide: true }).trim();
    if (!new RegExp(`\\b${VERSION.replaceAll('.', '\\.')}\\b`).test(versionText)) {
      throw new Error(`The staged RTK binary reported an unexpected version: ${versionText.slice(0, 120)}`);
    }
    const license = await download(`https://raw.githubusercontent.com/rtk-ai/rtk/v${VERSION}/LICENSE`, fetchImpl, 32 * 1024);
    mkdirSync(destination, { recursive: true });
    const stagedExecutable = path.join(destination, target.executable);
    copyFileSync(executable, stagedExecutable);
    if (platform !== 'win32') chmodSync(stagedExecutable, 0o755);
    writeFileSync(path.join(destination, 'LICENSE'), license, { mode: 0o600 });
    writeFileSync(path.join(destination, 'NOTICE.txt'), `RTK OSS ${VERSION} by RTK AI Labs; Apache-2.0. Source: https://github.com/rtk-ai/rtk/tree/v${VERSION}\n`, { mode: 0o600 });
    return { executable: stagedExecutable, version: versionText };
  } finally {
    // This directory is freshly created under the OS temp root for this single download.
    rmSync(scratch, { recursive: true, force: true });
  }
}
