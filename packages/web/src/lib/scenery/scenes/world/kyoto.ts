import { ParticlePool } from '../../engine/particles'
import { darkness } from '../../engine/palette'
import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { BuildCtx, FrameCtx, LayerSpec, Mask, Palettes, SceneDef, ThemePalettes } from '../../engine/types'

/**
 * Reference (§3.8 / R7 §2.6): Fushimi Inari torii path (Senbon Torii):
 * A ceremonial curving tunnel of vermilion torii gates receding in 1-point perspective
 * into cedar-framed mountain mist, framed by a raised foreground torii gate whose lintels
 * clear the `/new` card (v <= 0.10), carved stone lanterns (ishidōrō) casting a 3-stage
 * radial warm glow onto damp flagstones and moss, rolling mossy forest banks with bamboo
 * and ferns, and swaying momiji maple canopies.
 *
 * 32 Palette Roles:
 * 0..3:   Sky canopy opening (zenith to misty horizon slit)
 * 4..7:   Kitayama cedar & bamboo forest (deep trunk shadow, dark foliage, mid green, sunlit bamboo/crown)
 * 8..11:  Flagstone walkway ishidatami (mortar/cast shadow, damp stone, weathered stone, sunlit stone bevel)
 * 12..14: Forest moss & ferns (deep moss shadow, moss cushion body, sunlit moss/fern tip)
 * 15..18: Torii vermilion ramp (maroon shadow, body vermilion, lit face, warm specular rim)
 * 19..20: Torii black accents (nemaki cuff / kasagi cap, bronze highlight)
 * 21..22: Carved stone lantern granite (dark granite, lit granite edge)
 * 23..24: Lantern flame & inner glow (bright warm amber, hot flame core)
 * 25..27: Japanese maple momiji (dark bark/russet, vivid crimson leaf, golden-amber tip)
 * 28..29: Radial ground glow stages 3 & 2 (soft outer warm tint, mid amber spill)
 * 30..31: Path mist (soft mist shadow, bright mist veil)
 */

