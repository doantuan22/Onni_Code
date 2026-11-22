import { createSpriteSheet, parseSprite } from '../../engine/sprite'
import type { ThemePalettes } from '../../engine/types'

/**
 * 32 Palette Roles for world-tromso:
 *  0..3:  Sky bands (zenith -> upper -> lower -> horizon)
 *  4..6:  Stars & moon (night/dusk) / cirrus & winter sun glow (day/dawn)
 *  7..10: Aurora Borealis 4-stop ramp (violet corona -> teal -> emerald -> mint core; dusk/night only)
 * 11..13: Far fjord mountains (shadow -> hazy mid -> snow crest; 12 also smoke base)
 * 14..16: Mid rocky headland (deep crag -> granite/shaded snow -> lit snow rim)
 * 17..22: Fjord water 6-phase wave cycle (subtle shimmer)
 * 23..24: Water reflections (dim aurora/sky sheen, bright aurora/sun glint)
 * 25..27: Rorbu cabin & warm emissives (Falun red timber, amber window/spill, hot window core)
 * 28..31: Near shore & snow (dark granite/pilings, granite mid/spruce, snow body/far flake, snow rim/near flake)
 */
export const tromsoThemePalettes: ThemePalettes = {
  light: {
    dawn: [
      0x7b93b2, 0x99aac4, 0xc7bac2, 0xf2d6bc,
      0xd8e0ea, 0xf2ece8, 0xffebc6,
      0xb8cadc, 0xa8c0d4, 0x98b4ca, 0xd4e4f0,
      0x526a82, 0x788ea4, 0xdbe3e8,
      0x344a60, 0x566d84, 0xf0ece8,
      0x385872, 0x40627e, 0x496d8a, 0x537996, 0x5d85a2, 0x446884,
      0xc8bec4, 0xf6d39c,
      0x92392e, 0xe8a85c, 0xffe4a8,
      0x243444, 0x445a6e, 0xcad8e2, 0xf8f3ee,
    ],
    day: [
      0x9ebcd0, 0xb3cedc, 0xc9dce4, 0xe2e4dc,
      0xd8e8f0, 0xf0f6fa, 0xfff5d8,
      0xc8dce8, 0xb8d0e0, 0xa8c4d8, 0xdcebf4,
      0x546c80, 0x768fa2, 0xd4e1e8,
      0x364d62, 0x556f84, 0xedf4f8,
      0x3b5f76, 0x436982, 0x4c748e, 0x557f9a, 0x5f8aa4, 0x486e88,
      0xbad0d8, 0xf6dfaa,
      0x96382b, 0xd89e5a, 0xf8deb0,
      0x263746, 0x445a6e, 0xc8d8e4, 0xf8fcfe,
    ],
    dusk: [
      0x203052, 0x31456c, 0x485c84, 0x686e92,
      0x9aa8c4, 0xc4d0e8, 0xf8dec0,
      0x8c68b2, 0x3cb49c, 0x54e0a0, 0xc4fce4,
      0x283a50, 0x465c74, 0x98aab8,
      0x1c2c3e, 0x364b60, 0xb6c6d2,
      0x1e344c, 0x243d58, 0x2b4764, 0x335170, 0x3b5b7a, 0x27425d,
      0x2e6f6e, 0x4eb89a,
      0x7c2d24, 0xeba44e, 0xffebb0,
      0x162230, 0x324456, 0x8ca2b4, 0xd4e2ee,
    ],
    night: [
      0x111d36, 0x182846, 0x223658, 0x2d4868,
      0x6c84aa, 0xa8c2e4, 0xecf4ff,
      0x8c64b4, 0x38b098, 0x4ee09c, 0xc0fce2,
      0x162438, 0x263c54, 0x688498,
      0x0e1a2a, 0x1e3044, 0x86a0b2,
      0x102034, 0x152840, 0x1a304c, 0x203956, 0x264262, 0x172c44,
      0x246260, 0x42b08e,
      0x6e231e, 0xe8a852, 0xffebb0,
      0x0c1420, 0x223242, 0x668094, 0xc2d6e6,
    ],
  },
  dark: {
    dawn: [
      0x1e2942, 0x343854, 0x5f4e64, 0x9c726c,
      0x8492aa, 0xbcc4ce, 0xf6cba0,
      0x6e6c92, 0x428c7c, 0x58b090, 0xa8e0c8,
      0x202c3e, 0x38485c, 0x8c96a4,
      0x141e2c, 0x28384a, 0xa8b4be,
      0x18263a, 0x1e2e44, 0x25374e, 0x2e425b, 0x364d67, 0x213248,
      0x8c706c, 0xdfa87e,
      0x6c241e, 0xe4a258, 0xffe4a8,
      0x101824, 0x2a3846, 0x7c8e9e, 0xc4d0da,
    ],
    day: [
      0x2d4358, 0x3f5a72, 0x56748c, 0x7490a4,
      0x94aec2, 0xc0d6e6, 0xf4edd8,
      0x5e7890, 0x68889e, 0x789ab0, 0x96b6c8,
      0x263a4e, 0x3d556b, 0x869fae,
      0x1a2b3c, 0x2e4458, 0xa4bccb,
      0x1f3548, 0x253e54, 0x2c4860, 0x34526c, 0x3c5c76, 0x28435a,
      0x7c9cb0, 0xd8d6c2,
      0x742a22, 0xc89862, 0xeed4a2,
      0x14202c, 0x304456, 0x869eb0, 0xc6d8e4,
    ],
    dusk: [
      0x101a34, 0x1f3052, 0x35466c, 0x52587c,
      0x687ca0, 0xa2b6d8, 0xf2e4d8,
      0x8c64b0, 0x38ae94, 0x50e09c, 0xc0fce2,
      0x1a263c, 0x2c3f58, 0x6e849a,
      0x101a28, 0x223448, 0x8ea2b8,
      0x111f34, 0x15253c, 0x1b2e46, 0x223852, 0x29425e, 0x172a42,
      0x246260, 0x42ae8e,
      0x72241e, 0xeba850, 0xffecb4,
      0x0b121c, 0x243444, 0x687e94, 0xc2d6e6,
    ],
    night: [
      0x0a1328, 0x101d38, 0x192c4e, 0x243e62,
      0x4c648a, 0x8eaad0, 0xe8f3ff,
      0x865eb2, 0x30a894, 0x46dc96, 0xb8fce0,
      0x142236, 0x223850, 0x5c7890,
      0x0c1624, 0x1a2c40, 0x7e9ab0,
      0x0c1a2c, 0x0f2034, 0x142940, 0x1a324c, 0x203b56, 0x152a40,
      0x1f5c5a, 0x3da888,
      0x681f1a, 0xe8a44e, 0xffebb0,
      0x080f18, 0x1e2e3e, 0x587288, 0xb4cce0,
    ],
  },
}

