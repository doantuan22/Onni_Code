import type { Sprite, SpriteFrame, SpriteSheet } from './types'

export function parseSprite(rows: readonly string[] | string, legend: Readonly<Record<string, number>>): Sprite {
  const lines = typeof rows === 'string' ? rows.replace(/^\n|\n$/g, '').split('\n') : rows
  const width = lines[0]?.length ?? 0
  if (!width || lines.some((line) => line.length !== width)) throw new Error('Sprite rows must have the same nonzero width')
  const pixels = new Int8Array(width * lines.length).fill(-1)
  for (let y = 0; y < lines.length; y++) {
    for (let x = 0; x < width; x++) {
      const char = lines[y]![x]!
      if (char === '.' || char === ' ') continue
      const index = legend[char]
      if (!Number.isInteger(index) || index! < 0 || index! > 31) throw new Error(`Unknown sprite symbol: ${char}`)
      pixels[y * width + x] = index!
    }
  }
  return { width, height: lines.length, pixels }
}

export function createSpriteSheet(sprite: Sprite, frames: readonly SpriteFrame[]): SpriteSheet {
  if (!frames.length || frames.some((frame) => frame.x < 0 || frame.y < 0 || frame.width < 1 || frame.height < 1 || frame.x + frame.width > sprite.width || frame.y + frame.height > sprite.height)) {
    throw new RangeError('Sprite-sheet frames must stay inside the source sprite')
  }
  return { sprite, frames }
}