export const kyotoThemePalettes: ThemePalettes = {
  light: {
    // Crisp morning bamboo & cedar mist — bright airy sky, vivid vermilion, fresh green moss
    dawn: [
      0xb4cec8, 0xc4dcd4, 0xd6e8e0, 0xe8f3ed,
      0x2c4238, 0x426050, 0x5c8068, 0x7ea684,
      0x5a5c56, 0x767872, 0x94968e, 0xbabcb2,
      0x344e30, 0x507044, 0x769a5c,
      0x722a24, 0xbe462e, 0xdc6844, 0xf09868,
      0x241a18, 0x564642,
      0x5a5852, 0x9a968a,
      0xd8a866, 0xf2d492,
      0x58221e, 0xb83e2e, 0xde9a4c,
      0x686a5c, 0x9c8e6a,
      0xaac0b6, 0xd2e4da,
    ],
    // Clear Kyoto morning daylight — jade sky, sunlit flagstones, rich moss
    day: [
      0xa6ced6, 0xbadde3, 0xd0ebe9, 0xe6f6f2,
      0x263e34, 0x3a5a4a, 0x547a62, 0x78a07e,
      0x60625c, 0x7e8078, 0x9e9e94, 0xc6c6ba,
      0x385432, 0x567a48, 0x7ea464,
      0x7c2e26, 0xca4a32, 0xe86e48, 0xf6a072,
      0x281e1c, 0x5c4c46,
      0x62605a, 0xa29e92,
      0xc8a468, 0xe4cca0,
      0x622420, 0xc64230, 0xdca050,
      0x74766c, 0x9c9272,
      0xb4ccc4, 0xd8ece4,
    ],
    // Late afternoon golden-mauve light in light mode
    dusk: [
      0x8494a6, 0xa0a4b0, 0xc2b0b0, 0xe2c4b4,
      0x243436, 0x384c4c, 0x506864, 0x6c847a,
      0x4e5054, 0x686a70, 0x86888e, 0xaeafb2,
      0x2c3e2c, 0x466042, 0x668456,
      0x642426, 0xaa3c30, 0xcc5c44, 0xe48660,
      0x201818, 0x4e4040,
      0x504e4c, 0x88827a,
      0xeea84e, 0xfad87c,
      0x56201e, 0xa8362c, 0xca8244,
      0x5a584c, 0x9e7d4c,
      0x9498a2, 0xc4bcc0,
    ],
    // Quiet early evening / moonlit light-mode variant
    night: [
      0x485a74, 0x5c708a, 0x7286a0, 0x8ca0b8,
      0x1a282c, 0x283a3e, 0x3a5054, 0x4e6668,
      0x3a3e48, 0x505460, 0x686c78, 0x8c909c,
      0x223226, 0x344a36, 0x4a6448,
      0x521e22, 0x8e322a, 0xb24e3a, 0xd07454,
      0x181416, 0x403436,
      0x424044, 0x767270,
      0xf6b648, 0xffe488,
      0x4a1c1e, 0x8e3028, 0xb46a3c,
      0x44443e, 0x8a6c44,
      0x58667c, 0x7c8ca2,
    ],
  },
  dark: {
    // Cryptomeria pre-dawn mist — cool blue-slate forest, muted vermilion
    dawn: [
      0x263444, 0x344656, 0x465a68, 0x5c707c,
      0x162224, 0x223232, 0x324644, 0x445c56,
      0x2a2c32, 0x3a3c44, 0x4e525a, 0x6a6e76,
      0x18261e, 0x263a2a, 0x38523c,
      0x461c20, 0x7e3028, 0x9c4636, 0xb8664a,
      0x141012, 0x362c2e,
      0x343236, 0x5c5856,
      0xe0a24c, 0xf6cf78,
      0x461a1a, 0x842e28, 0x9c623c,
      0x2e322e, 0x725638,
      0x3c4a56, 0x586a76,
    ],
    // Overcast cryptomeria cedar shade (distinctly moody dark-theme day)
    day: [
      0x30424c, 0x40545e, 0x546c74, 0x6a848a,
      0x182624, 0x243834, 0x364e48, 0x4a685e,
      0x303236, 0x42444a, 0x585a60, 0x76787e,
      0x1c2c20, 0x2c4230, 0x405c44,
      0x502022, 0x8c342a, 0xaa4c38, 0xc66e50,
      0x161212, 0x3c3030,
      0x383638, 0x66625e,
      0xdca458, 0xf0ca80,
      0x4c1c1c, 0x8e322a, 0xa46840,
      0x363832, 0x6c543c,
      0x44565e, 0x647a82,
    ],
    // Cryptomeria Twilight / Dusk (dark default) — deep forest indigo + glowing lanterns
    dusk: [
      0x141e2e, 0x1e2c40, 0x2c3c50, 0x404a5c,
      0x0e1818, 0x182826, 0x263a38, 0x38504a,
      0x22242c, 0x30343e, 0x424854, 0x5e6472,
      0x121e18, 0x1e3026, 0x2c4434,
      0x40181a, 0x7a2a22, 0x9c3e2e, 0xc46042,
      0x120e10, 0x322628,
      0x2c2c30, 0x545050,
      0xf4ae40, 0xffe07c,
      0x421618, 0x7e2824, 0xa46638,
      0x2c2e2a, 0x725430,
      0x2a3644, 0x445464,
    ],
    // Deep moonlit night — obsidian cedar forest, crisp lantern illumination
    night: [
      0x0a101c, 0x101a2a, 0x162236, 0x1e2c44,
      0x0a1214, 0x121c1e, 0x1c2a2c, 0x283a3c,
      0x181a22, 0x242832, 0x343846, 0x4c5262,
      0x0e1612, 0x16241c, 0x223428,
      0x301216, 0x5e201c, 0x7e3026, 0xa44a34,
      0x0c0a0c, 0x241c1e,
      0x222226, 0x444246,
      0xf8b43c, 0xffe684,
      0x321014, 0x681e1c, 0x8e502c,
      0x222220, 0x644828,
      0x1c2432, 0x303c4e,
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

// 4-pose swaying Japanese maple (momiji) upper-left bough + foliage cluster (48×28 per pose, 192×28 sheet)
// Designed at 1:1 art-pixel scale with gnarly bark root, layered palmate leaf sprays, and golden sunlit tips.
const branchSheetRaw = parseSprite([
  'ddddddddbbbaaa..................................' + 'ddddddddbbbaaa..................................' + 'ddddddddbbbaaa..................................' + 'ddddddddbbbaaa..................................',
  '..ddddddbbacccaa..bb............................' + '..ddddddbbacccaa..bb............................' + '..ddddddbbacccaa...bb...........................' + '..ddddddbbacccaa..bb............................',
  '....ddddbbbaaaacbaabbc..........................' + '....ddddbbbaaaacbaabbc..........................' + '....ddddbbbaaaacbbabbc..........................' + '....ddddbbbaaaacbaabbc..........................',
  '.....dddddbbbbaaaccaaaab........................' + '.....dddddbbbbaaaccaaaab........................' + '......ddddbbbbbaaaccaaaab.......................' + '.....dddddbbbbaaaccaaaab........................',
  '.......dddddbaaaaaaaaacaa..bb...................' + '.......dddddbaaaaaaaaacaa..bb...................' + '.......ddddddbaaaaaaaaacaa..bb..................' + '.......dddddbaaaaaaaaacaa..bb...................',
  '........dddddbaacccaaaaaabbaac..................' + '........dddddbaacccaaaaaabbaac..................' + '.........ddddbaacccaaaaaabbaac..................' + '........dddddbaacccaaaaaabbaac..................',
  '.........ddddbbaaaccaaaaacaaccb.................' + '.........ddddbbaaaccaaaaacaaccb.................' + '..........dddbbaaaccaaaaacaaccb.................' + '.........ddddbbaaaccaaaaacaaccb.................',
  '..........ddddbaaaaabbbbaaaabbc.................' + '..........ddddbaaaaabbbbaaaabbc.................' + '...........dddbaaaaabbbbaaaabbc.................' + '..........ddddbaaaaabbbbaaaabbc.................',
  '...........ddddbbbaaccaaaaab....................' + '...........ddddbbbaaccaaaaab....................' + '............dddbbbaaaccbaaaab...................' + '...........ddddbbbaaccaaaaab....................',
  '............ddddbbaccccaaaab..cc................' + '............ddddbbaccccaaaab..cc................' + '.............dddbbaccccaaaab...cc...............' + '............ddddbbaccccaaaab..cc................',
  '.............ddddbaaaaacaaabbaab................' + '.............ddddbaaaaacaaabbaab................' + '..............dddbaaaaacaaabbbab................' + '.............ddddbaaaaacaaabbaab................',
  '..............ddddbbaaaabbaaccaac...............' + '...............dddbbaaaabbaaccaac...............' + '...............dddbbaaaabbaaccaac...............' + '..............ddddbbaaaabbaaccaac...............',
  '................dddbbaaaacccaaaaab..............' + '................dddbbaaaacccaaaaab..............' + '.................ddbbbaaaacccaaaaab.............' + '................dddbbaaaacccaaaaab..............',
  '..................dddbbaaaccaaaaaab.............' + '..................dddbbaaaccaaaaaab.............' + '...................ddbbaaaccaaaaaab.............' + '..................dddbbaaaccaaaaaab.............',
  '...................dddbbaaaaabbbbaac............' + '....................ddbbbaaaaabbbbaac...........' + '....................ddbbbaaaaabbbbaac...........' + '...................dddbbaaaaabbbbaac............',
  '.....................dddbaaaaccaaaabb...........' + '.....................dddbaaaaccaaaabb...........' + '......................ddbaaaaccaaaabb...........' + '.....................dddbaaaaccaaaabb...........',
  '.......................ddbbbaaaaaccaab..........' + '........................ddbbbaaaaaccaab.........' + '........................ddbbbaaaaaccaab.........' + '.......................ddbbbaaaaaccaab..........',
  '.........................ddbbbaccccaaa..........' + '..........................ddbbbaccccaaa.........' + '..........................ddbbbaccccaaa.........' + '.........................ddbbbaccccaaa..........',
  '............................ddbaaacaaab.........' + '.............................ddbaaacaaab........' + '.............................ddbaaacaaab........' + '............................ddbaaacaaab.........',
  '.............................ddbaaaabb..........' + '..............................ddbaaaabb.........' + '..............................ddbaaaabb.........' + '.............................ddbaaaabb..........',
  '...............................bbaab............' + '................................bbaab...........' + '................................bbaab...........' + '...............................bbaab............',
  '................................bbb.............' + '.................................bbb............' + '.................................bbb............' + '................................bbb.............',
  '................................................' + '................................................' + '................................................' + '................................................',
  '................................................' + '................................................' + '................................................' + '................................................',
  '................................................' + '................................................' + '................................................' + '................................................',
  '................................................' + '................................................' + '................................................' + '................................................',
  '................................................' + '................................................' + '................................................' + '................................................',
  '................................................' + '................................................' + '................................................' + '................................................',
], { d: 25, a: 26, b: 26, c: 27 })

const branchSheet = createSpriteSheet(branchSheetRaw, [
  { x: 0, y: 0, width: 48, height: 28, pivot: { x: 0, y: 0 }, duration: 0.5 },
  { x: 48, y: 0, width: 48, height: 28, pivot: { x: 0, y: 0 }, duration: 0.5 },
  { x: 96, y: 0, width: 48, height: 28, pivot: { x: 0, y: 0 }, duration: 0.5 },
  { x: 144, y: 0, width: 48, height: 28, pivot: { x: 0, y: 0 }, duration: 0.5 },
])

// Secondary top-right maple sprig (24×14 per pose, 96×14 sheet)
const rightSprigRaw = parseSprite([
  '............bb..dddddddd' + '...........bb...dddddddd' + '..........bb....dddddddd' + '...........bb...dddddddd',
  '.........bbaccddddddd...' + '........bbaccdddddddd...' + '.......bbaccdddddddd....' + '........bbaccdddddddd...',
  '........baaabdddd.......' + '.......baaabdddd........' + '......baaabdddd.........' + '.......baaabdddd........',
  '.....cc.bbabdd..........' + '....cc..bbabdd..........' + '....cc.bbabdd...........' + '....cc..bbabdd..........',
  '...bbacb.bb.............' + '..bbacb..bb.............' + '..bbacb..bb.............' + '..bbacb..bb.............',
  '...baaaab...............' + '..baaaab................' + '..baaaab................' + '..baaaab................',
  '....bbab................' + '...bbab.................' + '...bbab.................' + '...bbab.................',
  '........................' + '........................' + '........................' + '........................',
  '........................' + '........................' + '........................' + '........................',
  '........................' + '........................' + '........................' + '........................',
  '........................' + '........................' + '........................' + '........................',
  '........................' + '........................' + '........................' + '........................',
  '........................' + '........................' + '........................' + '........................',
  '........................' + '........................' + '........................' + '........................',
], { d: 25, a: 26, b: 26, c: 27 })

const rightSprigSheet = createSpriteSheet(rightSprigRaw, [
  { x: 0, y: 0, width: 24, height: 14, pivot: { x: 24, y: 0 }, duration: 0.5 },
  { x: 24, y: 0, width: 24, height: 14, pivot: { x: 24, y: 0 }, duration: 0.5 },
  { x: 48, y: 0, width: 24, height: 14, pivot: { x: 24, y: 0 }, duration: 0.5 },
  { x: 72, y: 0, width: 24, height: 14, pivot: { x: 24, y: 0 }, duration: 0.5 },
])

// 4-pose tumbling maple leaf sprite (4×4 per pose, 16×4 sheet)
const leafSheetRaw = parseSprite([
  '.b..a.a..c..b.c.',
  'bcb.aba.bcb..ba.',
  '.a...c..aba.aba.',
  '.....b.......c..',
], { a: 25, b: 26, c: 27 })

const leafSheet = createSpriteSheet(leafSheetRaw, [
  { x: 0, y: 0, width: 4, height: 4, pivot: { x: 1, y: 1 }, duration: 0.25 },
  { x: 4, y: 0, width: 4, height: 4, pivot: { x: 1, y: 1 }, duration: 0.25 },
  { x: 8, y: 0, width: 4, height: 4, pivot: { x: 1, y: 1 }, duration: 0.25 },
  { x: 12, y: 0, width: 4, height: 4, pivot: { x: 1, y: 1 }, duration: 0.25 },
])

interface LanternPos {
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
  readonly flameY: number
  readonly chamberTop: number
  readonly chamberH: number
  readonly chamberHalf: number
}

interface KyotoCache {
  readonly groundMask: Mask
  readonly nearMask: Mask
  readonly pool: ParticlePool
  readonly leafTier: Uint8Array
  readonly leafPhase: Float32Array
  readonly primaryLantern: LanternPos
  readonly secondaryLantern: LanternPos
  readonly gate5RightRim: { readonly x: number; readonly y0: number; readonly y1: number }
  lastT: number
}

const sceneCache = new WeakMap<Uint8Array, KyotoCache>()

/** Perspective path geometry: gently curves from vanishing point (0.68w, 0.48h) toward (0.56w, 1.0h) */
function getPathGeometry(w: number, depth: number): { center: number; width: number } {
  const curve = Math.sin(depth * Math.PI * 0.55) * 0.05
  const center = (0.68 - depth * 0.07 - curve) * w
  const width = (0.04 + depth * 0.30) * w
  return { center, width }
}

/** Deterministic integer spatial hash in [0..15] for zero-flicker static material grain */
function spatialHash(x: number, y: number, seed: number): number {
  return ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ seed) >>> 0) & 15
}

/** Draws a receding Fushimi Inari torii gate with kasagi curve, gakuzuka plaque, nuki, nemaki cuffs, and cast shadow */
function drawToriiGate(
  ctx: BuildCtx,
  cx: number,
  baseY: number,
  gateWidth: number,
  gateHeight: number,
  postThick: number,
  drawShadow = true,
): { readonly rightRimX: number; readonly rimY0: number; readonly rimY1: number } {
  const { width: w, height: h } = ctx
  const half = Math.round(gateWidth / 2)
  const leftX = Math.round(cx - half)
  const rightX = Math.round(cx + half - postThick)
  const topY = Math.round(baseY - gateHeight)

  // 1. Kasagi (curved upper lintel) + shimaki dark underside + black copper cap ends
  const beamOverhang = Math.max(3, Math.round(gateWidth * 0.16))
  const beamStartX = leftX - beamOverhang
  const beamEndX = rightX + postThick + beamOverhang
  const beamH = Math.max(2, Math.round(gateHeight * 0.11))
  const beamSpan = Math.max(1, beamEndX - beamStartX)

  for (let x = beamStartX; x < beamEndX; x++) {
    const norm = (x - (beamStartX + beamSpan / 2)) / (beamSpan / 2)
    const curveLift = Math.round(norm * norm * Math.max(1, gateHeight * 0.055))
    const y = topY - curveLift
    const capWidth = Math.max(1, Math.round(beamSpan * 0.035))
    const isCapEnd = x < beamStartX + capWidth || x >= beamEndX - capWidth

    for (let dy = 0; dy < beamH; dy++) {
      const py = y + dy
      if (py >= 0 && py < h && x >= 0 && x < w) {
        if (isCapEnd) {
          ctx.px(x, py, dy === 0 ? 20 : 19)
        } else if (dy === 0) {
          ctx.px(x, py, 18) // Top rim highlight
        } else if (dy === beamH - 1) {
          ctx.px(x, py, 15) // Underside shadow (shimaki)
        } else {
          ctx.px(x, py, x > cx ? 17 : 16)
        }
      }
    }
  }

  // 2. Nuki (secondary tie beam) & Gakuzuka (central tablet strut)
  const nukiY = Math.round(topY + gateHeight * 0.22)
  const nukiOverhang = Math.max(2, Math.round(gateWidth * 0.08))
  const nukiStartX = leftX - nukiOverhang
  const nukiEndX = rightX + postThick + nukiOverhang
  const nukiH = Math.max(1, Math.round(gateHeight * 0.06))

  for (let x = nukiStartX; x < nukiEndX; x++) {
    for (let dy = 0; dy < nukiH; dy++) {
      const py = nukiY + dy
      if (py >= 0 && py < h && x >= 0 && x < w) {
        ctx.px(x, py, dy === 0 ? (x > cx ? 18 : 17) : 15)
      }
    }
  }

  const plaqueHalf = Math.max(1, Math.round(postThick * 0.65))
  for (let x = Math.round(cx - plaqueHalf); x <= Math.round(cx + plaqueHalf); x++) {
    for (let y = topY + beamH; y < nukiY; y++) {
      if (y >= 0 && y < h && x >= 0 && x < w) {
        const isBorder = x === Math.round(cx - plaqueHalf) || x === Math.round(cx + plaqueHalf)
        ctx.px(x, y, isBorder ? 19 : 15)
      }
    }
  }

  // 3. Pillars (hashira) with dark base cuffs (nemaki) & upper-right lighting
  const cuffHeight = Math.max(2, Math.round(gateHeight * 0.14))

  for (let x = leftX; x < leftX + postThick; x++) {
    const isRightEdge = x === leftX + postThick - 1
    for (let y = topY + 1; y < baseY; y++) {
      if (y >= 0 && y < h && x >= 0 && x < w) {
        if (y >= baseY - cuffHeight) {
          ctx.px(x, y, 19)
        } else if (y < nukiY + nukiH && y >= topY + beamH) {
          ctx.px(x, y, isRightEdge ? 17 : 15)
        } else {
          ctx.px(x, y, isRightEdge ? 17 : 16)
        }
      }
    }
  }

  for (let x = rightX; x < rightX + postThick; x++) {
    const isRim = x === rightX + postThick - 1
    const isInner = x === rightX && postThick >= 3
    for (let y = topY + 1; y < baseY; y++) {
      if (y >= 0 && y < h && x >= 0 && x < w) {
        if (y >= baseY - cuffHeight) {
          ctx.px(x, y, isRim ? 20 : 19)
        } else {
          ctx.px(x, y, isRim ? 18 : (isInner ? 15 : 17))
        }
      }
    }
  }

  // 4. Grounding directional cast shadow slanting down-left across the flagstones
  if (drawShadow) {
    const shadowLen = Math.max(3, Math.round(gateWidth * 0.34))
    for (let i = 0; i < shadowLen; i++) {
      const sy = Math.round(baseY + i * 0.24)
      if (sy >= 0 && sy < h) {
        for (let t = 0; t < Math.max(1, Math.floor(postThick * 0.8)); t++) {
          const sxL = leftX - i + t
          const sxR = rightX - i + t
          if (sxL >= 0 && sxL < w) ctx.px(sxL, sy, 8)
          if (sxR >= 0 && sxR < w) ctx.px(sxR, sy, 8)
        }
      }
    }
  }

  return {
    rightRimX: rightX + postThick - 1,
    rimY0: Math.round(baseY - gateHeight * 0.28),
    rimY1: Math.round(baseY - cuffHeight + 4),
  }
}

/** Draws a carved stone lantern (ishidōrō) base geometry (time-agnostic; fireboxes are lit in frame()) */
function drawStoneLantern(
  ctx: BuildCtx,
  cx: number,
  baseY: number,
  scale: number,
): { flameY: number; chamberTop: number; chamberH: number; chamberHalf: number } {
  const { width: w, height: h } = ctx
  const s = Math.max(0.7, scale)
  const totalH = Math.round(25 * s)
  const topY = baseY - totalH

  // 1. Hōju (lotus finial)
  const finialW = Math.max(1, Math.round(1.5 * s))
  const finialH = Math.max(2, Math.round(3 * s))
  for (let dy = 0; dy < finialH; dy++) {
    const span = dy === 0 ? 0 : finialW
    for (let dx = -span; dx <= span; dx++) {
      const px = cx + dx
      const py = topY + dy
      if (px >= 0 && px < w && py >= 0 && py < h) {
        ctx.px(px, py, dx >= 0 ? 22 : 21)
      }
    }
  }

  // 2. Curved Kasa (pagoda roof with upturned eaves)
  const roofTop = topY + finialH
  const roofH = Math.max(3, Math.round(5 * s))
  const roofHalf = Math.max(4, Math.round(8.5 * s))
  for (let dy = 0; dy < roofH; dy++) {
    const frac = (dy + 1) / roofH
    const span = Math.round(roofHalf * Math.pow(frac, 0.78))
    const py = roofTop + dy
    for (let dx = -span; dx <= span; dx++) {
      const px = cx + dx
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const isEaveRim = dy === 0 || (dx > 0 && Math.abs(dx) >= span - 1)
        const isUnderside = dy === roofH - 1 && Math.abs(dx) > Math.round(roofHalf * 0.55)
        ctx.px(px, py, isUnderside ? 8 : (isEaveRim ? 22 : 21))
      }
    }
  }

  // 3. Hibukuro (firebox frame — unlit stone in base; frame() lights window panes at dusk/night)
  const chamberTop = roofTop + roofH
  const chamberH = Math.max(3, Math.round(5 * s))
  const chamberHalf = Math.max(2, Math.round(3.5 * s))
  const flameY = chamberTop + Math.floor(chamberH / 2)
  for (let dy = 0; dy < chamberH; dy++) {
    const py = chamberTop + dy
    for (let dx = -chamberHalf; dx <= chamberHalf; dx++) {
      const px = cx + dx
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const isFrame = Math.abs(dx) === chamberHalf || Math.abs(dx) === 0 || dy === 0 || dy === chamberH - 1
        ctx.px(px, py, isFrame && dx > 0 ? 22 : 21)
      }
    }
  }

  // 4. Chūdai (platform), Sao (shaft), Kiso (stepped stone pedestal with moss)
  const pedTop = chamberTop + chamberH
  const pedH = Math.max(4, baseY - pedTop)
  for (let dy = 0; dy < pedH; dy++) {
    const py = pedTop + dy
    const isChudai = dy < Math.max(1, Math.round(pedH * 0.22))
    const isKiso = dy >= Math.round(pedH * 0.72)
    const pw = isChudai
      ? Math.max(2, Math.round(4 * s))
      : isKiso
        ? Math.max(3, Math.round(5.5 * s))
        : Math.max(1, Math.round(2 * s))
    for (let dx = -pw; dx <= pw; dx++) {
      const px = cx + dx
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const isMoss = isKiso && spatialHash(px, py, ctx.seed) < 4
        ctx.px(px, py, isMoss ? 13 : (dx > 0 ? 22 : 21))
      }
    }
  }

  for (let dx = -Math.round(6 * s); dx <= Math.round(4 * s); dx++) {
    const px = cx + dx
    if (px >= 0 && px < w && baseY >= 0 && baseY < h) {
      ctx.px(px, baseY, 8)
    }
  }

  return { flameY, chamberTop, chamberH, chamberHalf }
}

