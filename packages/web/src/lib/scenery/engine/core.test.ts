import { describe, expect, it, vi } from 'vitest'

import { createContext } from './context'
import { contrastCeiling, contrastRatio, luminance } from './contrast'
import { BAYER_4, BAYER_8, dither } from './dither'
import fixture from './fixture-scene'
import { createNoiseAtlas } from './noise'
import { channels, createLut, expandPalette, indexedToRgba, interpolatePalette, mixColor, packRgba, resolveTime, TIME_ANCHORS } from './palette'
import { createSceneRegistry } from './registry'
import { bufferSize, SceneRenderer } from './renderer'
import { mulberry32 } from './rng'
import { parseSprite } from './sprite'
import { karst, reflectWater, ridge, terrace } from './terrain'
import type { TimeOfDay } from './types'

function fnv(bytes: Uint8Array): string {
  let hash = 0x811c9dc5
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

describe('seeded drawing tools', () => {
  it('pins mulberry32 and stays reproducible within [0,1)', () => {
    const a = mulberry32(1)
    expect(Array.from({ length: 4 }, a)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741])
    expect(Array.from({ length: 1000 }, mulberry32(42))).toEqual(Array.from({ length: 1000 }, mulberry32(42)))
    expect(Array.from({ length: 1000 }, mulberry32(7)).every((x) => x >= 0 && x < 1)).toBe(true)
  })

  it('bakes a deterministic 256-square fBm atlas with seamless periodic sampling', () => {
    const a = createNoiseAtlas(9)
    expect(a.data).toHaveLength(256 * 256)
    expect(a.data).toEqual(createNoiseAtlas(9).data)
    expect(a.data).not.toEqual(createNoiseAtlas(10).data)
    expect(a.data.every((x) => x >= 0 && x <= 1)).toBe(true)
    for (const [x, y] of [[-0.25, 22.5], [0, 0], [255.9, -31.3]]) {
      expect(a.sample(x!, y!)).toBeCloseTo(a.sample(x! + 256, y! - 256), 10)
    }
    expect(a.sample(-0.00001, 42)).toBeCloseTo(a.sample(0.00001, 42), 5)
    expect(() => createNoiseAtlas(0, 0)).toThrow(RangeError)
  })

  it('uses every Bayer threshold exactly once and wraps negative coordinates', () => {
    expect(new Set(BAYER_4).size).toBe(16)
    expect(new Set(BAYER_8).size).toBe(64)
    for (const size of [4, 8] as const) {
      const values = Array.from({ length: size * size }, (_, i) => dither(i % size, Math.floor(i / size), 0.5, 2, 3, size))
      expect(values.filter((i) => i === 3)).toHaveLength(size * size / 2)
      expect(dither(-1, -1, 0.5, 2, 3, size)).toBe(dither(size - 1, size - 1, 0.5, 2, 3, size))
      expect(dither(0, 0, 0, 2, 3, size)).toBe(2)
      expect(dither(0, 0, 1, 2, 3, size)).toBe(3)
    }
  })

  it('generates bounded ridges, stepped terraces and steep rounded karst', () => {
    const heights = ridge(320, createNoiseAtlas(5), { height: 0.5, amplitude: 0.3, frequency: 100 })
    expect(heights.every((v) => v >= 0.2 && v <= 0.8)).toBe(true)
    expect(new Set(heights).size).toBeGreaterThan(200)
    expect(terrace(0.49, 4)).toBe(0.25)
    expect(karst(0, 0, 1, 0.8)).toBe(0.8)
    expect(karst(1, 0, 1, 0.8)).toBe(0)
    expect(karst(0.5, 0, 1, 0.8)).toBeGreaterThan(0.7)
  })

  it('parses transparent sprites and clips every primitive at buffer edges', () => {
    const sprite = parseSprite(['a.', '.a'], { a: 7 })
    expect([...sprite.pixels]).toEqual([7, -1, -1, 7])
    expect(() => parseSprite(['ab'], { a: 0 })).toThrow('Unknown sprite')
    expect(() => parseSprite(['a', 'aa'], { a: 0 })).toThrow('same nonzero width')
    const buffer = new Uint8Array(16)
    const ctx = createContext(4, 4, 1, buffer, buffer, createNoiseAtlas(1, 8, 2))
    ctx.sprite(sprite, -1, -1)
    expect(buffer[0]).toBe(7)
    ctx.rect(-3, -3, 5, 5, 4)
    expect([...buffer.slice(0, 2)]).toEqual([4, 4])
    ctx.line(-1, 2, 5, 2, 3)
    expect([...buffer.slice(8, 12)]).toEqual([3, 3, 3, 3])
    ctx.disc(3, 3, 1, 2)
    expect(buffer[15]).toBe(2)
    ctx.px(50, -1, 31)
    expect(buffer).toHaveLength(16)
  })

  it('reflects static rows into the shadow bank without changing the base', () => {
    const base = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])
    const target = new Uint8Array(8)
    reflectWater(base, target, 2, 4, 2, 0, 0)
    expect([...target.slice(4)]).toEqual([19, 20, 17, 18])
    expect([...base]).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('palette pipeline and contrast ceiling', () => {
  it('interpolates all clock keyframes cyclically and packs actual RGBA bytes', () => {
    for (const time of Object.keys(TIME_ANCHORS) as TimeOfDay[]) {
      expect(interpolatePalette(fixture.palettes, time)).toEqual([...fixture.palettes[time]])
    }
    expect(interpolatePalette(fixture.palettes, -0.125)).toEqual(interpolatePalette(fixture.palettes, 0.875))
    expect(interpolatePalette(fixture.palettes, 0.125)[0]).toBe(mixColor(fixture.palettes.night[0]!, fixture.palettes.dawn[0]!, 0.5))
    expect([...new Uint8Array(new Uint32Array([packRgba(0x123456)]).buffer)]).toEqual([18, 52, 86, 255])
    const lut = createLut([0x123456])
    const out = new Uint32Array(2)
    expect(indexedToRgba(new Uint8Array([0, 16]), lut, out)).toBe(out)
    expect(out[1]).not.toBe(out[0])
    expect(createLut([0x123456], { background: 0x334455, visibility: 0 })[0]).toBe(packRgba(0x334455))
    expect(() => createLut([])).toThrow(RangeError)
    expect(() => createLut([0x1000000])).toThrow(RangeError)
    expect(resolveTime('auto', new Date(2026, 0, 1, 6, 0))).toBe(0.25)
    expect(resolveTime('auto', new Date(2026, 0, 1, 18, 0))).toBe(0.75)
    expect(resolveTime('day')).toBe('day')
  })

  it.each([
    [0x090909, [0xf0f0f0, 0xa0a0a0]],
    [0xf5f5f5, [0x181818, 0x595959]],
  ])('guarantees AA for both inks on theme %s at maximum visibility', (bg, inks) => {
    // Include extreme synthetic colors: the bound must protect both themes, not just muted art.
    const palette = [...Object.values(fixture.palettes).flat(), 0xfefefe, 0x010101, 0xe52bc3]
    const { minScrim, maxVisibility, possible } = contrastCeiling(palette, bg, inks, 1)
    expect(possible).toBe(true)
    expect(minScrim).toBeCloseTo(1 - maxVisibility)
    for (const pixel of palette) {
      const b = channels(bg)
      const rgb = channels(pixel).map((c, i) => b[i]! + (1 - minScrim) * (c - b[i]!))
      // Evaluate continuous compositing, without rounding toward an unsafe channel value.
      const linear = (c: number) => c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4
      const eff = 0.2126 * linear(rgb[0]!) + 0.7152 * linear(rgb[1]!) + 0.0722 * linear(rgb[2]!)
      for (const ink of inks) {
        const l = luminance(ink)
        expect((Math.max(l, eff) + 0.05) / (Math.min(l, eff) + 0.05)).toBeGreaterThanOrEqual(4.5 - 1e-10)
      }
    }
    expect(contrastCeiling(palette, bg, inks, 0).minScrim).toBe(0)
  })

  it('reports an impossible base theme rather than claiming a scrim fixes it', () => {
    expect(contrastCeiling([0xdddddd], 0x777777, [0x777777]).possible).toBe(false)
    expect(contrastCeiling([0xdddddd], 0x777777, [0x777777]).minScrim).toBe(1)
    expect(contrastRatio(0x010101, 0xfefefe)).toBeGreaterThan(20)
  })

  it('protects every fixture time and shadow bank on the actual theme text tokens', () => {
    for (const [background, inks] of [[0x090909, [0xededed, 0xa1a1a1]], [0xfafafa, [0x171717, 0x5c5c5c]]] as const) {
      for (let step = 0; step < 96; step++) {
        const palette = interpolatePalette(fixture.palettes, step / 96)
        const { minScrim, possible } = contrastCeiling(palette, background, inks)
        expect(possible).toBe(true)
        // Check the actual colorized banks, including generated reflection colors.
        for (const pixel of expandPalette(palette)) {
          const effective = mixColor(background, pixel, 1 - minScrim)
          for (const ink of inks) expect(contrastRatio(ink, effective)).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
})

describe('scene rendering and lazy registry', () => {
  it('loads only the requested scene chunk and caches it', async () => {
    const loader = vi.fn(() => import('./fixture-scene'))
    const registry = createSceneRegistry({ 'engine-fixture': loader })
    expect(loader).not.toHaveBeenCalled()
    expect(await registry.load('missing')).toBeUndefined()
    expect(await registry.load('toString')).toBeUndefined()
    const [a, b] = await Promise.all([registry.load('engine-fixture'), registry.load('engine-fixture')])
    expect(a).toBe(b)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('retries rejected lazy imports', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('chunk unavailable')).mockResolvedValue({ default: fixture })
    const registry = createSceneRegistry({ 'engine-fixture': loader })
    await expect(registry.load('engine-fixture')).rejects.toThrow('chunk unavailable')
    expect(await registry.load('engine-fixture')).toBe(fixture)
  })

  it('builds once, resets dynamic pixels, reuses output and updates only the LUT', () => {
    const build = vi.fn(fixture.build)
    const renderer = new SceneRenderer({ ...fixture, build }, { width: 320, height: 180 })
    const base = renderer.base.slice()
    const first = renderer.render().slice()
    const output = renderer.rgba
    renderer.render(4, 1 / 12)
    expect(renderer.render()).toBe(output)
    expect(renderer.rgba).toEqual(first)
    renderer.setPalette('night')
    expect(renderer.render()).not.toEqual(first)
    expect(renderer.base).toEqual(base)
    expect(build).toHaveBeenCalledTimes(1)
    expect(() => new SceneRenderer(fixture, { width: 1000, height: 1000 })).toThrow(RangeError)
  })

  it('pins the FNV-1a RGBA hashes of the 320×180 fixture at t=0', () => {
    const hashes = Object.fromEntries((Object.keys(TIME_ANCHORS) as TimeOfDay[]).map((time) => {
      const renderer = new SceneRenderer(fixture, { width: 320, height: 180, seed: 42, time })
      return [time, fnv(new Uint8Array(renderer.render().buffer))]
    }))
    expect(hashes).toEqual({ dawn: '32b38caf', day: 'f88accda', dusk: '868aa6a3', night: '70dd44c5' })
  })

  it('fits desktop and portrait/mobile buffers within their resolution budgets', () => {
    expect(bufferSize(1920, 1080, false)).toEqual({ width: 320, height: 180 })
    expect(bufferSize(3840, 2160, false)).toEqual({ width: 480, height: 270 })
    const narrow = bufferSize(720, 900)
    expect(narrow.width).toBeLessThanOrEqual(240)
    expect(narrow.height).toBeGreaterThan(narrow.width)
    expect(narrow.width * narrow.height).toBeLessThanOrEqual(480 * 270)
  })

  it('benchmarks core frames at 480×270 (2ms target, 8ms CI allowance)', () => {
    const renderer = new SceneRenderer(fixture, { width: 480, height: 270 })
    for (let i = 0; i < 30; i++) renderer.render(i / 12, 1 / 12)
    const start = performance.now()
    for (let i = 0; i < 120; i++) renderer.render(i / 12, 1 / 12)
    const average = (performance.now() - start) / 120
    console.info(`scenery core 480×270: ${average.toFixed(3)}ms/frame (target 2ms)`)
    expect(average).toBeLessThan(8)
  })
})
