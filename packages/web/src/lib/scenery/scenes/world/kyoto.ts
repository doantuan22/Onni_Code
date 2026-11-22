import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { BuildCtx, FrameCtx, LayerSpec, Palettes, SceneDef, ThemePalettes } from '../../engine/types'

/**
 * Reference (§3.8): Fushimi Inari torii path at dusk: a ceremonial tunnel of vermilion
 * torii gates receding towards a vanishing point in the mountain forest.
 * Warm stone lanterns flicker beside moss-covered flagstones; a leafy Japanese maple
 * branch sways overhead as autumn leaves flutter softly through the mountain mist.
 *
 * 32 Palette Roles:
 * 0..3:   Sky slit through cedar canopy (forest canopy opening gradient)
 * 4..7:   Far Kitayama cedar / bamboo forest (shadow trunk, deep foliage, mid green, accent)
 * 8..11:  Stone path & flagstones (shadow joint, damp flagstone, path surface, lit stone edge)
 * 12..14: Forest moss & ground cover (deep moss, vibrant moss cushion, lichen edge)
 * 15..18: Torii gate vermilion ramp (maroon shadow, body vermilion, orange-red, rim highlight)
 * 19..20: Torii black accents (black cuff/cap shadow, bronze/specular rim)
 * 21..24: Stone lantern (ishidōrō) & warm light (dark stone, lit stone, flame core, halo glow)
 * 25..27: Maple (momiji) leaves on branches (autumn russet, vivid crimson, golden leaf tip)
 * 28..29: Falling autumn leaves (mid orange-red leaf, bright amber leaf)
 * 30..31: Distant path mist (soft mist shadow, ethereal mist light)
 */

