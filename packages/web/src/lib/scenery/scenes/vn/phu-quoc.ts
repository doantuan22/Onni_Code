/**
 * Hand-drawn V2 reference: a west-facing Phú Quốc beach at last light.
 * Two rim-lit palms frame a quiet sea, a boat, and an asymmetric S-curve shore.
 */
import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { BuildCtx, Palettes, SceneDef } from '../../engine/types'

const enum Ink {
  SkyTop, SkyMid, SkyLow, Cloud, Sun, Halo, IslandFar, IslandNear,
  SeaDeep, SeaMid, SeaLight, Wave0, Wave1, Wave2, Wave3, Wave4, Wave5,
  Path0, Path1, Path2, SandDark, Sand, Foam, Rock, PalmShadow, Palm, PalmRim,
  BoatHull, BoatSail, Wake, Moon, Accent,
}

const palette = (sky: readonly number[], sea: readonly number[], sand: readonly number[], palm: readonly number[], boat: readonly number[]): readonly number[] => [
  ...sky, 0x72898c, 0x48686b, ...sea, 0x3d7280, 0x57909a, 0x78adb0, 0xa3c6bb, 0xc8d7bd, 0xf0d7ad,
  0xc0846c, 0xd8ae85, 0xe9caa0, ...sand, ...palm, boat[0]!, boat[1]!, 0xdac39a, 0xb6c8cc, 0xe8b57d, 0x493c42,
]
const light: Palettes = {
  dawn: palette([0xa9cdd2, 0xc6d4c6, 0xf1c7a0, 0xd8d2ba, 0xf4d8a2, 0xf8e8c7], [0x2e707d, 0x438c96, 0x75aeb0], [0x8c7967, 0xad9771, 0xe6d3a8], [0x263f3d, 0x385b50, 0x9eb07b], [0x714b3e, 0x986b4d]),
  day: palette([0x72b4ca, 0xa8cfce, 0xd7dfbf, 0xd4decf, 0xf4df9c, 0xf8e8bf], [0x226b79, 0x3d93a0, 0x75bdba], [0x8b806a, 0xb9a77b, 0xe8d7a6], [0x244441, 0x396b5d, 0x9ab07a], [0x664839, 0x946a48]),
  dusk: palette([0x5d4f72, 0x9a6475, 0xdb926c, 0xb98a7a, 0xf0b277, 0xf4d39a], [0x263e55, 0x394b63, 0x607687], [0x544a54, 0x64515a, 0xb99479], [0x1d343d, 0x273d42, 0x7d8363], [0x794a3d, 0xc08a66]),
  night: palette([0x142843, 0x283c58, 0x4a6279, 0x40536c, 0xb8cddd, 0xd4d5bf], [0x183c57, 0x285b70, 0x4d8190], [0x454653, 0x675b60, 0xa88d78], [0x172c36, 0x25404a, 0x718474], [0x60413c, 0x99745d]),
}
const dark: Palettes = {
  dawn: palette([0x4a6170, 0x829194, 0xc89678, 0xa79083, 0xe9bd85, 0xf2d6a5], [0x1d5261, 0x347782, 0x62979d], [0x6f635c, 0x917d66, 0xd0b88d], [0x1d3537, 0x31564e, 0x89996b], [0x654239, 0x8d6049]),
  day: palette([0x345f76, 0x679ca8, 0xaec6b5, 0xa7c1b7, 0xdccf8c, 0xe9dbae], [0x174e60, 0x2c7886, 0x589ca0], [0x6d685c, 0x958761, 0xd5c28f], [0x19383b, 0x2d5d54, 0x84976a], [0x593d37, 0x865c42]),
  dusk: palette([0x39314f, 0x874f63, 0xdb926c, 0x956b70, 0xe9a672, 0xf0c68e], [0x20364e, 0x394b63, 0x637384], [0x4a414d, 0x64515a, 0xb99479], [0x172d36, 0x273d42, 0x778168], [0x6b423e, 0xc08a66]),
  night: palette([0x0c1b30, 0x1d304a, 0x394e67, 0x30455e, 0x91a9b6, 0xb9c3b6], [0x102e48, 0x204b63, 0x3e7180], [0x393d4b, 0x5a525a, 0x937e71], [0x10252e, 0x203b46, 0x617667], [0x503a3b, 0x896850]),
}

