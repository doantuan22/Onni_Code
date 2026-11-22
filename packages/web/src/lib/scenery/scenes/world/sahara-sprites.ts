import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { Palettes, ThemePalettes } from '../../engine/types'

/**
 * 32-role semantic palette layout for `world-sahara`:
 *  0–3   sky zenith -> horizon
 *  4–5   sun core / halo (matches sky[1] at night so no white sun disc appears)
 *  6–7   moon / quiet night stars (matches sky[0] in daytime)
 *  8–9   far dune 1 lit / shadow (atmospheric haze)
 * 10–11  far dune 2 lit / shadow
 * 12–13  low desert haze / dust band
 * 14–18  mid S-curve sand ramp (rim highlight -> sunlit -> mid -> ripple -> warm shadow)
 * 19–21  mid leeward slip-face violet/plum shadow ramp + footprint shadow
 * 22–24  foreground near dune lit / mid / shadow
 * 25–27  camel caravan silhouette / body / saddle accent
 * 28–29  foreground dry grass & stones body / sunlit tip
 * 30–31  wind-blown sand particles bright / mid
 */
export const SAHARA_THEME_PALETTES: ThemePalettes = {
  light: {
    dawn: [
      0x7c80a2, 0xb094a8, 0xd9a89d, 0xf0c9a0,
      0xf8dfb2, 0xf2be94, 0x7c80a2, 0x7c80a2,
      0xc6a8a5, 0xb49699, 0xba958d, 0xa27e82,
      0xe4be9e, 0xd0a793,
      0xf5d6a4, 0xebb989, 0xd49a74, 0xc18569, 0xad7464,
      0x926572, 0x7c5468, 0x614155,
      0xb28067, 0x996959, 0x734d4a,
      0x4e404a, 0x755958, 0xe8cfb0,
      0x645249, 0xc39c73,
      0xf6deaf, 0xdda77f,
    ],
    day: [
      0x9dc4d4, 0xb6d0d6, 0xd2d7ca, 0xe5d2b3,
      0xfff1c8, 0xf4dcb2, 0x9dc4d4, 0x9dc4d4,
      0xc7b6a2, 0xb8a28e, 0xbd9d88, 0xa68478,
      0xdfcbb0, 0xc9b097,
      0xf3dbaa, 0xeacb8f, 0xcca274, 0xba8e68, 0xa87a62,
      0x967079, 0x8b6571, 0x714f5d,
      0xba8e69, 0xa47b5a, 0x7a574b,
      0x57494c, 0x7b5f58, 0xe9d7a8,
      0x6e5d48, 0xb79c6d,
      0xf6e4b8, 0xdfb985,
    ],
    dusk: [
      0x6d6a92, 0xa27f94, 0xd69b88, 0xebb88c,
      0xf7d19c, 0xe5a47d, 0x6d6a92, 0x6d6a92,
      0xb6959c, 0x9f7e8a, 0xab8282, 0x916a76,
      0xd9a88e, 0xc18e7e,
      0xf3cb93, 0xe6ae7c, 0xc98a6c, 0xb57563, 0x9f645e,
      0x86596b, 0x734b60, 0x593a4f,
      0xa67461, 0x8c5e54, 0x684546,
      0x493c47, 0x6e5252, 0xe6c79c,
      0x5c4a46, 0xb98d68,
      0xf6d59e, 0xd59672,
    ],
    night: [
      0x394b6e, 0x4b5d80, 0x677492, 0x8a8fa6,
      0x4b5d80, 0x4b5d80, 0xe4ecf4, 0x9eb0c8,
      0x777e98, 0x666d88, 0x6d708c, 0x5b5f7c,
      0x80879e, 0x707790,
      0xb8becc, 0x9ca3b5, 0x82889e, 0x71778f, 0x606680,
      0x515874, 0x444b66, 0x343b54,
      0x6a6e86, 0x585d75, 0x42475f,
      0x2f3448, 0x4b4f64, 0xa8b2c4,
      0x3d4256, 0x7c849b,
      0xc4cad6, 0x8f96ab,
    ],
  },
  dark: {
    dawn: [
      0x2b2d4d, 0x58496c, 0x966b78, 0xc9937e,
      0xf4cc95, 0xd59174, 0x2b2d4d, 0x2b2d4d,
      0x7e657a, 0x685269, 0x725164, 0x5b4257,
      0xa87777, 0x885f6b,
      0xf0c28b, 0xdfa274, 0xb27168, 0x975b63, 0x7d4b5c,
      0x563f59, 0x40314b, 0x2c233a,
      0x7c515c, 0x624050, 0x412c3c,
      0x2a2538, 0x4a3846, 0xc38e73,
      0x382c3a, 0x966e5e,
      0xf2ca94, 0xc8846c,
    ],
    day: [
      0x3f6482, 0x5b7f98, 0x8ea4a9, 0xc2b296,
      0xf8e2b2, 0xd8c39b, 0x3f6482, 0x3f6482,
      0x8e8682, 0x7a7172, 0x86746b, 0x715f5c,
      0xac9a85, 0x948174,
      0xe7c68c, 0xd3aa73, 0xb1835e, 0x9a6f56, 0x845c4e,
      0x67505a, 0x52404d, 0x3c2e3b,
      0x8c634f, 0x735043, 0x4f3835,
      0x332b32, 0x56433e, 0xd0b88e,
      0x463a33, 0x947a57,
      0xebd09a, 0xc39468,
    ],
    dusk: [
      0x3b3658, 0x624a6b, 0x966875, 0xc58c79,
      0xf8cc8e, 0xdf9c79, 0x3b3658, 0x3b3658,
      0x907482, 0x806779, 0x7d596d, 0x67495e,
      0xb27d78, 0x95676f,
      0xf5ca8d, 0xedb879, 0xbe7b6f, 0xa1626a, 0x895368,
      0x5a445e, 0x423650, 0x2f273e,
      0x855966, 0x6b495b, 0x432f41,
      0x302c40, 0x523e4e, 0xc18a72,
      0x3e3142, 0x9e7565,
      0xf8d59c, 0xd28e73,
    ],
    night: [
      0x131d35, 0x1e2b47, 0x2f3d5b, 0x495370,
      0x1e2b47, 0x1e2b47, 0xd6e2f2, 0x7f93b2,
      0x3b4462, 0x2f3754, 0x383c59, 0x2b2f4b,
      0x434b68, 0x373e5a,
      0x8e8fa6, 0x6f6e88, 0x57526e, 0x49435f, 0x3d3852,
      0x302c46, 0x242239, 0x18172b,
      0x453e59, 0x353048, 0x221f33,
      0x161626, 0x2c2b3e, 0x8a7d8a,
      0x201f32, 0x59576d,
      0x9b9cb2, 0x696782,
    ],
  },
}