export const kyotoThemePalettes: ThemePalettes = {
  light: {
    dawn: [
      0xb6c8c0, 0xc7d6cf, 0xd8e4de, 0xe8f0ec,
      0x384e46, 0x546e64, 0x78938a, 0x8ea89e,
      0x54524c, 0x706e68, 0x8a8880, 0xb2b0a6,
      0x324830, 0x526c50, 0x74926c,
      0x713f3b, 0xb85e46, 0xd47854, 0xe3a270,
      0x241a18, 0x5c4a46,
      0x585650, 0x989488, 0xf4d898, 0xd8b981,
      0x8a3832, 0xb8523c, 0xc19155,
      0xc46442, 0xdba062,
      0xa2b6ac, 0xc8dcd2,
    ],
    day: [
      0xc4dcd6, 0xd4eae4, 0xe2f4ee, 0xf0faf6,
      0x2e463e, 0x446056, 0x607e74, 0x76988c,
      0x5c5a54, 0x787670, 0x96948a, 0xbebcb2,
      0x385236, 0x587854, 0x7ca074,
      0x823e38, 0xc65e44, 0xe47c58, 0xf09e74,
      0x281e1a, 0x64524c,
      0x605e58, 0xa09c90, 0xfae0a4, 0xe0c890,
      0x963c34, 0xc6543c, 0xcca260,
      0xd06844, 0xe4aa6a,
      0xb0c6bc, 0xd4e8de,
    ],
    dusk: [
      0x687482, 0x8a8892, 0xb89ca0, 0xe0b4a4,
      0x28363a, 0x3c4c50, 0x566668, 0x707e7e,
      0x404044, 0x58585e, 0x74747a, 0x9c9a9e,
      0x2a382c, 0x425444, 0x5e725e,
      0x5c3036, 0x9c4c44, 0xbe6652, 0xd8886a,
      0x1e1818, 0x4c3e40,
      0x484646, 0x807a72, 0xf4c078, 0xd8985c,
      0x783030, 0xa84438, 0xb87448,
      0xb25642, 0xcc8054,
      0x848490, 0xb2a8b0,
    ],
    night: [
      0x162030, 0x202c40, 0x2c3850, 0x384660,
      0x162224, 0x203032, 0x2e4042, 0x3c5252,
      0x2a2c34, 0x3a3e46, 0x4e525c, 0x6c707c,
      0x1c2820, 0x2c3c30, 0x3c5040,
      0x3c1e24, 0x6e2e28, 0x944234, 0xb45a46,
      0x120e10, 0x342a2c,
      0x323034, 0x646060, 0xf8c864, 0xcca044,
      0x582024, 0x7e2e28, 0x9c4c34,
      0x8c382a, 0xaa5238,
      0x303848, 0x4c586c,
    ],
  },
  dark: {
    dawn: [
      0x3c4e56, 0x586c72, 0x788c8e, 0x9cb0ad,
      0x243430, 0x344842, 0x4c625a, 0x627a70,
      0x383632, 0x4e4c48, 0x666460, 0x888680,
      0x223222, 0x364a36, 0x4e644e,
      0x5c2e2c, 0x9c4838, 0xb86246, 0xcf8660,
      0x181210, 0x423632,
      0x403e3a, 0x706c62, 0xe8be70, 0xc49a56,
      0x722824, 0x9a3c30, 0xa86c40,
      0x9e4834, 0xba784a,
      0x546666, 0x788e8e,
    ],
    day: [
      0x466066, 0x5e7c82, 0x7a9c9e, 0x96b8b8,
      0x1e302c, 0x2c443e, 0x3e5c54, 0x527468,
      0x3c3c38, 0x52524e, 0x6c6a66, 0x8e8c86,
      0x243826, 0x3a543c, 0x527254,
      0x642e2a, 0xaa4a38, 0xc66446, 0xdc8660,
      0x1a1210, 0x463832,
      0x44423e, 0x78746a, 0xf0c878, 0xcaa05a,
      0x782a24, 0xa43e30, 0xae7042,
      0xa84a34, 0xc27c4c,
      0x586e70, 0x7e989a,
    ],
    dusk: [
      0x1c2838, 0x27384b, 0x3c4e5c, 0x5a646c,
      0x182428, 0x243438, 0x374e52, 0x486264,
      0x2a2a30, 0x3a3c42, 0x4b5059, 0x6c727c,
      0x1c2822, 0x263a32, 0x344c43,
      0x482e3a, 0x924b43, 0xb2604e, 0xc67c58,
      0x141014, 0x382a30,
      0x363438, 0x6a6460, 0xf0be68, 0xe1b573,
      0x602228, 0x8c342c, 0xa97959,
      0x944234, 0xb46a48,
      0x34404c, 0x52606e,
    ],
    night: [
      0x0f1826, 0x162032, 0x202c40, 0x2c3850,
      0x10181c, 0x182428, 0x223236, 0x2e4044,
      0x1e2026, 0x2b2d35, 0x3c3f4a, 0x545866,
      0x141e18, 0x1c2c22, 0x263a2e,
      0x321a22, 0x622822, 0x84382c, 0x9e4a38,
      0x0c0a0c, 0x281e22,
      0x28262a, 0x524e4c, 0xeeb050, 0xbe8e40,
      0x48181c, 0x6c2420, 0x8a3a28,
      0x742e22, 0x924830,
      0x242c38, 0x3c4858,
    ],
  },
}

export const kyotoPalettes: Palettes = kyotoThemePalettes.dark

const layers: readonly LayerSpec[] = [
  { kind: 'sky', z: 0 },
  { kind: 'far', z: 1 },
  { kind: 'fog', z: 2 },
  { kind: 'mid', z: 3 },
  { kind: 'near', z: 4 },
  { kind: 'fx', z: 5 },
]

// Animated swaying Japanese maple branch (24×16 pixels, 3 poses at 2 fps)
const branchSheetRaw = parseSprite([
  '....bbbb................' + '....bbbb................' + '....bbbb................',
  '...bbbaaab..............' + '...bbbaaab..............' + '...bbbaaab..............',
  '..baaaccaaa.............' + '..baaaccaaa.............' + '..baaaccaaa.............',
  '.baaccccaaaa............' + '.baaccccaaaa............' + '.baaccccaaaa............',
  '..bbaccaaaaa............' + '..bbaccaaaaa............' + '..bbaccaaaaa............',
  '....baaaaaaa............' + '....baaaaaaa............' + '....baaaaaaa............',
  '.....baaaaaaa...........' + '.....baaaaaaa...........' + '.....baaaaaaa...........',
  '......baaaccaaa.........' + '......baaaccaaa.........' + '......baaaccaaa.........',
  '.......aacccaaaa........' + '.......baaccaaaa........' + '.......aacccaaaa........',
  '.......aaaccaaaa........' + '.......aaaccaaaa........' + '.......baaccaaaa........',
  '........aaaaaaaaa.......' + '........aaaaaaaaa.......' + '........aaaaaaaaa.......',
  '.........aaaaaccaa......' + '.........aaaaaccaa......' + '.........aaaaaccaa......',
  '..........aaaccaaa......' + '..........aaaccaaa......' + '..........aaaccaaa......',
  '............aaaa........' + '............aaaa........' + '............aaaa........',
  '.............aa.........' + '.............aa.........' + '.............aa.........',
  '........................' + '........................' + '........................',
], { a: 25, b: 26, c: 27 })

