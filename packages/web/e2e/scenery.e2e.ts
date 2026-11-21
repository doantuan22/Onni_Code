import { spawn, type ChildProcess } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AgentBrowser, bootProjectId, fixtureServeEnv, onniCli, stopFixtureServer } from './agent-browser'
import run from './fixtures/thread-run.record.json'

// Pixel-scenes §7: use a completed transcript so this flow never launches an agent.
const artifacts = resolve(import.meta.dirname, '../../../.ai/qa/artifacts_e2e')
const sidebarToggle = '[data-slot="sidebar"] [data-slot="scene-toggle"]'
const enableSwitch = '[role="switch"][aria-label="Enable background scenes"]'
const backdrop = '[data-slot="scene-backdrop"]'
let browser: AgentBrowser
let server: ChildProcess
let root: string
let baseUrl: string
let project: string

function freePort(): Promise<number> {
  return new Promise((done, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => done(port))
    })
  })
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'onni-e2e-scenery-'))
  mkdirSync(join(root, '.ai/onni/runs'), { recursive: true })
  writeFileSync(join(root, '.ai/onni/runs.json'), JSON.stringify([run]))
  copyFileSync(resolve(import.meta.dirname, 'fixtures/thread-run.ndjson'), join(root, '.ai/onni/runs', `${run.id}.ndjson`))
  baseUrl = `http://127.0.0.1:${await freePort()}`
  server = spawn(process.execPath, [onniCli, 'serve', '--repo', root, '--port', new URL(baseUrl).port, '--no-open'], {
    env: fixtureServeEnv(root), stdio: 'ignore',
  })
  let healthy = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/v1/health`, { signal: AbortSignal.timeout(1000) })).ok) {
        healthy = true
        break
      }
    } catch { /* server booting */ }
    await new Promise((done) => setTimeout(done, 250))
  }
  if (!healthy) throw new Error('Scenery fixture server never became healthy')
  project = await bootProjectId(baseUrl)
  browser = AgentBrowser.open(`e2e-scenery-${process.pid}`)
  browser.setViewport(1440, 900)
}, 90_000)

afterAll(async () => {
  try { browser?.close() } finally { await stopFixtureServer(server, root) }
})

function expectScene(surface: 'new' | 'chat', mode: 'full' | 'horizon') {
  browser.waitForFunction(`document.documentElement.dataset.scene === 'on' && document.querySelector('${backdrop}[data-surface="${surface}"][data-mode="${mode}"][data-ready] canvas') !== null`)
  expect(browser.evaluate('document.documentElement.dataset.scene')).toBe('on')
  expect(browser.count(`${backdrop} canvas`)).toBe(1)
}

function openPopover() {
  browser.click(sidebarToggle)
  browser.waitForFunction(`document.querySelector('${enableSwitch}') !== null`)
}

function closePopover() {
  browser.press('Escape')
  browser.waitForFunction(`document.querySelector('${enableSwitch}') === null`)
}

describe('background scenes via the sidebar popover', () => {
  it('enables a scene on new task and chat in both themes, then removes the canvas when disabled', () => {
    browser.goto(`${baseUrl}/p/${project}/new`)
    browser.waitForFunction(`document.querySelector('${sidebarToggle}') !== null && document.documentElement.dataset.scene === 'off'`)
    expect(browser.count(`${backdrop} canvas`)).toBe(0)
    openPopover()
    browser.click('[data-scene-id="vn-halong"]')
    browser.click(enableSwitch)
    expectScene('new', 'full')
    closePopover()

    // Wait for persistence before a document navigation reads server truth again.
    browser.waitForFunction(`(async () => {
      const state = await (await fetch('/api/v1/workspace/ui-state')).json()
      return state.appearance?.scene?.on === true && state.appearance.scene.id === 'vn-halong'
    })()`)

    for (const surface of ['new', 'chat'] as const) {
      browser.goto(`${baseUrl}/p/${project}${surface === 'new' ? '/new' : `/tasks/${run.id}`}`)
      if (surface === 'chat') browser.waitForFunction(`document.querySelector('[data-slot="user-bubble"]') !== null`)
      for (const theme of ['dark', 'light'] as const) {
        const themeToggle = '[data-slot="sidebar"] [data-slot="theme-toggle"]'
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (browser.evaluate(`document.querySelector('${themeToggle}').dataset.themePref`) === theme) break
          browser.click(themeToggle)
        }
        browser.waitForFunction(`document.documentElement.classList.contains('light') === ${theme === 'light'}`)
        expectScene(surface, surface === 'new' ? 'full' : 'horizon')
        browser.screenshot(`${artifacts}/scenery-${surface}-${theme}.png`, { viewport: true })
      }
    }

    openPopover()
    browser.click(enableSwitch)
    browser.waitForFunction(`document.documentElement.dataset.scene === 'off' && document.querySelector('${backdrop} canvas') === null`)
    expect(browser.evaluate('document.documentElement.dataset.scene')).toBe('off')
    expect(browser.count(backdrop)).toBe(0)
    closePopover()
  }, 120_000)
})
