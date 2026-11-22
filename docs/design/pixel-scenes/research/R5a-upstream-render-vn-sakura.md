# R5a — Upstream Rendering Craft (`vn` & `sakura`) Mapped to the 480×270 Indexed Engine

**Snapshot studied:** `Aqua2409z/pixel-chat-themes` (MIT, commit `f237a18`), specifically `pixel-themes/hooks/scenes.ts` (`vn`, `karstRow`, `inStar`, `clouds`, `cloudRows`, `sakura`, `TORII_GATE_ROWS`, `SAKURA_BRANCH_ROWS`, `rng`, `Scene`), plus rendered screenshots `preview.png` and `shots/upstream-index.png`.
**Target architecture:** OnniCode indexed Canvas2D scenery engine (`packages/web/src/lib/scenery/engine/API.md`, max `480×270` art-pixel landscape / `240×300` portrait, `≤ 32` palette indices, `12 fps` target loop with `dt ≤ 0.2s`, `ParticlePool` hard cap `160`, semantic `ctx.layer()` + `Mask` coverage `0–15`, `createSpriteSheet` + `ctx.spriteFrame`, `cycles` index rotation, and `themePalettes` for `light` / `dark`).
**Visual baseline compared:** `docs/design/pixel-scenes/evidence/v2/scoring.md` and `docs/design/pixel-scenes/evidence/v2/ui-after/*.png` (`vn-halong-*`, `vn-fansipan-*`, `vn-phu-quoc-*`, `world-kyoto-*`).

> **Clean-room rule:** Zero upstream code, ASCII glyph tables, sprite matrices, or SVG assets are copied into OnniCode. Only mathematical principles, proportional ratios, value structure, and compositing discipline are extracted and reformulated for our indexed Canvas2D primitives.

---

## 1. Visual & Code Deconstruction: Why Upstream `vn` and `sakura` Look Good

### 1.1 Cell Size vs. Scene Size & Adaptive Thresholds

Upstream (`SIZES` in `scenes.ts:1780–1784`) renders into three SVG viewBoxes with integer cell pitches:

| Layout | ViewBox (px) | Cell `c` (px) | Grid (`cols × rows`) | Total Cells | Glyph Mode (`c >= 9`) | Gap `gap` (px) | Tile Size `s = c - gap` |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| `band` | `1200 × 132` | `12` | `100 × 11` | `1,100` | On (`font-size: 8.4px`) | `1.0` | `11.0 × 11.0` (`84.0%` area) |
| `side` | `420 × 900` | `12` | `35 × 75` | `2,625` | On (`font-size: 8.4px`) | `1.0` | `11.0 × 11.0` (`84.0%` area) |
| `thumb` | `168 × 96` | `6` | `28 × 16` | `448` | Off (dot fallback if `!bg`) | `0.5` | `5.5 × 5.5` (`84.0%` area) |

And in `shots/upstream-index.png` (captured at ~`1440 × 900` full-viewport desktop demo with a ~`260px` sidebar, leaving ~`1180 × 900` content canvas), `cell` sits around `12–14px` (~`84–98 × 64–75` tiles).

**Why this works:**
1. **Intentional low-grid budget forces bold forms.** With only `16` rows in `thumb` (`168×96`) and ~`64` rows on desktop, fine noise cannot exist. Every ridge, sun, flag, torii, and branch has to read as a clean silhouette at `16–64` vertical units.
2. **Automatic glyph suppression below `c = 9` (`scenes.ts:79, 133–140`).** When `c < 9` (`thumb` at `c = 6`), solid-background tiles drop text glyphs entirely so characters do not alias into muddy speckles, while glyph-only elements (water ripples `'~'`, distant stars) collapse to a crisp centered square dot of width `0.4 * c` (`2.4px`).

### 1.2 The Tile-and-Gap Micro-Texture

In `Scene.tiles()` (`scenes.ts:120–157`):
- Each filled cell draws an `s × s` square inset by `gap / 2` (`0.5px` at `c = 12`, `0.25px` at `c = 6`) on all four sides, leaving a `1px` (`c = 12`) or `0.5px` (`c = 6`) hairline channel between tiles.
- That hairline is **not** black or white: it exposes the underlying smooth `<linearGradient>` sky/sea/lake behind every sprite and mountain tile (`upstream-index.png`).
- Inside each tile, the monospace glyph (`font-weight: 600`, `font-size: 0.7 * c`, baseline `0.72 * c`) uses a **low-contrast companion color** (`fg`) against `bg` — typically only `10–25%` darker or lighter (e.g. flag red `#da251d` vs `#b51f18`, far karst `#a9c4cf` vs `#97b5c2`, Fuji sunlit slope `#818cf8` vs `#c7d2fe`).
- Deterministic spatial hashing (`Math.abs((i * 73856093) ^ (j * 19349663)) % glyphSet.length`) locks the glyph to `(i, j)` so surfaces have subtle woven texture without frame-to-frame shimmer.

**Contrast with our current `ui-after/` captures:**
In `ui-after/vn-halong-light-new.png`, `vn-fansipan-light-new.png`, and `world-kyoto-dark-new.png`, our `480×270` buffer scaled `3×` to `1440×900` puts **coarse 2×2 Bayer checkerboard dither (`20px` bands)** across the open sky behind UI text, while the karsts, clouds, and mossy ground have large unbroken flat-color spans. Upstream does the exact opposite: **clean, smooth sky behind text**, and **subtle micro-texture confined inside physical objects**.

