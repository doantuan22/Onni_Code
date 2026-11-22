import { describe, expect, it } from 'vitest'
import { compositeContrast } from '../../engine/contrast'
import { interpolatePalette } from '../../engine/palette'
import { SceneRenderer } from '../../engine/renderer'
import matterhorn from './matterhorn'
import sahara from './sahara'

const themes = ['light', 'dark'] as const
const times = ['dawn', 'day', 'dusk', 'night'] as const

for (const scene of [matterhorn, sahara]) {
  describe(scene.id, () => {
    it('declares 32-role palettes for both themes and valid non-overlapping cycles', () => {
      for (const palette of Object.values(scene.palettes)) {
        expect(palette.length).toBe(32)
      }
      expect(scene.themePalettes).toBeDefined()
      expect(scene.themeDefaultTime).toBeDefined()
      for (const theme of themes) {
        for (const time of times) {
          const palette = scene.themePalettes![theme][time]
          expect(palette.length).toBe(32)
          expect(palette.every((c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff)).toBe(true)
        }
      }
      const seen = new Set<number>()
      for (const cycle of scene.cycles ?? []) {
        for (const index of cycle.indices) {
          expect(index).toBeGreaterThanOrEqual(0)
          expect(index).toBeLessThan(32)
          expect(seen.has(index)).toBe(false)
          seen.add(index)
        }
      }
    })

    it('passes WCAG AA contrast inside local reading panels across both themes and all times', () => {
      const checks = [
        { theme: 'light', panel: 0xfafafa, alpha: 0.96, inks: [0x171717, 0x5c5c5c] },
        { theme: 'dark', panel: 0x090909, alpha: 0.94, inks: [0xededed, 0xa1a1a1] },
      ] as const

      for (const { theme, panel, alpha, inks } of checks) {
        const palettes = scene.themePalettes![theme]
        for (let step = 0; step < 32; step++) {
          const palette = interpolatePalette(palettes, step / 32)
          for (const pixel of palette) {
            for (const ink of inks) {
              expect(compositeContrast(ink, pixel, panel, alpha)).toBeGreaterThanOrEqual(4.5)
            }
          }
        }
      }
    })

    it('renders repeatable static and animated frames across themes and target viewports without mutating base', () => {
      for (const theme of themes) {
        for (const [width, height] of [[320, 180], [480, 270], [240, 300]] as const) {
          const renderer = new SceneRenderer(scene, { width, height, seed: 42, theme })
          const base = renderer.base.slice()
          const first = renderer.render(0).slice()
          expect(renderer.render(16)).not.toEqual(first)
          expect(renderer.base).toEqual(base)
          expect(renderer.render(0)).toEqual(first)
          expect(new SceneRenderer(scene, { width, height, seed: 42, theme }).render(0)).toEqual(first)
          expect(renderer.indexed.every((index) => index < 32)).toBe(true)
        }
      }
    })

    it('meets the 480x270 core p95 <= 2ms frame budget', () => {
      const renderer = new SceneRenderer(scene, { width: 480, height: 270, seed: 42, theme: 'dark' })
      for (let i = 0; i < 12; i++) renderer.render(i / 12, 1 / 12)
      const samples = Array.from({ length: 60 }, (_, i) => {
        const start = performance.now()
        renderer.render(i / 12, 1 / 12)
        return performance.now() - start
      }).sort((a, b) => a - b)
      expect(samples[Math.floor(samples.length * 0.95)]!).toBeLessThanOrEqual(2)
    })
  })
}
