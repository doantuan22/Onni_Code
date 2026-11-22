import { describe, expect, it } from 'vitest'

import { SceneRenderer } from '../../engine/renderer'
import scene from './fansipan'

describe('vn-fansipan scene', () => {
  it('renders the ridge with dark palettes and changing cloud/flag frames', () => {
    expect(scene.themePalettes).toBeDefined()
    for (const theme of ['light', 'dark'] as const) {
      for (const colors of Object.values(scene.themePalettes![theme])) expect(colors).toHaveLength(32)
    }
    const renderer = new SceneRenderer(scene, { width: 320, height: 180, seed: 42, theme: 'dark', time: 'night' })
    const first = renderer.render(0, 1 / 12).slice()
    expect(renderer.render(2, 1 / 12)).not.toEqual(first)
    expect(Math.max(...renderer.base)).toBeLessThan(32)
  })
})
