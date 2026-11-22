# Pixel Scenes v2 — P4 Reviewer Scoring & Defect Audit

> **Status:** Reviewer scores from P4 visual and code inspection (`onni/8393490d`). **These are reviewer scores, not the product owner's signature.** Final v2 acceptance requires the product owner's sign-off alongside contact sheets, animated clips, and measured AA/performance tables per [`docs/design/pixel-scenes/07-testing.md`](../../07-testing.md).

## Evidence Inspected & Constraints

- **UI PNGs inspected (`41 / 41`):** Every PNG in [`docs/design/pixel-scenes/evidence/v2/ui/`](ui/) — all `32` desktop (`1440×900`, 8 scenes × 2 themes × 2 surfaces `/new` & `chat`), `8` narrow (`390×844`) scene captures (`vn-halong`, `world-sahara`, `world-tromso`), and `off-narrow-new.png`.
- **Contact sheets (`.tmp/scene-snap/sheets`):** Not present in this worktree; contact-sheet 4-time-of-day / 3-size checks and animated clips were not available to inspect.
- **Motion rubric:** Motion **cannot be judged from static screenshots**. Every row below marks motion as **`unverified from stills`** and scores it strictly from scene source code (`packages/web/src/lib/scenery/scenes/*/*.ts`), counting active effects, animated sprites, and masking.
- **Scoring scale ([`07-testing.md` §7.1](../../07-testing.md#L19-L27)):** `1` = clear defect · `2` = weak · `3` = recognizable, needs fixes · `4` = pass · `5` = outstanding. Every criterion must be `>= 4` in **both themes**, taking the lower of `/new` and `chat` where UI-dependent, and the lower of the two themes where UI-dependent.

---

## 1. Full Score Matrix (8 Scenes × 2 Themes × 2 Surfaces = 32 Rows)

| Scene | Theme | Surface | Comp | Depth | Colour | Detail | Motion (code-only; unverified from stills) | One-line reason |
| --- | --- | --- | :---: | :---: | :---: | :---: | :---: | --- |
| `vn-halong` | `light` | `/new` | 3 | 3 | 3 | 2 | 3 (unverified from stills; 4 fx, 1 sprite) | Bay/junk readable below form, but no panel tint hurts subtitle/chip legibility, coarse sky dither, 4 horizontal `Cave` bars on right cliff, and blocky stair-step water glints. |
| `vn-halong` | `light` | `chat` | 1 | 1 | 1 | 1 | 3 (unverified from stills; 4 fx, 1 sprite) | 0% of the scene is visible in `vn-halong-light-chat.png`; solid white column hides the Horizon strip and landmark completely. |
| `vn-halong` | `dark` | `/new` | 3 | 3 | 1 | 2 | 3 (unverified from stills; 4 fx, 1 sprite) | Renders bright light-theme dawn palette instead of `dark.dusk` with no panel tint, making dark-mode header/placeholder/chips nearly unreadable. |
| `vn-halong` | `dark` | `chat` | 1 | 1 | 1 | 1 | 3 (unverified from stills; 4 fx, 1 sprite) | 0% of the scene is visible in `vn-halong-dark-chat.png`; solid dark surface completely hides the Horizon strip. |
| `vn-mu-cang-chai` | `light` | `/new` | 3 | 3 | 3 | 2 | 4 (unverified from stills; 4 fx, 2 sprites) | Angled terraces and stilt house read below form, but no panel tint over sky dither, vertical ladder-like irrigation channel, flat house box, and coarse sky dither. |
| `vn-mu-cang-chai` | `light` | `chat` | 1 | 1 | 1 | 1 | 4 (unverified from stills; 4 fx, 2 sprites) | 0% of the scene is visible in `vn-mu-cang-chai-light-chat.png`; Horizon strip and terraces are completely hidden. |
| `vn-mu-cang-chai` | `dark` | `/new` | 3 | 3 | 1 | 2 | 4 (unverified from stills; 4 fx, 2 sprites) | Renders bright `light.day` palette instead of `dark.dusk` with no panel tint; light-grey dark-mode text is illegible against bright sky dither and yellow terraces. |
| `vn-mu-cang-chai` | `dark` | `chat` | 1 | 1 | 1 | 1 | 4 (unverified from stills; 4 fx, 2 sprites) | 0% of the scene is visible in `vn-mu-cang-chai-dark-chat.png`; solid dark column hides the scene. |
| `vn-fansipan` | `light` | `/new` | 3 | 3 | 3 | 2 | 3 (unverified from stills; 3 fx, 2 sprites) | Peak silhouette sits behind right textarea/Dictation control without a panel tint; cloud sea ends at `0.96h` exposing a salmon sky strip at bottom-right and coarse sky dither. |
| `vn-fansipan` | `light` | `chat` | 1 | 1 | 1 | 1 | 3 (unverified from stills; 3 fx, 2 sprites) | 0% of the scene is visible in `vn-fansipan-light-chat.png`; Horizon strip is completely absent. |
| `vn-fansipan` | `dark` | `/new` | 3 | 3 | 1 | 2 | 3 (unverified from stills; 3 fx, 2 sprites) | Renders bright `light.dawn` palette instead of `dark.night` with no panel tint, severely breaking dark-mode text legibility over sky dither and flat cream clouds. |
| `vn-fansipan` | `dark` | `chat` | 1 | 1 | 1 | 1 | 3 (unverified from stills; 3 fx, 2 sprites) | 0% of the scene is visible in `vn-fansipan-dark-chat.png`; solid dark surface hides the scene. |
| `vn-phu-quoc` | `light` | `/new` | 3 | 3 | 3 | 2 | 3 (unverified from stills; 4 fx, 1 sprite) | Palms, boat, and S-curve beach read well, but tall palm overlaps composer metadata with no panel tint, far island is blocky, water glint is blocky, and a stray floating brown stick appears at `(0.09, 0.35..0.39)`. |
| `vn-phu-quoc` | `light` | `chat` | 1 | 1 | 1 | 1 | 3 (unverified from stills; 4 fx, 1 sprite) | 0% of the scene is visible in `vn-phu-quoc-light-chat.png`; solid white background hides the scene. |
| `vn-phu-quoc` | `dark` | `/new` | 3 | 3 | 1 | 2 | 3 (unverified from stills; 4 fx, 1 sprite) | Renders bright `light.dawn` palette instead of `dark.dusk` with no panel tint (poor dark-mode legibility) and retains the detached floating frond-sway stick in mid-air. |
| `vn-phu-quoc` | `dark` | `chat` | 1 | 1 | 1 | 1 | 3 (unverified from stills; 4 fx, 1 sprite) | 0% of the scene is visible in `vn-phu-quoc-dark-chat.png`; solid dark background hides the scene. |
| `world-tromso` | `light` | `/new` | 3 | 4 | 1 | 3 | 4 (unverified from stills; 5 fx, 1 sprite) | Renders dark night palette (`tromsoPalettes` = `dark`) in light mode with no panel tint, making dark text nearly unreadable over busy dithered aurora; cabin reflection splits into blocky orange chunks. |
| `world-tromso` | `light` | `chat` | 1 | 1 | 1 | 1 | 4 (unverified from stills; 5 fx, 1 sprite) | 0% of the scene is visible in `world-tromso-light-chat.png`; solid white column hides aurora and cabin. |
| `world-tromso` | `dark` | `/new` | 3 | 4 | 3 | 3 | 4 (unverified from stills; 5 fx, 1 sprite) | Good 6-layer fjord depth and cabin, but lacks a protective reading panel behind text over bright dithered aurora rays and shows blocky vertical aurora dither / detached orange water blobs. |
| `world-tromso` | `dark` | `chat` | 1 | 1 | 1 | 1 | 4 (unverified from stills; 5 fx, 1 sprite) | 0% of the scene is visible in `world-tromso-dark-chat.png`; solid dark background hides the scene. |
| `world-kyoto` | `light` | `/new` | 3 | 4 | 1 | 3 | 4 (unverified from stills; 4 fx, 2 sprites) | Strong perspective torii tunnel, but renders `dark.dusk` palette in light mode with no panel tint (dark text unreadable on dark forest/sky), foreground lintel cuts textarea, and lantern has a harsh yellow-black checkerboard mat. |
| `world-kyoto` | `light` | `chat` | 1 | 1 | 1 | 1 | 4 (unverified from stills; 4 fx, 2 sprites) | 0% of the scene is visible in `world-kyoto-light-chat.png`; solid white column hides the torii path. |
| `world-kyoto` | `dark` | `/new` | 3 | 4 | 3 | 3 | 4 (unverified from stills; 4 fx, 2 sprites) | Perspective torii gates and moss path read well, but no panel tint over coarse sky dither behind header/textarea, foreground lintel bisects textarea, and flat left moss ground / checkerboard lantern glow persist. |
| `world-kyoto` | `dark` | `chat` | 1 | 1 | 1 | 1 | 4 (unverified from stills; 4 fx, 2 sprites) | 0% of the scene is visible in `world-kyoto-dark-chat.png`; solid dark background hides the scene. |
| `world-matterhorn` | `light` | `/new` | 3 | 4 | 3 | 3 | 4 (unverified from stills; 4 fx, 2 sprites) | Iconic hooked peak, 3 pine variants, cabin, and lake reflection read clearly, but peak/sun intersect textarea with no panel tint and coarse horizontal sky dither bands remain. |
| `world-matterhorn` | `light` | `chat` | 1 | 1 | 1 | 1 | 4 (unverified from stills; 4 fx, 2 sprites) | 0% of the scene is visible in `world-matterhorn-light-chat.png`; Horizon strip is absent. |
| `world-matterhorn` | `dark` | `/new` | 3 | 4 | 1 | 3 | 4 (unverified from stills; 4 fx, 2 sprites) | Renders `light.dawn` sky/snow palette instead of `dark.night` with no panel tint, making dark-mode subtitle/placeholder/chips very low contrast over bright snow and sky. |
| `world-matterhorn` | `dark` | `chat` | 1 | 1 | 1 | 1 | 4 (unverified from stills; 4 fx, 2 sprites) | 0% of the scene is visible in `world-matterhorn-dark-chat.png`; solid dark background hides the scene. |
| `world-sahara` | `light` | `/new` | 4 | 4 | 3 | 3 | 5 (unverified from stills; 4 fx, 4 sprites) | S-curve slip-face and 3-camel caravan sit cleanly in open lower-right, but no panel tint behind header/chips, coarse sky dither, and a flat checkerboard haze band cuts horizontally across mid-dunes. |
| `world-sahara` | `light` | `chat` | 1 | 1 | 1 | 1 | 5 (unverified from stills; 4 fx, 4 sprites) | 0% of the scene is visible in `world-sahara-light-chat.png`; solid white surface hides the dunes and caravan. |
| `world-sahara` | `dark` | `/new` | 4 | 4 | 1 | 3 | 5 (unverified from stills; 4 fx, 4 sprites) | Caravan composition works well below form, but renders `light.day` palette instead of `dark.dusk` with no panel tint, causing severe dark-mode text illegibility against pale sand sky. |
| `world-sahara` | `dark` | `chat` | 1 | 1 | 1 | 1 | 5 (unverified from stills; 4 fx, 4 sprites) | 0% of the scene is visible in `world-sahara-dark-chat.png`; solid dark surface hides the scene. |

### Narrow (`390×844`) & Control Captures Observed

- `off-narrow-new.png`: Clean dark-mode `/new` with scenery off (`twinkle-backdrop` visible, readable text).
- `vn-halong-light-narrow-new.png`, `world-sahara-light-narrow-new.png`, `world-tromso-light-narrow-new.png`: Solid white page behind the open popover — **0% hero strip visible**.
- `world-sahara-dark-narrow-new.png`: Solid black page behind the open popover — **0% hero strip visible**.
- `vn-halong-dark-narrow-new.png`, `world-tromso-dark-narrow-new.png`: A top hero strip and dark reading panel are visible (`New task` header overlaps the hero strip), though the open Background scenes popover obscures the main form.
- `vn-halong-light-narrow-chat.png`, `vn-halong-dark-narrow-chat.png`: Solid white/dark chat transcript and dock — **0% scene visible**.

---

## 2. UI-Dependent Roll-Up & Defects List

Taking the **lower of the two surfaces (`/new`, `chat`)** and the **lower of the two themes (`light`, `dark`)** for UI-dependent criteria (`Composition`, `Depth`, `Colour`, `Detail`) yields **`1 / 1 / 1 / 1`** across all 8 scenes right now, primarily due to systemic UI integration gaps alongside scene-specific art bugs.

### A. Systemic UI / Integration Defects (Affect All 8 Scenes)

1. **Landmark & Horizon strip completely hidden on `chat` (18/18 chat PNGs):** Every desktop and narrow `chat` screenshot shows a 100% opaque solid white or dark thread/column/dock with zero pixels of the Horizon scene visible above the dock or in gutters (violating `04-ui-integration.md` §4.4: 32–40% visible transcript strip ending above the dock + transparent gutter/space).
2. **Missing protective reading panel on `/new` desktop (16/16 `/new` desktop PNGs):** Header, subtitle, textarea (`Describe a task...`), metadata row, and suggestion chips render directly on top of raw scene pixels with no `color-mix` tint panel or `1px` border (`04-ui-integration.md` §4.2–4.3).
3. **Theme palette & `timeSource` not wired (`SceneBackdrop` → host):** `packages/web/src/components/scene-backdrop.tsx` constructs `HostOptions` without `resolvedTheme` or `timeSource`, so `dark` theme `/new` captures render the `light` palette (7 scenes) and `world-tromso` / `world-kyoto` `light` captures render `dark` palettes (`tromsoPalettes` / `kyotoPalettes` defaults). This destroys text legibility in both themes.
4. **Placeholder SVG icons in Background scenes popover (all 40 scene PNGs):** Every scene card in the popover renders the generic `MountainSnowIcon` placeholder rather than the engine-rendered thumbnails in `packages/web/public/scenery-thumbs/` (`scene-popover.tsx` places `MountainSnowIcon` unconditionally after `<img>` or thumbnails fail to load).
5. **Narrow `/new` hero strip missing on 4/6 scene captures:** All 3 light narrow `/new` captures and `world-sahara-dark-narrow-new.png` render no hero strip at all; only `vn-halong-dark-narrow-new.png` and `world-tromso-dark-narrow-new.png` show the top hero strip.

### B. Scene-Specific Art, Legibility & Code Defects

- **Landmarks hidden / colliding with UI:**
  - `vn-fansipan`: Peak summit (`0.70, 0.23`) and `world-matterhorn` peak (`0.70, 0.17`) collide directly with the right side of the `/new` textarea and `Dictation` button.
  - `world-kyoto`: Giant foreground torii `kasagi`/`nuki` beams cut straight across the `/new` textarea, and receding path gates sit behind the suggestion buttons.
  - `vn-phu-quoc`: Tall palm crown (`u=0.25`) overlaps the bottom-left of the `/new` composer and `claude sonnet` metadata.
- **Text legibility failures (from missing panel tint + wrong theme palette):**
  - `dark` `/new` on `vn-halong`, `vn-mu-cang-chai`, `vn-fansipan`, `vn-phu-quoc`, `world-matterhorn`, `world-sahara`: Light-grey/white dark-mode text is rendered over bright daytime/dawn skies.
  - `light` `/new` on `world-tromso`, `world-kyoto`: Dark light-mode text is rendered over dark `night`/`dusk` palettes.
  - `light` `/new` on all other scenes: Muted subtitle/placeholder/chip text fails visual contrast over coarse sky dither and dark mountain silhouettes.
- **Flat shapes, coarse dither & drawing bugs:**
  - **All scenes except `world-tromso`:** Sky gradients use full-width or tall bands of coarse 2×2 Bayer checkerboard dither (`ctx.dither` across 480×270 scaled to 1440×900), creating noisy stipple behind UI text (`03-scene-set.md` §3.3 forbids full-sky dither).
  - **`vn-halong`:** Karsts are smooth triangular cones with flat 2-tone split; 4 horizontal `Ink.Cave` lines (`0.48h..0.66h`) read as floating black bars on the right cliff; sun-glint path renders as stacked blocky rectangles; birds are 2-line V strokes instead of a 4-pose sprite sheet; `frame()` fog is a 1px-tall dashed line.
  - **`vn-mu-cang-chai`:** No `ctx.layer` separation; terraces are flat colored bands; stilt house is a flat trapezoid + rectangle on 2 stick legs with no detail; irrigation channel (`ctx.curve`) + glint ticks read like a vertical ladder cutting straight down the terraces.
  - **`vn-fansipan`:** No `ctx.layer` separation; cloud banks are large flat cream polygons with thin peach rim lines and stray dark holes; `nearCloudUnder` terminates at `0.96h`, leaving a flat salmon-peach sky rectangle visible at the bottom-right corner.
  - **`vn-phu-quoc`:** **Bug in `phu-quoc.ts` L181** — palm frond sway draws a detached vertical/tilted brown line in mid-air at `x=0.09w, y=0.35..0.39h` (`vn-phu-quoc-{light,dark}-new.png`), and does not sway the second palm's crown (`0.295w, 0.55h`); far island is a flat stepped block; water glint path uses large blocky rectangles.
  - **`world-tromso`:** Aurora curtains exhibit vertical barcode/checkerboard dithering across the sky; cabin window reflection (`inCabinPath`) renders as two detached solid orange polygons in the water; `drawCurtain` draws aurora shapes even in `day` palette (violating §3.7 daytime cirrus rule).
  - **`world-kyoto`:** Stone lantern glow (`kyoto.ts` L465–475, L607–618) draws a stark yellow-and-black checkerboard square directly beneath the right lantern; left mossy floor is a large flat green slab with 5 square stepping stones.
  - **`world-matterhorn`:** Two flat horizontal checkerboard bands cut across the sky; birds visually touch the left cloud puff.
  - **`world-sahara`:** Heat-haze band (`bandTop..bandBot`) draws a distinct horizontal checkerboard ribbon across the mid-dunes.

---

## 3. Per-Scene Verdict Table

> **Rule (`07-testing.md` §7.1):** `PASS` requires **all 5 criteria `>= 4` in both `light` and `dark` themes** (taking the lower of `/new` and `chat` for UI-dependent criteria). Because `chat` shows 0% scenery and `/new` lacks panel tint + theme palette wiring in this capture, **0 / 8 scenes pass** as currently integrated.

| Scene | `/new` (L / D) `C·D·Col·Det` | `chat` (L / D) `C·D·Col·Det` | UI-Dependent Min (`C·D·Col·Det`) | Motion (code-only; unverified from stills) | Verdict | What to fix |
| --- | --- | --- | :---: | :---: | :---: | --- |
| `vn-halong` | `3·3·3·2` / `3·3·1·2` | `1·1·1·1` / `1·1·1·1` | `1 · 1 · 1 · 1` | `3` (4 fx, 1 sprite; unverified) | **FIX** | **UI:** Show Horizon strip in `chat`, add `/new` panel tint, wire `themePalettes`/`timeSource`, fix popover thumbnails & light narrow hero. **Art:** Replace coarse sky dither, remove 4 horizontal `Cave` bars, break up blocky water-glint rects, give karsts faceted rock clusters, use 4-pose bird sprite & realistic mist. |
| `vn-mu-cang-chai` | `3·3·3·2` / `3·3·1·2` | `1·1·1·1` / `1·1·1·1` | `1 · 1 · 1 · 1` | `4` (4 fx, 2 sprites; unverified) | **FIX** | **UI:** Show Horizon strip in `chat`, add `/new` panel tint, wire `themePalettes`/`timeSource`, fix popover thumbnails. **Art:** Use `ctx.layer` occlusion, reduce coarse sky dither, make irrigation channel curve organically without ladder-tick glints, add stilt-house detail (roof/window/steps) and richer foreground rice clusters. |
| `vn-fansipan` | `3·3·3·2` / `3·3·1·2` | `1·1·1·1` / `1·1·1·1` | `1 · 1 · 1 · 1` | `3` (3 fx, 2 sprites; unverified) | **FIX** | **UI:** Show Horizon strip in `chat`, add `/new` panel tint, wire `themePalettes`/`timeSource`, fix popover thumbnails. **Art:** Extend `nearCloudUnder` to `1.0h` (fix bottom-right salmon gap), add volume/shading to flat cream clouds, soften coarse sky dither, use `ctx.layer` masks, keep bird/3rd effect continuously active & refine flag placement. |
| `vn-phu-quoc` | `3·3·3·2` / `3·3·1·2` | `1·1·1·1` / `1·1·1·1` | `1 · 1 · 1 · 1` | `3` (4 fx, 1 sprite; unverified) | **FIX** | **UI:** Show Horizon strip in `chat`, add `/new` panel tint, wire `themePalettes`/`timeSource`, fix popover thumbnails. **Art:** Fix `phu-quoc.ts` L181 detached floating stick in sky and animate palm fronds at true crown pivots; replace blocky far island & blocky water-glint rectangles; soften sky dither. |
| `world-tromso` | `3·4·1·3` / `3·4·3·3` | `1·1·1·1` / `1·1·1·1` | `1 · 1 · 1 · 1` | `4` (5 fx, 1 sprite; unverified) | **FIX** | **UI:** Show Horizon strip in `chat`, add `/new` panel tint, wire `themePalettes`/`timeSource` (so `light` uses `day` palette), fix popover thumbnails & light narrow hero. **Art:** Smooth aurora curtain dither/rays (less vertical barcode look), hide aurora in `day` time in favor of cirrus clouds, refine cabin window water reflection so it does not form solid orange blocks. |
| `world-kyoto` | `3·4·1·3` / `3·4·3·3` | `1·1·1·1` / `1·1·1·1` | `1 · 1 · 1 · 1` | `4` (4 fx, 2 sprites; unverified) | **FIX** | **UI:** Show Horizon strip in `chat`, add `/new` panel tint, wire `themePalettes`/`timeSource` (fix `dark.dusk` showing in `light` mode), fix popover thumbnails. **Art:** Replace harsh yellow-black checkerboard lantern mat with soft stepped halo on flagstones, add texture/foliage detail to flat left moss floor, reduce sky-slit dither, adjust foreground torii lintel height or panel clearance. |
| `world-matterhorn` | `3·4·3·3` / `3·4·1·3` | `1·1·1·1` / `1·1·1·1` | `1 · 1 · 1 · 1` | `4` (4 fx, 2 sprites; unverified) | **FIX** | **UI:** Show Horizon strip in `chat`, add `/new` panel tint, wire `themePalettes`/`timeSource` (so `dark` renders `night` palette), fix popover thumbnails. **Art:** Soften horizontal sky dither bands and offset bird path slightly away from left cloud puff; `/new` panel tint will resolve peak/sun behind composer text. |
| `world-sahara` | `4·4·3·3` / `4·4·1·3` | `1·1·1·1` / `1·1·1·1` | `1 · 1 · 1 · 1` | `5` (4 fx, 4 sprites; unverified) | **FIX** | **UI:** Show Horizon strip in `chat`, add `/new` panel tint, wire `themePalettes`/`timeSource` (so `dark` renders `dusk` palette), fix popover thumbnails & narrow hero strip (both themes). **Art:** Soften horizontal sky dither bands and break up the straight horizontal checkerboard heat-haze ribbon across mid-dunes. |

---

## 4. Next Gate Checklist (Before Re-Scoring P4)

1. Wire `resolvedTheme` and `timeSource` into `SceneBackdrop` → `HostOptions` (`P3a`/`P3b`) so `light` and `dark` render their intended `themePalettes` and `themeDefaultTime`.
2. Add the protective `color-mix` reading panel + `1px` border on `/new` (`P3b`), restore the 32–40% Horizon strip above the dock on `chat` (`P3b`), fix the narrow `/new` hero strip across both themes, and fix `SceneLibrary` thumbnail rendering in `scene-popover.tsx` (`P3a`).
3. Fix the P2 scene defects above (especially `phu-quoc.ts` floating stick, `fansipan.ts` `0.96h` cloud gap, `halong.ts` `Cave` bars/water blocks, `kyoto.ts` lantern checkerboard, `tromso.ts` daytime aurora/reflections, and coarse full-sky dither).
4. Regenerate `.tmp/scene-snap/sheets` (3 sizes × 4 times × 2 themes), 5–10s motion clips, measured composite AA tables, and the 32 + narrow UI captures for owner review and signature.