export const SAHARA_LEGACY_PALETTES: Palettes = SAHARA_THEME_PALETTES.light

const camelLegend = { a: 25, b: 26, c: 27 } as const

/** Lead camel 24x14: 4 hand-drawn walking poses facing right (+u). */
const camelLargeSprite = parseSprite([
  // Pose 0: wide stride (front right forward, rear left back)
  '....................bbb.',
  '...................bbba.',
  '........ccc.......bbb...',
  '.......ccccc......bb....',
  '......ccbbbcc....bbb....',
  '.....bbbbbbbbbbbbbb.....',
  '....abbbbbbbbbbbbb......',
  '...a.bbbbbbbbbbbb.......',
  '..a..aaabaa..aaaba......',
  '.....aa..aa...aa.aa.....',
  '....aa....a...a...aa....',
  '....a.....aa..a....a....',
  '...aa......a..aa...aa...',
  '........................',
  // Pose 1: passing step, neck slightly lowered
  '........................',
  '....................bbb.',
  '........ccc........bbba.',
  '.......ccccc......bbb...',
  '......ccbbbcc....bbb....',
  '.....bbbbbbbbbbbbbb.....',
  '....abbbbbbbbbbbbb......',
  '...a.bbbbbbbbbbbb.......',
  '..a..aabaa...aabaa......',
  '.....aa.aa...aa.aa......',
  '.....aa.a.....a.aa......',
  '.....a..aa...aa..a......',
  '.....aa..a...a...aa.....',
  '........................',
  // Pose 2: opposite stride (rear forward, front back)
  '....................bbb.',
  '...................bbba.',
  '........ccc.......bbb...',
  '.......ccccc......bb....',
  '......ccbbbcc....bbb....',
  '.....bbbbbbbbbbbbbb.....',
  '....abbbbbbbbbbbbb......',
  '...a.bbbbbbbbbbbb.......',
  '..a..aabaa...aabaa......',
  '.....a..aa...aa..a......',
  '.....a...aa.aa...a......',
  '.....aa..aa.aa..aa......',
  '......a...a.a...a.......',
  '........................',
  // Pose 3: gathering step
  '........................',
  '....................bbb.',
  '........ccc........bbba.',
  '.......ccccc......bbb...',
  '......ccbbbcc....bbb....',
  '.....bbbbbbbbbbbbbb.....',
  '....abbbbbbbbbbbbb......',
  '...a.bbbbbbbbbbbb.......',
  '..a..aabaa...aabaa......',
  '.....aa.aa...aa.aa......',
  '....aa..a.....a..aa.....',
  '....a...a.....a...a.....',
  '....a...aa...aa...a.....',
  '........................',
], camelLegend)

export const camelLargeSheet = createSpriteSheet(camelLargeSprite, [
  { x: 0, y: 0, width: 24, height: 14, pivot: { x: 12, y: 13 } },
  { x: 0, y: 14, width: 24, height: 14, pivot: { x: 12, y: 13 } },
  { x: 0, y: 28, width: 24, height: 14, pivot: { x: 12, y: 13 } },
  { x: 0, y: 42, width: 24, height: 14, pivot: { x: 12, y: 13 } },
])

