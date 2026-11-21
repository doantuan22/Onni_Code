import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AgentBrowser, bootProjectId, fixtureServeEnv, onniCli, stopFixtureServer } from './agent-browser'
import record from './fixtures/thread-run.record.json'

const RUN = { ...record, task: 'Check wrapping for this token: ' + 'x'.repeat(180) }
const REPLY = 'The answer should fill the reading column.'
const COLUMN = '[data-slot="thread-rows"]'
const ANSWER = '[data-slot="assistant-message"]'
const DOCK = '[data-slot="thread-dock"]'
const COMPOSER = `${DOCK} [data-slot="composer"]`

let browser: AgentBrowser
let server: ChildProcess
let dataRoot: string
let taskUrl: string

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close(() => {
        if (!address || typeof address === 'string') reject(new Error('No fixture port assigned'))
        else resolve(address.port)
      })
    })
  })
}

async function waitForHealth(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(1_000) })).ok) return
    } catch {
      // The fixture server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`onni e2e: the thread geometry fixture never answered at ${baseUrl}`)
}

beforeAll(async () => {
  // The store reads the run index at boot, so seed the replay in an isolated server.
  dataRoot = mkdtempSync(join(tmpdir(), 'onni-e2e-thread-geometry-'))
  const data = join(dataRoot, '.ai/onni')
  mkdirSync(join(data, 'runs'), { recursive: true })
  writeFileSync(join(data, 'runs.json'), JSON.stringify([RUN]))
  writeFileSync(join(data, 'runs', `${RUN.id}.ndjson`), JSON.stringify({
    type: 'text', stepId: 'task', seq: 1, ts: RUN.createdAt, text: REPLY,
  }) + '\n')
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, [onniCli, 'serve', '--repo', dataRoot, '--port', String(port), '--no-open'], {
    env: fixtureServeEnv(dataRoot),
    stdio: 'ignore',
  })
  await waitForHealth(baseUrl)
  taskUrl = `${baseUrl}/p/${await bootProjectId(baseUrl)}/tasks/${RUN.id}`
  browser = AgentBrowser.open(`e2e-thread-geometry-${process.pid}`)
})

afterAll(async () => {
  try {
    browser?.close()
  } finally {
    await stopFixtureServer(server, dataRoot)
  }
})

function openThread(width: number, height: number) {
  browser.setViewport(width, height)
  browser.goto(taskUrl)
  browser.waitForFunction(`document.querySelector('${ANSWER}')?.textContent.includes(${JSON.stringify(REPLY)})
    && !!document.querySelector('${COMPOSER}')`)
}

function expectAlignedGeometry() {
  const geometry = browser.evaluate(`(() => {
    const rect = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON()
    const bubble = '[data-slot="user-bubble"]'
    const b = document.querySelector(bubble)
    return {
      column: rect('${COLUMN}'), answer: rect('${ANSWER}'), composer: rect('${COMPOSER}'),
      dock: rect('${DOCK}'), bubble: rect(bubble), bubbleOverflow: b.scrollWidth - b.clientWidth,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
    }
  })()`) as {
    column: DOMRect; answer: DOMRect; composer: DOMRect; dock: DOMRect; bubble: DOMRect
    bubbleOverflow: number; viewportWidth: number; viewportHeight: number
  }
  const { column, answer, composer, dock, bubble, bubbleOverflow, viewportWidth, viewportHeight } = geometry
  // One CSS pixel allows for subpixel rounding across viewport sizes.
  expect(column.width).toBeGreaterThan(0)
  expect(composer.height).toBeGreaterThan(0)
  expect(Math.abs(column.left - composer.left)).toBeLessThanOrEqual(1)
  expect(Math.abs(column.right - composer.right)).toBeLessThanOrEqual(1)
  expect(Math.abs(composer.left - dock.left - (dock.right - composer.right))).toBeLessThanOrEqual(1)
  expect(Math.abs(answer.left - column.left)).toBeLessThanOrEqual(1)
  expect(Math.abs(answer.right - column.right)).toBeLessThanOrEqual(1)
  expect(Math.abs(bubble.right - column.right)).toBeLessThanOrEqual(1)
  expect(bubble.left).toBeGreaterThan(column.left)
  expect(bubbleOverflow).toBeLessThanOrEqual(1)
  expect(composer.left).toBeGreaterThanOrEqual(0)
  expect(composer.right).toBeLessThanOrEqual(viewportWidth)
  expect(dock.top).toBeGreaterThanOrEqual(0)
  expect(dock.bottom).toBeLessThanOrEqual(viewportHeight + 1)
  return column.width
}

describe('thread and composer geometry', () => {
  it('shares a centered column at both desktop reading widths', () => {
    openThread(1440, 900)
    const full = expectAlignedGeometry()

    // Exercise the same root attribute as Appearance without coupling geometry to settings UI.
    browser.evaluate(`document.documentElement.dataset.width = 'narrow'`)
    expect(expectAlignedGeometry()).toBeLessThan(full)
  })

  it('keeps the chat and dock aligned at a narrow viewport', () => {
    openThread(390, 844)
    expectAlignedGeometry()
  })
})