const boatSheet = createSpriteSheet(parseSprite([
  '...........bb...........',
  '..........bbbb..........',
  '.........bbbbbb.........',
  '........bbbbbbbb........',
  '.......bbbbbbbbbb.......',
  '..........bb............',
  '..........bb............',
  '......aaaaaaaaaaaa......',
  '.....aaaaaaaaaaaaaa.....',
  '....cccccccccccccccc....',
  '.....cccccccccccccc.....',
  '.........cccccc.........',
  '........................',
  '........................',
  '...........bb...........',
  '..........bbbb..........',
  '.........bbbbbb.........',
  '........bbbbbbbb........',
  '.......bbbbbbbbbb.......',
  '.........bbb............',
  '.........bbb............',
  '......aaaaaaaaaaaa......',
  '.....aaaaaaaaaaaaaa.....',
  '....cccccccccccccccc....',
  '.....cccccccccccccc.....',
  '.........cccccc.........',
  '........................',
  '........................',
], { a: Ink.BoatHull, b: Ink.BoatSail, c: Ink.Wake }), [
  { x: 0, y: 0, width: 24, height: 14, pivot: { x: 12, y: 11 } },
  { x: 0, y: 14, width: 24, height: 14, pivot: { x: 12, y: 11 } },
])

function sky(ctx: BuildCtx, line: number): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'sky', z: 0 }, () => {
    for (let y = 0; y < line; y++) {
      const boundaries = [line / 3, line * 2 / 3]
      const boundary = boundaries.findIndex((value) => Math.abs(y - value) <= 10)
      if (boundary >= 0) {
        const center = boundaries[boundary]!
        const amount = Math.max(0, Math.min(1, (y - (center - 10)) / 20))
        for (let x = 0; x < w; x++) ctx.px(x, y, ctx.dither(x, y, amount, boundary, boundary + 1))
      } else {
        ctx.rect(0, y, w, 1, y < boundaries[0]! ? 0 : y < boundaries[1]! ? 1 : 2)
      }
    }
    ctx.disc(w * 0.76, h * 0.37, Math.min(w, h) * 0.065, Ink.Sun)
    for (let x = w * 0.49; x < w * 0.93; x += 17) ctx.line(x, h * (0.25 + ((x / 17) & 1) * 0.02), x + 12, h * (0.25 + ((x / 17) & 1) * 0.02), Ink.Cloud)
  })
}

function water(ctx: BuildCtx, line: number): void {
  const { width: w, height: h } = ctx
  ctx.layer({ kind: 'water', z: 3 }, () => {
    for (let y = line; y < h; y++) {
      const d = (y - line) / (h - line)
      ctx.rect(0, y, w, 1, ctx.dither(0, y, d * 0.7, Ink.SeaDeep, Ink.SeaMid))
      for (let x = (y * 3) % 27; x < w; x += 29 - Math.floor(d * 7)) if (ctx.fbm2(x * .13, y) > .62) ctx.line(x, y, x + 3 + d * 7, y, Ink.Wave0 + ((x + y) % 6))
      const row = Math.floor(d * 10)
      if (row % 2 === 0) {
        const center = w * (.76 + (row % 3 - 1) * .01)
        const spread = 5 + d * 48
        for (let part = 0; part < 3; part++) {
          if ((row + part) % 3 === 1) continue
          const start = center + (part - 1) * spread * .44 + ((row + part) & 1) * 3
          ctx.line(start, y, start + 3 + d * 11 - part, y, Ink.SeaLight)
        }
      }
    }
  })
}

function palm(ctx: BuildCtx, footX: number, footY: number, height: number, lean: number, radius: number): void {
  const crownX = footX + lean
  const crownY = footY - height
  for (let y = crownY; y < footY; y++) {
    const t = (y - crownY) / height
    const x = crownX - lean * t * t
    const wide = Math.max(2, radius * (.055 + t * .04))
    ctx.rect(x - wide / 2, y, wide, 1, Ink.PalmShadow)
    if (y % 4 !== 0) ctx.rect(x, y, Math.max(1, wide / 2), 1, Ink.Palm)
    if (y % 7 === 0) ctx.px(x + wide / 2, y, Ink.PalmRim)
  }
  for (let arm = 0; arm < 10; arm++) {
    const angle = -2.95 + arm * .59
    const length = radius * (.74 + (arm % 4) * .10)
    const bendX = crownX + Math.cos(angle) * length * .56
    const bendY = crownY + Math.sin(angle) * length * .40
    const endX = crownX + Math.cos(angle) * length
    const endY = crownY + Math.sin(angle) * length * .58
    const thickness = arm % 3 === 0 ? 3 : 2
    ctx.polygon([
      { x: crownX - 1, y: crownY + 1 },
      { x: bendX - thickness, y: bendY + thickness },
      { x: endX - 1, y: endY + 2 },
      { x: endX + 2, y: endY - 1 },
      { x: bendX + thickness, y: bendY - thickness },
      { x: crownX + 1, y: crownY - 1 },
    ], Ink.PalmShadow)
    ctx.line(crownX + 1, crownY, endX, endY + 1, arm > 4 ? Ink.PalmRim : Ink.Palm)
    if (arm % 2 === 0) ctx.line(bendX, bendY + 1, endX - 2, endY + 3, Ink.Palm)
  }
}

