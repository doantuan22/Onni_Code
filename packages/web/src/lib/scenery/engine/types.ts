export type Rng = () => number
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'
export type Palette = readonly number[]
export type Palettes = Readonly<Record<TimeOfDay, Palette>>

export interface Sprite {
  readonly width: number
  readonly height: number
  /** -1 is transparent; all other entries are palette indices. */
  readonly pixels: Int8Array
}

export interface RidgeOptions {
  height?: number
  amplitude?: number
  frequency?: number
  octaves?: number
}

/** Drawing coordinates are art pixels; divide by width/height for normalized u/v. */
export interface BuildCtx {
  readonly width: number
  readonly height: number
  readonly aspect: number
  readonly seed: number
  readonly base: Uint8Array
  readonly buffer: Uint8Array
  readonly rng: Rng
  px(x: number, y: number, index: number): void
  rect(x: number, y: number, width: number, height: number, index: number): void
  disc(x: number, y: number, radius: number, index: number): void
  line(x0: number, y0: number, x1: number, y1: number, index: number): void
  sprite(sprite: Sprite, x: number, y: number, scale?: number): void
  ridge(options?: RidgeOptions): Float32Array
  fbm1(x: number): number
  fbm2(x: number, y: number): number
  dither(x: number, y: number, amount: number, low: number, high: number, size?: 4 | 8): number
}

export interface FrameCtx extends BuildCtx {
  readonly frame: Uint8Array
}

export interface SceneDef {
  readonly id: string
  readonly name: Readonly<{ vi: string; en: string }>
  readonly region: 'vn' | 'world'
  readonly tone: 'dark' | 'light' | 'both'
  readonly palettes: Palettes
  readonly defaultTime: TimeOfDay
  readonly horizon: number
  readonly focus: Readonly<{ x: number; y: number }>
  build(ctx: BuildCtx): void
  /** Time and delta are seconds; activity is reserved for v2 and defaults to zero. */
  frame(ctx: FrameCtx, t: number, dt: number, activity: number): void
}
