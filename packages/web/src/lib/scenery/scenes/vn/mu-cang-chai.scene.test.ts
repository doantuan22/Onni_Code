import { describe, expect, it } from 'vitest'

import { SceneRenderer } from '../../engine/renderer'
import scene from './mu-cang-chai'

describe('vn-mu-cang-chai scene', () => {
  it('provides complete theme/time palettes and a dynamic valley frame', () => {
    expect(scene.themePalettes).toBeDefined()
    for (const theme of ['light', 'dark'] as const) {
      for (const colors of Object.values(scene.themePalettes![theme])) expect(colors).toHaveLength(32)
    }
    const renderer = new SceneRenderer(scene, { width: 320, height: 180, seed: 42, theme: 'dark', time: 'dusk' })
    const still = renderer.render(0, 1 / 12).slice()
    expect(renderer.render(2, 1 / 12)).not.toEqual(still)
    expect(Math.max(...renderer.base)).toBeLessThan(32)
  })
})
