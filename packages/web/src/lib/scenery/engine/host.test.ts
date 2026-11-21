import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import fixture from './fixture-scene'
import { createSceneHost } from './host'
import type { HostOptions, WorkerMessage } from './host-types'

let media: EventTarget & { matches: boolean; addListener: () => void; removeListener: () => void }
let context: { createImageData: ReturnType<typeof vi.fn>; putImageData: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn>; imageSmoothingEnabled: boolean }
const options: HostOptions = { sceneId: fixture.id, width: 32, height: 18 }

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  media = Object.assign(new EventTarget(), { matches: false, addListener() {}, removeListener() {} })
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  context = {
    createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
    putImageData: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: true,
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.stubGlobal('Worker', undefined)
  vi.stubGlobal('OffscreenCanvas', undefined)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function fakeWorker() {
  return {
    postMessage: vi.fn(), terminate: vi.fn(),
    onmessage: null as ((event: MessageEvent<WorkerMessage>) => void) | null,
    onerror: null as (() => void) | null,
    onmessageerror: null as (() => void) | null,
    send(data: WorkerMessage) { this.onmessage?.({ data } as MessageEvent<WorkerMessage>) },
  }
}

describe('browser scenery host', () => {
  it('falls back without Worker/OffscreenCanvas, pauses on hidden, and disposes timers/listeners', async () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const mediaRemove = vi.spyOn(media, 'removeEventListener')
    const host = createSceneHost(document.createElement('canvas'), options, { loadScene: async () => fixture })
    await host.ready
    expect(host.mode).toBe('main')
    expect(context.putImageData).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    Object.defineProperty(document, 'hidden', { value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(0)
    Object.defineProperty(document, 'hidden', { value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(1)
    media.matches = true
    media.dispatchEvent(new Event('change'))
    expect(vi.getTimerCount()).toBe(0)
    host.dispose()
    host.dispose()
    expect(host.mode).toBe('disposed')
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(mediaRemove).toHaveBeenCalledWith('change', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([{ reducedMotion: true }, { motion: false }])('renders one static fallback frame for %s', async (override) => {
    const host = createSceneHost(document.createElement('canvas'), { ...options, ...override }, { loadScene: async () => fixture })
    await host.ready
    expect(context.putImageData).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    await host.update({ time: 'night' })
    expect(context.putImageData).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    host.dispose()
  })

  it('uses worker rendering, forwards lifecycle updates and closes bitmap resources', async () => {
    const w = fakeWorker()
    const host = createSceneHost(document.createElement('canvas'), options, { createWorker: () => w as unknown as Worker })
    expect(host.mode).toBe('worker')
    expect(w.postMessage).toHaveBeenCalledWith({ type: 'init', options: expect.objectContaining({ sceneId: fixture.id, hidden: undefined }) })
    w.send({ type: 'ready' })
    await host.ready
    expect(vi.getTimerCount()).toBe(0)
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap
    w.send({ type: 'frame', bitmap })
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0)
    expect(bitmap.close).toHaveBeenCalledTimes(1)
    const brake = vi.fn()
    await host.update({ motion: false, onBrake: brake })
    w.send({ type: 'brake', fps: 6 })
    expect(brake).toHaveBeenCalledWith(6)
    expect(w.postMessage).toHaveBeenLastCalledWith({ type: 'update', options: expect.objectContaining({ motion: false }) })
    host.dispose()
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('recovers from asynchronous worker errors without transferring the visible canvas', async () => {
    const w = fakeWorker()
    const host = createSceneHost(document.createElement('canvas'), { ...options, motion: false }, { createWorker: () => w as unknown as Worker, loadScene: async () => fixture })
    w.onerror!()
    await host.ready
    expect(w.terminate).toHaveBeenCalledTimes(1)
    expect(host.mode).toBe('main')
    expect(context.putImageData).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    host.dispose()
  })

  it('bounds a stalled worker handshake and falls back', async () => {
    const w = fakeWorker()
    const host = createSceneHost(document.createElement('canvas'), { ...options, motion: false }, { createWorker: () => w as unknown as Worker, loadScene: async () => fixture })
    await vi.advanceTimersByTimeAsync(5000)
    await host.ready
    expect(host.mode).toBe('main')
    expect(w.terminate).toHaveBeenCalledTimes(1)
    host.dispose()
  })

  it('does not restart after disposal while a lazy scene is loading', async () => {
    let resolve!: (value: typeof fixture) => void
    const pending = new Promise<typeof fixture>((done) => { resolve = done })
    const host = createSceneHost(document.createElement('canvas'), options, { loadScene: () => pending })
    host.dispose()
    resolve(fixture)
    await host.ready
    await Promise.resolve()
    expect(context.putImageData).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports unknown scenes through onError and settles without a timer', async () => {
    const onError = vi.fn()
    const host = createSceneHost(document.createElement('canvas'), { ...options, onError }, { loadScene: async () => undefined })
    await host.ready
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unknown scene' }))
    expect(vi.getTimerCount()).toBe(0)
    host.dispose()
  })

  it('keeps the latest palette update when a replacement scene is still importing', async () => {
    const loadScene = vi.fn().mockResolvedValueOnce(fixture)
    let resolve!: (scene: typeof fixture) => void
    const pending = new Promise<typeof fixture>((done) => { resolve = done })
    const host = createSceneHost(document.createElement('canvas'), { ...options, motion: false }, { loadScene })
    await host.ready
    loadScene.mockReturnValue(pending)
    const sceneUpdate = host.update({ sceneId: 'replacement' })
    const paletteUpdate = host.update({ time: 'night' })
    resolve({ ...fixture, id: 'replacement' })
    await Promise.all([sceneUpdate, paletteUpdate])
    expect(context.putImageData).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    host.dispose()
  })
})
