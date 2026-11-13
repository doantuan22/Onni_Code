#!/usr/bin/env node
// Nấc 2 (vitest related) trên mẫu nhỏ: `vitest list --filesOnly --changed <cha>` tại worktree tạm của commit,
// node_modules nối (symlink) từ checkout chính — xấp xỉ, không phải môi trường cha chính xác.
//   node rung2.mjs --results full.json --wt <dir ngoài repo> --nm <đường dẫn node_modules> [--n 20] [--timeout-s 120]
import { execFileSync } from 'node:child_process';
import { readFileSync, symlinkSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const results = JSON.parse(readFileSync(opt('results'), 'utf8'));
const WT = opt('wt'), NM = opt('nm');
const N = Number(opt('n', 20)), TMO = Number(opt('timeout-s', 120)) * 1000;
const isTest = (p) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) || /(^|\/)(__tests__|test|tests)\//.test(p);

const val = results.testRows.filter((r) => r.set === 'val');
const step = Math.max(1, Math.floor(val.length / N));
const sample = val.filter((_, i) => i % step === 0).slice(0, N);
if (!existsSync(join(WT, 'node_modules'))) symlinkSync(NM, join(WT, 'node_modules'), 'junction');
const rows = [];
for (const r of sample) {
  const t = Date.now();
  try {
    execFileSync('git', ['checkout', '-f', '--detach', '-q', r.hash], { cwd: WT });
    // Modified tests go back to the parent state so --changed sees only the source change (it would list them trivially).
    if (r.truthList.length) execFileSync('git', ['checkout', r.hash + '~1', '--', ...r.truthList], { cwd: WT });
    const out = execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'list', '--filesOnly', '--changed', r.hash + '~1'], { cwd: WT, encoding: 'utf8', timeout: TMO, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
    const changed = new Set(execFileSync('git', ['diff', '--diff-filter=A', '--name-only', r.hash + '~1', r.hash], { cwd: WT, encoding: 'utf8' }).split('\n').filter(Boolean));
    const picked = new Set(out.split('\n').map((l) => l.replace(/^\[[^\]]+\]\s*/, '').trim()).filter((l) => l && isTest(l) && !changed.has(l)));
    const hit = r.truthList.filter((x) => picked.has(x)).length;
    rows.push({ hash: r.hash, truth: r.truthList.length, hit, size: picked.size, ms: Date.now() - t });
  } catch (e) { rows.push({ hash: r.hash, error: String(e.message).slice(0, 120), ms: Date.now() - t }); }
  console.error(rows[rows.length - 1]);
}
const ok = rows.filter((r) => !r.error);
const summary = { n: rows.length, ok: ok.length, meanRecall: ok.reduce((a, r) => a + r.hit / r.truth, 0) / (ok.length || 1),
  full: ok.filter((r) => r.hit === r.truth).length, medianSize: ok.map((r) => r.size).sort((a, b) => a - b)[Math.floor(ok.length / 2)], rows };
if (opt('out')) writeFileSync(opt('out'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, rows: undefined }));
