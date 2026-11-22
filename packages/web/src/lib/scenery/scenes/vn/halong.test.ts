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
  })

  it.each([[320, 180], [240, 300]] as const)('renders the still and animated junk at %ix%i', (width, height) => {
    const renderer = new SceneRenderer(scene, { width, height, seed: 42, theme: 'dark', time: 'dusk' })
    const still = renderer.render().slice()
    const animated = renderer.render(2.5, 1 / 12).slice()
    expect(new Set(still).size).toBeGreaterThan(8)
    expect(animated).not.toEqual(still)
  })
})
