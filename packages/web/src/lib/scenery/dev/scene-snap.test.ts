import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import fixture from '../engine/fixture-scene'
import { sceneRegistry } from '../engine/registry'
import { SceneRenderer } from '../engine/renderer'
import expected from './golden-hashes.json'
import { encodePng } from './png'
import { contactSheet, goldenHashes, rawFrame, snapshotMetadata, staticFrame, thumbnailFrame } from './snapshots'

describe('scenery goldens', () => {
  it('pins the engine fixture before production scenes are registered', () => {
    expect(goldenHashes(fixture)).toEqual(expected['engine-fixture'])
  })

  it('pins every registered scene at all four times of day', async () => {
    const hashes = new Map([[fixture.id, goldenHashes(fixture)]])
    for (const id of sceneRegistry.ids) {
      const scene = await sceneRegistry.load(id)
      if (!scene) throw new Error(`Scene registry could not load ${id}`)
      hashes.set(id, goldenHashes(scene))
    }
    expect(Object.fromEntries(hashes), 'Review the scene-snap PNG, then update golden-hashes.json').toEqual(expected)
  })
})

it('renders a themed 12-cell contact sheet with the requested size and time', () => {
  const { width, height, rgba } = contactSheet(fixture, 'dark')
  expect({ width, height }).toEqual({ width: 1960, height: 782 })
  const rows = [
    { top: 8, width: 320, height: 180 },
    { top: 196, width: 480, height: 270 },
    { top: 474, width: 240, height: 300 },
  ]
  for (const row of rows) {
    for (const [column, time] of (['dawn', 'day', 'dusk', 'night'] as const).entries()) {
      const { width: w, height: h, top } = row
      const renderer = new SceneRenderer(fixture, { width: w, height: h, theme: 'dark', time, background: 0x090909, visibility: 0.9, seed: 42 })
      const frame = new Uint8Array(renderer.render(0, 0, 0).buffer)
      const left = 8 + column * 488 + (480 - w) / 2
      for (const y of [0, Math.floor(h / 2), h - 1]) {
        const offset = ((top + y) * width + left) * 4
        expect(rgba.subarray(offset, offset + w * 4)).toEqual(frame.subarray(y * w * 4, (y + 1) * w * 4))
        expect(rgba[offset - 1]).toBe(0)
        expect(rgba[offset + w * 4 + 3]).toBe(0)
      }
    }
  }
})

it('exports raw and static frames with reproducibility metadata for both themes', () => {
  for (const theme of ['light', 'dark'] as const) {
    const raw = rawFrame(fixture, theme, 'dawn', 320, 180)
    expect(raw).toMatchObject({ width: 320, height: 180 })
    expect(raw.rgba).toHaveLength(320 * 180 * 4)

    const frame = staticFrame(fixture, theme)
    const thumbnail = thumbnailFrame(fixture, theme)
    expect(frame).toMatchObject({ width: 480, height: 270 })
    expect(thumbnail).toMatchObject({ width: 320, height: 180 })
    expect(snapshotMetadata(fixture, theme)).toEqual({
      scene: fixture.id,
      seed: 42,
      theme,
      time: fixture.defaultTime,
      width: 480,
      height: 270,
      visibility: 1,
      backend: 'SceneRenderer',
      frameSeconds: 0,
    })
  }
})

it('encodes a PNG with RGBA scanlines in row order', () => {
  const pixels = Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16)
  const png = encodePng(2, 2, pixels)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.subarray(8, 33).toString('hex')).toBe('0000000d494844520000000200000002080600000072b60d24')
  const idatLength = png.readUInt32BE(33)
  expect(png.toString('ascii', 37, 41)).toBe('IDAT')
  expect([...inflateSync(png.subarray(41, 41 + idatLength))]).toEqual([0, ...pixels.subarray(0, 8), 0, ...pixels.subarray(8)])
  expect(png.subarray(45 + idatLength).toString('hex')).toBe('0000000049454e44ae426082')
  expect(() => encodePng(2, 3, pixels)).toThrow(RangeError)
})
