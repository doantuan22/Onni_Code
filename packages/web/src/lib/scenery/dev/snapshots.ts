import { SceneRenderer } from '../engine/renderer'
import type { RenderOptions } from '../engine/renderer'
import type { SceneDef, SceneTheme, TimeOfDay } from '../engine/types'

export const snapshotTimes = ['dawn', 'day', 'dusk', 'night'] as const satisfies readonly TimeOfDay[]
export const snapshotThemes = ['light', 'dark'] as const satisfies readonly SceneTheme[]
export const snapshotSizes = [[320, 180], [480, 270], [240, 300]] as const
export const snapshotSeed = 42
export const staticSnapshotSize = [480, 270] as const
export const thumbnailSnapshotSize = [320, 180] as const

const backgrounds: Readonly<Record<SceneTheme, number>> = { light: 0xfafafa, dark: 0x090909 }
const gap = 8

export interface SnapshotFrame {
  readonly width: number
  readonly height: number
  readonly rgba: Uint8Array
}

export interface SnapshotMetadata {
  readonly scene: string
  readonly seed: number
  readonly theme: SceneTheme
  readonly time: TimeOfDay
  readonly width: number
  readonly height: number
  readonly visibility: number
  readonly backend: 'SceneRenderer'
  readonly frameSeconds: number
}

function firstFrame(scene: SceneDef, options: RenderOptions): Uint8Array {
  const rgba = new SceneRenderer(scene, { ...options, seed: snapshotSeed }).render(0, 0, 0)
  // The engine packs RGBA in memory order on either endianness.
  return new Uint8Array(rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + rgba.byteLength))
}

/** The untinted engine frame used to review palette and geometry directly. */
export function rawFrame(scene: SceneDef, theme: SceneTheme, time: TimeOfDay, width: number, height: number): SnapshotFrame {
  return { width, height, rgba: firstFrame(scene, { width, height, theme, time }) }
}

/** The stable frame used by popover thumbnails and visual-review metadata. */
export function staticFrame(scene: SceneDef, theme: SceneTheme): SnapshotFrame {
  const [width, height] = staticSnapshotSize
  const time = scene.themeDefaultTime?.[theme] ?? scene.defaultTime
  return rawFrame(scene, theme, time, width, height)
}

export function thumbnailFrame(scene: SceneDef, theme: SceneTheme): SnapshotFrame {
  const [width, height] = thumbnailSnapshotSize
  const time = scene.themeDefaultTime?.[theme] ?? scene.defaultTime
  return rawFrame(scene, theme, time, width, height)
}

export function snapshotMetadata(scene: SceneDef, theme: SceneTheme): SnapshotMetadata {
  const [width, height] = staticSnapshotSize
  return {
    scene: scene.id,
    seed: snapshotSeed,
    theme,
    time: scene.themeDefaultTime?.[theme] ?? scene.defaultTime,
    width,
    height,
    visibility: 1,
    backend: 'SceneRenderer',
    frameSeconds: 0,
  }
}

export function goldenHashes(scene: SceneDef): Record<TimeOfDay, string> {
  function hashAt(time: TimeOfDay): string {
    const [width, height] = snapshotSizes[0]
    let hash = 0x811c9dc5
    for (const byte of firstFrame(scene, { width, height, time })) {
      hash = Math.imul(hash ^ byte, 0x01000193)
    }
    return (hash >>> 0).toString(16).padStart(8, '0')
  }
  return { dawn: hashAt('dawn'), day: hashAt('day'), dusk: hashAt('dusk'), night: hashAt('night') }
}

/** One themed sheet: four times of day across three native art-buffer sizes. */
export function contactSheet(scene: SceneDef, theme: SceneTheme): SnapshotFrame {
  const columnWidth = Math.max(...snapshotSizes.map(([width]) => width))
  const width = snapshotTimes.length * (columnWidth + gap) + gap
  const height = snapshotSizes.reduce((total, [, h]) => total + h + gap, gap)
  const rgba = new Uint8Array(width * height * 4)

  let top = gap
  for (const [tileWidth, tileHeight] of snapshotSizes) {
    for (const [column, time] of snapshotTimes.entries()) {
      const left = gap + column * (columnWidth + gap) + (columnWidth - tileWidth) / 2
      const tile = firstFrame(scene, { width: tileWidth, height: tileHeight, theme, time, background: backgrounds[theme], visibility: 0.9 })
      const rowBytes = tileWidth * 4
      for (let row = 0; row < tileHeight; row++) {
        rgba.set(tile.subarray(row * rowBytes, (row + 1) * rowBytes), ((top + row) * width + left) * 4)
      }
    }
    top += tileHeight + gap
  }
  return { width, height, rgba }
}