function lightLanternChamber(ctx: FrameCtx, lantern: LanternPos, flicker: number): void {
  const { width: w, height: h } = ctx
  for (let dy = 1; dy < lantern.chamberH - 1; dy++) {
    const py = lantern.chamberTop + dy
    if (py < 0 || py >= h) continue
    for (let dx = -lantern.chamberHalf + 1; dx <= lantern.chamberHalf - 1; dx++) {
      if (dx === 0) continue
      const px = lantern.x + dx
      if (px < 0 || px >= w) continue
      const isHot = Math.abs(dx) <= 1 && (dy === 1 || dy === lantern.chamberH - 2 || flicker > -0.1)
      ctx.px(px, py, isHot ? 24 : 23)
    }
  }
}

/**
 * 3-stage smooth concentric radial lantern glow clipped strictly to groundMask.
 * Zero checkerboard dither: inner bright amber (24/23), mid amber spill (29), soft outer tint (28).
 */
function drawRadialLanternGlow(
  ctx: BuildCtx,
  lantern: LanternPos,
  groundMask: Mask,
  pulseScale = 1,
): void {
  const { width: w, height: h } = ctx
  const rx = Math.max(6, Math.round(lantern.rx * pulseScale))
  const ry = Math.max(3, Math.round(lantern.ry * pulseScale))
  const cy = lantern.y

  for (let dy = -ry; dy <= ry; dy++) {
    const py = cy + dy
    if (py < 0 || py >= h) continue
    for (let dx = -rx; dx <= rx; dx++) {
      const px = lantern.x + dx
      if (px < 0 || px >= w) continue
      const normDist = Math.hypot(dx / rx, dy / ry)
      if (normDist > 1) continue
      if (!groundMask.contains(px, py)) continue

      const baseInk = ctx.base[py * w + px]!
      if (normDist > 0.58 && baseInk === 8) continue

      let ink: number
      if (normDist <= 0.16 && dy >= -2) {
        ink = 24
      } else if (normDist <= 0.36) {
        ink = 23
      } else if (normDist <= 0.68) {
        ink = 29
      } else {
        ink = 28
      }
      ctx.px(px, py, ink)
    }
  }
}

