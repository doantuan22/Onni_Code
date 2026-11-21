import { performance } from 'node:perf_hooks'

import type { RunEvent } from '../../packages/api-client/src/index.ts'
import { mainTranscriptSections, buildTranscriptRows } from '../../packages/web/src/routes/task-thread/session-transcript.tsx'
import { reduceThread } from '../../packages/web/src/routes/task-thread/thread-state.ts'

const ROW_TARGETS = [300, 1_000, 3_000] as const
const SAMPLES = 15

const percentile = (samples: readonly number[], quantile: number) => {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)]!
}

const format = (value: number) => value.toFixed(3)

const eventsForRows = (target: number): RunEvent[] =>
  Array.from({ length: target }, (_, index) => ({
    seq: index + 1,
    ts: '2026-11-21T00:00:00.000Z',
    type: 'user-message',
    text: `Synthetic benchmark message ${index}`,
  }) as RunEvent)

const run = {
  id: 'benchmark-run',
  title: 'Thread benchmark',
  workflow: 'benchmark',
  task: 'Initial prompt',
  status: 'done',
  createdAt: '2026-11-21T00:00:00.000Z',
  tokensUsed: 0,
  archived: false,
  steps: [],
} as const

console.log('Thread reducer and row-model local benchmark')
console.log(`samples=${SAMPLES}`)
for (const target of ROW_TARGETS) {
  const events = eventsForRows(target)
  const reduceSamples: number[] = []
  const rowSamples: number[] = []
  let rows = 0

  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const reduceStarted = performance.now()
    const thread = reduceThread(events)
    reduceSamples.push(performance.now() - reduceStarted)

    const rowStarted = performance.now()
    rows = buildTranscriptRows(mainTranscriptSections(run, thread), run.id).length
    rowSamples.push(performance.now() - rowStarted)
  }

  console.log(
    `targetRows=${target} actualRows=${rows} `
    + `reduceThread_ms p50=${format(percentile(reduceSamples, 0.5))} p95=${format(percentile(reduceSamples, 0.95))} `
    + `rowModel_ms p50=${format(percentile(rowSamples, 0.5))} p95=${format(percentile(rowSamples, 0.95))}`,
  )
}
