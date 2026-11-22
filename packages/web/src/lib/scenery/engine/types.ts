export type Rng = () => number
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'
export type SceneTheme = 'light' | 'dark'
export type Palette = readonly number[]
export type Palettes = Readonly<Record<TimeOfDay, Palette>>
export type ThemePalettes = Readonly<Record<SceneTheme, Palettes>>
export type LayerKind = 'sky' | 'far' | 'mid' | 'near' | 'water' | 'fog' | 'fx'

export interface LayerSpec {
  readonly kind: LayerKind
  readonly z?: number
  readonly bounds?: Readonly<{ x: number; y: number; width: number; height: number }>
  readonly overscan?: number
  readonly mask?: Mask
}

/** Coverage is deliberately indexed (0–15), never an RGBA alpha buffer. */
export interface Mask {
  readonly width: number
  readonly height: number
  readonly coverage: Uint8Array
  clear(): void
  set(x: number, y: number, coverage?: number): void
  rect(x: number, y: number, width: number, height: number, coverage?: number): void
  contains(x: number, y: number): boolean
}

export interface SpriteFrame {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly pivot?: Readonly<{ x: number; y: number }>
  readonly duration?: number
}

export interface SpriteSheet {
  readonly sprite: Sprite
  readonly frames: readonly SpriteFrame[]
}

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
  polygon(points: readonly Readonly<{ x: number; y: number }>[], index: number, mask?: Mask): void
  /** Quadratic/cubic control points are baked at one art pixel or less before rasterizing. */
  curve(points: readonly Readonly<{ x: number; y: number }>[], index: number, mask?: Mask): void
  sprite(sprite: Sprite, x: number, y: number, scale?: number): void
  spriteFrame(sheet: SpriteSheet, frame: number, x: number, y: number, scale?: number): void
  mask(): Mask
  /** Declares semantic order and clips drawing to an optional indexed coverage mask. */
  layer(spec: LayerSpec, draw: (ctx: BuildCtx) => void): void
  ridge(options?: RidgeOptions): Float32Array
  fbm1(x: number): number
  fbm2(x: number, y: number): number
  dither(x: number, y: number, amount: number, low: number, high: number, size?: 4 | 8): number
}

export interface FrameCtx extends BuildCtx {
  readonly frame: Uint8Array
  /** Resolved time of day for this frame (additive; see `darkness` in palette.ts). */
  readonly time?: TimeOfDay | number
}

export interface SceneDef {
  readonly id: string
  readonly name: Readonly<{ vi: string; en: string }>
  readonly region: 'vn' | 'world'
  readonly tone: 'dark' | 'light' | 'both'
  readonly palettes: Palettes
  readonly defaultTime: TimeOfDay
  /** V2 optional palette branch; legacy `palettes` remains the fallback. */
  readonly themePalettes?: ThemePalettes
  readonly themeDefaultTime?: Readonly<Partial<Record<SceneTheme, TimeOfDay>>>
  readonly layers?: readonly LayerSpec[]
  readonly cycles?: readonly CycleSpec[]
  readonly horizon: number
  readonly focus: Readonly<{ x: number; y: number }>
  build(ctx: BuildCtx): void
  /** Time and delta are seconds; activity is reserved for v2 and defaults to zero. */
  frame(ctx: FrameCtx, t: number, dt: number, activity: number): void
}

export interface CycleSpec {
  readonly indices: readonly number[]
  readonly rate: number
  readonly phase?: number
}
