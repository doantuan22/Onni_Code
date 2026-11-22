import { describe, expect, it } from 'vitest'
import { contrastCeiling, luminance } from '../../engine/contrast'
import { channels, expandPalette, interpolatePalette } from '../../engine/palette'
import { SceneRenderer } from '../../engine/renderer'
import tromso from './tromso'

describe('world-tromso', () => {
  it('has valid v2 scene metadata and properties', () => {
    expect(tromso.id).toBe('world-tromso')
    expect(tromso.region).toBe('world')
    expect(tromso.tone).toBe('both')
    expect(tromso.defaultTime).toBe('night')
    expect(tromso.themeDefaultTime).toEqual({ light: 'day', dark: 'night' })
    expect(tromso.horizon).toBe(0.65)
    expect(tromso.focus).toEqual({ x: 0.70, y: 0.34 })
    expect(tromso.name.en).toBe('Tromsø Aurora')
    expect(tromso.name.vi).toBe('Cực quang Tromsø')
    expect(tromso.layers).toBeDefined()
    expect(tromso.layers!.length).toBeGreaterThanOrEqual(5)
  })

  it('declares valid 32-color palettes for all times across light and dark themes', () => {
    for (const [theme, themePals] of Object.entries(tromso.themePalettes ?? {})) {
      for (const [time, palette] of Object.entries(themePals)) {
        expect(palette.length, `${theme}.${time} palette length`).toBe(32)
        for (const [idx, color] of palette.entries()) {
          expect(Number.isInteger(color), `${theme}.${time}[${idx}] is integer`).toBe(true)
          expect(color, `${theme}.${time}[${idx}] in range`).toBeGreaterThanOrEqual(0)
          expect(color, `${theme}.${time}[${idx}] in range`).toBeLessThanOrEqual(0xffffff)
        }
      }
    }
  })

  it('keeps all interpolated palettes inside the AA contrast ceiling', () => {
    for (const palettes of [tromso.themePalettes!.light, tromso.themePalettes!.dark]) {
      for (const [bg, inks] of [[0x090909, [0xededed, 0xa1a1a1]], [0xfafafa, [0x171717, 0x5c5c5c]]] as const) {
        for (let step = 0; step < 96; step++) {
          const palette = interpolatePalette(palettes, step / 96)
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
    }
  })

  it('renders repeatable static and animated frames at landscape and portrait sizes without mutating the base', () => {
    for (const [width, height] of [[320, 180], [480, 270], [240, 300]]) {
      for (const theme of ['light', 'dark'] as const) {
        const renderer = new SceneRenderer(tromso, { width: width!, height: height!, seed: 42, theme })
        const base = renderer.base.slice()
        const first = renderer.render(0).slice()
        expect(renderer.render(16)).not.toEqual(first)
        expect(renderer.base).toEqual(base)
        expect(renderer.render(0)).toEqual(first)
        expect(new SceneRenderer(tromso, { width: width!, height: height!, seed: 42, theme }).render(0)).toEqual(first)
        expect(renderer.indexed.every((index) => index < 32)).toBe(true)
      }
    }
  })

  it('draws aurora indices only after daylight and animates curtains smoothly', () => {
    for (const theme of ['light', 'dark'] as const) {
      const day = new SceneRenderer(tromso, { width: 320, height: 180, seed: 42, theme, time: 'day' })
      day.render(1)
      expect([...day.indexed].some((index) => index >= 7 && index <= 10)).toBe(false)
    }

    const dusk = new SceneRenderer(tromso, { width: 320, height: 180, seed: 42, theme: 'dark', time: 'dusk' })
    dusk.render(1)
    expect([...dusk.indexed].some((index) => index >= 7 && index <= 10)).toBe(true)

    const nightA = new SceneRenderer(tromso, { width: 480, height: 270, seed: 42, theme: 'dark', time: 'night' })
    const frame0 = nightA.render(0).slice()
    const frame4 = nightA.render(4).slice()
    expect(frame4).not.toEqual(frame0)
    expect(nightA.render(0)).toEqual(frame0)
  })

  it('keeps open upper sky bands free of checkerboard dither behind the /new panel', () => {
    const renderer = new SceneRenderer(tromso, { width: 480, height: 270, seed: 42, theme: 'light', time: 'day' })
    renderer.render(0)
    // Solid upper sky band around v = 0.04..0.10 (avoiding cirrus/sun) should stay uniform index 0
    const row12 = renderer.indexed.subarray(12 * 480 + 140, 12 * 480 + 200)
    expect(new Set(row12).size).toBe(1)
  })
})
