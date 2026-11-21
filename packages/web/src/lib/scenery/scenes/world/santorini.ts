import { parseSprite } from '../../engine/sprite'
import type { BuildCtx, SceneDef } from '../../engine/types'

/**
 * Reference: Oia at dusk, viewed across the caldera: a warm peach sky and a
 * thin Aegean horizon behind stepped whitewashed houses, cobalt domes and a
 * steep russet cliff descending into blue water. The cluster of domes anchors
 * the upper third while the broad sea balances the intricate town.
 */
const palettes = {
  dawn: [0x6386a4, 0xa6b4bc, 0xe5b59c, 0xf0d2ad, 0x826e78, 0x586778, 0x477f9a, 0xd9c8ae, 0xb9ab9d, 0x466f91, 0x6f9bb2, 0x3c566e, 0xb6a998, 0x394f65],
  day: [0x78a9c1, 0xb5cfce, 0xd7d9c7, 0xf0dec1, 0x857b78, 0x697b7e, 0x3b91b1, 0xf1e7d0, 0xc9c5b8, 0x22658c, 0x4986a0, 0x426575, 0xa9aaa3, 0x354f62],
  dusk: [0x615d80, 0x9c7189, 0xd28c87, 0xeab596, 0x815c6a, 0x5a566d, 0x337f9d, 0xf0d5b7, 0xc6b4a4, 0x285d82, 0x507c94, 0x405369, 0xb9978a, 0x38475c],
  night: [0x182b4e, 0x304362, 0x62546f, 0x9b6978, 0x3d4059, 0x293b55, 0x1e5479, 0xc9c3b8, 0x898a91, 0x315b83, 0x476b89, 0x263b54, 0x9c827a, 0x202f48],
} as const

const domeHouse = parseSprite([
  '....bbb....',
  '...bbabb...',
  '..bbababb..',
  '..baaaabb..',
  '.aaaaaaaaa.',
  '.aaccaccaa.',
  'aaaaaaaaaaa',
  'aabaaaaaaba',
  'aabaaaaaaba',
  'aaaaaaaaaaa',
  '.aaaaaaaaa.',
], { a: 7, b: 9, c: 11 })

const smallDome = parseSprite([
  '...bbb...',
  '..bbabb..',
  '.bbaaabb.',
  '.aaaaaaa.',
  'aacaaacaa',
  'aaaaaaaaa',
  '.aaaaaaa.',
], { a: 7, b: 9, c: 11 })

function drawSea(ctx: BuildCtx, t: number): void {
  const { width: w, height: h } = ctx
  const horizon = Math.floor(h * 0.62)
  for (let y = horizon; y < h; y++) {
    const v = (y - horizon) / (h - horizon)
    for (let x = 0; x < w; x++) {
      const shimmer = Math.sin(x * 0.31 + y * 0.7 + t * 0.42)
      if (shimmer > 0.92 && (y + Math.floor(x / 9)) % 4 === 0) ctx.px(x, y, 10)
    }
  }
}

const scene: SceneDef = {
  id: 'world-santorini',
  name: { en: 'Santorini at Dusk', vi: 'Santorini hoàng hôn' },
  region: 'world', tone: 'both', defaultTime: 'dusk', horizon: 0.62, focus: { x: 0.57, y: 0.48 },
  palettes,
  build(ctx) {
    const { width: w, height: h } = ctx
    for (let y = 0; y < h; y++) {
      const v = y / h
      for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, v, 0, 3, 8))
    }
    // Caldera islands recede into the atmospheric horizon before the sea.
    for (let x = 0; x < w; x++) {
      const distant = Math.floor(h * (0.55 + ctx.fbm1(x / w * 3) * 0.018))
      ctx.rect(x, distant, 1, Math.max(0, h * 0.62 - distant), 4)
    }
    const waterline = Math.floor(h * 0.62)
    for (let y = waterline; y < h; y++) {
      const v = (y - waterline) / (h - waterline)
      for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, v * 0.55, 6, 5, 8))
    }
    // Far town silhouette and terraced cliff are built before the bright houses.
    const cliffRidge = ctx.ridge({ height: 0.52, amplitude: 0.055, frequency: 2.1, octaves: 4 })
    const footRidge = ctx.ridge({ height: 0.82, amplitude: 0.07, frequency: 1.8, octaves: 3 })
    for (let x = 0; x < w; x++) {
      const u = x / w
      const cliffTop = Math.floor(h * (cliffRidge[x]! + 0.022 * Math.sin(u * 5) + 0.012 * Math.sin(u * 17)))
      if (u > 0.12 && u < 0.9) {
        const cliffFoot = Math.floor(h * (footRidge[x]! - u * 0.035))
        const slope = Math.floor(cliffTop + h * 0.1 * (u < 0.4 ? 1 : 0.45))
        ctx.rect(x, slope, 1, cliffFoot - slope, 4)
        ctx.rect(x, slope, 1, h * 0.018, 12)
        ctx.rect(x, cliffFoot, 1, h - cliffFoot, 6)
      }
    }
    // White buildings step down the caldera rim; blue roofs make the island read instantly.
    const scale = Math.max(1, Math.floor(Math.min(w / 110, h / 78)))
    const houses = [
      [0.19, 0.43, 0], [0.34, 0.4, 1], [0.47, 0.39, 0], [0.59, 0.36, 1], [0.72, 0.4, 0],
      [0.27, 0.51, 1], [0.42, 0.49, 0], [0.57, 0.47, 1], [0.72, 0.5, 0],
    ] as const
    for (const [u, v, alternate] of houses) ctx.sprite(alternate ? smallDome : domeHouse, Math.floor(w * u), Math.floor(h * v), scale)
    // A few terrace walls and warm windows add the characteristic dense cliff town.
    for (let row = 0; row < 3; row++) {
      const y = Math.floor(h * (0.54 + row * 0.028))
      const start = Math.floor(w * (0.17 + row * 0.04))
      const end = Math.floor(w * (0.89 - row * 0.03))
      for (let x = start; x < end; x++) {
        if ((x + row * 5) % 17 < 11) ctx.px(x, y, 7)
        if ((x * 3 + row) % 29 === 0) ctx.px(x, y - 1, 11)
      }
    }
    drawSea(ctx, 0)
  },
  frame(ctx, t) {
    drawSea(ctx, t)
  },
}

export default scene
