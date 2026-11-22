import { describe, expect, it } from 'vitest'

import { compositeContrast } from './contrast'
import { createContext } from './context'
import { createMask } from './layers'
import { cyclePalette } from './palette'
import { ParticlePool } from './particles'
import { createSpriteSheet, parseSprite } from './sprite'
import { createNoiseAtlas } from './noise'

function context() {
  const base = new Uint8Array(64)
  return { base, ctx: createContext(8, 8, 42, base, base, createNoiseAtlas(42)) }
}

describe('v2 scenery primitives', () => {
  it('quantizes polygons and masked curves deterministically', () => {
    const first = context(); const second = context()
    for (const { ctx } of [first, second]) {
      const mask = createMask(8, 8); mask.rect(0, 3, 8, 5)
      ctx.polygon([{ x: 1.2, y: 1.2 }, { x: 6.6, y: 1.4 }, { x: 4.2, y: 6.8 }], 7)
      ctx.curve([{ x: 0, y: 0 }, { x: 4, y: 7 }, { x: 7, y: 0 }], 9, mask)
    }
    expect(first.base).toEqual(second.base)
    expect(first.base.slice(0, 24)).not.toContain(9)
  })

  it('uses bounded sprite sheets and particle pools', () => {
    const sprite = parseSprite(['ab', 'ba'], { a: 2, b: 3 })
    const sheet = createSpriteSheet(sprite, [{ x: 0, y: 0, width: 1, height: 2 }])
    const { base, ctx } = context()
    ctx.spriteFrame(sheet, 0, 3, 2)
    expect(base[2 * 8 + 3]).toBe(2)
    const pool = new ParticlePool(2, 42)
    expect(pool.spawn({ x: 0, y: 0, vx: 4, vy: 0, life: 1, index: 1 })).toBe(true)
    pool.advance(.25)
    expect(pool.particles[0]!.x).toBe(1)
    expect(() => new ParticlePool(161)).toThrow(RangeError)
  })

  it('cycles only declared palette groups and measures the final panel composite', () => {
    expect(cyclePalette([1, 2, 3, 4], [{ indices: [1, 2], rate: 1 }], 1)).toEqual([1, 3, 2, 4])
    expect(compositeContrast(0x000000, 0xffffff, 0xffffff, .96)).toBeGreaterThan(15)
  })
})
