import { dither } from './dither'
import type { NoiseAtlas } from './noise'
import { mulberry32 } from './rng'
import { ridge } from './terrain'
import type { FrameCtx } from './types'

export function createContext(width: number, height: number, seed: number, base: Uint8Array, buffer: Uint8Array, noise: NoiseAtlas): FrameCtx {
  const px = (x: number, y: number, index: number): void => {
    x = Math.floor(x)
    y = Math.floor(y)
    if (x >= 0 && y >= 0 && x < width && y < height) buffer[y * width + x] = index & 31
  }
  const rect = (x: number, y: number, w: number, h: number, index: number): void => {
    const left = Math.max(0, Math.floor(x))
    const right = Math.min(width, Math.ceil(x + w))
    if (right <= left) return
    for (let row = Math.max(0, Math.floor(y)); row < Math.min(height, Math.ceil(y + h)); row++) {
      buffer.fill(index & 31, row * width + left, row * width + right)
    }
  }
  return {
    width, height, aspect: width / height, seed, base, buffer, frame: buffer,
    rng: mulberry32(seed), px, rect, dither,
    ridge: (options) => ridge(width, noise, options),
    fbm1: (x) => noise.sample(x, 0),
    fbm2: (x, y) => noise.sample(x, y),
    disc(x, y, radius, index) {
      for (let row = Math.max(0, Math.ceil(y - radius)); row <= Math.min(height - 1, Math.floor(y + radius)); row++) {
        const half = Math.sqrt(Math.max(0, radius * radius - (row - y) ** 2))
        rect(Math.ceil(x - half), row, Math.floor(x + half) - Math.ceil(x - half) + 1, 1, index)
      }
    },
    line(x0, y0, x1, y1, index) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
      const dx = Math.abs(x1 - x0)
      const dy = -Math.abs(y1 - y0)
      const sx = x0 < x1 ? 1 : -1
      const sy = y0 < y1 ? 1 : -1
      let error = dx + dy
      for (;;) {
        px(x0, y0, index)
        if (x0 === x1 && y0 === y1) break
        const twice = error * 2
        if (twice >= dy) { error += dy; x0 += sx }
        if (twice <= dx) { error += dx; y0 += sy }
      }
    },
    sprite(sprite, x, y, scale = 1) {
      const s = Math.max(1, Math.floor(scale))
      for (let sy = 0; sy < sprite.height; sy++) {
        for (let sx = 0; sx < sprite.width; sx++) {
          const index = sprite.pixels[sy * sprite.width + sx]!
          if (index >= 0) rect(x + sx * s, y + sy * s, s, s, index)
        }
      }
    },
  }
}
