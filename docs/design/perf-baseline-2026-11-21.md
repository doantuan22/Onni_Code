# Local performance baseline — 2026-11-21

This is a local, one-run baseline for the two measurement targets in
`docs/system-survey-2026-11-21.md`. It sends no telemetry and makes no network
requests. Values are machine-, disk-, and Node-version-specific; they are a
comparison point, not a production SLO.

## Commands

```powershell
node --import tsx scripts/bench/run-store-io.ts
Push-Location packages/web
node --import tsx ../../scripts/bench/thread-row-model.ts
Pop-Location
```

The IO script accepts `--runs` and `--batches` positive integers (defaults:
20 and 20). It creates and removes an isolated temporary data directory.
The web command runs from `packages/web` so `tsx` uses that package's Vite
path aliases.

## Results

Environment: Windows, Node `v24.21.0`; run locally on 2026-11-21.

### RunStore append and index flush

Configuration: 20 concurrent runs, 20 batches, 400 total `appendEvent` calls.
Each batch appends one small v1 `text` event to every run, then calls
`RunStore.flush()`. Event-loop lag is the delay of a 1 ms timer scheduled
immediately before each synchronous append-and-flush batch.

| Metric | p50 (ms) | p95 (ms) |
| --- | ---: | ---: |
| `appendEvent` | 0.161 | 0.388 |
| index flush | 5.711 | 7.792 |
| event-loop lag | 8.030 | 15.105 |

### Thread reducer and row model

Configuration: 15 samples per input. Synthetic persisted `user-message`
events exercise `reduceThread`; each reduced result is then passed through
`mainTranscriptSections` and `buildTranscriptRows`. The extra row is the
initial prompt section.

| Target rows | Actual rows | `reduceThread` p50/p95 (ms) | row model p50/p95 (ms) |
| ---: | ---: | ---: | ---: |
| 300 | 301 | 0.285 / 1.173 | 0.983 / 1.887 |
| 1,000 | 1,001 | 0.854 / 7.075 | 3.267 / 7.368 |
| 3,000 | 3,001 | 1.686 / 2.675 | 7.264 / 9.115 |

## Recommendation

Keep the existing synchronous append and current reducer/row-model structure
for now: this one local baseline does not establish enough pressure to justify
a behavioral persistence change or deep thread refactor. Re-run the IO script
on supported Node 20 and a slower representative disk before considering the
proposed per-run write queue; use the p95 event-loop lag as the comparison
signal. At 3,000 rows the measured row-model work is still below 10 ms p95,
but this benchmark does not mount React nodes, so profile a real virtualized
thread before memoizing or splitting the reducer.
