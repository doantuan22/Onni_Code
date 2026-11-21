import { channels, clamp01, expandPalette } from './palette'
import type { Palette } from './types'

const linear = (channel: number): number => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const rgbLuminance = (rgb: readonly number[]): number => 0.2126 * linear(rgb[0]!) + 0.7152 * linear(rgb[1]!) + 0.0722 * linear(rgb[2]!)
export const luminance = (color: number): number => rgbLuminance(channels(color))
export function contrastRatio(a: number, b: number): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** §4.3.1: eff = bg + (1-A)*s*(pixel-bg), composited in sRGB channels.
 * Channel envelopes bound every palette color (and every interpolated palette) conservatively. */
export function contrastCeiling(palette: Palette, background: number, foregrounds: readonly number[], visibility = 1): {
  minScrim: number
  maxVisibility: number
  possible: boolean
} {
  if (!foregrounds.length) throw new RangeError('A foreground color is required')
  const bg = channels(background)
  const colors = expandPalette(palette).map(channels)
  const low = bg.map((c, i) => Math.min(c, ...colors.map((rgb) => rgb[i]!)))
  const high = bg.map((c, i) => Math.max(c, ...colors.map((rgb) => rgb[i]!)))
  const baseL = luminance(background)
  const inks = foregrounds.map(luminance)
  const safe = (amount: number): boolean => {
    // Include byte rounding as well as continuous CSS compositing at the AA boundary.
    const minL = rgbLuminance(bg.map((c, i) => {
      const value = c + (low[i]! - c) * amount
      return Math.min(value, Math.round(value))
    }))
    const maxL = rgbLuminance(bg.map((c, i) => {
      const value = c + (high[i]! - c) * amount
      return Math.max(value, Math.round(value))
    }))
    return inks.every((ink) => ink > baseL
      ? (ink + 0.05) / (maxL + 0.05) >= 4.5
      : (minL + 0.05) / (ink + 0.05) >= 4.5)
  }
  const possible = safe(0)
  let lo = 0
  let hi = 1
  if (possible && safe(1)) lo = 1
  else if (possible) {
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2
      if (safe(mid)) lo = mid
      else hi = mid
    }
  }
  const s = clamp01(visibility)
  return { possible, maxVisibility: lo, minScrim: s === 0 ? 0 : clamp01(1 - lo / s) }
}
