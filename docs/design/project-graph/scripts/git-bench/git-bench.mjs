#!/usr/bin/env node
/**
 * Repeatable local Git timing spike for Project Graph S4.
 * It invokes Git directly (never through a shell) and makes no repository changes.
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '../../../../..');
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const LOCKFILE_NAMES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'composer.lock',
  'go.sum',
  'cargo.lock',
  'poetry.lock',
  'pipfile.lock',
]);

function parseArgs(argv) {
  const options = { repo: DEFAULT_REPO, runs: 5, timeoutMs: 30_000, hashConcurrency: 16, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') options.repo = resolve(argv[++index] ?? '');
    else if (arg === '--runs') options.runs = Number(argv[++index]);
    else if (arg === '--timeout-ms') options.timeoutMs = Number(argv[++index]);
    else if (arg === '--hash-concurrency') options.hashConcurrency = Number(argv[++index]);
    else if (arg === '--json') options.json = true;
    else if (arg === '--help') {
      console.log('Usage: node git-bench.mjs [--repo <path>] [--runs <n>] [--timeout-ms <n>] [--hash-concurrency <n>] [--json]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error('--runs must be a positive integer');
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) throw new Error('--timeout-ms must be a positive integer');
  if (!Number.isInteger(options.hashConcurrency) || options.hashConcurrency < 1) throw new Error('--hash-concurrency must be a positive integer');
  return options;
}

function runGit(repo, args, timeoutMs, input) {
  return new Promise((resolveRun, rejectRun) => {
    const started = process.hrtime.bigint();
    const child = spawn('git', args, { cwd: repo, shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      rejectRun(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const output = Buffer.concat(stdout);
      if (timedOut) return rejectRun(new Error(`git ${args[0]} exceeded ${timeoutMs} ms`));
      if (code !== 0) return rejectRun(new Error(`git ${args.join(' ')} failed (${code ?? signal}): ${Buffer.concat(stderr).toString('utf8').trim()}`));
      resolveRun({ durationMs, stdout: output, stderr: Buffer.concat(stderr) });
    });
    child.stdin.end(input);
  });
}

function summary(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return {
    min: sorted[0],
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    max: sorted.at(-1),
  };
}

async function repeated(runs, action) {
  const samples = [];
  for (let index = 0; index < runs; index += 1) samples.push(await action());
  return samples;
}

function pathsFromZ(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1)];
}

function parseNameStatus(buffer) {
  const tokens = buffer.toString('utf8').split('\0');
  const filesPerCommit = new Map();
  let currentCommit;
  let pairs = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index].trim();
    if (/^[0-9a-f]{40}$/i.test(token)) {
      currentCommit = token;
      if (!filesPerCommit.has(token)) filesPerCommit.set(token, 0);
      continue;
    }
    if (!currentCommit || !/^[ACDMRTUXB][0-9]*$/.test(token)) continue;
    const pathFields = token.startsWith('R') || token.startsWith('C') ? 2 : 1;
    if (index + pathFields >= tokens.length) break;
    filesPerCommit.set(currentCommit, filesPerCommit.get(currentCommit) + 1);
    pairs += 1;
    index += pathFields;
  }
  return { commits: filesPerCommit.size, pairs, fileCounts: [...filesPerCommit.values()] };
}

function isTestPath(filePath) {
  return /\.test\.(?:ts|tsx)$/i.test(filePath) || /(^|\/)test\//i.test(filePath);
}

function countPaths(paths) {
  const extensions = {};
  const packages = {};
  let tests = 0;
  for (const filePath of paths) {
    const extension = extname(filePath).toLowerCase() || '(không phần mở rộng)';
    extensions[extension] = (extensions[extension] ?? 0) + 1;
    const packageMatch = /^packages\/([^/]+)\//.exec(filePath);
    if (packageMatch) packages[packageMatch[1]] = (packages[packageMatch[1]] ?? 0) + 1;
    if (isTestPath(filePath)) tests += 1;
  }
  return { extensions, packages, tests };
}

async function nodeHash(repo, paths, algorithm, concurrency) {
  const started = process.hrtime.bigint();
  let bytes = 0;
  let next = 0;
  async function worker() {
    while (next < paths.length) {
      const filePath = paths[next++];
      const content = await readFile(resolve(repo, filePath));
      bytes += content.length;
      createHash(algorithm).update(content).digest();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, paths.length) }, worker));
  return { durationMs: Number(process.hrtime.bigint() - started) / 1e6, bytes };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const tracked = await runGit(options.repo, ['ls-files', '-z'], options.timeoutMs);
  const trackedPaths = pathsFromZ(tracked.stdout);
  const codePaths = trackedPaths.filter((filePath) => CODE_EXTENSIONS.has(extname(filePath).toLowerCase()));
  const measurements = {};

  async function timeGit(name, args, extra = () => ({})) {
    const samples = await repeated(options.runs, async () => {
      const result = await runGit(options.repo, args, options.timeoutMs);
      return { durationMs: result.durationMs, outputBytes: result.stdout.length, ...extra(result) };
    });
    measurements[name] = {
      command: `git ${args.join(' ')}`,
      durationMs: summary(samples.map((sample) => sample.durationMs)),
      outputBytes: summary(samples.map((sample) => sample.outputBytes)),
      samples,
    };
    return samples;
  }

  await timeGit('lsFiles', ['ls-files', '-z'], (result) => ({ paths: pathsFromZ(result.stdout).length }));
  await timeGit('lsFilesWithOthers', ['ls-files', '-z', '--others', '--exclude-standard'], (result) => ({ paths: pathsFromZ(result.stdout).length }));

  const logSizes = {};
  for (const count of [100, 300, 'all']) {
    const args = ['log', '--name-status', '-M', '-z', '--no-merges', '--format=%x00%H%x00'];
    if (count !== 'all') args.push('-n', String(count));
    const samples = await repeated(options.runs, async () => {
      const result = await runGit(options.repo, args, options.timeoutMs);
      return { durationMs: result.durationMs, outputBytes: result.stdout.length, ...parseNameStatus(result.stdout) };
    });
    logSizes[String(count)] = {
      command: `git ${args.join(' ')}`,
      durationMs: summary(samples.map((sample) => sample.durationMs)),
      outputBytes: summary(samples.map((sample) => sample.outputBytes)),
      commits: samples[0].commits,
      commitFilePairs: samples[0].pairs,
      filesPerCommit: {
        median: percentile(samples[0].fileCounts, 50),
        p90: percentile(samples[0].fileCounts, 90),
        p95: percentile(samples[0].fileCounts, 95),
        p99: percentile(samples[0].fileCounts, 99),
        max: Math.max(...samples[0].fileCounts, 0),
      },
      samples,
    };
  }
  measurements.logNameStatus = logSizes;

  const commitList = await runGit(options.repo, ['rev-list', '--no-merges', '-n', '50', 'HEAD'], options.timeoutMs);
  const commits = commitList.stdout.toString('utf8').trim().split(/\r?\n/).filter(Boolean);
  const batchArgs = ['log', '--name-status', '-M', '-z', '--no-merges', '--format=%x00%H%x00', '-n', '50'];
  const batchSamples = await repeated(options.runs, async () => {
    const result = await runGit(options.repo, batchArgs, options.timeoutMs);
    return { durationMs: result.durationMs, outputBytes: result.stdout.length };
  });
  const perCommitSamples = await repeated(options.runs, async () => {
    const started = process.hrtime.bigint();
    let outputBytes = 0;
    for (const commit of commits) {
      const result = await runGit(options.repo, ['diff-tree', '-M', '--no-commit-id', '--name-status', '-r', '-z', commit], options.timeoutMs);
      outputBytes += result.stdout.length;
    }
    return { durationMs: Number(process.hrtime.bigint() - started) / 1e6, outputBytes };
  });
  measurements.batchVsPerCommit50 = {
    commits: commits.length,
    batch: { command: `git ${batchArgs.join(' ')}`, durationMs: summary(batchSamples.map((sample) => sample.durationMs)), outputBytes: summary(batchSamples.map((sample) => sample.outputBytes)), samples: batchSamples },
    perCommit: { command: 'git diff-tree -M --no-commit-id --name-status -r -z <commit> (50 lần nối tiếp)', durationMs: summary(perCommitSamples.map((sample) => sample.durationMs)), outputBytes: summary(perCommitSamples.map((sample) => sample.outputBytes)), samples: perCommitSamples },
  };

  const gitHashSamples = await repeated(options.runs, async () => {
    const result = await runGit(options.repo, ['hash-object', '--stdin-paths'], options.timeoutMs, Buffer.from(codePaths.join('\n')));
    return { durationMs: result.durationMs, outputBytes: result.stdout.length };
  });
  const sha1Samples = await repeated(options.runs, () => nodeHash(options.repo, codePaths, 'sha1', options.hashConcurrency));
  const sha256Samples = await repeated(options.runs, () => nodeHash(options.repo, codePaths, 'sha256', options.hashConcurrency));
  measurements.hashing = {
    codeFiles: codePaths.length,
    nodeHashConcurrency: options.hashConcurrency,
    gitHashObject: { durationMs: summary(gitHashSamples.map((sample) => sample.durationMs)), outputBytes: summary(gitHashSamples.map((sample) => sample.outputBytes)), samples: gitHashSamples },
    nodeSha1: { durationMs: summary(sha1Samples.map((sample) => sample.durationMs)), readBytes: summary(sha1Samples.map((sample) => sample.bytes)), samples: sha1Samples },
    nodeSha256: { durationMs: summary(sha256Samples.map((sample) => sample.durationMs)), readBytes: summary(sha256Samples.map((sample) => sample.bytes)), samples: sha256Samples },
  };

  await timeGit('revParseHead', ['rev-parse', 'HEAD']);
  await timeGit('statusPorcelainV2', ['status', '--porcelain=v2', '-z']);

  const allNameStatus = await runGit(options.repo, ['log', '--name-status', '-z', '--format=%x00%H%x00'], options.timeoutMs);
  const allTokens = allNameStatus.stdout.toString('utf8').split('\0');
  let currentCommit;
  const lockfileCommits = new Set();
  for (let index = 0; index < allTokens.length; index += 1) {
    const token = allTokens[index].trim();
    if (/^[0-9a-f]{40}$/i.test(token)) currentCommit = token;
    else if (currentCommit && /^[ACDMRTUXB][0-9]*$/.test(token)) {
      const pathFields = token.startsWith('R') || token.startsWith('C') ? 2 : 1;
      for (let offset = 1; offset <= pathFields; offset += 1) if (LOCKFILE_NAMES.has(basename(allTokens[index + offset] ?? ''))) lockfileCommits.add(currentCommit);
      index += pathFields;
    }
  }
  const authorLog = await runGit(options.repo, ['log', '--format=%an%x00%ae%x00'], options.timeoutMs);
  const authorTokens = authorLog.stdout.toString('utf8').split('\0');
  let botCommits = 0;
  for (let index = 0; index + 1 < authorTokens.length; index += 2) if (/(bot|dependabot|renovate|github-actions)/i.test(`${authorTokens[index]} ${authorTokens[index + 1]}`)) botCommits += 1;
  const mergeLog = await runGit(options.repo, ['rev-list', '--count', '--merges', 'HEAD'], options.timeoutMs);

  const report = {
    generatedAt: new Date().toISOString(),
    repo: options.repo,
    gitHead: (await runGit(options.repo, ['rev-parse', 'HEAD'], options.timeoutMs)).stdout.toString('utf8').trim(),
    runs: options.runs,
    timeoutMs: options.timeoutMs,
    trackedPathCounts: countPaths(trackedPaths),
    measurements,
    historyNoise: {
      botCommits,
      mergeCommits: Number(mergeLog.stdout.toString('utf8').trim()),
      lockfileCommits: lockfileCommits.size,
      lockfileNames: [...LOCKFILE_NAMES].sort(),
    },
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
