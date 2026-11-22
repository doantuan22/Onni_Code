import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SCENE_PREFERENCES, type ScenePreferences } from '@/lib/appearance'
import type { HostOptions } from '@/lib/scenery/engine/host-types'
import { SceneBackdrop } from './scene-backdrop'
import { SceneProvider } from './scene-provider'
import { ThemeProvider } from './theme-provider'

const { evaluateHost, evaluateEngine, createHost, dispose, update, loadScene } = vi.hoisted(() => ({
  evaluateHost: vi.fn(),
  evaluateEngine: vi.fn(),
  createHost: vi.fn<(canvas: HTMLCanvasElement, options: HostOptions) => unknown>(),
  dispose: vi.fn(),
  update: vi.fn(async (_options: Partial<HostOptions>) => {}),
  loadScene: vi.fn(async (id: string) => ({
    id,
    defaultTime: 'day',
    palettes: { dawn: [0xffffff], day: [0xffffff], dusk: [0xffffff], night: [0xffffff] },
  })),
}))

vi.mock('@/lib/scenery/engine/host', () => {
  evaluateHost()
  return { createSceneHost: createHost }
})

vi.mock('@/lib/scenery/engine', async (importOriginal) => {
  evaluateEngine()
  return {
    ...await importOriginal<typeof import('@/lib/scenery/engine')>(),
    sceneRegistry: { load: loadScene },
  }
})

const enabled = { ...DEFAULT_SCENE_PREFERENCES, id: 'vn-halong', on: true }

function sceneTree(entry: string, scene: ScenePreferences) {
  return (
    <ThemeProvider>
      <SceneProvider scene={scene} onChange={() => {}}>
        <MemoryRouter initialEntries={[entry]}>
          <Link to="/p/onni/tasks/run-1">Chat</Link>
          <Link to="/p/onni/tasks/run-1/changes">Changes</Link>
          <SceneBackdrop />
        </MemoryRouter>
      </SceneProvider>
    </ThemeProvider>
  )
}

const backdrop = () => document.querySelector<HTMLElement>('[data-slot="scene-backdrop"]')
const sceneCanvas = () => backdrop()?.querySelector('canvas')
const expectReady = () => expect(backdrop()?.hasAttribute('data-ready')).toBe(true)

let isDesktop: boolean
let changeViewport: () => void

