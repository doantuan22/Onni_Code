import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { Palettes, Sprite, ThemePalettes } from '../../engine/types'

/**
 * 32-role semantic palette layout for `world-matterhorn`:
 *  0–3   sky zenith -> horizon
 *  4     sun disc (matches sky[1] at night)
 *  5     moon & quiet alpine stars (matches sky[0] in daytime)
 *  6     high cloud lit top / smoke wisp
 *  7     cloud belly
 *  8–9   far range lit / shade (haze)
 * 10–11  foothill lit / shade
 * 12     snow, sunlit (also the summit glint and snow-dusted tree tips)
 * 13     snow, midtone (couloir streaks, cabin roof)
 * 14     snow, cold shadow (north face)
 * 15     alpenglow (warm light on the east face at dawn/dusk)
 * 16–21  6-phase lake water cycle
 * 22     lake deep base / reflection shadow
 * 23     granite, sunlit warm
 * 24     granite, midtone (strata bands)
 * 25     granite, shadow / bird silhouette
 * 26     conifer light (lit boughs)
 * 27     conifer midtone
 * 28     conifer dark / trunk / forest mass
 * 29     cabin timber
 * 30     cabin window glow
 * 31     meadow / shore accent
 */
export const MATTERHORN_THEME_PALETTES: ThemePalettes = {
  light: {
    dawn: [
      0x6d92b6, 0x9bbbd2, 0xcfd3d4, 0xeccab2,
      0xfbe2b0, 0x6d92b6,
      0xfbf0e6, 0xd3c4cc,
      0x9ab3c6, 0x7f97b2,
      0x7d95b0, 0x627a9a,
      0xf4eee8, 0xc4d4e3, 0x7d93ae,
      0xf0a68a,
      0x4e7991, 0x537f96, 0x608a9f, 0x86a6b0, 0xb2c5be, 0xc9d5ca,
      0x3b627c,
      0xb9a18c, 0x7d8594, 0x4a5366,
      0x6c9a8a, 0x3f6e62, 0x243f40,
      0x7a5b4a, 0xffd27a,
      0x8c9a78,
    ],
    day: [
      0x4f86b4, 0x7fb0d2, 0xb3d3e2, 0xdfeee9,
      0xfff4cc, 0x4f86b4,
      0xfdfdf8, 0xc9dbe6,
      0xa3bfd4, 0x86a4bf,
      0x7e9dba, 0x6485a2,
      0xfbfdff, 0xd2e0ec, 0x8ca7c0,
      0xe8b89a,
      0x447d96, 0x4c879f, 0x5d96aa, 0x83b0bc, 0xadc9ce, 0xc9dedb,
      0x336580,
      0xc3b49a, 0x7b8694, 0x454f60,
      0x5f9a88, 0x3e7063, 0x244a45,
      0x7e5b47, 0xffd978,
      0x9aa77f,
    ],
    dusk: [
      0x3e4a78, 0x7a6b96, 0xbe8f9c, 0xe6a98f,
      0xf7bf93, 0x3e4a78,
      0xf0cfc0, 0x9a8aa6,
      0x7f7896, 0x66628a,
      0x60608a, 0x4b4f7a,
      0xf2d2c4, 0xb6a9c4, 0x6e6f96,
      0xf19a84,
      0x476885, 0x4e708c, 0x5d7c95, 0x8294a6, 0xa9aebb, 0xc7bab9,
      0x35506d,
      0x9c8a8a, 0x66607a, 0x3e3f57,
      0x4d6a5e, 0x33554e, 0x1f3a3a,
      0x5e4a49, 0xf2bf78,
      0x7d7c70,
    ],
    night: [
      0x2d4163, 0x3d5478, 0x556c8e, 0x7185a3,
      0x3d5478, 0xe3ecf5,
      0x7b90ad, 0x586d8c,
      0x506484, 0x425675,
      0x435776, 0x354866,
      0xc6d6e6, 0x8fa6c0, 0x5c7692,
      0x7f8fb8,
      0x304e6b, 0x365774, 0x416480, 0x597c96, 0x7697ad, 0x94b1c2,
      0x243e58,
      0x6f7790, 0x4d5a72, 0x323d52,
      0x3d5c58, 0x2b4a4c, 0x1b3134,
      0x4a434c, 0xf2c278,
      0x8ea2ba,
    ],
  },
  dark: {
    dawn: [
      0x2a3a5c, 0x4d5b83, 0x8a6f8a, 0xc08f88,
      0xf0c08a, 0x2a3a5c,
      0xd4b6aa, 0x7b6c86,
      0x5b6283, 0x4a5172,
      0x4d5274, 0x3a4262,
      0xe8b8a0, 0x9d93b4, 0x4a5a7c,
      0xc77f74,
      0x314a66, 0x385470, 0x45627c, 0x677c8f, 0x8c95a3, 0xb2a8a6,
      0x22364f,
      0x7c6f70, 0x515a70, 0x2e3648,
      0x3d5a58, 0x2c4640, 0x1a2e2f,
      0x5d4a44, 0xf2be74,
      0x6b7088,
    ],
    day: [
      0x1f3b5a, 0x33557a, 0x4f7194, 0x6f8fa8,
      0xe8d6a0, 0x1f3b5a,
      0xb8c8d6, 0x6a8299,
      0x46607c, 0x3a5067,
      0x3c5670, 0x2c4157,
      0xc7d7e4, 0x7f9bb2, 0x3f5b78,
      0x9c7a7c,
      0x2e5570, 0x365f7a, 0x446d86, 0x62899c, 0x84a5b2, 0xa5bebf,
      0x203f58,
      0x7d8190, 0x4d5b6d, 0x2b3644,
      0x3c6456, 0x2a4c42, 0x183229,
      0x5a4638, 0xe3b96a,
      0x8aa3b0,
    ],
    dusk: [
      0x1a2140, 0x2c2f56, 0x5a4766, 0x8a5a68,
      0xe89a6e, 0x1a2140,
      0x9e7f88, 0x4c4470,
      0x3a3c60, 0x2e3050,
      0x34365a, 0x272a46,
      0xb88c8c, 0x7e7898, 0x3a4262,
      0xb0606a,
      0x273e58, 0x2e4862, 0x3a546e, 0x576b80, 0x7a8394, 0x9f9698,
      0x1b2d44,
      0x5b5570, 0x3b3b55, 0x22243a,
      0x33504a, 0x233f3e, 0x14282a,
      0x4a3438, 0xf2bc6e,
      0x7a7090,
    ],
    night: [
      0x0f1a2e, 0x17243c, 0x203250, 0x2c4262,
      0x17243c, 0xdce6f2,
      0x4a5f7e, 0x2d4060,
      0x2a3a58, 0x202e47,
      0x243350, 0x1b2a40,
      0x9fb4cc, 0x6c86a4, 0x3a5070,
      0x5a6b92,
      0x1c3350, 0x233f5a, 0x2d4c66, 0x3e5f78, 0x587690, 0x7290a6,
      0x142338,
      0x3a4458, 0x2b3346, 0x1b212e,
      0x2b3f48, 0x1e3236, 0x101c24,
      0x3a3442, 0xe8b96a,
      0x607090,
    ],
  },
}