const branchSheet = createSpriteSheet(branchSheetRaw, [
  { x: 0, y: 0, width: 24, height: 16, pivot: { x: 0, y: 0 }, duration: 0.5 },
  { x: 24, y: 0, width: 24, height: 16, pivot: { x: 0, y: 0 }, duration: 0.5 },
  { x: 48, y: 0, width: 24, height: 16, pivot: { x: 0, y: 0 }, duration: 0.5 },
])

const LEAVES_COUNT = 18

/** Perspective path geometry helper: returns path center and width at given depth [0..1] */
function getPathGeometry(w: number, depth: number): { center: number; width: number } {
  const center = (0.68 - depth * 0.14) * w
  const width = (0.05 + depth * 0.32) * w
  return { center, width }
}

function drawToriiGate(
  ctx: BuildCtx,
  cx: number,
  baseY: number,
  gateWidth: number,
  gateHeight: number,
  postThick: number,
  drawShadow = true,
): void {
  const { width: w, height: h } = ctx
  const half = Math.round(gateWidth / 2)
  const leftX = Math.round(cx - half)
  const rightX = Math.round(cx + half)
  const topY = Math.round(baseY - gateHeight)

  // 1. Kasagi (curved upper lintel) with black cap ends
  const beamY = topY
  const beamOverhang = Math.max(3, Math.round(gateWidth * 0.14))
  const beamStartX = leftX - beamOverhang
  const beamEndX = rightX + postThick + beamOverhang
  const beamH = Math.max(2, Math.round(gateHeight * 0.11))

  for (let x = beamStartX; x < beamEndX; x++) {
    const norm = (x - cx) / (beamEndX - beamStartX)
    const curveLift = Math.round((norm * 2) ** 2 * (gateHeight * 0.06))
    const y = beamY - curveLift
    const isCapEnd = x < beamStartX + 2 || x >= beamEndX - 2

    for (let dy = 0; dy < beamH; dy++) {
      const py = y + dy
      if (py >= 0 && py < h && x >= 0 && x < w) {
        if (isCapEnd) {
          ctx.px(x, py, 19) // Black copper end-cap
        } else if (dy === 0) {
          ctx.px(x, py, 18) // Top rim highlight
        } else if (dy === beamH - 1) {
          ctx.px(x, py, 15) // Underside shadow
        } else {
          ctx.px(x, py, 16) // Vermilion face
        }
      }
    }
  }

  // 2. Nuki (straight secondary crossbeam) below kasagi
  const nukiY = Math.round(topY + gateHeight * 0.22)
  const nukiOverhang = Math.max(2, Math.round(gateWidth * 0.06))
  const nukiStartX = leftX - nukiOverhang
  const nukiEndX = rightX + postThick + nukiOverhang
  const nukiH = Math.max(1, Math.round(gateHeight * 0.06))

  for (let x = nukiStartX; x < nukiEndX; x++) {
    for (let dy = 0; dy < nukiH; dy++) {
      const py = nukiY + dy
      if (py >= 0 && py < h && x >= 0 && x < w) {
        ctx.px(x, py, dy === 0 ? 17 : 15)
      }
    }
  }

  // 3. Vertical Pillars (Left and Right)
  const cuffHeight = Math.max(2, Math.round(gateHeight * 0.16))

  // Left Pillar: inner face is in shadow
  for (let x = leftX; x < leftX + postThick; x++) {
    const isInner = x === leftX + postThick - 1
    for (let y = topY; y < baseY; y++) {
      if (y >= 0 && y < h && x >= 0 && x < w) {
        if (y >= baseY - cuffHeight) {
          ctx.px(x, y, 19) // Black base wrap (nemaki)
        } else {
          ctx.px(x, y, isInner ? 15 : 16)
        }
      }
    }
  }

  // Right Pillar: outer right edge has specular rim light
  for (let x = rightX; x < rightX + postThick; x++) {
    const isRim = x === rightX + postThick - 1
    for (let y = topY; y < baseY; y++) {
      if (y >= 0 && y < h && x >= 0 && x < w) {
        if (y >= baseY - cuffHeight) {
          ctx.px(x, y, isRim ? 20 : 19)
        } else {
          ctx.px(x, y, isRim ? 18 : 17)
        }
      }
    }
  }

  // 4. Directional cast shadow slanting leftward onto flagstones
  if (drawShadow) {
    const shadowLen = Math.round(gateWidth * 0.35)
    for (let i = 0; i < shadowLen; i++) {
      const sxL = leftX - i
      const sxR = rightX - i
      const sy = Math.round(baseY + i * 0.3)
      if (sy < h) {
        if (sxL >= 0 && sxL < w) ctx.px(sxL, sy, 8)
        if (sxR >= 0 && sxR < w) ctx.px(sxR, sy, 8)
      }
    }
  }
}

