// Capture the landing site viewport by viewport (desktop + mobile) for review rounds.
// Usage: node docs/landing-site/tools/capture.mjs <out-dir> [--mobile] [--light] [--reduced] [--step 900]
// Needs playwright-core (resolved from the repo or its parent checkout) and a local Chrome/Edge.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const out = resolve(args[0] ?? resolve(here, '../03-mockups/round-2'));
const mobile = args.includes('--mobile');
const light = args.includes('--light');
const reduced = args.includes('--reduced');
const stepArg = args.indexOf('--step');
const prefix = (mobile ? 'mobile' : 'desktop') + (light ? '-light' : '') + (reduced ? '-reduced' : '');

function loadPlaywright() {
  const roots = [here, process.cwd(), resolve(here, '../../../../..'), 'D:/OnniCode'];
  for (const root of roots) {
    try { return createRequire(resolve(root, 'noop.js'))('playwright-core'); } catch {}
  }
  throw new Error('playwright-core not found');
}
const chromes = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: chromes.find(existsSync) });
const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
if (light) await page.addInitScript(() => localStorage.setItem('onni-landing-theme', 'light'));
await page.goto(pathToFileURL(resolve(here, '../site/index.html')).href);
if (light) await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
await page.waitForTimeout(3500); // let the hero boot finish
mkdirSync(out, { recursive: true });
const height = await page.evaluate(() => document.documentElement.scrollHeight);
const step = stepArg > -1 ? Number(args[stepArg + 1]) : viewport.height;
let i = 0;
for (let y = 0; y < height; y += step, i++) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve(out, `${prefix}-${String(i).padStart(2, '0')}.png`) });
}
console.log(JSON.stringify({ shots: i, height, errors }, null, 1));
await browser.close();