export const MATTERHORN_LEGACY_PALETTES: Palettes = MATTERHORN_THEME_PALETTES.light

const coniferLegend = { s: 26, S: 12, m: 27, d: 28 } as const

/**
 * Procedural conifer: a stacked-tier silhouette `height` rows tall (10–14 art px),
 * `maxHalf` columns out from the trunk. Tier notches and snow-dusted tier ends vary
 * with `variant`, so the treeline reads as many different trees rather than stamps.
 */
function conifer(height: number, maxHalf: number, variant: number): Sprite {
  const trunk = height >= 11 ? 2 : 1
  const crown = height - trunk
  const width = maxHalf * 2 + 1
  const rows: string[] = []
  for (let r = 0; r < crown; r++) {
    const f = (r + 1) / crown
    let half = Math.round(f * maxHalf)
    const tier = r % 3
    if (tier === 0 && r > 0 && half > 1 && (r + variant) % 2 === 0) half -= 1
    let row = ''
    for (let c = 0; c < width; c++) {
      const dx = c - maxHalf
      if (Math.abs(dx) > half) row += '.'
      else if (r === 0 && dx === 0) row += 's'
      else if (dx === -half && tier === 0 && half >= 2) row += 'S'
      else if (dx < 0) row += 'm'
      else if (dx === 0) row += 'm'
      else row += 'd'
    }
    rows.push(row)
  }
  for (let t = 0; t < trunk; t++) {
    let row = ''
    for (let c = 0; c < width; c++) row += c === maxHalf ? 'd' : '.'
    rows.push(row)
  }
  return parseSprite(rows, coniferLegend)
}