/** Draws a lush fern cluster on the forest floor */
function drawFern(ctx: BuildCtx, cx: number, baseY: number, size: number): void {
  const fronds = [
    { dx: -size, dy: -Math.round(size * 0.55) },
    { dx: -Math.round(size * 0.55), dy: -size },
    { dx: 0, dy: -Math.round(size * 1.15) },
    { dx: Math.round(size * 0.55), dy: -size },
    { dx: size, dy: -Math.round(size * 0.5) },
  ]
  for (let i = 0; i < fronds.length; i++) {
    const f = fronds[i]!
    const tipX = cx + f.dx
    const tipY = baseY + f.dy
    ctx.line(cx, baseY, tipX, tipY, i >= 2 ? 14 : 13)
    if (size >= 4) {
      const midX = Math.round(cx + f.dx * 0.55)
      const midY = Math.round(baseY + f.dy * 0.55)
      ctx.px(midX, midY - 1, 14)
      ctx.px(cx, baseY, 12)
    }
  }
}

/** Draws a bamboo culm with node joints and delicate bamboo leaf sprays */
function drawBambooStalk(ctx: BuildCtx, bx: number, topY: number, botY: number, width: number, seed: number): void {
  const { width: w, height: h } = ctx
  for (let y = topY; y < botY; y++) {
    const isJoint = (y - topY) % 13 === 0
    for (let dx = 0; dx < width; dx++) {
      const px = bx + dx
      if (px >= 0 && px < w && y >= 0 && y < h) {
        ctx.px(px, y, isJoint ? 7 : (dx === width - 1 ? 6 : 5))
      }
    }
    if (isJoint && y > topY + 6 && y < botY - 12 && ((y + seed) % 26 === 0 || (y + seed) % 39 === 0)) {
      const dir = ((y / 13) % 2 === 0) ? 1 : -1
      const sx = dir > 0 ? bx + width : bx - 1
      ctx.line(sx, y, sx + dir * 4, y + 2, 6)
      ctx.line(sx + dir, y + 1, sx + dir * 5, y + 4, 7)
      ctx.line(sx, y, sx + dir * 2, y + 4, 5)
    }
  }
}

