import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

import { RunStore } from '../../packages/work/src/runs/store.ts'

const numberArg = (name: string, fallback: number) => {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv.at(index + 1)
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`)
  return parsed
}

const percentile = (samples: readonly number[], quantile: number) => {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)]!
}

const format = (value: number) => value.toFixed(3)

const concurrentRuns = numberArg('--runs', 20)
const batches = numberArg('--batches', 20)
const dataDir = mkdtempSync(join(tmpdir(), 'onni-run-store-bench-'))

try {
  const store = RunStore.open(dataDir)
  const runIds = Array.from({ length: concurrentRuns }, (_, index) =>
    store.createRun({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      title: `Benchmark run ${index}`,
      workflow: 'benchmark',
      task: 'Measure local RunStore IO only.',
      steps: [{ id: 'bench', name: 'Benchmark', kind: 'agent' }],
    }).id)
  store.flush({ throwOnError: true })

  const appendSamples: number[] = []
  const flushSamples: number[] = []
  const lagSamples: number[] = []

  for (let batch = 0; batch < batches; batch += 1) {
    const expected = performance.now() + 1
    const lag = new Promise<number>((resolve) => {
      setTimeout(() => resolve(Math.max(0, performance.now() - expected)), 1)
    })

    for (const runId of runIds) {
      const started = performance.now()
      store.appendEvent(runId, { type: 'text', text: `batch ${batch}` })
      appendSamples.push(performance.now() - started)
    }

    const flushStarted = performance.now()
    store.flush({ throwOnError: true })
    flushSamples.push(performance.now() - flushStarted)
    lagSamples.push(await lag)
  }

  console.log('RunStore local IO benchmark')
  console.log(`runs=${concurrentRuns} batches=${batches} appends=${appendSamples.length}`)
  console.log(`appendEvent_ms p50=${format(percentile(appendSamples, 0.5))} p95=${format(percentile(appendSamples, 0.95))}`)
  console.log(`indexFlush_ms p50=${format(percentile(flushSamples, 0.5))} p95=${format(percentile(flushSamples, 0.95))}`)
  console.log(`eventLoopLag_ms p50=${format(percentile(lagSamples, 0.5))} p95=${format(percentile(lagSamples, 0.95))}`)
} finally {
  rmSync(dataDir, { recursive: true, force: true })
}
