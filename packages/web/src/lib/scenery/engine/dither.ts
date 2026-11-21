import { wrap } from './noise'

export const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const
export const BAYER_8 = Array.from({ length: 64 }, (_, i) => {
  const x = i % 8
  const y = Math.floor(i / 8)
  return 4 * BAYER_4[(y % 4) * 4 + x % 4]! + [0, 2, 3, 1][Math.floor(y / 4) * 2 + Math.floor(x / 4)]!
})

export function dither(x: number, y: number, amount: number, low: number, high: number, size: 4 | 8 = 4): number {
  const matrix = size === 4 ? BAYER_4 : BAYER_8
  const threshold = (matrix[wrap(Math.floor(y), size) * size + wrap(Math.floor(x), size)]! + 0.5) / (size * size)
  return amount >= threshold ? high : low
}