function palmSway(ctx: BuildCtx, footX: number, footY: number, height: number, lean: number, radius: number, sway: number): void {
  const crownX = footX + lean
  const crownY = footY - height
  for (const arm of [1, 4, 7] as const) {
    const angle = -2.95 + arm * .59
    const length = radius * (.74 + (arm % 4) * .10)
    const endX = crownX + Math.cos(angle) * length + sway
    const endY = crownY + Math.sin(angle) * length * .58
    ctx.line(crownX, crownY, endX, endY, arm > 4 ? Ink.PalmRim : Ink.Palm)
  }
}

const scene: SceneDef = {
  id: 'vn-phu-quoc', name: { vi: 'Phú Quốc hoàng hôn', en: 'Phú Quốc Sunset' }, region: 'vn', tone: 'both',
  defaultTime: 'dusk', themePalettes: { light, dark }, themeDefaultTime: { light: 'dawn', dark: 'dusk' }, palettes: light,
  cycles: [{ indices: [Ink.Wave0, Ink.Wave1, Ink.Wave2, Ink.Wave3, Ink.Wave4, Ink.Wave5], rate: 6 }],
  horizon: .57, focus: { x: .72, y: .65 },
  build(ctx) {
    const { width: w, height: h } = ctx
    const line = Math.floor(h * .57)
    sky(ctx, line)
    ctx.layer({ kind: 'far', z: 1 }, () => {
      for (let x = 0; x < w * .50; x++) {
        const u = x / w
        const farTop = h * (.555 - Math.sin(u * 6.5) * .018 - ctx.fbm2(x * .07, 33) * .018)
        const nearTop = h * (.54 - Math.sin(u * 7.7 + .5) * .026 - ctx.fbm2(x * .09, 63) * .025)
        ctx.rect(x, farTop, 1, line - farTop, Ink.IslandFar)
        if (x > w * .10) ctx.rect(x, nearTop, 1, line - nearTop, Ink.IslandNear)
      }
    })
    water(ctx, line)
    ctx.layer({ kind: 'near', z: 5 }, () => {
      for (let x = 0; x < w; x++) {
        const u = x / w
        const shore = h * (.73 + u * .50 - u * u * .31) + (ctx.fbm2(x * .11, 70) - .5) * 4
        ctx.rect(x, shore, 1, h - shore, Ink.Sand)
        if (ctx.fbm2(x * .14, 90) > .48) ctx.line(x, shore, x + 2 + (x % 3), shore, Ink.Foam)
        if (u < .52 && shore < h * .92 && ctx.fbm2(x * .19, 17) > .54) ctx.line(x, shore + 4, x + 3, shore + 4, Ink.SandDark)
      }
      for (const [x, y, size] of [[.43, .84, 3], [.49, .88, 2], [.56, .91, 4], [.62, .94, 2]] as const) {
        ctx.disc(w * x, h * y, size, Ink.Rock)
      }
      palm(ctx, w * .09, h * 1.02, h * .64, w * .16, Math.min(w, h) * .17)
      palm(ctx, w * .25, h * 1.04, h * .49, w * .045, Math.min(w, h) * .13)
    })
  },
  frame(ctx, t) {
    const { width: w, height: h } = ctx
    ctx.layer({ kind: 'fx', z: 4 }, () => {
      const boatY = h * .70 + Math.round(Math.sin(t * Math.PI * 2 / 7))
      ctx.spriteFrame(boatSheet, Math.floor(t * 2), w * .72, boatY, Math.max(1, Math.floor(w / 480)))
      for (let i = 0; i < 3; i++) ctx.line(w * .72 - 16 - i * 4, boatY + i + 2, w * .72 - 9 - i * 3, boatY + i + 2, Ink.Wake)
    })
    // Foam pulses locally along the shore; frond tips sway without moving their trunks.
    ctx.layer({ kind: 'fx', z: 7 }, () => {
      const shift = Math.round(Math.sin(t * Math.PI / 4) * 2)
      for (let i = 0; i < 12; i++) {
        const x = w * (.09 + i * .044)
        const y = h * (.77 + i * .015)
        if (i % 3 !== 1) ctx.line(x + shift, y, x + 4 + shift, y, Ink.Foam)
      }
      const sway = Math.round(Math.sin(t * Math.PI / 6) * 2)
      palmSway(ctx, w * .09, h * 1.02, h * .64, w * .16, Math.min(w, h) * .17, sway)
      palmSway(ctx, w * .25, h * 1.04, h * .49, w * .045, Math.min(w, h) * .13, -sway)
    })
  },
}

export default scene