function buildCache(ctx: BuildCtx): KyotoCache {
  const { width: w, height: h, seed } = ctx
  const groundMask = ctx.mask()
  const nearMask = ctx.mask()
  const pool = new ParticlePool(36, seed + 17)
  const leafTier = new Uint8Array(36)
  const leafPhase = new Float32Array(36)

  for (let i = 0; i < 36; i++) {
    leafTier[i] = i < 24 ? 0 : 1
    leafPhase[i] = ((i * 2.39996 + seed * 0.13) % (Math.PI * 2))
  }

  const lScale = Math.max(0.75, Math.min(1.4, h / 220))
  const primaryLantern: LanternPos = {
    x: Math.round(w * 0.79),
    y: Math.round(h * 0.84),
    rx: Math.max(12, Math.round(32 * lScale * (w / 480))),
    ry: Math.max(5, Math.round(13 * lScale)),
    flameY: Math.round(h * 0.84 - 14 * lScale),
    chamberTop: 0,
    chamberH: 4,
    chamberHalf: 3,
  }
  const secondaryLantern: LanternPos = {
    x: Math.round(w * 0.25),
    y: Math.round(h * 0.68),
    rx: Math.max(8, Math.round(19 * lScale * (w / 480))),
    ry: Math.max(3, Math.round(8 * lScale)),
    flameY: Math.round(h * 0.68 - 10 * lScale * 0.7),
    chamberTop: 0,
    chamberH: 3,
    chamberHalf: 2,
  }

  return {
    groundMask,
    nearMask,
    pool,
    leafTier,
    leafPhase,
    primaryLantern,
    secondaryLantern,
    gate5RightRim: { x: 0, y0: 0, y1: 0 },
    lastT: -1,
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
    const { width: w, height: h, seed } = ctx
    const cache = buildCache(ctx)
    sceneCache.set(ctx.base, cache)

    const skyBottom = Math.floor(h * 0.48)
    const vpY = Math.floor(h * 0.48)

    // 1. Clean 4-band Sky (NO full-sky Bayer checkerboard; 2px 4×4 Bayer seam only)
    ctx.layer({ kind: 'sky', z: 0 }, (layer) => {
      const stops = [0, Math.round(skyBottom * 0.25), Math.round(skyBottom * 0.52), Math.round(skyBottom * 0.78), skyBottom]
      for (let band = 0; band < 4; band++) {
        const y0 = stops[band]!
        const y1 = stops[band + 1]!
        if (y1 > y0) layer.rect(0, y0, w, y1 - y0, band)
      }
      for (let band = 1; band <= 3; band++) {
        const seamY = stops[band]!
        for (let dy = -1; dy <= 0; dy++) {
          const y = seamY + dy
          if (y < 0 || y >= skyBottom) continue
          const amt = (dy + 1.5) / 2
          for (let x = 0; x < w; x++) {
            layer.px(x, y, layer.dither(x, y, amt, band - 1, band, 4))
          }
        }
      }
    })

    // 2. Far & Mid Kitayama Cedar Forest with organic scalloped tree crowns (NO geometric pyramids)
    ctx.layer({ kind: 'far', z: 1 }, (layer) => {
      // Distant hazy mountain ridge behind the canopy valley opening
      for (let x = 0; x < w; x++) {
        const u = x / w
        const valley = 0.41 - Math.abs(u - 0.65) * 0.32
        const crown = (layer.fbm1(u * 18 + 7) - 0.5) * 0.045
        const farTop = Math.floor(Math.max(0.18, Math.min(0.41, valley - crown)) * h)
        for (let y = farTop; y < vpY + 8; y++) {
          layer.px(x, y, y <= farTop + 1 ? 7 : 6)
        }
      }

      // Organic scalloped cedar/cypress canopy domes flanking left (u=0..0.44) & right (u=0.78..1.0)
      const dome = (u: number, cu: number, hw: number, height: number) => {
        const d = Math.abs(u - cu) / hw
        return d >= 1 ? 0 : height * Math.pow(1 - d * d, 0.72)
      }
      for (let x = 0; x < w; x++) {
        const u = x / w
        const leftCanopy = Math.max(
          dome(u, 0.04, 0.13, 0.30),
          dome(u, 0.15, 0.12, 0.27),
          dome(u, 0.25, 0.11, 0.21),
          dome(u, 0.35, 0.09, 0.13),
        )
        const rightCanopy = Math.max(
          dome(u, 0.83, 0.10, 0.15),
          dome(u, 0.92, 0.12, 0.25),
          dome(u, 0.99, 0.10, 0.30),
        )
        const canopyH = Math.max(leftCanopy, rightCanopy)
        if (canopyH <= 0.01) continue

        const crownRipple = Math.sin(u * 48 + 0.7) * 0.014 + (layer.fbm1(u * 32 + 21) - 0.5) * 0.035
        const treeTop = Math.floor(Math.max(0.02, 0.44 - canopyH - crownRipple) * h)
        for (let y = treeTop; y < vpY + 8; y++) {
          const foliage = layer.fbm2(u * 22 + 9, (y / h) * 18)
          let ink = 5
          if (y <= treeTop + 2 && foliage > 0.38) ink = 7
          else if (foliage > 0.62) ink = 6
          else if (foliage < 0.34) ink = 4
          layer.px(x, y, ink)
        }
      }

      // Leafy bamboo culms framing left & right woodland
      drawBambooStalk(layer, Math.round(w * 0.045), Math.round(h * 0.08), Math.round(h * 0.52), Math.max(1, Math.round(w * 0.005)), seed)
      drawBambooStalk(layer, Math.round(w * 0.18), Math.round(h * 0.14), Math.round(h * 0.52), Math.max(1, Math.round(w * 0.004)), seed + 3)
      drawBambooStalk(layer, Math.round(w * 0.29), Math.round(h * 0.20), Math.round(h * 0.50), Math.max(1, Math.round(w * 0.004)), seed + 7)
      drawBambooStalk(layer, Math.round(w * 0.935), Math.round(h * 0.10), Math.round(h * 0.52), Math.max(1, Math.round(w * 0.005)), seed + 11)
    })

    // 3. Organic Rolling Mossy Forest Floor & Stone Paved Walkway (ishidatami)
    ctx.layer({ kind: 'mid', z: 3 }, (layer) => {
      for (let x = 0; x < w; x++) {
        const u = x / w
        // Undulating woodland bushes / undergrowth transition along tree line (breaks flat horizon seam)
        const bush = Math.sin(u * 23 + 0.5) * 0.015 + (layer.fbm1(u * 18 + 5) - 0.5) * 0.06
        const isTunnelGap = u > 0.56 && u < 0.76
        const edgeY = Math.round((isTunnelGap ? vpY : vpY - Math.max(2, h * 0.025)) + bush * h)
        for (let y = edgeY; y < h; y++) {
          cache.groundMask.set(x, y, 15)
          const depth = (y - vpY) / Math.max(1, h - vpY)
          // Broad organic moss cushions + soft multi-pixel cluster texture (no 1px salt-and-pepper noise)
          const swell = layer.fbm2(u * 5.0 + 3, depth * 4.0 + 11)
          const cluster = layer.fbm2(u * 13 + 19, (y / h) * 15 + 29)

          let ink = 12
          if (y < vpY - 2 && !isTunnelGap) {
            ink = cluster > 0.55 ? 5 : 4
          } else if (swell > 0.56 || (swell > 0.48 && cluster > 0.60)) {
            ink = 14
          } else if (swell > 0.39 || cluster > 0.55) {
            ink = 13
          }
          layer.px(x, y, ink)
        }
      }

      // Scattered small fallen maple-leaf clusters (2-3px organic pairs near path & left grove)
      for (let i = 0; i < 18; i++) {
        const lx = Math.round((0.05 + ((i * 0.371 + seed * 0.05) % 1) * 0.88) * w)
        const ly = Math.round((0.56 + ((i * 0.619 + seed * 0.09) % 1) * 0.40) * h)
        const leafInk = i % 3 === 0 ? 27 : 26
        layer.px(lx, ly, leafInk)
        if (lx + 1 < w) layer.px(lx + 1, ly, i % 2 === 0 ? 25 : leafInk)
      }

      // Flagstone path (ishidatami) starting cleanly inside the farthest gate
      const pathStartY = Math.round(vpY + h * 0.04)
      for (let y = pathStartY; y < h; y++) {
        const depth = (y - vpY) / Math.max(1, h - vpY)
        const { center, width: pathW } = getPathGeometry(w, depth)
        const left = Math.floor(center - pathW / 2)
        const right = Math.ceil(center + pathW / 2)

        const rowPitch = Math.max(2, Math.round(2 + depth * 8))
        const rowIdx = Math.floor((y - vpY) / rowPitch)
        const isHorizontalJoint = ((y - vpY) % rowPitch) === 0

        for (let x = Math.max(0, left); x < Math.min(w, right); x++) {
          const slabW = Math.max(6, Math.round(7 + depth * 18))
          const stagger = (rowIdx % 2) * Math.floor(slabW * 0.5)
          const slabCol = Math.floor((x + stagger) / slabW)
          const isVerticalJoint = ((x + stagger) % slabW) === 0
          const isBorder = x <= left + 1 || x >= right - 2

          const slabTone = spatialHash(slabCol, rowIdx, seed)
          const grain = layer.fbm2(x * 0.16, y * 0.16)

          let ink = 9
          if (isBorder && grain > 0.40) {
            ink = 13
          } else if (isHorizontalJoint || isVerticalJoint) {
            ink = 8
          } else if ((y - vpY) % rowPitch === 1 && slabTone > 4) {
            ink = 11
          } else if (slabTone > 10 || grain > 0.62) {
            ink = 10
          } else if (slabTone < 3) {
            ink = 8
          }
          layer.px(x, y, ink)
        }

        const kerbW = Math.max(2, Math.round(1 + depth * 2.5))
        for (let k = 1; k <= kerbW; k++) {
          if (left - k >= 0) layer.px(left - k, y, ((left - k + y) % 4 === 0) ? 10 : 8)
          if (right + k - 1 < w) layer.px(right + k - 1, y, ((right + k + y) % 4 === 0) ? 10 : 8)
        }
      }

      // Winding mossy stepping stones on left forest grove leading toward secondary lantern
      const stoneCount = 6
      for (let i = 0; i < stoneCount; i++) {
        const t = i / (stoneCount - 1)
        const sy = Math.round(h * (0.60 + t * 0.32))
        const sx = Math.round(w * (0.36 - t * 0.14 + Math.sin(t * 3.1) * 0.02))
        const rx = Math.max(3, Math.round((3.5 + t * 5.5) * (w / 480)))
        const ry = Math.max(1, Math.round(1.5 + t * 2.2))
        for (let dy = -ry; dy <= ry; dy++) {
          for (let dx = -rx; dx <= rx; dx++) {
            if ((dx / rx) ** 2 + (dy / ry) ** 2 <= 1) {
              const px = sx + dx
              const py = sy + dy
              if (px >= 0 && px < w && py >= 0 && py < h) {
                layer.px(px, py, dy === -ry ? 11 : (dy === ry ? 8 : 9))
              }
            }
          }
        }
      }

      // Foreground/midground bamboo culms & ferns
      drawBambooStalk(layer, Math.round(w * 0.04), Math.round(h * 0.14), Math.round(h * 0.84), Math.max(2, Math.round(w * 0.005)), seed + 19)
      drawBambooStalk(layer, Math.round(w * 0.19), Math.round(h * 0.24), Math.round(h * 0.88), Math.max(1, Math.round(w * 0.004)), seed + 23)
      drawBambooStalk(layer, Math.round(w * 0.085), Math.round(h * 0.20), Math.round(h * 0.78), Math.max(1, Math.round(w * 0.004)), seed + 29)

      const fernSpots = [
        { x: Math.round(w * 0.065), y: Math.round(h * 0.88), s: Math.max(4, Math.round(h * 0.048)) },
        { x: Math.round(w * 0.21), y: Math.round(h * 0.72), s: Math.max(3, Math.round(h * 0.034)) },
        { x: Math.round(w * 0.34), y: Math.round(h * 0.90), s: Math.max(4, Math.round(h * 0.044)) },
        { x: Math.round(w * 0.94), y: Math.round(h * 0.89), s: Math.max(4, Math.round(h * 0.048)) },
        { x: Math.round(w * 0.76), y: Math.round(h * 0.64), s: Math.max(3, Math.round(h * 0.030)) },
      ]
      for (const f of fernSpots) drawFern(layer, f.x, f.y, f.s)
    })

    // 4. Receding 5-Gate 1-Point Perspective Torii Tunnel (all tops >= 0.475h, clearing /new card!)
    ctx.layer({ kind: 'mid', z: 3 }, (layer) => {
      const sec = cache.secondaryLantern
      const secScale = Math.max(0.65, h / 320)
      const secMeta = drawStoneLantern(layer, sec.x, sec.y, secScale)
      ;(cache as { secondaryLantern: LanternPos }).secondaryLantern = { ...sec, ...secMeta }

      const gates = [
        { baseV: 0.56, topV: 0.525, wRatio: 0.048, thick: Math.max(1, Math.round(w * 0.004)) },
        { baseV: 0.60, topV: 0.515, wRatio: 0.075, thick: Math.max(1, Math.round(w * 0.006)) },
        { baseV: 0.67, topV: 0.500, wRatio: 0.118, thick: Math.max(2, Math.round(w * 0.009)) },
        { baseV: 0.77, topV: 0.488, wRatio: 0.175, thick: Math.max(3, Math.round(w * 0.013)) },
        { baseV: 0.90, topV: 0.475, wRatio: 0.255, thick: Math.max(4, Math.round(w * 0.018)) },
      ]
      let lastRim = { rightRimX: 0, rimY0: 0, rimY1: 0 }
      for (const g of gates) {
        const baseY = Math.round(h * g.baseV)
        const topY = Math.round(h * g.topV)
        const depth = (baseY - vpY) / Math.max(1, h - vpY)
        const geom = getPathGeometry(w, depth)
        lastRim = drawToriiGate(
          layer,
          geom.center,
          baseY,
          Math.max(10, Math.round(w * g.wRatio)),
          Math.max(8, baseY - topY),
          g.thick,
          true,
        )
      }
      ;(cache as { gate5RightRim: { x: number; y0: number; y1: number } }).gate5RightRim = {
        x: lastRim.rightRimX,
        y0: lastRim.rimY0,
        y1: lastRim.rimY1,
      }

      // Primary Hero Carved Stone Lantern (ishidōrō) beside right kerb (u=0.79, v=0.84)
      const pri = cache.primaryLantern
      const priScale = Math.max(0.8, Math.min(1.45, h / 210))
      const priMeta = drawStoneLantern(layer, pri.x, pri.y, priScale)
      ;(cache as { primaryLantern: LanternPos }).primaryLantern = { ...pri, ...priMeta }

      const clearFoot = (cx: number, by: number, hw: number, hh: number) => {
        for (let y = by - hh; y <= by; y++) {
          for (let x = cx - hw; x <= cx + hw; x++) {
            cache.groundMask.set(x, y, 0)
          }
        }
      }
      clearFoot(pri.x, pri.y, Math.round(7 * priScale), Math.round(25 * priScale))
      clearFoot(sec.x, sec.y, Math.round(6 * secScale), Math.round(20 * secScale))
    })

    // 5. Near Giant Framing Torii Gate — Lintel raised to v <= 0.10 to clear the /new form card!
    ctx.layer({ kind: 'near', z: 4 }, (layer) => {
      const fgBaseY = Math.round(h * 0.99)
      const fgLeftX = Math.round(w * 0.115)
      const fgPostW = Math.max(4, Math.round(w * 0.025))
      const fgRightX = Math.round(w * 0.875)
      const fgKasagiY = Math.round(h * 0.028)
      const fgKasagiH = Math.max(3, Math.round(h * 0.024))
      const fgNukiY = Math.round(h * 0.070)
      const fgNukiH = Math.max(2, Math.round(h * 0.016))

      const markNear = (x: number, y: number, ink: number) => {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          layer.px(x, y, ink)
          cache.nearMask.set(x, y, 15)
          cache.groundMask.set(x, y, 0)
        }
      }

      // Giant Kasagi upper lintel (v = 0.01..0.052, completely above /new card)
      const beamStartX = Math.round(w * 0.05)
      const beamEndX = Math.round(w * 0.97)
      const beamCenter = (beamStartX + beamEndX) / 2
      const beamHalf = Math.max(1, (beamEndX - beamStartX) / 2)
      const capSpan = Math.max(2, Math.round(w * 0.022))

      for (let x = beamStartX; x < beamEndX; x++) {
        const norm = (x - beamCenter) / beamHalf
        const lift = Math.round(norm * norm * Math.max(1, h * 0.016))
        const by = fgKasagiY - lift
        const isEndCap = x < beamStartX + capSpan || x >= beamEndX - capSpan
        for (let dy = 0; dy < fgKasagiH; dy++) {
          const py = by + dy
          const ink = isEndCap
            ? (dy === 0 ? 20 : 19)
            : dy === 0
              ? 18
              : dy === fgKasagiH - 1
                ? 15
                : x > beamCenter ? 17 : 16
          markNear(x, py, ink)
        }
      }

      // Giant Nuki lower crossbeam (v = 0.070..0.086 <= 0.10, clearing /new form card)
      for (let x = Math.round(w * 0.085); x < Math.round(w * 0.93); x++) {
        for (let dy = 0; dy < fgNukiH; dy++) {
          markNear(x, fgNukiY + dy, dy === 0 ? (x > beamCenter ? 18 : 17) : 15)
        }
      }

      // Central Gakuzuka nameplate between kasagi & nuki
      const plaqueHalf = Math.max(2, Math.round(fgPostW * 0.65))
      const cxMid = Math.round((fgLeftX + fgRightX + fgPostW) / 2)
      for (let x = cxMid - plaqueHalf; x <= cxMid + plaqueHalf; x++) {
        for (let y = fgKasagiY + fgKasagiH; y < fgNukiY; y++) {
          const isFrame = x === cxMid - plaqueHalf || x === cxMid + plaqueHalf
          markNear(x, y, isFrame ? 19 : 15)
        }
      }

      // Giant Left & Right Pillars in outer gutters
      const cuffTop = fgBaseY - Math.max(4, Math.round(h * 0.085))
      for (let x = fgLeftX; x < fgLeftX + fgPostW; x++) {
        const isLitEdge = x === fgLeftX + fgPostW - 1
        for (let y = fgKasagiY; y < fgBaseY; y++) {
          const isCuff = y >= cuffTop
          markNear(x, y, isCuff ? 19 : (isLitEdge ? 17 : (x === fgLeftX ? 15 : 16)))
        }
      }

      for (let x = fgRightX; x < fgRightX + fgPostW; x++) {
        const isRim = x === fgRightX + fgPostW - 1
        const isInnerShadow = x === fgRightX
        for (let y = fgKasagiY; y < fgBaseY; y++) {
          const isCuff = y >= cuffTop
          markNear(x, y, isCuff ? (isRim ? 20 : 19) : (isRim ? 18 : (isInnerShadow ? 15 : 17)))
        }
      }

      // Directional cast shadows from the giant foreground pillars
      const fgShadowLen = Math.max(6, Math.round(w * 0.065))
      for (let i = 0; i < fgShadowLen; i++) {
        const sy = Math.round(fgBaseY + i * 0.15)
        if (sy < h) {
          for (let t = 0; t < fgPostW; t++) {
            const sxL = fgLeftX - i + t
            const sxR = fgRightX - i + t
            if (sxL >= 0 && sxL < w) layer.px(sxL, sy, 8)
            if (sxR >= 0 && sxR < w) layer.px(sxR, sy, 8)
          }
        }
      }
    })

    // Pre-warm particle pool so t=0 static snapshots & reduced-motion show falling autumn leaves mid-air
    for (let step = 0; step < 60; step++) {
      advanceLeaves(cache, 0.1, step * 0.1, w, h)
    }
    cache.lastT = 0
  },

  frame(ctx: FrameCtx, t: number, dt: number): void {
    const { width: w, height: h } = ctx
    const cache = sceneCache.get(ctx.base)
    if (!cache) return

    const vpY = Math.floor(h * 0.48)
    const { center: vpX } = getPathGeometry(w, 0)

    if (t < cache.lastT || (dt <= 0 && t !== cache.lastT)) {
      for (const p of cache.pool.particles) p.active = false
      const simBase = Math.max(0, t)
      for (let step = 0; step < 60; step++) {
        advanceLeaves(cache, 0.1, simBase + step * 0.1, w, h)
      }
    } else if (dt > 0) {
      advanceLeaves(cache, Math.min(0.2, dt), t, w, h)
    }
    cache.lastT = t

    // Night canopy stars (time-bound in frame() so setPalette() updates immediately)
    const nightAmt = darkness(ctx.time)
    if (nightAmt >= 0.85) {
      const skyBottom = Math.floor(h * 0.48)
      for (let i = 0; i < 16; i++) {
        const sx = Math.floor((0.36 + ((i * 0.317 + ctx.seed * 0.07) % 1) * 0.46) * w)
        const sy = Math.floor((0.04 + ((i * 0.618 + ctx.seed * 0.11) % 1) * 0.20) * h)
        if (sy < skyBottom - 6 && !cache.nearMask.contains(sx, sy) && ctx.base[sy * w + sx]! <= 3) {
          ctx.px(sx, sy, i % 3 === 0 ? 31 : 3)
        }
      }
    }

    // Effect 1: Drifting Mountain Mist at the far tunnel bend (0.18 px/s, quantized at 3 fps)
    ctx.layer({ kind: 'fog', z: 2 }, (layer) => {
      const mistShift = Math.floor(t * 3) * 0.06
      const mistTop = Math.max(0, vpY - 4)
      const mistBot = Math.min(h, vpY + Math.max(8, Math.round(h * 0.07)))
      const mistLeft = Math.max(0, Math.floor(vpX - w * 0.16))
      const mistRight = Math.min(w, Math.ceil(vpX + w * 0.16))
      for (let y = mistTop; y < mistBot; y++) {
        for (let x = mistLeft; x < mistRight; x++) {
          if (cache.nearMask.contains(x, y)) continue
          const baseInk = ctx.base[y * w + x]!
          if (baseInk < 4 || baseInk > 14) continue
          const m = layer.fbm2((x / w) * 14 + mistShift, (y / h) * 16)
          if (m > 0.60) {
            layer.px(x, y, m > 0.72 ? 31 : 30)
          }
        }
      }
    })

    // Effect 2: Breathing Stone Lantern Flame & 3-Stage Radial Ground Glow (when dusk/night)
    if (nightAmt >= 0.45) {
      const pulse = 1 + Math.sin(t * ((Math.PI * 2) / 5.0)) * 0.07
      drawRadialLanternGlow(ctx, cache.secondaryLantern, cache.groundMask, pulse)
      drawRadialLanternGlow(ctx, cache.primaryLantern, cache.groundMask, pulse)

      const flicker = Math.sin(t * 4.8 + 0.7) * 0.5 + Math.sin(t * 10.3) * 0.35
      lightLanternChamber(ctx, cache.primaryLantern, flicker)
      lightLanternChamber(ctx, cache.secondaryLantern, flicker)

      const rim = cache.gate5RightRim
      for (let y = rim.y0; y < rim.y1; y++) {
        if (y >= 0 && y < h && rim.x >= 0 && rim.x < w) ctx.px(rim.x, y, 29)
      }
    }

    // Effect 3: Mid-depth Falling Maple Leaves (occluded behind near giant Torii!)
    ctx.layer({ kind: 'fx', z: 5 }, (layer) => {
      for (let i = 0; i < cache.pool.particles.length; i++) {
        const p = cache.pool.particles[i]!
        if (!p.active || cache.leafTier[i] !== 0) continue
        const px = Math.round(p.x)
        const py = Math.round(p.y)
        if (px < 0 || px >= w || py < 0 || py >= h) continue
        if (cache.nearMask.contains(px, py)) continue
        const ink = i % 3 === 0 ? 27 : 26
        layer.px(px, py, ink)
        if (px + 1 < w && !cache.nearMask.contains(px + 1, py)) {
          layer.px(px + 1, py, i % 2 === 0 ? 25 : ink)
        }
      }
    })

    // Effect 4: Lush 1:1 4-Pose Swaying Momiji Maple Canopy Sprays in upper corners (cleanly attached to boughs)
    const branchPose = Math.floor(t * 2) % 4
    const swayX = Math.round(Math.sin(t * 1.6) * 1.0)
    ctx.spriteFrame(branchSheet, branchPose, Math.max(0, swayX), 0, 1)
    ctx.spriteFrame(rightSprigSheet, (branchPose + 1) % 4, w - swayX, 0, 1)

    // Effect 5: Near-depth Tumbling 4-Pose Maple Leaf Sprites (passing in front of near Torii)
    for (let i = 0; i < cache.pool.particles.length; i++) {
      const p = cache.pool.particles[i]!
      if (!p.active || cache.leafTier[i] !== 1) continue
      const pose = Math.floor(t * 4 + i) % 4
      ctx.spriteFrame(leafSheet, pose, Math.round(p.x), Math.round(p.y), 1)
    }
  },
}