function drawStoneLantern(ctx: BuildCtx, cx: number, baseY: number, scale = 1): void {
  const { width: w, height: h } = ctx
  const s = Math.max(1, scale)

  // 1. Pagoda Hexagonal Roof (kasa)
  const roofW = 8 * s
  const roofH = 4 * s
  const roofTop = baseY - 16 * s

  for (let dy = 0; dy < roofH; dy++) {
    const span = Math.round(roofW * (dy / roofH))
    const py = roofTop + dy
    for (let dx = -span; dx <= span; dx++) {
      const px = cx + dx
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const isRim = dy === 0 || Math.abs(dx) === span
        ctx.px(px, py, isRim ? 22 : 21)
      }
    }
  }

  // 2. Light Chamber (hibukuro) with glowing window slits
  const chamberH = 4 * s
  const chamberTop = roofTop + roofH
  for (let dy = 0; dy < chamberH; dy++) {
    const py = chamberTop + dy
    for (let dx = -3 * s; dx <= 3 * s; dx++) {
      const px = cx + dx
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const isLattice = Math.abs(dx) === 3 * s || Math.abs(dx) === 0 || dy === 0 || dy === chamberH - 1
        if (isLattice) {
          ctx.px(px, py, 21)
        } else {
          ctx.px(px, py, Math.abs(dx) === 1 ? 23 : 24)
        }
      }
    }
  }

  // 3. Carved Stone Pedestal (chūdai, sao, kiso)
  const baseTop = chamberTop + chamberH
  const baseH = 8 * s
  for (let dy = 0; dy < baseH; dy++) {
    const py = baseTop + dy
    const isFoot = dy >= baseH - 2 * s
    const pw = isFoot ? 4 * s : (dy < 2 * s ? 3 * s : 2 * s)
    for (let dx = -pw; dx <= pw; dx++) {
      const px = cx + dx
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const isMoss = isFoot && (dx + dy) % 3 === 0
        ctx.px(px, py, isMoss ? 13 : (dx > 0 ? 22 : 21))
      }
    }
  }
}

