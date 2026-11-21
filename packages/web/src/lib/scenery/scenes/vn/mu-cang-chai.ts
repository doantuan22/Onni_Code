/**
 * Reference: late sun slants over Mù Cang Chải's ripe rice terraces;
 * stacked contour bands sweep across the valley, with lit terrace rims,
 * layered blue hills, and a few tiny birds crossing the apricot sky.
 */
import type { Palettes, SceneDef } from '../../engine/types'
import { parseSprite } from '../../engine/sprite'

const palettes: Palettes = {
  dawn: [0x6c829f, 0xc7a794, 0x8092a0, 0x596f83, 0x465c70, 0x354b60, 0x826c68, 0x9b7965, 0xad875f, 0x8c6d4f, 0x6d5a4b, 0x534b47, 0xb09572, 0xd0ad79, 0xe1c38e, 0xc28c60],
  day: [0x82b5c2, 0xe7d6b1, 0x94bac0, 0x6d929a, 0x57777f, 0x405d67, 0x9d9b68, 0xb4a85f, 0xc5b65b, 0xa68e4e, 0x847750, 0x645f50, 0xc6b274, 0xe0c77e, 0xead69b, 0xc5a064],
  dusk: [0x53466b, 0xd69a7a, 0x7d6678, 0x68596e, 0x514d65, 0x3b4359, 0xa36f59, 0xc08255, 0xd19848, 0xb27c43, 0x8e6541, 0x68523f, 0xc08b62, 0xdca568, 0xe8bd78, 0xc77a4c],
  night: [0x202b49, 0x4c425d, 0x343a55, 0x2d354e, 0x263148, 0x202b41, 0x4e4d52, 0x625449, 0x766149, 0x615344, 0x4e483e, 0x3a3d3b, 0x686052, 0x8b7154, 0xa1835d, 0x805849],
}

const birds = parseSprite([
  '...b.......b...',
  '..b.b.....b.b..',
  '.b...b...b...b.',
  '.....b.b.......',
  '......b........',
], { b: 5 })

const scene: SceneDef = {
  id: 'vn-mu-cang-chai',
  name: { en: 'Mù Cang Chải Rice Terraces', vi: 'Ruộng bậc thang Mù Cang Chải' },
  region: 'vn', tone: 'both', palettes, defaultTime: 'dusk', horizon: 0.42, focus: { x: 0.68, y: 0.65 },
  build(ctx) {
    const { width: w, height: h } = ctx

    // A cool-to-warm pixel sky leads into a pale, low valley sun.
    for (let y = 0; y < h; y++) {
      const t = y / h
      for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, t * 0.78, 0, 2, 8))
    }
    ctx.disc(w * 0.77, h * 0.29, h * 0.047, 1)
    for (let ray = 0; ray < 7; ray++) {
      const x0 = w * (0.73 + ray * 0.012)
      ctx.line(x0, h * 0.34, x0 - h * 0.19, h * 0.49, ray % 2 === 0 ? 1 : 2)
    }

    // Blue mountain ridges recede behind the cultivated slopes.
    const ridges = [
      { base: 0.48, amp: 0.14, frequency: 2.1, color: 2 },
      { base: 0.54, amp: 0.17, frequency: 3.2, color: 3 },
      { base: 0.59, amp: 0.18, frequency: 4.3, color: 4 },
    ]
    for (const [layer, ridge] of ridges.entries()) {
      const heights = ctx.ridge({ height: ridge.base, amplitude: ridge.amp, frequency: ridge.frequency, octaves: 4 })
      for (let x = 0; x < w; x++) {
        const top = Math.floor(heights[x]! * h)
        for (let y = top; y < h * 0.67; y++) {
          const litEdge = x > w * 0.58 && y < top + 2 && (x + layer) % 3 === 0
          ctx.px(x, y, litEdge ? 1 : ridge.color + (ctx.fbm2(x * 0.045, y * 0.06) > 0.68 ? 1 : 0))
        }
      }
    }

    // Quantized height bands make broad, irregular rice terraces across the valley.
    for (let x = 0; x < w; x++) {
      const u = x / w
      const valley = Math.sin(u * Math.PI * 2.15 + 0.45) * 0.035 + Math.sin(u * Math.PI * 4.3) * 0.018
      const skyline = 0.39 + valley + (ctx.fbm1(x * 0.045) - 0.5) * 0.07
      for (let y = Math.max(0, Math.floor(skyline * h)); y < h; y++) {
        const depth = (y / h - skyline) / Math.max(0.1, 1 - skyline)
        const contour = Math.max(0, (depth * 8.2) + Math.sin(u * Math.PI * 3.2 + depth * 2) * 0.52 + u * 0.72 + (ctx.fbm2(x * 0.055, y * 0.028) - 0.5) * 0.62)
        const step = Math.floor(contour)
        const edge = contour - step
        const sunward = x > w * (0.62 - depth * 0.13)
        const alternating = (step + Math.floor(u * 5)) % 3
        let color = 6 + alternating
        if (ctx.fbm2(x * 0.13 + 23, y * 0.12) > 0.73) color++
        // Thin bright lips face the low sun; shaded banks sit just below them.
        if (edge < 0.13 && sunward) color = 14
        else if (edge > 0.13 && edge < 0.23) color = 12
        else if (edge > 0.78 && !sunward) color = 10
        if (depth > 0.82 && (x + step) % 11 === 0) color = 15
        ctx.px(x, y, color)
      }
    }

    // Warm reflected light threads through only a few terrace bends.
    for (let x = Math.floor(w * 0.48); x < w; x++) {
      for (let band = 0; band < 4; band++) {
        const u = x / w
        const y = Math.floor(h * (0.57 + band * 0.073 + Math.sin(u * 8 + band) * 0.026))
        if (y < h && ((x + band * 5) % 9 < 3)) ctx.px(x, y, band % 2 === 0 ? 14 : 13)
      }
    }
  },
  frame(ctx, t) {
    // The small flock drifts across the sky; wing pixels alternate gently.
    const travel = Math.floor(ctx.width * 0.18 + ((t * 3) % (ctx.width + birds.width * 2)) - birds.width)
    const y = Math.floor(ctx.height * 0.24 + Math.sin(t * 0.22) * 2)
    ctx.sprite(birds, travel, y + (Math.floor(t * 2) % 2), 1)
    ctx.sprite(birds, travel - Math.floor(ctx.width * 0.09), y + 9 - (Math.floor(t * 2) % 2), 1)
  },
}

export default scene
