import type { Palette, Palettes, TimeOfDay } from './types'

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
export const TIME_ANCHORS: Readonly<Record<TimeOfDay, number>> = { dawn: 0.25, day: 0.5, dusk: 0.75, night: 0 }
export function resolveTime(time: TimeOfDay | number | 'auto' | undefined, date = new Date()): TimeOfDay | number | undefined {
  return time === 'auto' ? (date.getHours() * 60 + date.getMinutes()) / 1440 : time
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
  return Uint32Array.from(expandPalette(palette), (color) => packRgba(options.background === undefined ? color : mixColor(options.background, color, options.visibility ?? 1)))
}

export function indexedToRgba(indexed: Uint8Array, lut: Uint32Array, target: Uint32Array = new Uint32Array(indexed.length)): Uint32Array {
  if (target.length !== indexed.length || lut.length !== 32) throw new RangeError('Invalid output or LUT size')
  for (let i = 0; i < indexed.length; i++) target[i] = lut[indexed[i]!] ?? lut[0]!
  return target
}
