import type { Mask } from './types'

export function createMask(width: number, height: number): Mask {
  const coverage = new Uint8Array(width * height)
  const point = (x: number, y: number): number => Math.floor(y) * width + Math.floor(x)
  return {
    width,
    height,
    coverage,
    clear: () => coverage.fill(0),
    set(x, y, amount = 15) {
      x = Math.floor(x); y = Math.floor(y)
      if (x >= 0 && y >= 0 && x < width && y < height) coverage[point(x, y)] = Math.max(0, Math.min(15, Math.floor(amount)))
    },
    rect(x, y, w, h, amount = 15) {
      const left = Math.max(0, Math.floor(x))
      const right = Math.min(width, Math.ceil(x + w))
      for (let row = Math.max(0, Math.floor(y)); row < Math.min(height, Math.ceil(y + h)); row++) {
        coverage.fill(Math.max(0, Math.min(15, Math.floor(amount))), row * width + left, row * width + right)
      }
    },
    contains(x, y) {
      x = Math.floor(x); y = Math.floor(y)
      return x >= 0 && y >= 0 && x < width && y < height && coverage[point(x, y)] !== 0
    },
  }
}