// 4-pose chimney smoke atlas (48×12 -> four 12×12 frames) using sky/far-matched smoke tones.
const smokeSheetRaw = parseSprite([
  '....cc......' + '....cc......' + '...ccc......' + '...ccc......',
  '...cccc.....' + '..cccccc....' + '..ccccc.....' + '..cccccc....',
  '..cccccc....' + '..cccccca...' + '..cccccc....' + '.cccccccc...',
  '..cccccc....' + '.cccccccc...' + '.ccccccc....' + '.cccccccca..',
  '..baaccc....' + '.caaccccc...' + '.caaacccc...' + 'ccaacccccc..',
  '...bbbaa....' + '..baaaccc...' + '..bbaaccc...' + '.ccbaacccc..',
  '....bbb.....' + '...bbbaaa...' + '...bbbaaa...' + '..cbbaacca..',
  '.....b......' + '....bbbb....' + '....bbbb....' + '...cbbbba...',
  '............' + '.....b......' + '.....bb.....' + '....bbbb....',
  '............' + '............' + '............' + '.....bb.....',
  '............' + '............' + '............' + '............',
  '............' + '............' + '............' + '............',
], { a: 12, b: 4, c: 5 })

export const smokeSheet = createSpriteSheet(smokeSheetRaw, [
  { x: 0, y: 0, width: 12, height: 12, pivot: { x: 5, y: 11 }, duration: 0.5 },
  { x: 12, y: 0, width: 12, height: 12, pivot: { x: 5, y: 11 }, duration: 0.5 },
  { x: 24, y: 0, width: 12, height: 12, pivot: { x: 5, y: 11 }, duration: 0.5 },
  { x: 36, y: 0, width: 12, height: 12, pivot: { x: 5, y: 11 }, duration: 0.5 },
])

