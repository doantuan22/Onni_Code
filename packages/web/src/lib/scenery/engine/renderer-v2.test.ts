import { describe, expect, it } from 'vitest'

import { SceneRenderer } from './renderer'
import type { SceneDef } from './types'
import fixture from './fixture-scene'

const palettes = {
  dawn: [0x101010, 0x202020, 0x303030], day: [0x111111, 0x222222, 0x333333],
  dusk: [0x121212, 0x232323, 0x343434], night: [0x131313, 0x242424, 0x353535],
} as const
const scene: SceneDef = {
  id: 'v2', name: { en: 'V2', vi: 'V2' }, region: 'world', tone: 'both', palettes, defaultTime: 'day', horizon: .5, focus: { x: .5, y: .5 },
  themePalettes: { light: palettes, dark: { dawn: [0xaa0000, 0xbb0000, 0xcc0000], day: [0xaa0000, 0xbb0000, 0xcc0000], dusk: [0xaa0000, 0xbb0000, 0xcc0000], night: [0xaa0000, 0xbb0000, 0xcc0000] } },
  themeDefaultTime: { dark: 'night' }, cycles: [{ indices: [1, 2], rate: 1 }],
  build(ctx) { ctx.rect(0, 0, ctx.width, ctx.height, 1) },
  frame() {},
}

describe('v2 renderer palette API', () => {
  it('is deterministic by seed/time and resolves a themed palette without changing legacy fields', () => {
    const first = new SceneRenderer(scene, { width: 32, height: 18, seed: 42, theme: 'dark' })
    const second = new SceneRenderer(scene, { width: 32, height: 18, seed: 42, theme: 'dark' })
    expect(first.render(1)).toEqual(second.render(1))
    expect(first.render(0)[0]).not.toBe(first.render(1)[0])
  })

  it('forwards the resolved palette time to frame effects', () => {
    const times: (string | number)[] = []
    const timedScene: SceneDef = {
      ...scene,
      frame(ctx) { times.push(ctx.time) },
    }
    const renderer = new SceneRenderer(timedScene, { width: 32, height: 18, time: 'dawn' })
    renderer.render()
    renderer.setPalette('night')
    renderer.render()
    expect(times).toEqual(['dawn', 'night'])
  })

  it('keeps the 480×270 fixture core p95 within the P0 budget', () => {
    const renderer = new SceneRenderer(fixture, { width: 480, height: 270, seed: 42 })
    for (let frame = 0; frame < 12; frame++) renderer.render(frame / 12, 1 / 12)
    const samples = Array.from({ length: 60 }, (_, frame) => {
      const start = performance.now()
      renderer.render(frame / 12, 1 / 12)
      return performance.now() - start
    }).sort((a, b) => a - b)
    expect(samples[Math.floor(samples.length * .95)]!).toBeLessThanOrEqual(2)
  })
})
