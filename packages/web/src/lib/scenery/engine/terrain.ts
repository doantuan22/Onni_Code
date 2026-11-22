import type { NoiseAtlas } from './noise'
import type { RidgeOptions } from './types'

export function ridge(width: number, atlas: NoiseAtlas, options: RidgeOptions = {}): Float32Array {
  const { height = 0.5, amplitude = 0.2, frequency = 2, octaves = 4 } = options
  return Float32Array.from({ length: width }, (_, x) => {
    let value = 0
    let weight = 1
    let total = 0
    for (let o = 0; o < Math.min(8, Math.max(1, octaves)); o++) {
      value += (atlas.sample(x / Math.max(1, width - 1) * frequency * 2 ** o, 37 * o) - 0.5) * 2 * weight
      total += weight
      weight *= 0.5
    }
    return Math.max(0, Math.min(1, height + amplitude * value / total))
  })
}

export function terrace(height: number, steps: number): number {
  const count = Math.max(1, Math.floor(steps))
  return Math.floor(height * count) / count
}

export function karst(x: number, center: number, radius: number, height: number): number {
  if (radius <= 0) return 0
  const distance = Math.abs((x - center) / radius)
  return distance >= 1 ? 0 : height * Math.sqrt(1 - distance ** 4)
}

/** Read the immutable static layer; the +16 bank keeps reflected water cooler/darker. */
export function reflectWater(base: Uint8Array, target: Uint8Array, width: number, height: number, horizon: number, t: number, amplitude = 2): void {
  const start = Math.max(0, Math.min(height, Math.floor(horizon)))
  for (let y = start; y < height; y++) {
    const sourceY = Math.max(0, start - 1 - (y - start))
    const offset = Math.round(Math.sin(y * 0.45 + t) * amplitude)
    let sourceX = offset % width
    if (sourceX < 0) sourceX += width
    const sourceRow = sourceY * width
    const targetRow = y * width
    for (let x = 0; x < width; x++) {
      target[targetRow + x] = (base[sourceRow + sourceX]! & 15) + 16
      if (++sourceX === width) sourceX = 0
    }
  }
}