/**
 * Hand-pixeled Nordic Rorbu fisherman's cabin & wooden wharf (36×24 art pixels).
 * Features steep snow-laden gable roof, chimney on right slope, Falun red timber
 * walls with dark batten trim, glowing multi-pane amber windows, left pier deck,
 * and timber pilings stepping down into the fjord.
 */
export const cabinSprite = parseSprite([
  '...........................bbb......',
  '..........................bbgb......',
  '.................ssss.....bbgb......',
  '...............ssssssss...bbgb......',
  '.............sssssssssssssbbgb......',
  '...........ssssssssssssssssssse.....',
  '.........ssssssssssssssssssssseee...',
  '.......sssssssssssssssseeeeeeeeeee..',
  '......bbbbbbbbbbbbbbbbbbbbbbbbbbbbb.',
  '.......bwwwwwwwwwwwwwwwwwwwwwwwwb...',
  '.......bwwwwwwwwyywwwwwwwwwwwwwwb...',
  '.......bwwwwwwwwhhwwwwwwwwwwwwwwb...',
  '.......bwwwwwwwwwwwwwwwwwwwwwwwwb...',
  '.......bwwwwyhyhywwwwwwwwwyywwwwb...',
  '.......bwwwwhhhhhwwwwwwwwwyhwwwwb...',
  '.......bwwwwyhyhywwwwwwwwwbbwwwwb...',
  '..y....bwwwwbbbbbwwwwwwwwwwwwwwwb...',
  '..b.sssbwwwwwwwwwwwwwwwwwwwwwwwwb...',
  '.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb...',
  '.gbgbgbgbgbgbgbgbgbgbgbgbgbgbgbgb...',
  '..bb....bb.......bb......bb...bb....',
  '..bb....bb.......bb......bb...bb....',
  '..bb....bb.......bb......bb...bb....',
  '..bb....bb.......bb......bb...bb....',
], {
  s: 31, // Bright roof snow
  e: 30, // Shaded eave snow
  w: 25, // Falun red timber
  y: 26, // Warm amber window / pier lantern
  h: 27, // Hot window core
  b: 28, // Dark timber trim & pilings
  g: 29, // Weathered timber / brick midtone
})

// Small snow-dusted Nordic spruce (9×14)
export const spruceSmall = parseSprite([
  '....s....',
  '....s....',
  '...ssg...',
  '...bgg...',
  '..ssegg..',
  '..bgggg..',
  '.ssgeegg.',
  '.bbggggb.',
  'ssgbbgggg',
  'bggggggbb',
  '.sgggggs.',
  '..bbbbb..',
  '....b....',
  '....b....',
], { s: 31, e: 30, g: 29, b: 28 })

// Taller snow-dusted Nordic spruce (11×19)
export const spruceTall = parseSprite([
  '.....s.....',
  '.....s.....',
  '....ssg....',
  '....bgg....',
  '...ssegg...',
  '...bbggg...',
  '..ssgeegg..',
  '..bbggggb..',
  '.ssgbbgggg.',
  '.bbggggggb.',
  'ssggeeggggs',
  'bbbgggggbbb',
  '.ssggggggs.',
  '.bbbggggbb.',
  '..sgggggs..',
  '...bbbbb...',
  '.....b.....',
  '.....b.....',
  '.....b.....',
], { s: 31, e: 30, g: 29, b: 28 })
