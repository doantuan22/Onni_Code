import { describe, expect, it } from 'vitest'

import { SceneRenderer } from '../../engine/renderer'
import scene, { Ink } from './mu-cang-chai'

describe('vn-mu-cang-chai scene', () => {
  it('provides complete 32-role theme/time palettes with distinct twilight dark mode', () => {
    expect(scene.themePalettes).toBeDefined()
    for (const theme of ['light', 'dark'] as const) {
      for (const colors of Object.values(scene.themePalettes![theme])) {
        expect(colors).toHaveLength(32)
        for (const color of colors) {
          expect(Number.isInteger(color)).toBe(true)
          expect(color).toBeGreaterThanOrEqual(0)
          expect(color).toBeLessThanOrEqual(0xffffff)
        }
      }
    }
    // Dark dusk (twilight design) must differ significantly from light day
    expect(scene.themePalettes!.dark.dusk).not.toEqual(scene.themePalettes!.light.day)
    expect(scene.themeDefaultTime).toEqual({ light: 'day', dark: 'dusk' })
  })

  it('renders a dynamic valley frame with valid indexed values within 32 palette roles', () => {
    const renderer = new SceneRenderer(scene, { width: 320, height: 180, seed: 42, theme: 'dark', time: 'dusk' })
    const frame0 = renderer.render(0, 1 / 12).slice()
    const frame1 = renderer.render(2, 1 / 12).slice()
    expect(frame1).not.toEqual(frame0)
    expect(Math.max(...renderer.base)).toBeLessThan(32)
    expect(Math.min(...renderer.base)).toBeGreaterThanOrEqual(0)
  })

  it('anchors the authentic 36×26 H\'Mong stilt house in the right gutter', () => {
    const width = 480
    const height = 270
    const renderer = new SceneRenderer(scene, { width, height, seed: 42, theme: 'light', time: 'day' })
    renderer.render(0, 0, 0)
    const base = renderer.base

    const hx = Math.floor(width * 0.78 - 18) // 356
    const hy = Math.floor(height * 0.58 - 13) // 143

    // Stilt house must fall in right gutter u=0.65..0.95, v=0.50..0.70
    expect(hx / width).toBeGreaterThanOrEqual(0.65)
    expect((hx + 36) / width).toBeLessThanOrEqual(0.95)
    expect(hy / height).toBeGreaterThanOrEqual(0.50)
    expect((hy + 26) / height).toBeLessThanOrEqual(0.70)

    // Check house pixels within its 36×26 bounds
    const houseInks = new Set([
      Ink.ThatchShadow,
      Ink.ThatchLit,
      Ink.TimberDark,
      Ink.TimberLit,
      Ink.WindowGlow,
      Ink.WindowHalo,
      Ink.HouseGround,
    ])
    let houseCount = 0
    for (let y = hy; y < hy + 26; y++) {
      for (let x = hx; x < hx + 36; x++) {
        if (houseInks.has(base[y * width + x]!)) houseCount++
      }
    }
    // Solid architectural silhouette: >500 pixels in 36×26 box
    expect(houseCount).toBeGreaterThan(500)
  })

  it('preserves clean sky bands without wide full-sky checkerboard dither', () => {
    const width = 480
    const height = 270
    const renderer = new SceneRenderer(scene, { width, height, seed: 42, theme: 'light', time: 'day' })
    renderer.render(0, 0, 0)
    const base = renderer.base

    // In open sky (y < 90), checkerboard 2×2 patterns are restricted to <=4px seams
    let checkerCells = 0
    for (let y = 0; y < 90; y++) {
      for (let x = 0; x < width - 1; x++) {
        const p1 = base[y * width + x]!
        const p2 = base[y * width + x + 1]!
        const p3 = base[(y + 1) * width + x]!
        const p4 = base[(y + 1) * width + x + 1]!
        if (p1 === p4 && p2 === p3 && p1 !== p2) checkerCells++
      }
    }
    // In full-sky dither, checkerCells would exceed 10,000; with narrow seams it stays <= 1,200
    expect(checkerCells).toBeLessThan(1200)
  })
})