const kyoto: SceneDef = {
  id: 'world-kyoto',
  name: { en: 'Kyoto Torii Path', vi: 'Đường cổng Torii Kyoto' },
  region: 'world',
  tone: 'both',
  defaultTime: 'dusk',
  themeDefaultTime: { light: 'dawn', dark: 'dusk' },
  horizon: 0.42,
  focus: { x: 0.73, y: 0.57 },
  palettes: kyotoPalettes,
  themePalettes: kyotoThemePalettes,
  layers,

  build(ctx: BuildCtx): void {
    const { width: w, height: h } = ctx
    const vpY = Math.floor(h * 0.44)

    // 1. Sky slit through forest canopy opening (u=0.42..0.86, v=0..0.42)
    for (let y = 0; y < Math.floor(h * 0.42); y++) {
      const v = y / (h * 0.42)
      for (let x = 0; x < w; x++) {
        ctx.px(x, y, ctx.dither(x, y, v * 0.88, 0, 3, 8))
      }
    }

    // 2. Far Kitayama cedar forest: natural organic crowns, textured vertical trunks and bamboo clumps
    for (let x = 0; x < w; x++) {
      const u = x / w
      const c1 = Math.max(0, 0.28 - Math.abs(u - 0.22) * 1.1)
      const c2 = Math.max(0, 0.25 - Math.abs(u - 0.40) * 1.4)
      const c3 = Math.max(0, 0.26 - Math.abs(u - 0.88) * 1.2)
      const crownWave = (ctx.fbm1(u * 28 + 45) - 0.5) * 0.05
      const canopyBase = 0.38 - (c1 + c2 + c3) + crownWave
      const forestTop = Math.floor(canopyBase * h)

      for (let y = forestTop; y < h; y++) {
        const isTrunk = ((x + 3) % 18 < 3 && u < 0.42) || ((x + 7) % 22 < 3 && u > 0.80)
        const foliage = ctx.fbm2(u * 30 + 12, (y / h) * 16)
        let ink = 4
        if (isTrunk) {
          ink = (x % 18 === 0) ? 5 : 4
        } else if (foliage > 0.62) {
          ink = 6
        } else if (foliage > 0.42) {
          ink = 5
        }
        ctx.px(x, y, ink)
      }
    }

    // 3. Stone Paved Walkway (ishidatami) with interlocking flagstones and moss joints
    for (let y = vpY; y < h; y++) {
      const depth = (y - vpY) / Math.max(1, h - vpY)
      const { center, width: pathW } = getPathGeometry(w, depth)
      const left = Math.floor(center - pathW / 2)
      const right = Math.ceil(center + pathW / 2)

      const rowPitch = Math.max(2, Math.round(2 + depth * 8))
      const isHorizontalJoint = (y % rowPitch) === 0

      for (let x = Math.max(0, left); x < Math.min(w, right); x++) {
        const flagstoneSeed = ctx.fbm2(Math.floor(x / (12 + depth * 16)) * 4, Math.floor(y / rowPitch) * 4)
        const isVerticalJoint = ((x + Math.floor(flagstoneSeed * 7)) % Math.max(6, Math.round(8 + depth * 22))) === 0
        const isBorder = x <= left + 2 || x >= right - 3

        let ink = 9 // Flagstone base
        if (isBorder && flagstoneSeed > 0.35) {
          ink = 13 // Moss creeping along path edge
        } else if (isHorizontalJoint || isVerticalJoint) {
          ink = 8 // Mortar joint
        } else if (flagstoneSeed > 0.70) {
          ink = 11 // Lit stone slab edge
        } else if (flagstoneSeed > 0.45) {
          ink = 10 // Weathered stone face
        }
        ctx.px(x, y, ink)
      }

      // Forest moss mounds, stone kerbing, and mossy stepping stones on left
      for (let x = 0; x < left; x++) {
        const m = ctx.fbm2(x * 0.08, y * 0.08)
        const isKerb = x >= left - 3
        const isSteppingStone = (Math.abs(x - left * 0.6) < 4 && y % 18 < 6)
        if (isKerb) {
          ctx.px(x, y, (x + y) % 3 === 0 ? 10 : 8)
        } else if (isSteppingStone) {
          ctx.px(x, y, 9)
        } else {
          ctx.px(x, y, m > 0.48 ? 13 : 12)
        }
      }
      for (let x = right; x < w; x++) {
        const m = ctx.fbm2(x * 0.08 + 50, y * 0.08 + 50)
        const isKerb = x <= right + 2
        if (isKerb) {
          ctx.px(x, y, (x + y) % 3 === 0 ? 10 : 8)
        } else {
          ctx.px(x, y, m > 0.48 ? 13 : 12)
        }
      }
    }

    // Secondary mossy stone lantern in the left forest grove (u=0.30, v=0.62)
    const leftLanternX = Math.floor(w * 0.30)
    const leftLanternY = Math.floor(h * 0.62)
    const leftScale = Math.max(1, Math.floor(h / 190))
    drawStoneLantern(ctx, leftLanternX, leftLanternY, leftScale)

    // 4. Three Receding Mid Torii Gates perfectly centered on the stone path
    // Gate 1 (deepest in tunnel): depth ≈ 0.16 (y=0.48)
    const g1BaseY = Math.floor(h * 0.48)
    const g1Geom = getPathGeometry(w, (g1BaseY - vpY) / (h - vpY))
    drawToriiGate(ctx, g1Geom.center, g1BaseY, Math.max(18, Math.floor(w * 0.05)), Math.floor(h * 0.09), 2)

    // Gate 2 (middle of tunnel): depth ≈ 0.35 (y=0.59)
    const g2BaseY = Math.floor(h * 0.59)
    const g2Geom = getPathGeometry(w, (g2BaseY - vpY) / (h - vpY))
    drawToriiGate(ctx, g2Geom.center, g2BaseY, Math.max(34, Math.floor(w * 0.095)), Math.floor(h * 0.16), Math.max(2, Math.floor(w * 0.010)))

    // Gate 3 (front of receding tunnel): depth ≈ 0.58 (y=0.72)
    const g3BaseY = Math.floor(h * 0.72)
    const g3Geom = getPathGeometry(w, (g3BaseY - vpY) / (h - vpY))
    drawToriiGate(ctx, g3Geom.center, g3BaseY, Math.max(62, Math.floor(w * 0.16)), Math.floor(h * 0.25), Math.max(3, Math.floor(w * 0.015)))

    // 5. Traditional Stone Lantern (ishidōrō) along path right edge at u=0.78, v=0.72
    const lanternX = Math.floor(w * 0.78)
    const lanternY = Math.floor(h * 0.72)
    const lScale = Math.max(1, Math.floor(h / 140))
    drawStoneLantern(ctx, lanternX, lanternY, lScale)

    // Ambient warm glow from lantern onto flagstones
    for (let dy = 0; dy < 6 * lScale; dy++) {
      for (let dx = -6 * lScale; dx <= 6 * lScale; dx++) {
        const px = lanternX + dx
        const py = lanternY + dy
        if (px >= 0 && px < w && py >= 0 && py < h) {
          if (Math.hypot(dx, dy) < 6 * lScale && (px + py) % 2 === 0) {
            ctx.px(px, py, 24)
          }
        }
      }
    }

    // 6. Near Giant Torii Gate framing the whole scene
    const fgBaseY = Math.floor(h * 0.98)
    const fgLeftX = Math.floor(w * 0.14)
    const fgRightX = Math.floor(w * 0.90)
    const fgTopY = Math.floor(h * 0.17)
    const fgPostW = Math.max(6, Math.floor(w * 0.024))

    // Giant Kasagi lintel arching across
    const fgBeamH = Math.max(5, Math.floor(h * 0.045))
    for (let x = Math.floor(w * 0.07); x < Math.floor(w * 0.98); x++) {
      const norm = (x - w * 0.52) / (w * 0.44)
      const lift = Math.round((norm ** 2) * (h * 0.04))
      const by = fgTopY - lift
      const isEndCap = x < Math.floor(w * 0.10) || x > Math.floor(w * 0.95)

      for (let dy = 0; dy < fgBeamH; dy++) {
        const py = by + dy
        if (py >= 0 && py < h) {
          if (isEndCap) {
            ctx.px(x, py, 19)
          } else if (dy === 0) {
            ctx.px(x, py, 18) // Top rim
          } else if (dy === fgBeamH - 1) {
            ctx.px(x, py, 15) // Underside shadow
          } else {
            ctx.px(x, py, 16)
          }
        }
      }
    }

    // Giant Nuki crossbeam below
    const fgNukiY = Math.floor(fgTopY + h * 0.08)
    const fgNukiH = Math.max(3, Math.floor(h * 0.025))
    for (let x = Math.floor(w * 0.11); x < Math.floor(w * 0.94); x++) {
      for (let dy = 0; dy < fgNukiH; dy++) {
        const py = fgNukiY + dy
        if (py >= 0 && py < h) {
          ctx.px(x, py, dy === 0 ? 17 : 15)
        }
      }
    }

    // Giant Left Pillar
    for (let x = fgLeftX; x < fgLeftX + fgPostW; x++) {
      const isInner = x === fgLeftX + fgPostW - 1
      for (let y = fgTopY; y < fgBaseY; y++) {
        const isCuff = y >= fgBaseY - h * 0.08
        ctx.px(x, y, isCuff ? 19 : (isInner ? 15 : 16))
      }
    }

    // Giant Right Pillar
    for (let x = fgRightX; x < fgRightX + fgPostW; x++) {
      const isRim = x === fgRightX + fgPostW - 1
      for (let y = fgTopY; y < fgBaseY; y++) {
        const isCuff = y >= fgBaseY - h * 0.08
        ctx.px(x, y, isCuff ? (isRim ? 20 : 19) : (isRim ? 18 : 17))
      }
    }

    // 7. Overhanging Japanese Maple (Momiji) Branch in top-left
    ctx.line(0, Math.floor(h * 0.03), Math.floor(w * 0.12), Math.floor(h * 0.09), 4)
    ctx.line(Math.floor(w * 0.12), Math.floor(h * 0.09), Math.floor(w * 0.18), Math.floor(h * 0.14), 4)
    ctx.line(Math.floor(w * 0.08), Math.floor(h * 0.06), Math.floor(w * 0.15), Math.floor(h * 0.04), 4)
  },

  frame(ctx: FrameCtx, t: number): void {
    const { width: w, height: h } = ctx
    const vpY = Math.floor(h * 0.44)
    const { center: vpX } = getPathGeometry(w, 0)

    // Effect 1: Swaying Japanese Maple Branch (momiji) in upper-left corner
    const branchScale = Math.max(1, Math.floor(h / 110))
    const branchFrame = Math.floor(t * 2) % 3
    const swayX = Math.floor(Math.sin(t * 1.8) * 1.5)
    ctx.spriteFrame(branchSheet, branchFrame, 4 + swayX, 2, branchScale)
    ctx.spriteFrame(branchSheet, (branchFrame + 1) % 3, Math.floor(w * 0.10) + swayX, Math.floor(h * 0.06), branchScale)

    // Effect 2: 18 Fluttering Falling Autumn Leaves
    for (let i = 0; i < LEAVES_COUNT; i++) {
      const leafSeed = (i * 13.37 + ctx.seed * 0.19) % 1
      const life = 6.0
      const age = (t * 0.8 + leafSeed * life) % life
      const progress = age / life

      const startX = (0.12 + leafSeed * 0.32) * w
      const startY = (0.05 + ((i * 7) % 11) * 0.015) * h

      const flutter = Math.sin(t * 3.5 + i * 1.7) * (3 + progress * 4)
      const lx = Math.floor(startX + progress * (w * 0.35) + flutter)
      const ly = Math.floor(startY + progress * (h * 0.75))

      if (lx >= 0 && lx < w && ly >= 0 && ly < h) {
        const ink = i % 3 === 0 ? 29 : 28
        ctx.px(lx, ly, ink)
        if (progress > 0.4 && lx + 1 < w) {
          ctx.px(lx + 1, ly, ink)
        }
      }
    }

    // Effect 3: Drifting Mountain Mist at the far path bend (0.15 px/s, ticking at 3 fps)
    const mistShift = Math.floor(t * 3) * 0.05
    for (let y = vpY - 4; y < vpY + 12; y++) {
      for (let x = Math.floor(vpX - w * 0.12); x < Math.floor(vpX + w * 0.12); x++) {
        const u = x / w
        const mistNoise = ctx.fbm2(u * 12 + mistShift, (y / h) * 14)
        if (mistNoise > 0.58) {
          const current = ctx.base[y * w + x]!
          if (current >= 8 && current <= 14) {
            ctx.px(x, y, mistNoise > 0.72 ? 31 : 30)
          }
        }
      }
    }

    // Effect 4: Flickering / Breathing Lantern Flame and Ambient Glow
    const lanternX = Math.floor(w * 0.78)
    const lanternY = Math.floor(h * 0.72)
    const lScale = Math.max(1, Math.floor(h / 140))
    const flicker = Math.sin(t * 5.2 + 1.2) * 0.5 + Math.sin(t * 11.4) * 0.3

    if (flicker > 0.2) {
      ctx.px(lanternX, lanternY - 10 * lScale, 23)
      ctx.px(lanternX + 1, lanternY - 10 * lScale, 23)
    } else {
      ctx.px(lanternX, lanternY - 10 * lScale, 22)
    }

    const glowRadius = Math.round((5 + flicker * 0.8) * lScale)
    for (let dy = 0; dy < glowRadius; dy++) {
      for (let dx = -glowRadius; dx <= glowRadius; dx++) {
        const px = lanternX + dx
        const py = lanternY + dy
        if (px >= 0 && px < w && py >= 0 && py < h) {
          if (Math.hypot(dx, dy) < glowRadius && (px + py + Math.floor(t * 2)) % 3 === 0) {
            ctx.px(px, py, 24)
          }
        }
      }
    }
  },
}

export default kyoto
