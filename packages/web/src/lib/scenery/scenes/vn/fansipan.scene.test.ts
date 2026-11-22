import { describe, expect, it } from 'vitest'

import { SceneRenderer } from '../../engine/renderer'
import scene from './fansipan'

const maxIndex = (buf: Uint8Array): number => {
  let max = 0
  for (let i = 0; i < buf.length; i++) if (buf[i]! > max) max = buf[i]!
  return max
}

describe('vn-fansipan scene', () => {
  it('defines distinct 32-color light and dark palettes across all times of day', () => {
    expect(scene.themePalettes).toBeDefined()
    for (const theme of ['light', 'dark'] as const) {
      for (const colors of Object.values(scene.themePalettes![theme])) {
        expect(colors).toHaveLength(32)
      }
    }
    expect(scene.themePalettes!.light.day).not.toEqual(scene.themePalettes!.dark.day)
    expect(scene.themePalettes!.light.dawn).not.toEqual(scene.themePalettes!.dark.night)
  })

  it('renders cleanly across sizes with dark/light motion and valid palette indices', () => {
    for (const [width, height] of [[320, 180], [480, 270], [240, 300]] as const) {
      const darkRenderer = new SceneRenderer(scene, { width, height, seed: 42, theme: 'dark', time: 'night' })
      const lightRenderer = new SceneRenderer(scene, { width, height, seed: 42, theme: 'light', time: 'dawn' })

      const darkT0 = darkRenderer.render(0, 1 / 12).slice()
      const darkT2 = darkRenderer.render(2, 1 / 12).slice()
      expect(darkT2).not.toEqual(darkT0)
      expect(maxIndex(darkRenderer.base)).toBeLessThan(32)
      expect(maxIndex(darkRenderer.indexed)).toBeLessThan(32)

      const lightT0 = lightRenderer.render(0, 1 / 12).slice()
      const lightT2 = lightRenderer.render(2, 1 / 12).slice()
      expect(lightT2).not.toEqual(lightT0)
      expect(lightT0).not.toEqual(darkT0)
      expect(maxIndex(lightRenderer.indexed)).toBeLessThan(32)
    }
  })
})
