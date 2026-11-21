import { FrameLoop } from './loop'
import { resolveTime } from './palette'
import { sceneRegistry } from './registry'
import { SceneRenderer } from './renderer'
import { serializableOptions } from './host-types'
import type { HostOptions, WorkerMessage } from './host-types'
import type { SceneDef } from './types'

export interface SceneHost {
  readonly ready: Promise<void>
  readonly mode: 'worker' | 'main' | 'disposed'
  update(options: Partial<HostOptions>): Promise<void>
  dispose(): void
}

export interface HostDependencies {
  createWorker?: () => Worker
  loadScene?: (id: string) => Promise<SceneDef | undefined>
}

/** Browser edge only. The canvas stays on main so a failed worker can always fall back. */
export function createSceneHost(canvas: HTMLCanvasElement, initial: HostOptions, dependencies: HostDependencies = {}): SceneHost {
  let options = { ...initial }
  let disposed = false
  let mode: SceneHost['mode'] = 'main'
  let worker: Worker | undefined
  let loop: FrameLoop | undefined
  let renderer: SceneRenderer | undefined
  let generation = 0
  let initTimer: ReturnType<typeof setTimeout> | undefined
  let fallback: Promise<void> | undefined
  let settleReady: () => void
  const ready = new Promise<void>((resolve) => { settleReady = resolve })
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Scene 2D canvas unavailable')
  const scheduler = {
    now: () => performance.now(),
    schedule: (callback: () => void, delay: number) => setTimeout(callback, delay),
    cancel: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  }
  const effective = (): HostOptions => ({ ...options, hidden: document.hidden || options.hidden, reducedMotion: media?.matches || options.reducedMotion })
  const resize = (): void => { canvas.width = options.width; canvas.height = options.height; context.imageSmoothingEnabled = false }
  const stopWorker = (): void => {
    clearTimeout(initTimer)
    worker?.terminate()
    worker = undefined
  }
  async function main(rebuild = true): Promise<void> {
    const token = ++generation
    if (!rebuild && renderer && loop) {
      renderer.setPalette(resolveTime(options.time), options)
      loop.configure(effective())
      return
    }
    loop?.dispose()
    loop = undefined
    renderer = undefined
    const scene = await (dependencies.loadScene ?? sceneRegistry.load)(options.sceneId)
    if (disposed || token !== generation) return
    if (!scene) throw new Error('Unknown scene')
    let paletteTime = resolveTime(options.time)
    renderer = new SceneRenderer(scene, { ...options, time: paletteTime })
    resize()
    const pixels = context!.createImageData(options.width, options.height)
    const bytes = new Uint8ClampedArray(renderer.rgba.buffer)
    loop = new FrameLoop((t, dt) => {
      if (options.time === 'auto') {
        const time = resolveTime('auto')
        if (time !== paletteTime) { renderer!.setPalette(time, options); paletteTime = time }
      }
      renderer!.render(t, dt)
      pixels.data.set(bytes)
      context!.putImageData(pixels, 0, 0)
    }, scheduler, effective(), (rate) => options.onBrake?.(rate))
    loop.start()
  }
  function useFallback(): Promise<void> {
    if (fallback) return fallback
    stopWorker()
    mode = disposed ? 'disposed' : 'main'
    fallback = (disposed ? Promise.resolve() : main()).catch((error: unknown) => { if (!disposed) options.onError?.(error) }).finally(() => settleReady())
    return fallback
  }
  function signals(): void {
    if (disposed) return
    if (worker) {
      try { worker.postMessage({ type: 'update', options: serializableOptions(effective()) }) }
      catch { void useFallback() }
    } else loop?.configure(effective())
  }
  document.addEventListener('visibilitychange', signals)
  media?.addEventListener('change', signals)
  resize()
  try {
    if (!dependencies.createWorker && (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')) throw new Error('Worker rendering unavailable')
    worker = dependencies.createWorker?.() ?? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    mode = 'worker'
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data
      if (data.type === 'frame') {
        try { if (!disposed && mode === 'worker' && !document.hidden) context!.drawImage(data.bitmap, 0, 0) }
        catch { void useFallback() }
        finally {
          data.bitmap.close()
          try { worker?.postMessage({ type: 'presented' }) } catch { void useFallback() }
        }
      } else if (!disposed && data.type === 'ready') { clearTimeout(initTimer); settleReady() }
      else if (!disposed && data.type === 'brake') options.onBrake?.(data.fps)
      else if (!disposed && data.type === 'error') void useFallback()
    }
    worker.onerror = () => { void useFallback() }
    worker.onmessageerror = () => { void useFallback() }
    initTimer = setTimeout(() => { void useFallback() }, 5000)
    worker.postMessage({ type: 'init', options: serializableOptions(effective()) })
  } catch { void useFallback() }
  return {
    ready,
    get mode() { return disposed ? 'disposed' : mode },
    async update(next) {
      if (disposed) return
      const previous = options
      options = { ...options, ...next }
      const rebuild = ['sceneId', 'width', 'height', 'seed'].some((key) => previous[key as keyof HostOptions] !== options[key as keyof HostOptions])
      if (worker) {
        if (rebuild) resize()
        signals()
      } else {
        try { await main(rebuild) } catch (error) { options.onError?.(error) }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      generation++
      stopWorker()
      loop?.dispose()
      document.removeEventListener('visibilitychange', signals)
      media?.removeEventListener('change', signals)
      settleReady()
    },
  }
}
