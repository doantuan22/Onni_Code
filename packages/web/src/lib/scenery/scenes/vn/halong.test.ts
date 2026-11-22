import { describe, expect, it } from 'vitest'

import { SceneRenderer } from '../../engine/renderer'
import type { SceneTheme, TimeOfDay } from '../../engine/types'
import scene from './halong'

describe('vn-halong V2 scene', () => {
  it('ships independent 32-role palettes for every theme and time', () => {
    for (const theme of ['light', 'dark'] as SceneTheme[]) {
      for (const time of ['dawn', 'day', 'dusk', 'night'] as TimeOfDay[]) {
        expect(scene.themePalettes?.[theme][time]).toHaveLength(32)
      }
    }
    expect(scene.themeDefaultTime).toEqual({ light: 'dawn', dark: 'dusk' })
    expect(scene.themePalettes?.dark.dusk).not.toEqual(scene.themePalettes?.light.dusk)
    expect(scene.themePalettes?.dark.dawn).not.toEqual(scene.themePalettes?.light.dawn)
  })

  it('keeps sky bands clean without full-sky checkerboard dithering', () => {
    const renderer = new SceneRenderer(scene, { width: 480, height: 270, seed: 42, theme: 'light', time: 'dawn' })
    renderer.render(0, 0, 0)
    // Open sky row inside SkyTop (y = 12) should be uniform across the width (no Bayer stipple)
    const row = renderer.indexed.slice(12 * 480, 12 * 480 + 480)
    expect(new Set(row).size).toBe(1)
  })

  it('occludes dynamic mist and clouds behind foreground and midground karsts', () => {
    const renderer = new SceneRenderer(scene, { width: 480, height: 270, seed: 42, theme: 'light', time: 'dawn' })
    renderer.render(0, 0, 0)
    const baseLeftCliff = renderer.base[162 * 480 + 25]
    // Advance across multiple cloud/mist/bird ticks: near-left cliff pixels stay intact
    for (const t of [0.5, 2.5, 5.5, 11.0]) {
      renderer.render(t, 1 / 12, 0)
      expect(renderer.indexed[162 * 480 + 25]).toBe(baseLeftCliff)
    }
  })

  it.each([[320, 180], [480, 270], [240, 300]] as const)('renders the still and animated 42x32 junk at %ix%i', (width, height) => {
    const renderer = new SceneRenderer(scene, { width, height, seed: 42, theme: 'dark', time: 'dusk' })
    const still = renderer.render().slice()
    const animated = renderer.render(2.5, 1 / 12).slice()
    expect(new Set(still).size).toBeGreaterThan(12)
    expect(animated).not.toEqual(still)
  })
})
