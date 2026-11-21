import { FrameLoop } from './loop'
import { sceneRegistry } from './registry'
import { resolveTime } from './palette'
import { SceneRenderer } from './renderer'
import type { HostMessage, WorkerMessage, WorkerOptions } from './host-types'

// A narrow worker port avoids loading lib.webworker alongside the app's DOM library.
interface WorkerPort {
  onmessage: ((event: MessageEvent<HostMessage>) => void) | null
  postMessage(message: WorkerMessage, transfer?: Transferable[]): void
  close(): void
}

export function installSceneWorker(port: WorkerPort): void {
  let loop: FrameLoop | undefined
  let renderer: SceneRenderer | undefined
  let current: WorkerOptions | undefined
  let generation = 0
  let canvas: OffscreenCanvas | undefined
  let context: OffscreenCanvasRenderingContext2D | null = null
  let pixels: ImageData | undefined
  let inFlight = false
  let dirty = false
  function present(): void {
    if (inFlight || !dirty || !canvas) return
    const bitmap = canvas.transferToImageBitmap()
    inFlight = true
    dirty = false
    port.postMessage({ type: 'frame', bitmap }, [bitmap])
  }
  const scheduler = {
    now: () => performance.now(),
    schedule: (callback: () => void, delay: number) => setTimeout(callback, delay),
    cancel: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  }
  async function apply(options: WorkerOptions): Promise<void> {
    const token = ++generation
    const rebuild = !current || options.sceneId !== current.sceneId || options.width !== current.width || options.height !== current.height || options.seed !== current.seed
    if (!rebuild && renderer && loop) {
      renderer.setPalette(resolveTime(options.time), options)
      current = options
      loop.configure({ hidden: false, reducedMotion: false, motion: true, speed: 1, ...options })
      return
    }
    loop?.dispose()
    loop = undefined
    renderer = undefined
    const scene = await sceneRegistry.load(options.sceneId)
    if (token !== generation) return
    if (!scene) throw new Error('Unknown scene')
    let paletteTime = resolveTime(options.time)
    renderer = new SceneRenderer(scene, { ...options, time: paletteTime })
    canvas = new OffscreenCanvas(options.width, options.height)
    context = canvas.getContext('2d')
    if (!context) throw new Error('Offscreen 2D canvas unavailable')
    pixels = context.createImageData(options.width, options.height)
    const bytes = new Uint8ClampedArray(renderer.rgba.buffer)
    current = options
    loop = new FrameLoop((t, dt) => {
      if (current?.time === 'auto') {
        const time = resolveTime('auto')
        if (time !== paletteTime) { renderer!.setPalette(time, current); paletteTime = time }
      }
      renderer!.render(t, dt)
      pixels!.data.set(bytes)
      context!.putImageData(pixels!, 0, 0)
      // At most one bitmap is queued while chat occupies the main thread (§4.3.2).
      dirty = true
      present()
    }, scheduler, options, (fps) => port.postMessage({ type: 'brake', fps }))
    port.postMessage({ type: 'ready' })
    loop.start()
  }
  port.onmessage = (event) => {
    if (event.data.type === 'presented') {
      inFlight = false
      present()
      return
    }
    if (event.data.type === 'dispose') {
      generation++
      loop?.dispose()
      port.close()
      return
    }
    const request = generation + 1
    void apply(event.data.options).catch((error: unknown) => {
      if (request !== generation) return
      loop?.dispose()
      port.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Scene worker failed' })
    })
  }
}
