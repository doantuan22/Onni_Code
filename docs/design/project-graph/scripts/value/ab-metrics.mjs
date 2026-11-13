// V1b: metrics for one A/B run from its onni event log (PLAN.md §9.1, spikes/value.md).
// usage: node ab-metrics.mjs <runs dir> <run id>...   prints one JSON line per run
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [dir, ...ids] = process.argv.slice(2);
for (const id of ids) {
  const file = readdirSync(dir).find((f) => f.startsWith(id) && f.endsWith('.ndjson'));
  const events = readFileSync(join(dir, file), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const tools = events.filter((e) => e.type === 'item.started' && e.item?.kind === 'tool');
  const cmd = (t) => String(t.item.input?.command ?? '');
  // setup = reading the order/handoff + reset/npm ci; work starts after the reset command
  const resetAt = tools.findIndex((t) => /git reset --hard/.test(cmd(t)));
  const work = tools.slice(resetAt + 1);
  // graph calls: the V1 prototype or the P1 `onni graph` CLI (built index.js); edits: patch tool or a shell write
  const isGraph = (t) => /graph-proto|index\.js['"]? graph /.test(cmd(t));
  const isEdit = (t) => t.item.name === 'fileChange' || /WriteAllText|Set-Content|Out-File|apply_patch/.test(cmd(t));
  const firstEdit = work.findIndex(isEdit);
  const reportAt = work.findIndex((t) => /task report|onni task|ONNI_BIN/.test(cmd(t)) && !isGraph(t));
  const tokens = events.filter((e) => e.type === 'token-usage').map((e) => e.tokensUsed);
  const usage = events.filter((e) => e.type === 'turn.completed').map((e) => e.usage ?? {});
  const ts = events.map((e) => e.ts).filter(Boolean);
  const startWork = tools[resetAt + 1]?.ts ?? ts[0];
  console.log(JSON.stringify({
    id: id.slice(0, 8),
    toolCalls: work.length,
    toolCallsBeforeFirstEdit: firstEdit,
    toolCallsBeforeReport: reportAt < 0 ? work.length : reportAt,
    graphCalls: work.filter(isGraph).length,
    edits: work.filter(isEdit).length,
    tokensTotal: tokens.at(-1) ?? null,
    lastTurnInput: usage.at(-1)?.input ?? null,
    wallSecondsAfterSetup: Math.round((Date.parse(ts.at(-1)) - Date.parse(startWork)) / 1000),
  }));
}