beforeEach(() => {
  createHost.mockReset().mockReturnValue({ ready: Promise.resolve(), dispose, update })
  dispose.mockClear()
  update.mockClear()
  isDesktop = true
  changeViewport = () => {}
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return query.startsWith('(min-width:') && isDesktop },
    addEventListener: (_event: string, callback: () => void) => {
      if (query.startsWith('(min-width:')) changeViewport = callback
    },
    removeEventListener: () => {},
  }))
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1440)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
  const rootStyle = document.documentElement.style
  rootStyle.setProperty('--background', `#${(0x090909).toString(16).padStart(6, '0')}`)
  rootStyle.setProperty('--foreground', `#${(0xededed).toString(16)}`)
  rootStyle.setProperty('--muted-foreground', `#${(0xa1a1a1).toString(16)}`)
})

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('style')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SceneBackdrop', () => {
  it('does not load the engine or add a canvas when off or disabled on the current route', async () => {
    const rendered = render(sceneTree('/new', DEFAULT_SCENE_PREFERENCES))
    await act(() => {})
    expect(sceneCanvas()).toBeUndefined()
    expect(evaluateEngine).not.toHaveBeenCalled()
    expect(evaluateHost).not.toHaveBeenCalled()

    rendered.rerender(sceneTree('/new', { ...enabled, surfaces: { ...enabled.surfaces, new: false } }))
    await act(() => {})
    expect(sceneCanvas()).toBeUndefined()
    expect(evaluateEngine).not.toHaveBeenCalled()
    expect(evaluateHost).not.toHaveBeenCalled()
  })

  it('mounts the host with the requested visibility and disposes when turned off and when unmounted', async () => {
    const rendered = render(sceneTree('/p/onni/new', { ...enabled, motion: false, visibility: 1 }))
    await waitFor(expectReady)
    expect(backdrop()?.getAttribute('aria-hidden')).toBe('true')
    expect(backdrop()?.dataset).toMatchObject({ surface: 'new', mode: 'full' })
    expect(createHost).toHaveBeenCalledExactlyOnceWith(sceneCanvas(), expect.objectContaining({
      sceneId: 'vn-halong', motion: false, theme: 'light', time: undefined, speed: 1,
    }))
    expect(createHost.mock.calls[0]![1].visibility).toBe(1)
    expect(backdrop()?.querySelector('[data-slot="scene-scrim"]')).toBeNull()

    rendered.rerender(sceneTree('/p/onni/new', DEFAULT_SCENE_PREFERENCES))
    expect(sceneCanvas()).toBeUndefined()
    expect(dispose).toHaveBeenCalledTimes(1)

    rendered.rerender(sceneTree('/p/onni/new', enabled))
    await waitFor(expectReady)
    rendered.unmount()
    expect(dispose).toHaveBeenCalledTimes(2)
  })

  it('uses the chat profile only on the transcript and releases the host on a disabled surface', async () => {
    const rendered = render(sceneTree('/p/onni/new', enabled))
    await waitFor(expectReady)
    fireEvent.click(rendered.getByRole('link', { name: 'Chat' }))
    expect(backdrop()?.dataset).toMatchObject({ surface: 'chat', mode: 'horizon' })
    expect(createHost).toHaveBeenCalledTimes(1)

    fireEvent.click(rendered.getByRole('link', { name: 'Changes' }))
    expect(sceneCanvas()).toBeUndefined()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps the full /new scene static with a buffer at most 240 pixels wide below md', async () => {
    render(sceneTree('/new', enabled))
    await waitFor(expectReady)
    expect(createHost.mock.calls[0]![1].width).toBeGreaterThan(240)
    act(() => {
      isDesktop = false
      changeViewport()
    })
    expect(backdrop()?.dataset.mode).toBe('full')
    expect(update).toHaveBeenCalled()
    expect(update.mock.lastCall![0].width).toBeLessThanOrEqual(240)
    expect(update.mock.lastCall![0].motion).toBe(false)
    expect(createHost).toHaveBeenCalledTimes(1)
  })

  it('does not create a host if the scene finishes loading after turning it off', async () => {
    let resolveScene: (scene: Awaited<ReturnType<typeof loadScene>>) => void = () => {}
    loadScene.mockImplementationOnce(() => new Promise((resolve) => { resolveScene = resolve }))
    const previousLoads = loadScene.mock.calls.length
    const rendered = render(sceneTree('/new', enabled))
    await waitFor(() => expect(loadScene).toHaveBeenCalledTimes(previousLoads + 1))
    rendered.rerender(sceneTree('/new', DEFAULT_SCENE_PREFERENCES))
    await act(async () => { resolveScene(await loadScene('vn-halong')) })
    expect(createHost).not.toHaveBeenCalled()
    expect(sceneCanvas()).toBeUndefined()
  })

  it('ships D4-compliant scenery integration CSS rules per R6', () => {
    const rawCss = readFileSync(resolve(__dirname, '../styles/index.css'), 'utf8')
    const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toContain('backdrop-filter')
    expect(css).toContain('--scene-panel-alpha: 92%;')
    expect(css).toContain('--scene-panel-alpha: 94%;')
    expect(css).toContain('--radius-2xl: 16px;')
    expect(css).toContain('black 78%')
    expect(css).toContain("[data-slot='new-task-main'] [data-slot='composer']")
    expect(css).toContain("[data-slot='scene-backdrop'][data-surface='chat'][data-ready]:not([data-narrow])")
    expect(css).toContain("[data-slot='tool-streak']")
    expect(css).toContain("[data-slot='execution-details']")
    expect(css).toContain("[data-slot='reasoning']")
    expect(css).toContain("[data-slot='turn-time']")
    expect(css).toContain('height: clamp(140px, 24vh, 180px);')
    expect(css).toContain("[data-slot='scene-backdrop'][data-surface='chat'][data-narrow]")
  })
})
