import { createContext } from './context'
import { createNoiseAtlas } from './noise'
import { createLut, indexedToRgba, interpolatePalette, validatePalette } from './palette'
import type { ToneMap } from './palette'
import type { FrameCtx, SceneDef, TimeOfDay } from './types'

export interface RenderOptions extends ToneMap {
  width: number
  height: number
  seed?: number
  time?: TimeOfDay | number
}

/** Pure TS renderer: stable buffers, no browser globals, no per-frame allocations. */
export class SceneRenderer {
  readonly base: Uint8Array
  readonly indexed: Uint8Array
  readonly rgba: Uint32Array
  private readonly ctx: FrameCtx
  private lut: Uint32Array
  private tone: ToneMap
  private time: TimeOfDay | number

  constructor(readonly scene: SceneDef, readonly options: RenderOptions) {
    const { width, height, seed = 1 } = options
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 480 || height > 480 || width * height > 480 * 270) {
      throw new RangeError('Scene buffer exceeds art resolution budget')
    }
    const palettes = Object.values(scene.palettes)
    for (const palette of palettes) validatePalette(palette)
    if (palettes.some((p) => p.length !== palettes[0]!.length)) throw new RangeError('Palette keyframes must have equal lengths')
    this.base = new Uint8Array(width * height)
    this.indexed = new Uint8Array(width * height)
    this.rgba = new Uint32Array(width * height)
    const noise = createNoiseAtlas(seed)
    scene.build(createContext(width, height, seed, this.base, this.base, noise))
    this.ctx = createContext(width, height, seed, this.base, this.indexed, noise)
    this.time = options.time ?? scene.defaultTime
    this.tone = options
    this.lut = createLut(interpolatePalette(scene.palettes, this.time), this.tone)
  }

  setPalette(time: TimeOfDay | number = this.time, tone: ToneMap = this.tone): void {
    this.time = time
    this.tone = tone
    this.lut = createLut(interpolatePalette(this.scene.palettes, time), tone)
  }

  render(t = 0, dt = 0, activity = 0): Uint32Array {
    this.indexed.set(this.base)
    this.scene.frame(this.ctx, t, dt, activity)
    return indexedToRgba(this.indexed, this.lut, this.rgba)
  }
}

export function bufferSize(width: number, height: number, narrow = width < 768): { width: number; height: number } {
  const px = Math.max(3, Math.min(6, Math.round(height / 180)))
  const w = Math.max(1, Math.ceil(width / px))
  const h = Math.max(1, Math.ceil(height / px))
  const scale = Math.min(1, (narrow ? 240 : 480) / w, (narrow ? 480 : 270) / h, Math.sqrt(480 * 270 / (w * h)))
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) }
}
