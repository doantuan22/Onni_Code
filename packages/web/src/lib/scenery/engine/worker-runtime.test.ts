import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import fixture from './fixture-scene'
import type { HostMessage } from './host-types'
import { sceneRegistry } from './registry'
import { installSceneWorker } from './worker-runtime'

const options = { sceneId: fixture.id, width: 32, height: 18 }
let context: { createImageData: ReturnType<typeof vi.fn>; putImageData: ReturnType<typeof vi.fn> }
let bitmap: { close: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(sceneRegistry, 'load').mockResolvedValue(fixture)
  bitmap = { close: vi.fn() }
  context = { createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })), putImageData: vi.fn() }
  vi.stubGlobal('OffscreenCanvas', class {
    getContext() { return context }
    transferToImageBitmap() { return bitmap }
  })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function setup() {
  const port = { onmessage: null as ((event: MessageEvent<HostMessage>) => void) | null, postMessage: vi.fn(), close: vi.fn() }
  installSceneWorker(port)
  return {
    port,
    async send(data: HostMessage) {
      port.onmessage!({ data } as MessageEvent<HostMessage>)
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

describe('OffscreenCanvas worker runtime', () => {
  it('renders and transfers offscreen bitmaps, then closes its loop', async () => {
    const { port, send } = setup()
    await send({ type: 'init', options })
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'ready' })
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'frame', bitmap }, [bitmap])
    expect(vi.getTimerCount()).toBe(1)
    await send({ type: 'dispose' })
    expect(port.close).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not animate reduced-motion, hidden or explicitly motionless scenes', async () => {
    const { send } = setup()
    await send({ type: 'init', options: { ...options, reducedMotion: true } })
    expect(context.putImageData).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    await send({ type: 'update', options: { ...options, hidden: true } })
    expect(context.putImageData).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    await send({ type: 'update', options: { ...options, motion: false, time: 'night' } })
    expect(context.putImageData).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    await send({ type: 'dispose' })
  })

  it('signals offscreen capability failures to the fallback host', async () => {
    vi.stubGlobal('OffscreenCanvas', class { getContext() { return null } })
    const { port, send } = setup()
    await send({ type: 'init', options })
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'error', message: 'Offscreen 2D canvas unavailable' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds in-flight bitmap memory while the main thread is busy', async () => {
    const { port, send } = setup()
    await send({ type: 'init', options })
    await vi.advanceTimersByTimeAsync(1000)
    const frames = () => port.postMessage.mock.calls.filter(([m]) => m.type === 'frame')
    expect(context.putImageData.mock.calls.length).toBeGreaterThan(10)
    expect(frames()).toHaveLength(1)
    await send({ type: 'presented' })
    expect(frames()).toHaveLength(2)
    await send({ type: 'dispose' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not revive a terminated worker after a delayed scene import', async () => {
    let resolve!: (value: typeof fixture) => void
    vi.mocked(sceneRegistry.load).mockReturnValue(new Promise((done) => { resolve = done }))
    const { port, send } = setup()
    await send({ type: 'init', options })
    await send({ type: 'dispose' })
    resolve(fixture)
    await Promise.resolve()
    expect(port.postMessage).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