### 1.3 Palette Count and Value Structure

Counting every discrete hex color used in `scenes.ts` shows how disciplined the palettes are:

- **`vn` (~18 tile colors + 5 gradient stops + 1 radial glow + 2 cloth-fold overlays):**
  - **Sky gradient (cool → warm horizon):** `#4f9fe0` (`0%`) → `#9fd2f2` (`55%`) → `#ffe0b0` (`100%`).
  - **Sea gradient (teal → deep marine):** `#6fb7cc` (`0%`) → `#2c7896` (`100%`).
  - **Sun & glow:** radial `#ffd27a` (`alpha 0.55`, radius `0.45 * max(W,H)`), sun tiles `#fff0b8` / `#f5d27a`.
  - **Depth-separated karsts:** far rank `#a9c4cf` / `#97b5c2` (`opacity 0.8` — cool, desaturated, high value near sky horizon); near rank `#5b8b92` / `#46737a` with `#6f9e7c` / `#557f62` foliage crowns; reflection `#3f7f8f` (`opacity 0.3`).
  - **Clouds:** core `#ffffff` / `#a9c1d6`, edge `#eef6fd` / `#c3d5e5` (`opacity 0.495–0.90`).
  - **Accents & hero:** birds `#33475b`, ripples `#e6f6fb`, glints `#fff0b8` / `#f0d27a`, pole `#ece6d8` / `#bdb5a3`, finial `#ffd34d` / `#c99a1c`, base `#8d99a6` / `#6d7884`, flag `#da251d` / `#b51f18` + `#ffea00` / `#cfb800`.
  - **Why the value structure reads immediately (`upstream-index.png`):** Sky stays mid-high luminance; far karsts sit within ~`15%` luminance of the horizon haze; near karsts drop ~`25%` darker and shift warmer green at the crown; the hero flag uses high-chroma crimson (`#da251d`) and luminous gold (`#ffea00`) against the cool `#4f9fe0 / #9fd2f2` upper sky.

