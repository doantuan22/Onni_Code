import type { CycleSpec, Palette, Palettes, SceneTheme, ThemePalettes, TimeOfDay } from './types'

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
export const TIME_ANCHORS: Readonly<Record<TimeOfDay, number>> = { dawn: 0.25, day: 0.5, dusk: 0.75, night: 0 }
export function resolveTime(time: TimeOfDay | number | 'auto' | undefined, date = new Date()): TimeOfDay | number | undefined {
  return time === 'auto' ? (date.getHours() * 60 + date.getMinutes()) / 1440 : time
}
/** 0 = full day, 1 = deep night; numeric time is a day fraction (0 = midnight). */
export function darkness(time: TimeOfDay | number | undefined): number {
  if (time === undefined) return 0
  if (typeof time === 'string') return { night: 1, dusk: 0.7, dawn: 0.35, day: 0 }[time]
  const t = ((time % 1) + 1) % 1
  return clamp01(0.5 + 0.5 * Math.cos(t * Math.PI * 2))
}
const shifts = [16, 8, 0] as const
export const channels = (color: number): number[] => shifts.map((shift) => (color >>> shift) & 255)

export function mixColor(a: number, b: number, amount: number): number {
  const t = clamp01(amount)
  return shifts.reduce<number>((result, shift) => result | (Math.round(((a >>> shift) & 255) * (1 - t) + ((b >>> shift) & 255) * t) << shift), 0)
}

export function validatePalette(palette: Palette): void {
  if (palette.length < 1 || palette.length > 32 || palette.some((color) => !Number.isInteger(color) || color < 0 || color > 0xffffff)) {
    throw new RangeError('Palettes require 1–32 numeric RGB colors')
  }
}

export function interpolatePalette(palettes: Palettes, time: TimeOfDay | number): number[] {
  const order = ['night', 'dawn', 'day', 'dusk'] as const
  const tod = typeof time === 'number' ? ((time % 1) + 1) % 1 : TIME_ANCHORS[time]
  const pos = tod * 4
  const a = palettes[order[Math.floor(pos)]!]
  const b = palettes[order[(Math.floor(pos) + 1) % 4]!]
  return a.map((color, i) => mixColor(color, b[i]!, pos % 1))
}

export function paletteForTheme(legacy: Palettes, themed: ThemePalettes | undefined, theme: SceneTheme | undefined): Palettes {
  return theme && themed?.[theme] ? themed[theme] : legacy
}

/** Rotates only owned index groups; no scene geometry or unrelated palette slots are touched. */
export function cyclePalette(palette: Palette, cycles: readonly CycleSpec[] | undefined, time: number, target = Array.from(palette)): number[] {
  if (!cycles?.length) return target
  for (let i = 0; i < palette.length; i++) target[i] = palette[i]!
  for (const cycle of cycles) {
    const indices = cycle.indices
    if (!indices.length || indices.some((index) => !Number.isInteger(index) || index < 0 || index >= palette.length)) throw new RangeError('Cycle indices must belong to the palette')
    const offset = Math.floor(time * cycle.rate + (cycle.phase ?? 0))
    for (let i = 0; i < indices.length; i++) target[indices[i]!] = palette[indices[(i - offset % indices.length + indices.length) % indices.length]!]!
  }
  return target
}

const littleEndian = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4
export function packRgba(color: number): number {
  const r = (color >>> 16) & 255
  const g = (color >>> 8) & 255
  const b = color & 255
  return (littleEndian ? (255 << 24) | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | 255) >>> 0
}

export interface ToneMap {
  background?: number
  visibility?: number
}

export function expandPalette(palette: Palette): number[] {
  validatePalette(palette)
  return Array.from({ length: 32 }, (_, i) => {
    const normal = palette[i % Math.min(16, palette.length)]!
    return palette[i] ?? (i >= 16 ? mixColor(normal, 0x14243b, 0.35) : normal)
  })
}

export function createLut(palette: Palette, options: ToneMap = {}): Uint32Array {
  return writeLut(palette, options)
}

/** Writes a reusable 32-entry LUT; render loops must not allocate a LUT for cycling. */
export function writeLut(palette: Palette, options: ToneMap = {}, target: Uint32Array = new Uint32Array(32)): Uint32Array {
  if (target.length !== 32) throw new RangeError('LUTs require exactly 32 entries')
  validatePalette(palette)
  for (let index = 0; index < 32; index++) {
    const normal = palette[index % Math.min(16, palette.length)]!
    const expanded = palette[index] ?? (index >= 16 ? mixColor(normal, 0x14243b, 0.35) : normal)
    const color = options.background === undefined ? expanded : mixColor(options.background, expanded, options.visibility ?? 1)
    target[index] = packRgba(color)
  }
  return target
}

export function indexedToRgba(indexed: Uint8Array, lut: Uint32Array, target: Uint32Array = new Uint32Array(indexed.length)): Uint32Array {
  if (target.length !== indexed.length || lut.length !== 32) throw new RangeError('Invalid output or LUT size')
  for (let i = 0; i < indexed.length; i++) target[i] = lut[indexed[i]!] ?? lut[0]!
  return target
}