/** Mid camel 17x10: 4 hand-drawn walking poses facing right (+u). */
const camelMidSprite = parseSprite([
  // Pose 0
  '..............bb.',
  '.....ccc.....bbba',
  '....ccbcc....bb..',
  '...bbbbbbbbbbb...',
  '..abbbbbbbbbb....',
  '.a..aabaa.aabaa..',
  '....a..aa..a..aa.',
  '...aa...a..a...a.',
  '...a....a..a...a.',
  '.................',
  // Pose 1
  '.................',
  '..............bb.',
  '.....ccc.....bbba',
  '....ccbcc...bbb..',
  '...bbbbbbbbbbb...',
  '..abbbbbbbbbb....',
  '.a..aabaa.aabaa..',
  '....aa.a...a.aa..',
  '....a..aa.aa..a..',
  '.................',
  // Pose 2
  '..............bb.',
  '.....ccc.....bbba',
  '....ccbcc....bb..',
  '...bbbbbbbbbbb...',
  '..abbbbbbbbbb....',
  '.a..aabaa.aabaa..',
  '....a..a...a..a..',
  '....a..aa.aa..a..',
  '....aa..a.a..aa..',
  '.................',
  // Pose 3
  '.................',
  '..............bb.',
  '.....ccc.....bbba',
  '....ccbcc...bbb..',
  '...bbbbbbbbbbb...',
  '..abbbbbbbbbb....',
  '.a..aabaa.aabaa..',
  '...aa..a...a..aa.',
  '...a...a...a...a.',
  '.................',
], camelLegend)

export const camelMidSheet = createSpriteSheet(camelMidSprite, [
  { x: 0, y: 0, width: 17, height: 10, pivot: { x: 8, y: 9 } },
  { x: 0, y: 10, width: 17, height: 10, pivot: { x: 8, y: 9 } },
  { x: 0, y: 20, width: 17, height: 10, pivot: { x: 8, y: 9 } },
  { x: 0, y: 30, width: 17, height: 10, pivot: { x: 8, y: 9 } },
])

/** Far camel 12x7: 4 hand-drawn walking poses facing right (+u). */
const camelSmallSprite = parseSprite([
  // Pose 0
  '..........bb',
  '...cc....bbb',
  '..bbbbbbbb..',
  '.abbbbbbb...',
  '..aa.a.a.a..',
  '.a...a.a..a.',
  '............',
  // Pose 1
  '............',
  '...cc.....bb',
  '..bbbbbbabbb',
  '.abbbbbbb...',
  '..aa.a.aa...',
  '..a..a..a...',
  '............',
  // Pose 2
  '..........bb',
  '...cc....bbb',
  '..bbbbbbbb..',
  '.abbbbbbb...',
  '..a.aa.aa...',
  '..a..a.a....',
  '............',
  // Pose 3
  '............',
  '...cc.....bb',
  '..bbbbbbabbb',
  '.abbbbbbb...',
  '..aa.a.aa...',
  '.a...a..a...',
  '............',
], camelLegend)

export const camelSmallSheet = createSpriteSheet(camelSmallSprite, [
  { x: 0, y: 0, width: 12, height: 7, pivot: { x: 6, y: 6 } },
  { x: 0, y: 7, width: 12, height: 7, pivot: { x: 6, y: 6 } },
  { x: 0, y: 14, width: 12, height: 7, pivot: { x: 6, y: 6 } },
  { x: 0, y: 21, width: 12, height: 7, pivot: { x: 6, y: 6 } },
])

/** Dry desert grass tuft 8x10: 3 wind-sway poses anchored at bottom center. */
const grassSprite = parseSprite([
  // Pose 0: calm upright
  '...b....',
  '..b.b.b.',
  '..a.b.b.',
  '.ba.a.a.',
  '..a.a.b.',
  '..aaaaa.',
  '...aaa..',
  '...aaa..',
  '..aaaaa.',
  '........',
  // Pose 1: gentle lean right
  '....b...',
  '...b.b.b',
  '..ba.b.a',
  '..a..a.a',
  '..aa.aa.',
  '...aaaa.',
  '...aaa..',
  '...aaa..',
  '..aaaaa.',
  '........',
  // Pose 2: gust lean right
  '.....b..',
  '....b.bb',
  '...ba.ba',
  '...a..a.',
  '..aa.aa.',
  '...aaaa.',
  '...aaa..',
  '...aaa..',
  '..aaaaa.',
  '........',
], { a: 28, b: 29 })

export const dryGrassSheet = createSpriteSheet(grassSprite, [
  { x: 0, y: 0, width: 8, height: 10, pivot: { x: 4, y: 9 } },
  { x: 0, y: 10, width: 8, height: 10, pivot: { x: 4, y: 9 } },
  { x: 0, y: 20, width: 8, height: 10, pivot: { x: 4, y: 9 } },
])
