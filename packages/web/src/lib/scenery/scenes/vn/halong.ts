/**
 * Reference: dawn over Ha Long Bay, with three receding ranks of limestone
 * towers dissolving into peach mist; a small brown junk crosses still water.
 * The pale sun sits right of center, behind the distant karsts.
 */
import { karst, reflectWater } from '../../engine/terrain'
import { parseSprite } from '../../engine/sprite'
import type { Palettes, SceneDef } from '../../engine/types'

const palettes: Palettes = {
  dawn: [0x334c69, 0xd59b91, 0x7893a1, 0x536f82, 0x324e68, 0x213b55, 0x678c9a, 0x83a5a8, 0x547d8b, 0x3e687b, 0x31576e, 0x29465f, 0x8e705d, 0x9b9b8e, 0xb7825f, 0x405a6d],
  day: [0x77aebe, 0xe8d0a4, 0x95c3c3, 0x739fa9, 0x4b7e8d, 0x315c72, 0x74b1b4, 0x91c9c5, 0x428a9c, 0x33798d, 0x2b687e, 0x28586f, 0x927252, 0xa1b5a7, 0xc38a52, 0x456c7a],
  dusk: [0x514c70, 0xd38c82, 0x85849b, 0x676e88, 0x4a5b78, 0x344662, 0x806f83, 0x9a8290, 0x635d7f, 0x4c526f, 0x3d4967, 0x303f5d, 0x88684f, 0xb09586, 0xb57954, 0x504d69],
  night: [0x18263e, 0x4e4d68, 0x373f59, 0x2d3a53, 0x24334c, 0x1c2b43, 0x34435a, 0x414b61, 0x27394e, 0x223448, 0x1e3045, 0x192a40, 0x615047, 0x515267, 0x806044, 0x29374e],
}

const junk = parseSprite([
  '.......c.......',
  '......cc.......',
  '.....ccc.......',
  '....cccc.......',
  '...ccccc.......',
  '..cccccc.......',
  '.....c.........',
  '....c..........',
  '...c...........',
  'bbbbbbbbbbbbbbb',
  '.bbbbbbbbbbbbb.',
], { b: 14, c: 12 })

function drawSky(ctx: Parameters<SceneDef['build']>[0]): void {
  const { width: w, height: h } = ctx
  for (let y = 0; y < h; y++) {
    const t = y / h
    for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, t * 0.72, 0, 2, 8))
  }
  ctx.disc(w * 0.72, h * 0.285, h * 0.052, 1)
  // A narrow halo lifts the sun from the distant, mist-softened skyline.
  for (let y = Math.floor(h * 0.2); y < h * 0.39; y++) {
    for (let x = Math.floor(w * 0.61); x < w * 0.83; x++) {
      const d = Math.hypot((x - w * 0.72) / w, (y - h * 0.285) / h)
      if (d < 0.105 && ctx.fbm2(x * 0.08, y * 0.12) > 0.36) ctx.px(x, y, ctx.dither(x, y, 0.5, 0, 1))
    }
  }
}

const scene: SceneDef = {
  id: 'vn-halong',
  name: { en: 'Ha Long Bay', vi: 'Vịnh Hạ Long' },
  region: 'vn', tone: 'both', palettes, defaultTime: 'dawn', horizon: 0.68, focus: { x: 0.71, y: 0.57 },
  build(ctx) {
    const { width: w, height: h } = ctx
    drawSky(ctx)

    // Distant limestone fades into the horizon before the dark foreground towers.
    const layers = [
      { baseline: 0.58, height: 0.22, count: 11, radius: 0.085, shade: 2, seed: 17 },
      { baseline: 0.64, height: 0.3, count: 8, radius: 0.095, shade: 3, seed: 29 },
      { baseline: 0.7, height: 0.39, count: 7, radius: 0.105, shade: 4, seed: 41 },
    ]
    for (const layer of layers) {
      const towers = Array.from({ length: layer.count }, (_, i) => ({
        center: (i + 0.35 + ctx.rng() * 0.5) / layer.count,
        radius: layer.radius * (0.52 + ctx.rng() * 0.75),
        peak: layer.height * (0.5 + ctx.rng() * 0.48),
      }))
      for (let x = 0; x < w; x++) {
        const u = x / w
        let peak = 0
        let tower: (typeof towers)[number] | undefined
        for (const candidate of towers) {
          const value = karst(u, candidate.center, candidate.radius, candidate.peak)
          if (value > peak) { peak = value; tower = candidate }
        }
        const top = Math.max(0, Math.floor((layer.baseline - peak) * h))
        const baseY = Math.floor(layer.baseline * h)
        for (let y = top; y < baseY; y++) {
          const vertical = (baseY - y) / Math.max(1, baseY - top)
          const face = tower ? Math.abs((u - tower.center) / tower.radius) : 1
          const fissure = ctx.fbm2(x * 0.17 + layer.seed, y * 0.055)
          let color = layer.shade
          if (layer.shade === 2) color = fissure > 0.7 ? 3 : 2
          else if (face > 0.74 && fissure > 0.34) color = layer.shade + 1
          else if (face < 0.34 && fissure > 0.53) color = layer.shade + 2
          if (vertical < 0.09 && (x + layer.seed) % 5 === 0) color = layer.shade + 2
          ctx.px(x, y, color)
        }
      }
    }

    // Lacy mist bands separate the islands and soften their bases.
    for (let band = 0; band < 3; band++) {
      const center = h * (0.57 + band * 0.042)
      const thickness = Math.max(2, h * 0.022)
      for (let y = Math.floor(center - thickness); y < center + thickness; y++) {
        for (let x = 0; x < w; x++) {
          const haze = ctx.fbm2(x * 0.035 + band * 31, y * 0.04)
          const fade = 1 - Math.abs(y - center) / thickness
          if (haze < fade * 0.77) ctx.px(x, y, ctx.dither(x, y, 0.58, 1, 2))
        }
      }
    }

    // The bay reflects the sky and island silhouettes in broad, quiet bands.
    const waterline = Math.floor(h * 0.68)
    for (let y = waterline; y < h; y++) {
      const depth = (y - waterline) / Math.max(1, h - waterline)
      for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, 0.24 + depth * 0.18, 8, 9))
    }
    ctx.line(0, waterline, w - 1, waterline, 7)
    // Glints gather beneath the sunrise without breaking the calm horizon.
    for (let row = 0; row < 7; row++) {
      const y = waterline + 2 + row * Math.max(2, Math.floor(h * 0.025))
      const spread = 2 + row * Math.max(2, Math.floor(w * 0.008))
      const center = Math.floor(w * (0.72 + row * 0.002))
      for (let x = center - spread; x < center + spread; x++) {
        if ((x + row * 3) % 9 < 2) ctx.px(x, y, row < 3 ? 7 : 6)
      }
    }
  },
  frame(ctx, t) {
    const waterline = Math.floor(ctx.height * 0.68)
    reflectWater(ctx.base, ctx.frame, ctx.width, ctx.height, waterline, t * 0.34, 1)
    const boatX = Math.floor(ctx.width * 0.69 + Math.sin(t * 0.16) * ctx.width * 0.014)
    const bob = Math.round(Math.sin(t * 0.7))
    ctx.sprite(junk, boatX - Math.floor(junk.width / 2), waterline + Math.floor(ctx.height * 0.1) + bob, 2)
  },
}

export default scene
