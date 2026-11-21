/** Reference: a dawn view from Stellisee: rose-gold light from upper left,
 * an asymmetric ivory Matterhorn at the right third, blue lake and ink-blue pines. */
import type { BuildCtx, SceneDef } from '../../engine/types'

function pine(ctx: BuildCtx, x: number, y: number, size: number) {
  ctx.rect(x - 1, y - size, 2, size, 14)
  for (let j = 0; j < size; j++) {
    const spread = (j / size) * size * 0.3 * (0.7 + (j % 5) / 12)
    ctx.line(x - spread, y - size + j, x + spread, y - size + j, 13)
  }
}

const scene: SceneDef = {
  id: 'world-matterhorn', name: { en: 'Matterhorn', vi: 'Đỉnh Matterhorn' },
  region: 'world', tone: 'both', defaultTime: 'dawn', horizon: 0.65, focus: { x: 0.64, y: 0.28 },
  palettes: {
    dawn: [0x565e87, 0xa18da6, 0xe6b9a8, 0xf0d6ae, 0x9b9aaf, 0x777f9a, 0x536581, 0x354c6b, 0xc4c8d0, 0x8c9bb8, 0x516b87, 0xc7a9a4, 0x3b5066, 0x253f50, 0x203448, 0xe8c4ac],
    day: [0x5989b1, 0x90b7cd, 0xc3d5db, 0xe7ddbb, 0x98afbe, 0x7795ab, 0x57758e, 0x385a73, 0xe0e4df, 0xa5bbce, 0x4c8598, 0xb2c9ce, 0x3d6369, 0x254e50, 0x203d46, 0xefe1c6],
    dusk: [0x4a496e, 0x95829d, 0xd29c96, 0xe9c09c, 0x918da8, 0x706c90, 0x535878, 0x383f5f, 0xc4b6ca, 0x9293b2, 0x52627d, 0xb39da8, 0x3e485e, 0x293747, 0x242f40, 0xe5b4a1],
    night: [0x192c48, 0x304462, 0x53627c, 0xa2b6c3, 0x566580, 0x435671, 0x354962, 0x263b53, 0x95a7bd, 0x647e9d, 0x304d67, 0x71849b, 0x293e51, 0x1e3242, 0x192a3c, 0xb6c5ce],
  },
  build(ctx) {
    const { width: w, height: h } = ctx
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const band = Math.min(1.99, y / h / 0.5 * 2)
      ctx.px(x, y, ctx.dither(x, y, band % 1, Math.floor(band), Math.floor(band) + 1))
    }
    ctx.disc(w * 0.3, h * 0.28, Math.min(w, h) * 0.035, 3)
    for (let layer = 0; layer < 3; layer++) {
      for (let x = 0; x < w; x++) {
        const u = x / w
        const top = 0.53 + layer * 0.035 + Math.sin(u * 15 + layer * 2) * 0.035 + ctx.fbm1(u * 220 + layer * 71) * 0.05
        ctx.rect(x, top * h, 1, h * 0.2, 4 + layer)
      }
    }
    // The bent summit and split snow faces distinguish Matterhorn from a symmetric cone.
    const outline = [[0.17, 0.65], [0.38, 0.51], [0.49, 0.4], [0.59, 0.21], [0.64, 0.19], [0.72, 0.42], [0.87, 0.57], [1, 0.65]]
    for (let x = 0; x < w; x++) {
      const u = x / w
      let segment = 0
      while (segment < outline.length - 2 && u > outline[segment + 1]![0]!) segment++
      const a = outline[segment]!, b = outline[segment + 1]!
      if (u < a[0]!) continue
      const top = a[1]! + (b[1]! - a[1]!) * (u - a[0]!) / (b[0]! - a[0]!)
      for (let y = Math.floor(top * h); y < h * 0.65; y++) {
        const v = y / h, n = ctx.fbm2(x * 1.6, y * 2)
        const spine = 0.635 - (v - 0.2) * 0.22
        const snow = v < 0.39 + n * 0.095 + Math.sin(u * 51) * 0.025 || (u < spine && v < 0.50 + n * 0.05 + Math.sin(u * 35) * 0.025)
        const scree = v > 0.3 && Math.sin((u - spine) / (v - 0.15) * 19 + n * 6) > 0.91
        const seam = Math.abs(u - spine - (v - 0.22) * 0.18 - Math.sin(v * 28) * 0.008) < 0.008 || (v > 0.38 && Math.abs(u - spine - (v - 0.25) * 0.65) < 0.007)
        ctx.px(x, y, snow ? (u < spine ? (seam || scree ? 8 : 15) : (seam || scree ? 6 : 9)) : (u < spine ? (seam ? 6 : 8) : (seam ? 7 : 6)))
      }
      if (u > 0.38 && u < 0.64) ctx.px(x, top * h, 15)
    }
    ctx.rect(0, h * 0.65, w, h, 10)
    for (let x = 0; x < w; x++) {
      const u = x / w
      const shore = 0.89 + Math.sin(u * 7) * 0.025 - Math.pow(Math.abs(u - 0.5) * 2, 4) * 0.22
      ctx.rect(x, shore * h, 1, h, 12)
      ctx.rect(x, (shore + 0.025) * h, 1, h, 14)
    }
    for (let i = 0; i < 26; i++) {
      const left = i < 14
      const x = (left ? ctx.rng() * 0.22 : 0.86 + ctx.rng() * 0.14) * w
      pine(ctx, x, h * (0.77 + ctx.rng() * 0.18), h * (0.09 + ctx.rng() * 0.15))
    }
    for (let i = 0; i < w / 5; i++) {
      const x = ctx.rng() * w, y = h * (0.94 + ctx.rng() * 0.06)
      ctx.line(x, y, x + 3, y - 1, 12)
    }
  },
  frame(ctx, t) {
    const { width: w, height: h, base, frame } = ctx
    const edge = Math.floor(h * 0.65)
    for (let y = edge; y < h; y++) {
      const offset = Math.round(Math.sin(y * 0.55 + t * 0.45) * (1 + (y / h - 0.65) * 5))
      const sourceY = Math.max(0, edge - 1 - (y - edge))
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (base[i] !== 10) continue
        const sx = Math.max(0, Math.min(w - 1, x + offset))
        frame[i] = (base[sourceY * w + sx]! & 15) + 16
        // Sparse horizontal glints cycle slowly, including a composed static frame.
        if (y % 5 === 0 && (x + y * 7) % 43 < 5) frame[i] = 10 + Math.floor((Math.sin(t * 0.2 + y) + 1) * 0.5)
      }
    }
  },
}
export default scene
