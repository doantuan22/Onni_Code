import { describe, expect, it } from 'vitest'

import { SceneRenderer } from '../../engine/renderer'
import type { SceneTheme, TimeOfDay } from '../../engine/types'
import scene from './phu-quoc'
import {
  heroPalmCrownSheet,
  Ink,
  sampanSheet,
  secPalmCrownSheet,
} from './phu-quoc-sprites'

describe('vn-phu-quoc V2 scene', () => {
  it('ships independent 32-role palettes for every theme and time', () => {
    for (const theme of ['light', 'dark'] as SceneTheme[]) {
      for (const time of ['dawn', 'day', 'dusk', 'night'] as TimeOfDay[]) {
        expect(scene.themePalettes?.[theme][time]).toHaveLength(32)
      }
    }
    expect(scene.themeDefaultTime).toEqual({ light: 'dawn', dark: 'dusk' })
    expect(scene.defaultTime).toBe('dusk')
    expect(scene.horizon).toBe(0.57)
    expect(scene.focus).toEqual({ x: 0.72, y: 0.65 })
  })

  it('declares 6-phase wave palette cycle', () => {
    expect(scene.cycles).toHaveLength(1)
    expect(scene.cycles?.[0]?.indices).toEqual([
      Ink.Wave0,
      Ink.Wave1,
      Ink.Wave2,
      Ink.Wave3,
      Ink.Wave4,
      Ink.Wave5,
    ])
    expect(scene.cycles?.[0]?.rate).toBe(6)
  })

  it('authors binding hero crown (52x40) and secondary crown (38x30) with 3 animated poses', () => {
    expect(heroPalmCrownSheet.frames).toHaveLength(3)
    for (const frame of heroPalmCrownSheet.frames) {
      expect(frame.width).toBe(52)
      expect(frame.height).toBe(40)
      expect(frame.pivot).toEqual({ x: 26, y: 20 })
    }

    expect(secPalmCrownSheet.frames).toHaveLength(3)
    for (const frame of secPalmCrownSheet.frames) {
      expect(frame.width).toBe(38)
      expect(frame.height).toBe(30)
      expect(frame.pivot).toEqual({ x: 19, y: 16 })
    }
  })

  it('authors coastal fishing sampan (30x18) with 2 poses', () => {
    expect(sampanSheet.frames).toHaveLength(2)
    for (const frame of sampanSheet.frames) {
      expect(frame.width).toBe(30)
      expect(frame.height).toBe(18)
      expect(frame.pivot).toEqual({ x: 15, y: 14 })
    }
  })

  it.each([[320, 180], [240, 300], [480, 270]] as const)(
    'renders palms, shore, water, and animated elements at %ix%i',
    (width, height) => {
      const renderer = new SceneRenderer(scene, {
        width,
        height,
        seed: 42,
        theme: 'light',
        time: 'dawn',
      })
      const still = renderer.render(0, 0).slice()
      const animated = renderer.render(3.25, 1 / 12).slice()
      expect(new Set(still).size).toBeGreaterThan(12)
      expect(animated).not.toEqual(still)
    },
  )

  it('renders crescent moon at night and radiant sun at dusk without full-sky dither', () => {
    const duskRenderer = new SceneRenderer(scene, {
      width: 480,
      height: 270,
      seed: 42,
      theme: 'dark',
      time: 'dusk',
    })
    const duskFrame = duskRenderer.render(0, 0)

    const nightRenderer = new SceneRenderer(scene, {
      width: 480,
      height: 270,
      seed: 42,
      theme: 'dark',
      time: 'night',
    })
    const nightFrame = nightRenderer.render(0, 0)

    expect(duskFrame).not.toEqual(nightFrame)
  })

  it('animates foam wash across tide cycle', () => {
    const renderer = new SceneRenderer(scene, {
      width: 480,
      height: 270,
      seed: 42,
      theme: 'dark',
      time: 'dusk',
    })
    const surge = renderer.render(2.0, 1 / 12).slice() // surge phase
    const recede = renderer.render(6.0, 1 / 12).slice() // recession phase
    expect(surge).not.toEqual(recede)
  })
})