/** Treeline library: 10–14 px conifers in four sizes and several silhouettes. */
export const treeSmall: readonly Sprite[] = [conifer(10, 2, 0), conifer(10, 2, 1), conifer(11, 3, 2)]
export const treeMedium: readonly Sprite[] = [conifer(12, 3, 0), conifer(12, 3, 1), conifer(13, 3, 2)]
export const treeLarge: readonly Sprite[] = [conifer(14, 4, 0), conifer(14, 4, 1), conifer(14, 3, 2)]

/** Alpine cabin 18x14: scale anchor in the valley with snow roof & lit window. */
export const alpineCabin = parseSprite([
  '.............dd...',
  '.............dd...',
  '.......ssssssdd...',
  '.....ssssssssmm...',
  '...ssssssssmmmm...',
  '.ssssssssmmmmmm...',
  'ssssmmmmmmmmmmmm..',
  '..dddddddddddddd..',
  '..dbbbddwddbbbbd..',
  '..dbbbdwwwdbbbbd..',
  '..dbbbddwddbbbbd..',
  '..dbbbdddddbaabd..',
  '..dddddddddddddd..',
  '..................',
], { s: 12, m: 13, d: 25, b: 29, w: 30, a: 23 })

/** Chimney smoke 12x12: 4 curling rising puff poses. */
const smokeSprite = parseSprite([
  // Pose 0
  '............',
  '........aa..',
  '.......aaa..',
  '........a...',
  '......aa....',
  '.....aaa....',
  '......a.....',
  '....aa......',
  '...aa.......',
  '...a........',
  '..a.........',
  '............',
  // Pose 1
  '.........aa.',
  '........aa..',
  '.......aa...',
  '......aa....',
  '.....aaa....',
  '......a.....',
  '.....aa.....',
  '....aa......',
  '...aa.......',
  '..aa........',
  '..a.........',
  '............',
  // Pose 2
  '........aa..',
  '.......aaa..',
  '.......a....',
  '......aa....',
  '.....aaa....',
  '.....aa.....',
  '....aa......',
  '...aaa......',
  '...a........',
  '..aa........',
  '..a.........',
  '............',
  // Pose 3
  '.......aa...',
  '......aaa...',
  '......aa....',
  '.......a....',
  '.....aaa....',
  '....aaa.....',
  '....a.......',
  '...aa.......',
  '..aaa.......',
  '..a.........',
  '..a.........',
  '............',
], { a: 6 })

export const smokeSheet = createSpriteSheet(smokeSprite, [
  { x: 0, y: 0, width: 12, height: 12, pivot: { x: 2, y: 11 } },
  { x: 0, y: 12, width: 12, height: 12, pivot: { x: 2, y: 11 } },
  { x: 0, y: 24, width: 12, height: 12, pivot: { x: 2, y: 11 } },
  { x: 0, y: 36, width: 12, height: 12, pivot: { x: 2, y: 11 } },
])

/** Alpine bird 8x5: 4 wing-flap poses. */
const birdSprite = parseSprite([
  // Pose 0: wings up
  '.a....a.',
  '..a..a..',
  '...aa...',
  '........',
  '........',
  // Pose 1: wings glide level
  '........',
  'aa....aa',
  '..aaaa..',
  '........',
  '........',
  // Pose 2: wings down
  '........',
  '........',
  '..aaaa..',
  '.a....a.',
  'a......a',
  // Pose 3: wings recovering
  '........',
  '.a....a.',
  '..aaaa..',
  '........',
  '........',
], { a: 25 })

export const birdSheet = createSpriteSheet(birdSprite, [
  { x: 0, y: 0, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 0, y: 5, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 0, y: 10, width: 8, height: 5, pivot: { x: 4, y: 2 } },
  { x: 0, y: 15, width: 8, height: 5, pivot: { x: 4, y: 2 } },
])
