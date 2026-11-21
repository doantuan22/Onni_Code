import { describe, expect, it } from 'vitest'
import { contrastCeiling, luminance } from '../../engine/contrast'
import { channels, expandPalette, interpolatePalette } from '../../engine/palette'
import { SceneRenderer } from '../../engine/renderer'
import matterhorn from './matterhorn'
import sahara from './sahara'

for (const scene of [matterhorn, sahara]) {
  describe(scene.id, () => {
    it('keeps all interpolated palettes and reflection banks inside the AA contrast ceiling', () => {
      for (const palette of Object.values(scene.palettes)) expect(palette.length).toBeLessThanOrEqual(16)
      for (const [bg, inks] of [[0x090909, [0xededed, 0xa1a1a1]], [0xfafafa, [0x171717, 0x5c5c5c]]] as const) {
        for (let step = 0; step < 96; step++) {
          const palette = interpolatePalette(scene.palettes, step / 96)
          const { minScrim, possible } = contrastCeiling(palette, bg, inks, 1)
          expect(possible).toBe(true)
          for (const pixel of expandPalette(palette)) {
            const background = channels(bg)
            const rgb = channels(pixel).map((c, i) => background[i]! + (1 - minScrim) * (c - background[i]!))
            const linear = (c: number) => c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4
            const effective = 0.2126 * linear(rgb[0]!) + 0.7152 * linear(rgb[1]!) + 0.0722 * linear(rgb[2]!)
            for (const ink of inks) {
              const l = luminance(ink)
              expect((Math.max(l, effective) + 0.05) / (Math.min(l, effective) + 0.05)).toBeGreaterThanOrEqual(4.5 - 1e-10)
            }
          }
        }
      }
    })
    it('renders repeatable static and animated frames at landscape and portrait sizes without mutating the base', () => {
      for (const [width, height] of [[320, 180], [480, 270], [240, 300]]) {
        const renderer = new SceneRenderer(scene, { width: width!, height: height!, seed: 42 })
        const base = renderer.base.slice()
        const first = renderer.render(0).slice()
        expect(renderer.render(16)).not.toEqual(first)
        expect(renderer.base).toEqual(base)
        expect(renderer.render(0)).toEqual(first)
        expect(new SceneRenderer(scene, { width: width!, height: height!, seed: 42 }).render(0)).toEqual(first)
        expect(renderer.indexed.every((index) => index < 32)).toBe(true)
      }
    })
  })
}
