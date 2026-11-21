import type { BuildCtx, SceneDef } from '../../engine/types'

/**
 * Reference: a clear winter night above Tromsø: a compact ribbon of green aurora
 * hangs over indigo fjord peaks, pinprick stars fill the cold sky, and the fjord
 * repeats the aurora as a broken jade path. The brightest light sits just left
 * of center; the mountain rim keeps the lower half quiet and legible.
 */
const palettes = {
  dawn: [0x43536f, 0x766b83, 0xa9868b, 0xd7a486, 0x53677c, 0x34465e, 0x26394f, 0x8bb49c, 0x6e9c9e, 0x5d7e8e, 0x6e8495, 0x35495e, 0xa5b5ae, 0x26384d],
  day: [0x7293ac, 0xa9bdc6, 0xd2d3c3, 0xe5c8a5, 0x8099a7, 0x627b8d, 0x4c667c, 0x84b99e, 0x73a9a8, 0x6595a1, 0x829fac, 0x4c6d80, 0xc0cec5, 0x40596d],
  dusk: [0x3b456a, 0x695779, 0xa16878, 0xd68e7e, 0x515d7b, 0x363f62, 0x28344f, 0x83b39a, 0x71999d, 0x5c748b, 0x718796, 0x374a65, 0xb2a9ae, 0x29374f],
  night: [0x101b36, 0x182746, 0x273552, 0x39465d, 0x25364f, 0x1a2b43, 0x12243b, 0x62bf94, 0x4ea887, 0x438a87, 0x536f83, 0x283c54, 0x94a89f, 0x192b43],
} as const

function paintAurora(ctx: BuildCtx, time: number): void {
  const { width: w, height: h } = ctx
  const bands = [
    { center: 0.34, span: 0.32, phase: 0.4, color: 7 },
    { center: 0.4, span: 0.28, phase: 2.1, color: 8 },
    { center: 0.31, span: 0.18, phase: 4.3, color: 9 },
  ]
  for (let x = Math.floor(w * 0.12); x < w * 0.9; x++) {
    const u = x / w
    for (const [bandIndex, band] of bands.entries()) {
      const left = 0.15 + bandIndex * 0.035
      const right = 0.88 - bandIndex * 0.04
      const edge = Math.sin(Math.PI * Math.max(0, Math.min(1, (u - left) / (right - left))))
      if (edge <= 0) continue
      const envelope = Math.sqrt(edge)
      const fold = Math.sin(u * 11 + band.phase + time * 0.11) * 0.035 + Math.sin(u * 23 + band.phase * 2 - time * 0.07) * 0.016
      const crest = h * (band.center - band.span * 0.55 + fold * envelope)
      const depth = h * (band.span + 0.035 * Math.sin(u * 8 + band.phase + time * 0.08)) * envelope
      const pleat = Math.sin(u * 58 + Math.sin(u * 9 + band.phase) * 2 + band.phase)
      const columnStrength = pleat * 0.65 + Math.sin(u * 27 - band.phase) * 0.25
      if (columnStrength < -0.42 + bandIndex * 0.1) continue
      for (let y = Math.max(1, Math.floor(crest)); y < Math.min(h * 0.58, crest + depth); y++) {
        const fade = (y - crest) / depth
        const strand = Math.sin(u * 46 + fade * 4 + band.phase) > -0.72 + fade * 0.3
        if (strand || columnStrength > 0.28) {
          const color = fade < 0.45 ? band.color : (band.color === 7 ? 8 : band.color)
          ctx.px(x, y, color)
        }
      }
    }
  }
}

const scene: SceneDef = {
  id: 'world-tromso',
  name: { en: 'Tromsø Aurora', vi: 'Cực quang Tromsø' },
  region: 'world', tone: 'dark', defaultTime: 'night', horizon: 0.61, focus: { x: 0.43, y: 0.39 },
  palettes,
  build(ctx) {
    const { width: w, height: h } = ctx
    for (let y = 0; y < h; y++) {
      const v = y / h
      for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, v * 0.9, 0, 2, 8))
    }
    // A soft, distant ridge leaves a notch of sky beneath the aurora.
    const far = ctx.ridge({ height: 0.56, amplitude: 0.09, frequency: 2.5, octaves: 4 })
    for (let x = 0; x < w; x++) {
      const top = Math.floor((far[x]! - 0.12 * (1 - Math.abs(x / w - 0.48))) * h)
      ctx.rect(x, top, 1, h - top, 4)
    }
    const near = ctx.ridge({ height: 0.65, amplitude: 0.11, frequency: 1.6, octaves: 4 })
    for (let x = 0; x < w; x++) {
      const u = x / w
      const shoulder = Math.max(0, 0.16 - Math.abs(u - 0.1) * 0.6) + Math.max(0, 0.17 - Math.abs(u - 0.92) * 0.62)
      const top = Math.floor((near[x]! - shoulder) * h)
      ctx.rect(x, top, 1, h - top, 5)
      if (x % 13 === 0) ctx.px(x, top, 12)
    }
    for (let i = 0; i < Math.max(28, Math.floor(w * h / 370)); i++) {
      const x = Math.floor(ctx.rng() * w)
      const y = Math.floor(ctx.rng() * h * 0.43)
      if (ctx.base[y * w + x]! < 4) ctx.px(x, y, i % 7 === 0 ? 3 : 12)
    }
    paintAurora(ctx, 0)
    const waterline = Math.floor(h * 0.68)
    for (let y = waterline; y < h; y++) {
      const v = (y - waterline) / (h - waterline)
      for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, v * 0.58, 10, 11))
    }
    // Distant shore lights provide scale without competing with the sky.
    for (let i = 0; i < 9; i++) ctx.px(Math.floor(w * (0.08 + i * 0.105)), Math.floor(h * (0.66 + (i % 3) * 0.008)), i % 3 === 0 ? 3 : 12)
  },
  frame(ctx, t) {
    const waterline = Math.floor(ctx.height * 0.68)
    const { width: w, height: h } = ctx
    for (let y = waterline; y < h; y++) {
      const v = (y - waterline) / (h - waterline)
      for (let x = 0; x < w; x++) {
        const u = x / w
        const distance = Math.abs(u - (0.43 + Math.sin(y * 0.08 + t * 0.08) * 0.012))
        const reflection = distance < 0.018 + v * 0.095
        const ripple = Math.sin(x * 0.37 + y * 1.3 + t * 0.45) > 0.18 + v * 0.55
        if (reflection && ripple) ctx.px(x, y, v < 0.52 ? 24 : 25)
        else if (Math.sin(x * 0.12 + y * 0.9 + t * 0.35) > 0.985 && y % 3 === 0) ctx.px(x, y, 26)
      }
    }
  },
}

export default scene
