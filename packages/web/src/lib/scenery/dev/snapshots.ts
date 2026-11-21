import { SceneRenderer } from '../engine/renderer'
import type { RenderOptions } from '../engine/renderer'
import type { SceneDef, TimeOfDay } from '../engine/types'

const times = ['dawn', 'day', 'dusk', 'night'] as const satisfies readonly TimeOfDay[]
const sizes = [[320, 180], [480, 270], [240, 300]] as const
const backgrounds = [0xfafafa, 0x090909] as const
const gap = 8
const seed = 42

function firstFrame(scene: SceneDef, options: RenderOptions): Uint8Array {
  const rgba = new SceneRenderer(scene, { ...options, seed }).render(0, 0, 0)
  // The engine packs RGBA in memory order on either endianness.
  return new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength)
}

export function goldenHashes(scene: SceneDef): Record<TimeOfDay, string> {
  function hashAt(time: TimeOfDay): string {
    const [width, height] = sizes[0]
    let hash = 0x811c9dc5
    for (const byte of firstFrame(scene, { width, height, time })) {
      hash = Math.imul(hash ^ byte, 0x01000193)
    }
    return (hash >>> 0).toString(16).padStart(8, '0')
  }
  return { dawn: hashAt('dawn'), day: hashAt('day'), dusk: hashAt('dusk'), night: hashAt('night') }
}

export function contactSheet(scene: SceneDef): { width: number; height: number; rgba: Uint8Array } {
  const columnWidth = Math.max(...sizes.map(([width]) => width))
  const width = times.length * (columnWidth + gap) + gap
  const height = sizes.reduce((total, [, h]) => total + backgrounds.length * (h + gap), gap)
  const rgba = new Uint8Array(width * height * 4)

  let top = gap
  for (const [tileWidth, tileHeight] of sizes) {
    for (const background of backgrounds) {
      for (const [column, time] of times.entries()) {
        const left = gap + column * (columnWidth + gap) + (columnWidth - tileWidth) / 2
        const tile = firstFrame(scene, { width: tileWidth, height: tileHeight, time, background, visibility: 0.7 })
        const rowBytes = tileWidth * 4
        for (let row = 0; row < tileHeight; row++) {
          rgba.set(tile.subarray(row * rowBytes, (row + 1) * rowBytes), ((top + row) * width + left) * 4)
        }
      }
      top += tileHeight + gap
    }
  }
  return { width, height, rgba }
}