- **`sakura` (~27 tile colors + 7 gradient stops + 3 radial glows):**
  - **Sky gradient (blush → peach → warm cream):** `#fce7f3` (`0%`) → `#fed7aa` (`40%`) → `#fef3c7` (`75%`) → `#ffedd5` (`100%`).
  - **Lake gradient (rose reflection → sky blue → cobalt):** `#fbcfe8` (`0%`) → `#93c5fd` (`25%`) → `#2563eb` (`100%`).
  - **Glows:** horizon sunrise `#fb7185` (`0.45`), upper-right sakura haze `#f472b6` (`0.30`), lantern `#fef08a` (`0.55`, `r = 6c`).
  - **Mt. Fuji (directional 2-face + snow):** snow `#ffffff` / `#e2e8f0`; sunlit left slope (`dx < 0`) `#818cf8` / `#c7d2fe`; shaded right slope (`dx >= 0`) `#4338ca` / `#312e81`.
  - **Torii (`TORII_PAL`, 10 colors):** kasagi dark cap `#7f1d1d` / `#450a0a`, main top `#dc2626` / `#991b1b`, bright nuki/beam `#ef4444` / `#b91c1c`, pillars `#dc2626` / `#991b1b`, stone bases `#475569` / `#334155`.
  - **Branch + Lantern (`SAKURA_BRANCH_PAL`, 19 colors):** bark `#3e2723` / `#241411`, twigs `#5d4037` / `#3e2723`, petals `#ffb7c5`/`#ffffff`, `#f472b6`/`#fff1f2`, `#fce7f3`/`#f472b6`, `#e11d48`/`#ffffff`, leaves `#86efac`/`#15803d`, lantern cord `#1e293b`, lantern `#b91c1c`/`#7f1d1d`, lantern flame `#fef08a`/`#f59e0b`.
  - **Why the value structure reads immediately (`preview.png` thumbnail #2):** Everything in the background sky (`#fce7f3..#ffedd5`) lives in the `85–97%` lightness band. That guarantees that both the deepest dark anchor (bark `#241411/#3e2723`) and the mid-dark saturated landmarks (indigo Fuji `#4338ca`, vermilion Torii `#dc2626`) pop with zero silhouette ambiguity, even at `168×96`.

### 1.4 Silhouette-First Composition & Hero Size (% of Frame)

1. **`vn` composition:**
   - **Horizon:** `0.80 * rows` (`80%` down — `80%` sky/karst stage, `20%` sea).
   - **Hero subject (Flag + Pole):**
     - `L = round(clamp(min(cols * (narrow ? 0.55 : 0.34), (horizon - top - 2) * 1.5), 8, 48))`, `H = round((2/3) * L)`, anchored at `px = min(cols * 0.62, cols - L - 2)` (right third, `x = 62%..96%`, `y = 12%..53%`).
     - **Frame coverage:** On wide desktop (`1200×675` ≈ `100×56` cells), `L = 34` (`34%` width) × `H = 23` (`41%` height) = **`13.9%` of total frame area** (and pole `top-2` to `horizon+2` spans `75%` of frame height). On `thumb` (`28×16`, `narrow = true`), `L = 15` (`54%` width) × `H = 10` (`62.5%` height) = **`33.5%` of total frame area** — ensuring instant readability in the theme picker (`preview.png`).
     - **Supporting anchors:** rising sun half-disc (`sr = clamp(round(rows * 0.07), 2, 5)`) at `0.82 * cols` directly beneath the flag, creating a warm focal halo behind the flagpole's lower half.
2. **`sakura` composition:**
   - **Horizon:** `hy = 0.76 * H` (`76%` sky/mountain, `24%` lake).
   - **Three-anchor asymmetric balance (visible in `preview.png`):**
     - **Mt. Fuji (mid-far anchor):** `fx = 0.28 * cols` (wide) / `0.42 * cols` (narrow), width `fw = clamp(0.50 * cols, 20, 50)` (`50%` width), height `fh = clamp(0.36 * rows, 9, 22)` (`36%` height). Concave volcanic profile `pow(1 - pow(u, 1.35), 1.75)` with crater flat `if (u < 0.1) h *= 0.96`. Area ≈ `10–12%` of frame.
     - **Torii Gate (mid-near hero):** `18 × 9` cells, placed at `tx = 0.12 * cols` (wide) / `0.05 * cols` (narrow), `y = horizRow - 7` so its stone pillar bases (`rows 7–8`) step two cells *below* the horizon into the water edge (`18×9` = `~3.8%` area on desktop, `64%×56%` on `thumb`).
     - **Sakura Branch + Lantern (foreground frame):** `60 × 13` cells anchored flush top-right (`x = W - 60*c, y = 0`), covering up to `60%` width × `23%` height in the upper-right sky on `100×56`, framing the open sky negatively around the left-center Fuji/Torii pair.

### 1.5 Layering, Occlusion, Shading, Glints, and Motion Rates

| Element | Layer Order (Back → Front) | Shape / Shading Technique | Animation & Rate |
| --- | --- | --- | --- |
| Sky & Water (`vn`, `sakura`) | `0` (bottom) | Vertical `<linearGradient>` + radial `<radialGradient>` (`r = 0.45–0.50 * max(W,H)`) | Static |
| Rising Sun (`vn`) | `1` (above sky glow) | Half-disc `hypot(dx, dy) <= sr + 0.3` for `dy <= 0` (`sr ∈ [2, 5]`) | Static |
| Karst Far (`vn`) | `2` (`opacity 0.8`) | `karstRow` `(1 - d^2.6)^0.55`, `lean ∈ [-0.25, 0.25]`, `70%` shoulder peak | Static |
| Karst Near + Reflect (`vn`) | `3` | Taller cluster (`0.24 * rows`), top 2 rows green crown; reflection `0.5 * min(hgt, waterRows)` at `opacity 0.3` | Static |
| Mt. Fuji (`sakura`) | `2` | Left/right slope illumination split + jagged snowline `46–62%` height | Static |
| Torii & Branch (`sakura`) | `3` (Torii), `4` (Branch + glow) | Hand-authored pixel sprites (`<defs>/<use>`), dark stone feet / dark bark | Static (lantern glow static in SVG) |
| Clouds (`vn`) | `4` (in front of karsts/sky) | `cloudRows`: base ellipse + `2–4` upper lobes, `4`-neighbor `'e'` rim; `4` cached shapes | Continuous horizontal drift: `(8 + 26z) * 0.5` px/s (`4–17 px/s`), `z`-coupled opacity `0.495–0.90` |
| Birds (`vn`, `sakura`) | `5` (`vn`), `5` (`sakura`) | `vn`: `'v'` / `'-'` glyph toggle; `sakura`: `'v'` glide | `vn`: `2 Hz` flap (`dur = 0.5s` discrete), drift `(0.8–1.8)*c` px/s; `sakura`: `8–14s` glide |
| Ripples & Sun Glints (`vn`) | `6` | Ripples: `(13x + 7y) % 17 === 0` (`5.9%` cells); Glints: cone `spread = 1 + 0.8d` at `30%` fill | Ripples: `±2c` sway over `8s` (`0.125 Hz`); Glints: opacity `[0.4..0.7]` over `2.4s` (`0.417 Hz`) |
| Flag Pole & Waving Flag (`vn`) | `7` (frontmost) | `6×6` supersampled star (`>= 0.22` coverage); `16`-step column wave `A = 0.14H`, `f = ((i+1)/L)^0.8`, `k = 2.2π/L`, harmonic `sin(ph) + 0.18sin(2ph+1)`; slope-coupled `#000` (`0–0.32`) / `#fff` (`0–0.22`) | Period `1.85s` (`0.54 Hz`, `~8.65` keyframe steps/s) |
| Falling Petals (`sakura`) | `6` (frontmost) | `18–48` petals (`clamp(cols*rows/100, 18, 48)`), `5` pink/white colors, `4` glyphs or `0.35c` circles | Diagonal fall (`dx = -0.45..-0.90W`, `dy = 0.75..1.30H`) in `6–13s` + `360°` spin in `2.5–5s`, staggered negative `begin` |

---

## 2. Twelve Concrete Recipes for Our 480×270 Indexed Engine (`API.md`)

All coordinates below are **art pixels** on a `480 × 270` landscape canvas (`240 × 300` portrait scales proportionally using `w / 480`, `h / 270`, keeping integer snap). Every recipe conforms strictly to `packages/web/src/lib/scenery/engine/API.md` (`<= 32` palette indices, `Mask` coverage `0–15`, `ParticlePool <= 160`, `dt <= 0.2s`, `12 fps` render target).

### Recipe 1 — Deterministic Seeding & Zero-Flicker Spatial Texture

- **Upstream lesson:** `rng(seed)` (`mulberry32`) + `glyph(i, j)` integer bit-hash (`scenes.ts:45–53, 92–94`) keep geometry, star positions, and surface grain identical across frame redraws and worker/main renders.
- **Engine mapping:**
  - Use `ctx.rng` (backed by `mulberry32(seed)`) for all placement, cluster offsets, and initial particle phases inside `build(ctx)` and `ParticlePool(capacity, seed)`. Never call `Math.random()`.
  - For static surface grain inside rocks, bark, moss, or foliage, use `ctx.fbm2(x * fx, y * fy)` (sampling the pre-baked `256×256` `NoiseAtlas`) or an integer spatial hash `((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ seed) >>> 0) & 15`.
  - **Parameters:** `NoiseAtlas` size `256`, `octaves = 5`; spatial hash period `16` (`& 15`) for stone/foliage cluster selection; never vary the hash seed by `t` on static terrain.

### Recipe 2 — Clean Sky & Horizon Banding Without Full-Sky Bayer Noise

- **Upstream lesson:** Upstream keeps the sky as a smooth 3–4 stop gradient (`#4f9fe0 → #9fd2f2 → #ffe0b0` or `#fce7f3 → #fed7aa → #fef3c7`) so text and silhouettes read cleanly without background stipple.
- **Defect fixed:** Eliminates the `20px`-tall `2×2` Bayer checkerboard bands currently hurting `vn-halong`, `vn-mu-cang-chai`, `vn-fansipan`, `world-kyoto`, and `world-matterhorn` (`scoring.md` §2B).
- **Engine mapping (`ctx.layer({ kind: 'sky', z: 0 })`):**
  - Allocate `4` sky slots (`0..3`: `SkyTop`, `SkyUpper`, `SkyLower`, `SkyHorizon`) with small luminance steps (`ΔL* <= 10–14` between adjacent stops).
  - Draw solid horizontal `ctx.rect(0, y0, w, bandH, idx)` bands at `v = [0.00, 0.22, 0.44, 0.63]` (for `horizon = 0.63`, or `[0.00, 0.24, 0.50, 0.76]` for `horizon = 0.76`).
  - Optional transition dither **only** in a narrow `4–6px` band (`halfWidth = 2–3px`) using `ctx.dither(x, y, amount, low, high, 4)` (never `size = 8` on sky, and `0px` dither behind the centered `/new` panel region `u ∈ [0.22, 0.78], v ∈ [0.06, 0.48]` if high-contrast stops are unavoidable).
  - Draw the celestial disc (`ctx.disc(cx, cy, r, Ink.Sun)`) with a single `4–6px` halo ring (`r + 5px`, `Ink.SunHalo`) inside `sky` `z = 0`: `r = 9px` (`vn-halong` `03-scene-set.md`) to `12px` (`vn-phu-quoc`).

### Recipe 3 — 32-Slot Semantic Palette Map & Theme-Branched Value Hierarchy

- **Upstream lesson:** Upstream separates figure from ground via luminance compression in far layers (`#a9c4cf` vs sky `#9fd2f2`), darker mid/near forms (`#5b8b92`, `#4338ca`), and high-chroma hero accents (`#da251d`, `#dc2626`, `#ffea00`).
- **Engine mapping (`themePalettes: { light, dark }` with `dawn / day / dusk / night`):**
  - Lock all `32` indices to fixed semantic roles across both `light` and `dark` keyframes so `build()` geometry never inspects `theme`:
    - `0–3`: Sky ramp (`SkyTop → SkyHorizon`, 4 stops)
    - `4–5`: Celestial body + halo (`Sun`, `SunHalo`)
    - `6–8`: Cloud ramp (`CloudShadow`, `CloudBody`, `CloudRim`)
    - `9–11`: Far terrain (`FarShadow`, `FarBody`, `FarRim`) — mix `45–55%` toward `SkyHorizon`
    - `12–14`: Mid terrain (`MidShadow`, `MidBody`, `MidRim`) — mix `20–28%` toward `SkyHorizon`
    - `15–17`: Near foreground (`NearShadow`, `NearBody`, `NearRim`) — `0–8%` haze, highest contrast
    - `18–23`: **6-phase water cycle group** (`Wave0..Wave5`, owned exclusively by `cycles`)
    - `24–25`: Glint / wake / foam (`WaterGlint`, `Foam`) — optional 2nd cycle or static high-key
    - `26–29`: Hero landmark / sprite 4-step ramp (`HeroDeep`, `HeroShadow`, `HeroBody`, `HeroRim`)
    - `30–31`: Fog/mist (`Fog`) and dark accent/contact shadow/birds (`InkDark`)
  - **Concrete light vs. dark anchor check (Halong example):**
    - `light.dawn`: sky `#A9CDDB → #F3D9B0`, far `#8BA8A5 / #A9C4CF`, near `#294C52 / #557B74 / #B7B685`, hero `#6C4238 / #965B40 / #D09A66`.
    - `dark.dusk`: sky `#202E4D → #B67A77`, far `#384D5C / #536A72`, near `#172A35 / #37525C / #A08074`, hero `#593C41 / #784E48 / #E1B57F`.
  - Keep `light` sky luminance `L* >= 75` and `dark` sky luminance `L* <= 28` so `compositeContrast` (`panelAlpha = 0.96` light / `0.94` dark) stays well above `4.5:1`.

### Recipe 4 — Woven Interior Micro-Texture Replacing Flat Polygon Slabs

- **Upstream lesson:** Upstream's `11×11` tile + `1px` gap + low-contrast glyph creates internal visual density inside solid rocks, foliage, and cloth without hurting silhouette edges.
- **Engine mapping (for `480×270` without fake grid gaps):**
  - Instead of splitting every shape into literal `12×12` tiles (which looks artificial at `480×270` against pixel-art sprites), simulate **material weave** inside `mid` / `near` / `bark` / `foliage` fills:
  - Within `ctx.layer({ kind: 'mid' | 'near' })`, sample `n = ctx.fbm2(x * 0.18, y * 0.18)` + `2×2` or `3×3` deterministic sub-pattern `((x % 3 === 0) && (y % 2 === 0))` to flip `12–18%` of interior pixels from `Body` to `Shadow` (for crevices/foliage clusters) or `Rim` (for sunlit crown stipple).
  - **Guardrails:** Keep `ΔRGB` between `Body` and texture grain within `15–25%` (`1` ramp step, never `Body` to `InkDark`), and **never** apply interior stipple to `far` (`z = 1`) layers or `1px` silhouette rims.
  - **Thumbnail parity:** When `width <= 240` (`thumb` / narrow), reduce grain probability threshold (`fbm2 > 0.72` instead of `0.60`) so forms stay clean at small sizes (mirroring upstream's `glyphs = cell >= 9` cutoff).

### Recipe 5 — Silhouette-First Framing & Hero Scale Budget Around `/new` and `chat` UI

- **Upstream lesson:** Upstream dedicates `~14%` of desktop area (up to `33%` on thumbnails) to one unmistakable off-center hero (flag or torii+Fuji+branch triangle), leaving open sky for chat messages.
- **Defect fixed:** Fixes `vn-fansipan`, `world-matterhorn`, `world-kyoto`, and `vn-phu-quoc` colliding directly with the centered `/new` textarea (`760px` wide at `1440×900`) and disappearing in `chat` (`scoring.md` §2A–B).
- **Engine mapping (`480 × 270` normalized `(u, v)`):**
  - Reserve the `/new` panel safe zone: centered `u ∈ [0.22, 0.78]`, `v ∈ [0.06, 0.48]` should hold only `sky` / `far` calm background; place the primary hero landmark either **below** the panel (`v ∈ [0.52, 0.88]`, e.g., `vn-halong` junk at `(0.73, 0.76)`, `world-sahara` caravan at `(0.72, 0.64)`) or in the **left/right outer framing gutters** (`u < 0.22` or `u > 0.78`).
  - For `chat` Horizon strip (`32–40%` visible transcript height above dock, top `20–30%` sky-faded): anchor key landmarks inside `v ∈ [0.55, 0.92]` so they survive the top feather intact (`vn-halong` `horizon = 0.63`, `world-kyoto` mid torii gates at `v = 0.59, 0.72`).
  - **Hero size bounds:** Target `10–18%` of `480×270` (`~13,000–23,000` art-px² area, e.g., `72×50` to `120×70` combined landmark footprint) at `480×270`, scaling up to `25–35%` area in `168×96` / `320×180` thumbnails if procedural, or via a dedicated close-up `focus` crop.

### Recipe 6 — Clustered Karst Silhouettes (`karstRow` → Quantized Multi-Peak Polygons + Crowns)

- **Upstream lesson:** `karstRow()` (`scenes.ts:271–283`) builds organic limestone towers via `h * (1 - d^2.6)^0.55` with asymmetric `lean ∈ [-0.25, 0.25]`, plus `cluster()` (`L308–318`) adds a `70%`-probability overlapping companion tower (`0.7×` width, `0.45–0.70×` height at `±(0.8–1.3)×w`). Top `2` rows get green foliage crowns.
- **Defect fixed:** Replaces smooth triangular cones and floating horizontal `Cave` bars in `halong.ts` (`ui-after/vn-halong-light-new.png`).
- **Engine mapping:**
  - In `build(ctx)`, generate each karst rank (`far`, `mid`, `near`) as `2–4` multi-spire peak clusters using `d = Math.abs(x - cx) / (halfW * (x < cx ? 1 + lean : 1 - lean))` and `height * Math.pow(1 - Math.pow(d, 2.6), 0.55)` combined via `Math.max(...)`, quantized into polygon vertices spaced every `2px` along `x` and filled with `layer.polygon(pts, shadowIdx)`.
  - **Directional face & crown:** Paint the sunlit right/left face mask (`u_local > 0.42 + 0.12 * shape`, matching light direction) in `MidBody` / `NearBody`, add a broken `1px` rim (`15–25%` of sunlit contour) in `Rim`, and paint the top `3–5px` (`k >= hgt - 4`) of flat/rounded summits with `2–3` rounded foliage bumps (`ctx.disc(x, topY + 1, 2–3, FoliageIdx)`).
  - **Cliff fissures (no horizontal cave bars):** Inside `mid` / `near` karst bodies, carve **vertical/steep-angled** (`65–85°`) `4–9px` rock striations (`dx = ±1..2px, dy = 4..8px`) via `ctx.line()` gated by `fbm2 > 0.65`.

### Recipe 7 — Volumetric Multi-Lobe Clouds (`cloudRows` → Cached Puff Stamps + Rim + Depth Drift)

- **Upstream lesson:** `cloudRows()` (`scenes.ts:212–229`) unions 1 flat-bottomed wide base ellipse (`ry = 0.34h`) with `2–4` tall upper cumulus lobes (`rx = 0.16–0.30w`), then marks all 4-connected boundary pixels as bright edge (`'e'`) and interior as `'c'`. `clouds()` instantiates `4` variants at depth `z ∈ [0, 1]` with `z`-proportional speed.
- **Defect fixed:** Fixes flat `1px` cloud lines in `halong.ts:88` and flat full-width cream cloud polygons in `vn-fansipan` (`ui-after/vn-fansipan-light-new.png`).
- **Engine mapping:**
  - At `build(ctx)` (or module init via `parseSprite`), pre-bake `3–4` cloud `Sprite` stamps (`28×10`, `44×14`, `64×18`, `84×22` art px) from a seeded base ellipse + `3` upper lobes:
    - Top `1–2px` sunlit contour facing the light source → `Ink.CloudRim` (`#FFFFFF` / `#F6DCC2`).
    - Upper/mid body → `Ink.CloudBody` (`#EEF6FD` / `#C4CFD8`).
    - Bottom `2–3px` flat underside → `Ink.CloudShadow` (`#A9C1D6` / `#899DB2`), using `1px` `4×4` Bayer transition along the shadow-body seam.
  - In `frame(ctx, t)`, draw `2` depth bands inside `ctx.layer({ kind: 'sky' | 'fog' })`:
    - Far clouds (`v ∈ [0.10, 0.28]`, smaller `28×10` / `44×14` stamps): drift at `0.15 px/s` (`Math.floor(t * 0.15 + phase) % (w + span) - stampW`).
    - Mid/near clouds (`v ∈ [0.22, 0.42]`, larger `64×18` / `84×22` stamps): drift at `0.40 px/s`.
  - Keep clouds **above** `horizon - 15px` (except Fansipan's sea-of-clouds layer, which replaces `far`/`mid` valleys at `v ∈ [0.50, 1.00]` with overlapping scalloped puff banks rather than a flat polygon ending at `0.96h`).

### Recipe 8 — Semantic Layer Occlusion & Grounded Contact Masks

- **Upstream lesson:** Upstream draws `sky → sun → far karsts → near karsts + reflections → clouds → birds → water glints → pole → flag` (`vn`) and `sky → glow → Fuji → torii → branch + lantern → birds → petals` (`sakura`). Foreground objects cleanly clip/occlude moving elements behind them.
- **Engine mapping (`API.md` `ctx.mask()` + `ctx.layer()`):**
  - Strictly separate static and dynamic passes using `z`-ordered layers and reusable `Mask` buffers created once in `build(ctx)` (cached per `SceneRenderer` via `WeakMap<Uint8Array, SceneCache>` keyed on `ctx.base`, never module-global):
    1. `sky` (`z: 0`): sky, celestial disc, far stars.
    2. `far` (`z: 1`): distant ridges/karsts (`Mask` optional).
    3. `fog` (`z: 2`, `fogMask`): broken valley mist bands (`8–16px` tall), clipped to valley gaps so fog never slices across mountain peaks (`03-scene-set.md` §3.3–3.4).
    4. `mid` (`z: 3`): hero terrain / torii / mid islands. Record `landMask` (`coverage = 15`) for occlusion.
    5. `water` (`z: 4`, `waterMask`): `waterMask.rect(0, horizonPx, w, h - horizonPx)` with `landMask` pixels cleared (`coverage = 0`), ensuring water glints and wakes **never** bleed onto shores, pillar bases, or karsts.
    6. `fx` (`z: 5`): far birds (drawn *before* `near`), animated hero sprites (`boatSheet`, `camelSheet`), mid petals/snow.
    7. `near` (`z: 6`, `nearMask`): foreground framing islands (`vn-halong` left karst `u = 0..0.20`), sakura/pine corner branches, foreground torii pillars. In `frame()`, re-stamp or composite `near` spans (from a cached `nearMask` + index slice of `ctx.base`) **after** `fx` so birds, petals, and distant boats pass *behind* foreground framing!
    8. `fx` (`z: 7`): near-depth petals/snowflakes (`<= 10%` of `ParticlePool`) that pass *in front of* the foreground frame.

### Recipe 9 — Tapered Sun-Path Glints & 6-Phase Water Cycling (Fixing Blocky Water)

- **Upstream lesson:** Upstream splits water into (a) sparse deterministic ripples (`(13x + 7y) % 17 === 0`, `~6%` coverage) swaying smoothly, and (b) a tapered perspective sun-glint cone (`spread = round(1 + d * 0.8)`) pulsing gently, plus dimmed karst reflections (`0.3` opacity, `50%` height).
- **Defect fixed:** Replaces the wide rectangular stair-stepped glint bars in `halong.ts:124–131` and `phu-quoc.ts` (`ui-after/vn-halong-light-new.png`, `vn-phu-quoc-light-new.png`).
- **Engine mapping:**
  - **Cycles (`SceneDef.cycles`):** Reserve `6` indices (`18..23`, `Wave0..Wave5`) and declare `cycles: [{ indices: [18, 19, 20, 21, 22, 23], rate: 6 }]` (`6` steps/sec = `167ms` per phase step). Keep palette contrast across `Wave0..Wave5` subtle (`ΔL* <= 6–8` per step) so cycling shimmers like water instead of strobing.
  - **Perspective wave strokes (in `build` inside `waterMask`):** Draw short horizontal `ctx.line(x, y, x + len, y, Wave0 + phaseIdx)` strokes whose length scales with depth `depth = (y - horizonPx) / waterH`: `len = Math.round(3 + depth * 13)` (`3px` near horizon → `16px` near bottom), spaced at `14–22px` horizontally and `2–3px` vertically with deterministic row stagger `(y * 7) % 19`.
  - **Tapered sun-path glints:** Centered on sun `sx`, expand half-width linearly from `halfW = 4px` at `horizonPx` to `34px` at `y = h` (`8px → 68px` total cone width, matching `03-scene-set.md` §3.6 `8→65px`). Inside that cone only, scatter `1px`-tall strokes (`2–7px` wide near horizon, `4–11px` lower down) at `22–30%` probability using `2–3` cycling glint indices (`rate: 4`, `250ms`/step) or `Wave4..Wave5` + `WaterGlint` so glints sparkle strictly inside the light corridor while surrounding water stays calm.
  - **Broken reflections:** Beneath `mid`/`near` karsts or torii pillars, draw reflection patches up to `45%` of object height using `3–14px` horizontal segments separated by `1–2px` water gaps and shifted `±1–2px` per row (`Math.round(Math.sin(y * 0.45 + Math.floor(t * 3)) * 1.5)`), updated at `3 fps` (`333ms`).

### Recipe 10 — Coupled Geometry–Shading Motion (Flag Wave, Swaying Fronds, Bobbing Boat)

- **Upstream lesson:** In `vn()`, each flag column `i` oscillates vertically by `round((sin(ph) + 0.18*sin(2ph+1)) * A * ((i+1)/L)^0.8)` over `1.85s` (`A = 0.14H`, `k = 2.2π/L`) **and simultaneously** applies fold shadow (`0..0.32`) or highlight (`0..0.22`) proportional to `cos(ph)`. Coupling motion and shading turns flat translation into rippling cloth.
- **Defect fixed:** Prevents disembodied moving lines (`phu-quoc.ts` L181 detached floating brown stick in `ui-after/vn-phu-quoc-light-new.png`) and stiff bouncing sprites.
- **Engine mapping:**
  - **Pre-baked multi-pose `SpriteSheet` (flags, sails, palm fronds, branch tips):**
    - Author `4–6` discrete frames inside one `Sprite` atlas via `parseSprite()` + `createSpriteSheet(sprite, frames)` with explicit `pivot` anchored at the **fixed attachment point** (flagpole top, trunk crown top, branch root — never floating unattached!).
    - Advance at `2–3 fps` (`frame = Math.floor(t * 3)`, `333ms`/frame for a `6`-frame `2.0s` flag cycle; `2 fps` / `500ms` for sails and palm frond gusts).
    - **Slope-coupled palette assignment inside each frame:** When generating or authoring frames, compute column slope `cos(ph)`: pixels on upward/lit slopes (`slope > 0.25`) use `HeroRim` (`#FF5449` / `#FFF36B`), flat/neutral columns use `HeroBody` (`#DA251D` / `#FFEA00`), and downward/trough slopes (`slope < -0.25`) use `HeroShadow` (`#9E1912` / `#C4A800`).
  - **Anchored boat/reflection motion (`vn-halong`, `vn-phu-quoc`):**
    - Keep `boatSheet` (`24×16`, `2` sail frames at `2 fps`, `pivot: { x: 12, y: 12 }`) out of `ctx.base`.
    - Vertical bob: `boatY = baseY + Math.round(Math.sin((t * Math.PI * 2) / 7))` (`±1px` over `7.0s` period); horizontal drift `0.3–0.5 px/s` or stationary bobbing with `2–4` trailing `1px` wake lines (`Ink.Wake`) masked to `waterMask`.

### Recipe 11 — Hand-Authored Multi-Scale Landmarks & Stepped Lantern Halos (No Checkerboard Mats)

- **Upstream lesson:** `TORII_GATE_ROWS` (`18×9`, 5 material symbols) and `SAKURA_BRANCH_ROWS` (`60×13`, 10 symbols) use hand-placed `1px` highlights, dark structural caps (`#7f1d1d`, `#475569`), and crisp silhouette gaps (`rows 2, 4–7` open between pillars), paired with a radial warm lantern halo (`#fef08a`, `r = 6c`).
- **Defect fixed:** Directly resolves two defects seen in `ui-after/world-kyoto-dark-new.png` and `world-kyoto-light-new.png`: (1) the harsh yellow-black checkerboard square beneath the stone lantern, and (2) foreground torii lintel cutting straight across the `/new` textarea (`scoring.md` §2B).
- **Engine mapping:**
  - **Multi-scale Torii / Stilt-House / Caravan atlases:** Never downscale one `48×48` sprite to `14×14`. Hand-author `3–4` discrete scale variants (`world-kyoto`: `14×12`, `26×22`, `48×40`, plus foreground edge framing pillars `u = 0.14` & `u = 0.88` whose kasagi lintel sits either *above* `v = 0.05` or crops cleanly outside the `/new` panel). Each scale preserves `1–2px` dark stone pillar bases (`#1E2430`) and `1px` right-facing rim (`#E3A270` light / `#C67C58` dark).
  - **Indexed Stepped Lantern Halo (replacing checkerboard mats):**
    - Precompute a `3`-ring distance field around each lantern (`(lx, ly)`) in `build(ctx)` within radius `r = 12px` (inner core `d <= 4px`, mid ring `4 < d <= 8px`, outer ring `8 < d <= 12px`), clipped to `groundMask` / `stoneMask`.
    - Instead of `50%` yellow/black Bayer dither, remap existing ground/stone palette indices through a small 3-level lookup `haloRemap[ring][baseIdx]` (e.g., `MossDark → MossLit → LanternWarm → LanternCore`), reserving Bayer `4×4` at `25%` **only** along the outer `1px` fringe (`d ∈ [10, 12]`).
    - Animate halo pulse gently in `frame()` by shifting the ring thresholds `±1px` or swapping between `2` pre-built warm indices every `2.5s` (`5–10%` luminance variation over `5s`, `0.2 Hz`) in `dark` mode, and turn halos **off** during `light.day` / `light.dawn`.

### Recipe 12 — Wind-Coupled Particle Pool & 4-Pose Bird Flight (`ParticlePool <= 160`)

- **Upstream lesson:** `sakura` launches `18–48` diagonal falling petals (`6–13s` fall, `2.5–5s` tumble) and `3` birds (`8–14s` glide), while `vn` animates `2–8` flapping birds (`2 Hz` `'v'`/`'-'` swap, `0.8–1.8 cells/s`).
- **Engine mapping:**
  - **Sakura/Leaf Particle Pool (`new ParticlePool(48, seed)`):**
    - Spawn continuously from the foreground branch bounding mask (`u ∈ [0.65, 0.98], v ∈ [0.02, 0.25]` for `sakura`/`kyoto`) and upper-right edge.
    - Split into `2` depth tiers inside the single pool (`48 <= 160` cap):
      - **Far/mid tier (`36` particles, `75%`):** `1×1px` (`ctx.px`), `vx = -3.5..-6.0 px/s`, `vy = 2.5..4.5 px/s`, `life = 5–8s`, rendered at `z = 5` (clipped by `nearMask` so they pass behind near pillars/branches).
      - **Near tier (`12` particles, `25%`):** `3×3` or `4×4` `spriteFrame(petalSheet, Math.floor(t * 4 + p.life), x, y)` (`4` tumbling poses at `4 fps` = `250ms`/pose), `vx = -7.0..-10.5 px/s`, `vy = 5.0..7.5 px/s`, rendered at `z = 7` (in front of `near` branches).
    - **Wind gust envelope:** Compute deterministic `gust(t)`: wait `8–14s`, smooth ease-in/out over `2.5s` (`sin(π * u)^2`), multiplying `vx` by `1 + 0.65 * gust` and spawning `6–10` extra burst particles from the branch mask (`pool.spawn(...)` silently no-ops if all `48` slots are full).
    - **Advance cleanly:** Call `pool.advance(dt)` once per `frame()` (`dt` already clamped `<= 0.2s` inside `ParticlePool.advance`), and initialize `build()` / `t = 0` by pre-stepping `pool` `60` iterations of `0.1s` (`6s` warm-up) so `reduced-motion` and initial thumbnails show petals mid-air instead of an empty sky!
  - **Flapping Bird SpriteSheet:**
    - Author an `8×5` `4`-pose wing cycle (`upstroke → level → downstroke → glide`) via `parseSprite` + `createSpriteSheet`, advancing at `6 fps` (`Math.floor(t * 6 + phase) % 4`, `167ms`/pose), drifting horizontally at `2.0 px/s` along a gentle sine arc (`y = y0 + Math.sin(t * 0.4 + i) * 3`), keeping `y` clear of cloud rims and `/new` header text (`v ∈ [0.22, 0.44]`, outside center panel).

---

## 3. Summary Checklist: Mapping Upstream Craft to Active v2 Scene Fixes

| Scene in `03-scene-set.md` | Upstream Craft Applied (Recipes) | Current `ui-after` Defect Addressed (`scoring.md`) |
| --- | --- | --- |
| `vn-halong` | **R1, R2, R3, R4, R6, R7, R8, R9, R10, R12** | Replaces `20px` sky dither (`R2`), smooth cone karsts + horizontal `Cave` bars (`R6`), 1px dashed fog (`R7/R8`), blocky stair-step water glints (`R9`), and 2-line V birds (`R12`). |
| `vn-fansipan` | **R2, R3, R5, R7, R8, R10** | Fixes `0.96h` cloud gap exposing bottom-right sky (`R7`), flat cream clouds (`R7` underside shadow + rim), `20px` sky dither (`R2`), and flag/peak framing (`R5, R10`). |
| `vn-phu-quoc` | **R2, R5, R8, R9, R10** | Fixes `phu-quoc.ts` L181 floating brown stick via pivot-anchored frond `SpriteSheet` (`R10`), blocky far island (`R6`), and blocky water glints (`R9`). |
| `world-kyoto` | **R1, R2, R3, R4, R5, R8, R11, R12** | Fixes yellow-black checkerboard lantern mat (`R11`), flat left moss slab (`R4`), coarse sky-slit dither (`R2`), foreground torii lintel crossing `/new` textarea (`R5, R11`), and adds wind-gust petals (`R12`). |
