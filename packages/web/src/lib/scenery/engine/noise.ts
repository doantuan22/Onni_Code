import { mulberry32 } from './rng'

export const wrap = (n: number, size: number): number => ((n % size) + size) % size
const smooth = (t: number): number => t * t * (3 - 2 * t)
const mix = (a: number, b: number, t: number): number => a + (b - a) * t

export interface NoiseAtlas {
  readonly size: number
  readonly data: Float32Array
  /** Coordinates wrap at size, including fractional and negative coordinates. */
  sample(x: number, y: number): number
}

/** Periodic value noise, baked once. Animation only samples the finished atlas (§2.2). */
export function createNoiseAtlas(seed: number, size = 256, octaves = 5): NoiseAtlas {
  if (!Number.isInteger(size) || size < 2 || size > 1024 || !Number.isInteger(octaves) || octaves < 1 || octaves > 8) {
    throw new RangeError('Invalid noise atlas dimensions or octaves')
  }
  const rng = mulberry32(seed)
  const data = new Float32Array(size * size)
  let weight = 1
  let total = 0
  for (let octave = 0; octave < octaves; octave++) {
    const cells = 2 ** (octave + 1)
    const lattice = Float32Array.from({ length: cells * cells }, rng)
    for (let y = 0; y < size; y++) {
      const gy = y / size * cells
      const iy = Math.floor(gy)
      const fy = smooth(gy - iy)
      for (let x = 0; x < size; x++) {
        const gx = x / size * cells
        const ix = Math.floor(gx)
        const fx = smooth(gx - ix)
        const a = mix(lattice[iy * cells + ix]!, lattice[iy * cells + (ix + 1) % cells]!, fx)
        const b = mix(lattice[((iy + 1) % cells) * cells + ix]!, lattice[((iy + 1) % cells) * cells + (ix + 1) % cells]!, fx)
        const i = y * size + x
        data[i] = data[i]! + mix(a, b, fy) * weight
      }
    }
    total += weight
    weight *= 0.5
  }
  for (let i = 0; i < data.length; i++) data[i] = data[i]! / total
  return {
    size, data,
    sample(x, y) {
      const wx = wrap(x, size)
      const wy = wrap(y, size)
      const ix = Math.floor(wx)
      const iy = Math.floor(wy)
      return mix(
        mix(data[iy * size + ix]!, data[iy * size + (ix + 1) % size]!, wx - ix),
        mix(data[((iy + 1) % size) * size + ix]!, data[((iy + 1) % size) * size + (ix + 1) % size]!, wx - ix),
        wy - iy,
      )
    },
  }
}