/** Deterministic wind gust + particle pool advance for falling momiji leaves */
function advanceLeaves(cache: KyotoCache, dt: number, t: number, w: number, h: number): void {
  const cycle = t % 12
  const gust = cycle > 9.0 ? Math.sin(((cycle - 9.0) / 3.0) * Math.PI) : 0
  const wind = 4.5 + gust * 7.5

  for (let i = 0; i < cache.pool.particles.length; i++) {
    const p = cache.pool.particles[i]!
    const tier = cache.leafTier[i]!
    const ph = cache.leafPhase[i]!
    if (!p.active) {
      const sx = ((i * 0.6180339 + t * 0.07) % 1) * w * 0.42 + w * 0.02
      const sy = ((i * 0.381966) % 1) * h * 0.14
      cache.pool.spawn({
        x: sx,
        y: sy,
        vx: wind * (tier === 1 ? 1.2 : 0.75),
        vy: tier === 1 ? 11 + (i % 4) * 1.5 : 6 + (i % 5) * 1.1,
        life: 6.5 + (i % 4) * 1.2,
        index: 26,
      })
    } else {
      p.vx = wind * (tier === 1 ? 1.15 : 0.7) + Math.sin(t * 2.4 + ph) * (tier === 1 ? 5.5 : 3.2)
    }
  }
  cache.pool.advance(dt)
}

export default kyoto
