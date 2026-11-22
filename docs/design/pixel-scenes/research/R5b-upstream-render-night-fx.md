# R5b — Upstream Rendering & Night FX Study (Galaxy, Hội An, Noel → 480×270 Indexed Engine)

**Scope:** Deep-dive extraction of depth, lighting, glow/bloom, **aurora curtains**, **believable night scenes**, **animated characters/gait cycles**, **particle systems**, **black hole lensing**, and **day/night handling** from upstream `Aqua2409z/pixel-chat-themes` (`f237a18`), mapped into concrete, parameterized recipes for OnniCode's indexed `480×270` Canvas2D engine ([`API.md`](../../../../packages/web/src/lib/scenery/engine/API.md)).

**Sources inspected directly:**
- Upstream SVG+SMIL builder: `pixel-themes/hooks/scenes.ts` (L1–1804: `Scene`, `galaxy`, `hoian`, `nxRay`/`nxPaint`/`nxTeamSvg`/`noel`)
- Upstream Canvas2D userscript: `claude-pixel-themes.user.js` (L1–320 `World`, L825–1276 `galaxy`, L1280–1463 `hoian`, L1469–2619 `noel` `nxPaint` + `frame`, L3447–3466 `checkAutoCycle`)
- Upstream visuals: `preview.png`, `shots/upstream-index.png`
- OnniCode engine & current v2 UI captures: [`API.md`](../../../../packages/web/src/lib/scenery/engine/API.md), [`types.ts`](../../../../packages/web/src/lib/scenery/engine/types.ts), [`context.ts`](../../../../packages/web/src/lib/scenery/engine/context.ts), [`layers.ts`](../../../../packages/web/src/lib/scenery/engine/layers.ts), [`particles.ts`](../../../../packages/web/src/lib/scenery/engine/particles.ts), [`sprite.ts`](../../../../packages/web/src/lib/scenery/engine/sprite.ts), [`dither.ts`](../../../../packages/web/src/lib/scenery/engine/dither.ts), [`palette.ts`](../../../../packages/web/src/lib/scenery/engine/palette.ts), [`renderer.ts`](../../../../packages/web/src/lib/scenery/engine/renderer.ts), [`tromso.ts`](../../../../packages/web/src/lib/scenery/scenes/world/tromso.ts), [`03-scene-set.md`](../03-scene-set.md), [`evidence/v2/scoring.md`](../evidence/v2/scoring.md), and `evidence/v2/ui-after/*.png`.

> **Ownership rule:** Techniques, math, and parameter relationships only. No upstream code, ASCII sprite tables, or palette arrays are copied into OnniCode.

---

## 1. Visual Diagnosis: Upstream vs. Current OnniCode (`ui-after/*.png`)

Inspecting upstream `preview.png` and `shots/upstream-index.png` alongside our `evidence/v2/ui-after/*.png` reveals why upstream night/lighting scenes read with depth and atmosphere while several of our current scenes still look flat or noisy:

| Aspect | Upstream (`galaxy`, `hoian`, `noel`) | Current OnniCode (`ui-after/*.png`) | Root Cause in Code |
| --- | --- | --- | --- |
| **Sky gradient** | `noel` `nxPaint` quantizes sky across 70% height into **11 discrete bands** with 4×4 Bayer dither **only at band boundaries**; `hoian`/`galaxy` use smooth dark gradients (`#0c0a26 → #4a2340`, `#04020a → #0b061d`). | `world-tromso`, `world-kyoto`, `world-matterhorn`, `vn-halong`, `world-sahara` show coarse 2×2 / 8×8 checkerboard stipple across wide sky strips. | Calling `ctx.dither(x, y, v * 0.92, 0, 3, 8)` across the full sky height spreads high-contrast Bayer cells over `~175px` (`tromso.ts` L353–358). |
| **Aurora curtain** | `noel` (`user.js` L2226–2287) renders on a `ceil(PW/3) × ceil(PH*0.4/3)` subgrid using a dual-sine curtain baseline (`0.18` + `0.08` amp), smooth 1D ray noise (`nxRay`), power-curve vertical fade `(1 - d)^1.6`, and soft edge taper `min(1, 6u, 6(1-u))`. `scenes.ts` L1544–1561 uses two overlapping undulating sine ribbons with vertical emerald→cyan→violet fade. | `world-tromso-dark-new.png` and `world-tromso-dark-chat.png` show separated vertical barcode stripes of green/lavender dots (`\| \| \|`) above a choppy 2–3px bottom line. | `tromso.ts` L409–433 filters rays by `rayWave > 0.54` (leaving 46% empty gaps), flickers pixels with `((x*5 + y*3 + floor(t*4)) & 3)`, and draws 1–2px columns instead of a continuous folded curtain sheet. |
| **Local light & glow** | `hoian` & `noel` pair crisp pixel sources (`#ffcc66`, `#fff0b8`, `#ffd27a`) with soft radial halos (`64×64` cached gradient or 8-step Bayer dithered ground pool `pool()`) + directional window `spill()` + light `cones` that tint falling snow `#ffe7b8`. | `world-kyoto-dark-new.png` shows a harsh yellow semicircle beneath the right lantern; `world-tromso-dark-new.png` shows stacked solid tan polygons under the cabin (`inCabinPath`). | Direct un-dithered polygon/rect fills on water/stone without radial falloff, ground clipping, or row-broken glint widths. |
| **Depth & occlusion** | `noel` splits `img` (far mountains → mid hills/pines tinted `nxMix(c, skyLow, 0.42)` → snow → houses → trees → streetlamps) and `over` (corner branches drawn **after** Santa and snow). `galaxy` draws back disk → lensing arcs → black hole → front disk. | `vn-halong-dark-new.png` has a flat horizontal fog bar spanning islands; `vn-fansipan-dark-new.png` shows bright rim lines cutting across clouds. | Missing `ctx.layer({ mask })` occlusion separation between dynamic `fx` / `fog` and `far` / `mid` / `near` geometry. |

---

## 2. How Upstream Achieves Each Effect (Technical Breakdown)

### 2.1 Depth (5+ Planes Without Camera Parallax)
Upstream creates strong depth in static frames before any pixel moves:
1. **Atmospheric tinting by plane (`noel` L1048, L966–972):** Distant village buildings (`backHouse`, `church`) are explicitly desaturated/blue-shifted toward horizon sky using `nxMix(col, NX.skyLow, 0.42)` (`#6f8fc4`, 42% mix). Mid hills mix `30%` and `22%` snow (`0.3 - k * 0.08`) and add a Bayer-dithered horizon glow band (`25%` → `15%` density) between hill layers to separate ridges.
2. **Silhouette scale & detail budget:**
   - Far mountains (`range` L910): simple triangular peaks (`4`–`10` peaks), 2-tone rock + 2-tone snow cap (`0.33h`), zero window/brick detail.
   - Mid village (`backHouse` at `0.05–0.07 PW`, `2×2s` windows) sits behind foreground houses (`0.09–0.11 PW`, timber beams every `6s`, 2-floor `3s×4s` framed windows, wreaths, icicles, chimneys).
3. **Foreground `over` occlusion (`noel` L860, L1216–1232, L1769):** Corner pine branches (`over` buffer, capped at `y <= 0.26 * PH`) render **after** Santa, snow particles, and bokeh—so dynamic elements physically pass behind foreground needles.
4. **3D layer interleaving (`galaxy` L909–982; `planet` L863–890):** Back half of rings/accretion disk (`ty < 0` or `dy <= -1`) → solid planet/black-hole sphere → front half of rings/disk (`ty >= 0` or `dy >= 0`).
5. **Multi-depth particles:** Stars (`z ∈ {0.25, 0.5, 1.0}`), clouds (`z ∈ [0,1]` scaling width, speed `0.35 + 1.2z`, alpha `0.55 + 0.45z`), and snow (`4` depth tiers at `z < 0.45 / 0.85 / 0.965 / 1.0`).

### 2.2 Believable Night Scenes
Upstream `noel`, `hoian`, and `galaxy` feel genuinely nocturnal—not washed-out gray and not crushed black—because of five measurable rules:
1. **Blue-hour / deep-indigo value anchor (not `#000000` sky):**
   - `noel`: `#142347` (zenith, L\*≈14) → `#29457c` (mid, L\*≈29) → `#6f8fc4` (horizon haze, L\*≈58).
   - `hoian`: `#0c0a26` → `#1f1438` → `#4a2340` (warm plum horizon from town bounce).
   - `galaxy`: `#04020a` → `#0b061d` → `#06091f` + radial edge vignette (`0.55` black) so the black hole's `#000000` event horizon still reads darker than deep space.
2. **Cool ambient shadows vs. narrow warm emissives:**
   - Snow/stone shadows stay cool slate-blue (`#b7c6e4`, `#93a8d4`, `#6c7fae`, `#8296c4` outline).
   - Warmth is confined to `<8%` of pixels: windows (`#ffcc66` top / `#fff0b8` hot lower pane), lanterns (`#ffd27a`, `#ffc861`), bulbs (`#fff1c4`..`#ffc861`), and ground spill (`#ffc77a`, `#ffcf85`).
3. **Directional moonlight & contact shadows:**
   - Moon (`#f6f2df` lit face, `#e2dcc2` Bayer-dithered terminator where `(x-mx)*0.55 + (y-my)*0.75 > 0.35r`, `#d6cfb2` craters) casts consistent left-lit / right-shaded planes on mountains (`x < pk.x`), church spire (`x > cx`), snowman (`0.6x + 0.8y > 0.45r`), and gift boxes (`x > 0.65w` darkened `25%`).
   - Ground drifts (`sh > 0.78`) and contact bases (snowman shadow `[-9..11]` px at `gy`, footprints in `#93a8d4`) anchor objects to the snow.
4. **Night specular glints (`glints` L1336, L2335):** `0.25 * PW` sparse snow pixels pulse briefly (`sin(t*f + ph) > 0.75`) and expand to a 3px horizontal sparkle only at peak (`a > 0.6`), simulating moonlight on ice crystals without noisy snow-wide glitter.
5. **Night-only vs. day switching:** In `noel` and `hoian`, stars, embers, window glow, and streetlamp cones are primary actors. (Note for OnniCode `tromso`: aurora and stars must vanish or drop to faint cirrus in `light`/`day`, per `03-scene-set.md` §3.7.)

### 2.3 Lighting, Glow & Bloom (Soft Upstream vs. Indexed Reality)
Upstream mixes crisp pixel art with two Canvas2D/SVG glow tricks that our indexed engine forbids directly (`ctx.globalAlpha`, `radialGradient`, `lighter`):
1. **Radial sprite glows (`World.glow` L249–263, `sc.glow` L113–117):** Upstream caches a `64×64` radial gradient per hex color (`alpha` `1 → 0`) and draws it scaled at `alpha ∈ [0.20, 0.55]`.
2. **Dithered pixel-art light pools (`nxPaint` `pool()` L1235–1246, `spill()` L1315–1322, `lantern` cone L1200–1212):** Inside `nxPaint`, upstream **already solves lighting without alpha blending** by quantizing radial falloff `v = round((1 - d)^0.8 * a * 8 + nxB(x, y) - 0.5) / 8` with 4×4 Bayer dithering and clipping strictly to `y >= ground(x)`!
3. **Light-reactive particles (`noel` L2570–2595):** Each falling snowflake tests intersection against `s.art.cones` (`|x - cone.x| < 1 + spread * (y - top) / (bottom - top)`). Inside the cone, the flake switches from cool `#c9d6f0`/`#ffffff` to warm `#ffe7b8` (and triggers a `#ffd27a` micro-halo on crystal flakes).

### 2.4 Aurora Curtain (How Upstream Makes It Work)
Upstream provides **two distinct aurora architectures**—comparing both explains exact design invariants:

1. **Canvas2D Coarse-Grid Curtain (`claude-pixel-themes.user.js` L2226–2287):**
   - **Subgrid resolution:** `AW = ceil(PW / 3)`, `AH = ceil(PH * 0.4 / 3)`. At `PW=120, PH=68` (`480×270` at `P=4`), that is `40 × 10` cells—or `120 × 48` at 1:1/2× art-pixel scale. Evaluating on a subgrid makes curves smooth and keeps CPU negligible.
   - **Wavy curtain lower hem (`base`):** Two incommensurate sine waves moving in opposite directions:
     `base(u, t) = AH * (0.55 + 0.18 * sin(u*5 + t*0.12) + 0.08 * sin(u*13 - t*0.20))`
   - **Continuous vertical ray modulation (`nxRay`):** Smoothstep-interpolated 1D value noise (`nxRay(x * 0.35 + t * 0.6, seed)`) modulates column brightness in `[0.45, 1.00]`—**never** dropping to zero gaps (`> 0.45` floor keeps the curtain connected!).
   - **Asymmetric vertical profile (`d`):** `d = (base - y) / (AH * 0.5)`.
     - Below the hem (`-0.08 < d < 0`): sharp 8% ramp `1 + d / 0.08` so the bottom edge is crisp and luminous.
     - Above the hem (`0 <= d < 1`): concave power fade `(1 - d)^1.6` so rays taper softly upward into the night sky.
   - **Horizontal envelope (`edge`):** `min(1, 6u, 6(1 - u))` fades out the outer `16.7%` on left and right edges so curtains never clip at screen borders.
   - **Altitude color shift:** Bottom hem (`k = clamp(d,0,1) = 0`) is bright emerald-mint `rgb(60, 255, 170)` (`#3cffaa`), transitioning continuously up the curtain (`k → 1`) to violet `rgb(150, 105, 230)` (`#9669e6`).
   - **Compositing:** `lighter` additive blend with slow global breath `0.7 + 0.15 * sin(t * 0.3)`.

2. **SVG+SMIL Dual-Ribbon Curtain (`scenes.ts` L1543–1561):**
   - Draws **2 overlapping ribbons** at `y0 = 0.05H` and `0.10H`, height `hgt = 0.16H`, overscanned `-0.2W .. 1.2W` so horizontal drift never reveals a seam.
   - Vertical linear gradient: transparent bottom `stop 0` (`a=0`) → bright green core at `0.15` (`#3cffaa`, `a=0.5`) → cyan-teal at `0.60` (`#5ad8e0`, `a=0.22`) → violet fade at `1.0` (`#8a6cff`, `a=0`).
   - Independent periods (`9s`/`13s` opacity breathing `0.35 ↔ 0.70`; `16s`/`22s` translation drift `0.08W`) create slow parallax folding between the two ribbons.

**Why `tromso.ts` failed visually:** Our `tromso.ts` draws isolated 1px rays (`rayWave > 0.54` → zero alpha in 54% of columns!) with harsh temporal checkerboard dithering `((x*5+y*3+floor(t*4))&3)` and no altitude color shift (`bodyInk` green only, no emerald→cyan→violet vertical ramp).

### 2.5 Animated Characters & Gait Cycles
Upstream animates tiny pixel characters convincingly with minimal frame counts:
1. **Reindeer 3-Frame Gallop + 4-Step Gait (`scenes.ts` L1386–1406, `user.js` L2112–2170):**
   - **Split static torso (`NX_DEER_TOP`, `24×14`) from animated legs (`NX_DEER_LEGS`, `23×4`, 3 poses):**
     - Pose `0`: legs extended wide (front forward, hind back)
     - Pose `1`: legs passing near mid-stance
     - Pose `2`: legs tucked inward under belly (`......kkkk.............`)
   - **Ping-pong gait table `NX_GAIT = [0, 1, 2, 1]`** cycled at `gaitDur = 0.44s` (`~9.1 fps` step change, `4` beats per cycle).
   - **Per-animal phase offset:** Reindeer `k ∈ {0, 1, 2}` uses `NX_GAIT[(i + k) % 4]` and vertical bob `round(sin(t * 9 + k * 1.7))` so the 3 deer never move in robotic lockstep.
   - **Secondary follow-through:** Catenary reins (`sin(π*k)*1.2`) re-anchored dynamically to each deer's bobbing shoulder (`deer[k].y + 9`), cold breath puffs (`0.35s` spawn, `0.9s` drift), Rudolph nose blink (`sin(t*5) > -0.3`), and Santa's 2-frame waving arm (`0.28s` toggle during `1.8s` of every `6s` cycle, or triggered when pointer `< 40u`).
2. **Villager Stroll (`NX_WALKER`, `4×8`, 2 frames at `4 Hz`):**
   - Frame `0`: `l..l` (stride open); Frame `1`: `.ll.` (legs together).
   - Patrols bounded sidewalk interval `[a, b]` at `2.5–4 px/s`, horizontally mirrored on turn (`dir > 0 ? x0 + i : x0 + 3 - i`), holding a 1px lantern (`#ffd27a`) with local glow `r=3` ahead of the leading hand (`dir > 0 ? x0 + 4 : x0 - 1`).
3. **Spinning Crystal (`NX_CRYSTAL`, `7×7`, 2 frames at `2.2 Hz`):** Alternates orthogonal `+` arms and diagonal `×` arms while falling/swaying.

### 2.6 Particle Systems, Rare Events & Black Hole Lensing
1. **4-Depth Snow + Gust Envelope (`user.js` L2534–2617):**
   - `wind` state smoothly eases `now += (target - now) * min(1, 0.8*dt)`: calm `0.6–1.8` for `6–12s`, gust `5–9` for `2–3.5s` (`35%` trigger chance).
   - Horizontal motion combines per-flake sine sway `sin(t*0.8 + ph)*(1 + 2z)` + wind scaled by depth `wind * (0.4 + z)`.
   - Depth tiers: `z < 0.45` (1px `#c9d6f0`, `a=0.35`), `< 0.85` (1px `#fff`, `a=0.65`), `< 0.965` (5px `+` cross `#fff`, `a=0.95`), `>= 0.965` (7×7 2-frame crystal). Vertical speed `(3 + 10z) * sp`.
2. **Causal Parachute Gift Chain (`user.js` L2459–2532):**
   - Drops only outside `keepOut` zones (snowman, tree).
   - `0..0.45s`: gravity free-fall `vy += 30 * dt`.
   - `> 0.45s`: canopy opens (`5×2` striped sprite + 4 shroud pixels), `vy` eases toward terminal `5 px/s` (`vy += (5 - vy)*min(1, 4*dt)`), horizontal sway `sin(age*2 + ph) * 1.6`.
   - Ground contact (`y >= ground(x) - 1`): spawns a 10-particle radial spark burst (`vx = cos(a)*[6..12]`, `vy = sin(a)*[6..12]-4`, gravity `20`, life `0.8s`).
3. **Black Hole Lensing & Accretion (`galaxy` `user.js` L909–982, `scenes.ts` L601–628):**
   - Normalized ellipse equation `e = hypot(dx / rx, dy / ry)` with `rx = 3.1R`, `ry = 0.6R`, inner edge `ein = 1.3R / rx`.
   - **Doppler beaming:** `beam = 0.78 - 0.42 * cos(th)` (brightens approaching left limb `th ≈ π` to `1.20×`, dims receding right limb `th ≈ 0` to `0.36×`).
   - **Spiral shear:** `sw = sin(3*th - 4*ang + 8*rn)` drives 4 radial temperature zones (`#fde68a/#fff` inner → `#f59e0b` → `#fb923c/#f43f5e` → `#a855f7` outer).
   - **Gravitational lensing arcs (`gxArcs`):** Two bent ellipses (`a = 1.75R`, `b = 1.45R` upper; `0.82b` lower) drawn **between** the far disk and the `#000000` event horizon, creating the Interstellar/Gargantua halo over/under the shadow.
4. **Hội An Lantern Reflections (`user.js` L1431–1437):** Per-lantern vertical column (`x ± 1px`) hashed by `hash(x + (d >> 1), y, floor(t * 4) + seed) < 0.34`, intensity decaying with distance below the river bank `max(0.08, 0.42 - d * 0.018)`.

### 2.7 Day / Night Handling
- Upstream (`user.js` L3447–3455) only swaps **whole themes** (`sakura` 06:00–17:59, `hoian` 18:00–05:59, polled every `60s`) and applies a site-mismatch `veil = clamp(veil * veilScale + 0.42, 0, 0.9)`.
- OnniCode (`API.md`, `palette.ts`, `03-scene-set.md`) is strictly stronger: `themePalettes.light` & `themePalettes.dark` each carry 4 keyframes (`dawn/day/dusk/night`) with semantic index preservation, interpolated by `interpolatePalette()`, plus `themeDefaultTime` (`light: 'day' | 'dawn'`, `dark: 'dusk' | 'night'`). This means night FX (aurora, stars, lantern glow, warm window spill) must key off `darkness(ctx.time)` or `ctx.time` **and** reassign palette slots cleanly for daytime equivalents (e.g., `tromso` slots `7–9` switch from emerald/cyan/violet aurora at `dusk/night` to pale ice cirrus `#c8dce8/#b8d0e0/#a8c4d8` at `day`).

---

## 3. Numbered Recipes for Our 480×270 Indexed Engine (`API.md`)

All coordinates are art pixels at **`480×270`** (`scale = 1`, `speed = 1`), strictly **≤32 palette indices (`0..31`)**, **no per-pixel alpha**, **no Canvas gradients/blur**, and **≤160 particles** in `ParticlePool`.

---

### Recipe 1: Band-Quantized Night Sky Gradient (Eliminates Full-Sky Checkerboard)
- **Upstream origin:** `noel` `nxPaint` L878–884 (`11` quantized steps with boundary-only `nxB(x,y)` Bayer dither).
- **Fixes in OnniCode:** Coarse 8×8 checkerboard across the entire sky in `tromso`, `matterhorn`, `halong`, `sahara`, and `kyoto` (`ui-after/*.png`).
- **Palette slots (`4` slots):** `0: zenith`, `1: upper-mid`, `2: lower-mid`, `3: horizon` (e.g., night `#0d172e → #142347 → #29457c → #6f8fc4`; dawn `#3c4e68 → #596d85 → #8a7c93 → #dfc5b2`).
- **Parameters & Engine Mapping (`build`):**
  - Divide `skyH = Math.floor(h * horizon)` into `3` band boundaries at `v ∈ {0.28, 0.58, 0.84}`.
  - Around each boundary, keep a transition strip of **`±6px` (`12px` total height)**—never across the full `175px` sky.
  - Inside each `12px` strip (`t = (y - (by - 6)) / 12` in `[0, 1]`), call `ctx.dither(x, y, t, lowSlot, highSlot, 4)` (using **4×4** Bayer, not 8×8, so cells stay `≤4px` at 3× display scale instead of `8px` macro-blocks). Outside the `12px` strips, fill solid `ctx.rect(0, y0, w, y1 - y0, slot)`.
  - **Result:** Clean, calm sky bands behind `/new` UI text with crisp pixel-art dithering only at transitions.

---

### Recipe 2: Continuous Multi-Ribbon Aurora Curtain (`world-tromso` Hero Fix)
- **Upstream origin:** `noel` Canvas2D coarse-grid aurora (`user.js` L2226–2287) + SVG dual-ribbon (`scenes.ts` L1543–1561) + `nxRay` smooth 1D noise (L785–790).
- **Fixes in OnniCode:** Broken vertical barcode stripes & harsh 2px solid hem in `tromso.ts` L386–449 (`world-tromso-dark-new.png`).
- **Palette slots (`4` slots, indices `7, 8, 9, 10` or `4` dedicated aurora slots):**
  - `7`: outer violet-indigo top veil (`#6e5ea8` / `#8e82ae`)
  - `8`: mid teal-cyan body (`#389888` / `#5ad8e0`)
  - `9`: bright emerald lower curtain (`#48c090` / `#3cffaa`)
  - `10`: intense mint-white hem core (`#8ef0be` / `#b6ffe0`)
  - *(In `light.day`, remap slots `7..9` to sky-matched ice cirrus `#c8dce8 / #b8d0e0 / #a8c4d8` and set `auroraStrength = 0`.)*
- **Parameters & Engine Mapping (`frame`):**
  1. **Occluded layer:** Wrap aurora draws inside `ctx.layer({ kind: 'fx', z: 1, mask: skyMask }, ...)` where `skyMask` is baked once in `build()` with `15` for sky pixels above far/mid mountain ridges and `0` inside mountains—**zero** manual per-pixel `ctx.base` checks needed inside loops, and mountains cleanly occlude curtains.
  2. **Coarse evaluation grid (`120 × 48` cells = `4×3px` or `4×4px` block, or `160 × 48` @ `3×3px`):** Evaluate 2 overlapping curtains (`k = 0, 1`) in `u ∈ [0.10, 0.92]` and `y ∈ [12, horizonY - 6]` (`~150px` tall). Update shape at **`4 fps`** (`tick = Math.floor(t * 4) / 4`, or smooth `t` since `120×48 = 5,760` evals takes `<0.15ms`).
  3. **Undulating curtain hem:**
     `hemY(u, t) = baseY + A1 * sin(u * 6.5 + t * 0.14 + ph) + A2 * sin(u * 14 - t * 0.22 + ph)`
     with `baseY = 0.34 * h` (`~92px`), `A1 = 0.045 * h` (`~12px`), `A2 = 0.020 * h` (`~5.4px`).
  4. **Continuous ray modulation (no `0` gaps):** Sample `ctx.fbm1(u * 18 + t * 0.08 + k * 7)` (mapped to `[0.45, 1.0]`) so brightness ripples smoothly along curtains without snapping off into vertical bars.
  5. **Asymmetric vertical profile & altitude color ramp:** For each `(x, y)` in the curtain ROI (`rise = (hemY - y) / curtainH`, `curtainH ≈ 48..68px`):
     - Below hem (`-0.08 < rise < 0`): sharp bright roll-off `intensity = (1 + rise / 0.08) * ray * edge`.
     - Above hem (`0 <= rise < 1`): smooth concave taper `intensity = Math.pow(1 - rise, 1.55) * ray * edge`, where `edge = Math.min(1, span * 6, (1 - span) * 6)`.
     - **Indexed quantization (no temporal flicker!):** Instead of `(x*5+y*3+floor(t*4))&3`, map `intensity * (1 - rise * 0.35)` through `ctx.dither(x, y, frac, lowSlot, highSlot, 4)` using **world coordinates `(x, y)`** across the 4-step altitude ramp (`10` at `rise < 0.12` → `9` at `0.12..0.38` → `8` at `0.38..0.68` → `7` at `0.68..0.95`). Using static 4×4 Bayer on slowly drifting `hemY`/`fbm1` produces silky pixel transitions with **zero salt-and-pepper shimmer**.
  6. **Record per-column peak intensity** `auroraCol[x]` (`0..3`) for Recipe 6's fjord reflection.

---

### Recipe 3: Dithered Indexed Light Pools, Ground Spill & Lantern Halos
- **Upstream origin:** `noel` `pool()` (L1235–1246), `spill()` (L1315–1322), `lantern` cone (L1200–1212).
- **Fixes in OnniCode:** Harsh solid yellow semicircular mat under the lantern in `world-kyoto-dark-new.png` and un-lit dark snow around `world-tromso` cabin/windows.
- **Palette slots (`3` warm-lit ground/stone remap slots, or 4-level remap table):**
  - Define a precomputed `lightRemap[baseSlot]` array (or 3 dedicated warm ground indices: `cool ground` → `warm-tinted ground` → `amber lit` → `bright lantern core`).
  - Example for `world-kyoto` flagstones (`#4b5059` base): level 1 `#6f6b5c`, level 2 `#9e8962`, level 3 `#d8b26a`, core `#ffe699`.
  - Example for `world-tromso` snow (`#829cad` base): level 1 `#9aa6a2`, level 2 `#c7b68a`, level 3 `#f0cb7e`.
- **Parameters & Engine Mapping (`build` + `frame`):**
  - **Elliptical ground pool:** Radius `rx = 18..36px`, `ry = 8..16px` (`ry ≈ 0.42 * rx` for perspective foreshortening on horizontal ground).
  - Clip strictly to a `groundMask` (`ctx.mask()` covering stone path / snow below horizon, excluding vertical posts/walls).
  - For each pixel inside bounding box `(dx/rx)^2 + (dy/ry)^2 < 1`:
    Compute `d = Math.hypot(dx / rx, dy / ry)` and `energy = Math.pow(1 - d, 0.85) * pulse`, where `pulse = 0.92 + 0.08 * Math.sin(t * 2.1 + seed)` (`5–8%` gentle breathing at `~0.33 Hz`, never strobing).
  - Quantize `energy * 3` into levels `0..3` using `ctx.dither(x, y, frac, levelSlot, nextLevelSlot, 4)`.
  - **Result:** Replaces Kyoto's flat yellow checkerboard mat with a smooth 3-ring perspective-foreshortened amber pool on the flagstones.

---

### Recipe 4: Directional Light Cones & Light-Reactive Particles
- **Upstream origin:** `noel` `lantern()` cones (L1199–1212) + snowflake cone tinting (`user.js` L2570–2595).
- **Palette slots:** Snow/particle base slots (`30: far #94b2cc`, `31: near #d0e4f4`) + `1` warm-lit particle slot (`23: #ffe7b8`, shared with warm window/lantern core).
- **Parameters & Engine Mapping (`build` + `frame`):**
  - Store `cones = [{ x, top, bottom, spread }]` in scene state (e.g., `top = lampY`, `bottom = groundY`, `spread = 18..26px`, `2–3` streetlamps/torches max).
  - In `build()` (night/dusk only), paint a subtle `12–18%` Bayer-dithered warm cone tint inside the triangle `|x - cx| <= 1 + spread * (y - top) / (bottom - top)` using `ctx.dither(x, y, (1 - e) * 0.28, baseSkySlot, warmDimSlot, 4)`.
  - In `frame()`, when rendering each active `Particle` from `ParticlePool`:
    Check if `p.y >= cone.top && p.y <= cone.bottom && Math.abs(p.x - cone.x) <= 1 + cone.spread * ((p.y - cone.top) / (cone.bottom - cone.top))`. If inside, draw with warm slot `23` (`#ffe7b8`) instead of cool slot `30/31`.
  - **Result:** Snowflakes, fireflies, or dust motes visibly warm up as they drift through lantern beams (`O(N * 2)` arithmetic checks per frame, zero allocations).

---

### Recipe 5: Atmospheric Depth Tinting & 5-Plane Occlusion Stack
- **Upstream origin:** `noel` `far(c) = nxMix(c, NX.skyLow, 0.42)` (L1048), hill-foot haze band (L970–972), and `over` foreground buffer (L860, L1769).
- **Fixes in OnniCode:** Flat horizontal fog stripes (`vn-halong-dark-new.png`) and un-occluded foreground/midground overlaps.
- **Parameters & Engine Mapping (`build` + `frame`):**
  - Enforce explicit `ctx.layer({ kind, z, mask })` ordering:
    1. `sky` (`z: 0`): Recipe 1 sky + moon/stars.
    2. `far` (`z: 1`): Ridges/buildings with colors baked at **`35–45%` mix toward `skyHorizon`**, zero small texture (`<3px` detail omitted), optional `8–14px` tall Bayer-dithered valley mist band (`15–25%` coverage) masked *only* to gaps between far/mid ridges (never crossing across foreground peaks!).
    3. `fx` (`z: 2`): Distant clouds / aurora / distant birds (`farMask` clips out mid mountains).
    4. `mid` (`z: 3`): Hero landmarks, lit windows, silhouettes with `1px` light-facing rim on `15–25%` of top/lit contour.
    5. `water` (`z: 4`, `waterMask`): Base gradient + dynamic reflections (Recipe 6).
    6. `near` (`z: 5`, `nearMask`): Framing branches, shore rocks, foreground torii (`10–20%` viewport area), drawn to `base` and re-enforced via `nearMask` exclusion on `fx` layers.
    7. `fx` (`z: 6`): Near snow/petals/bokeh passing *in front of* `near`.

---

### Recipe 6: Source-Linked Broken Water Reflections (`tromso` Cabin & Aurora Fix)
- **Upstream origin:** `hoian` per-lantern column shimmer (`user.js` L1431–1437) + `noel`/`vn` broken horizontal water glints.
- **Fixes in OnniCode:** Solid stacked orange blocks under `tromso` cabin (`world-tromso-dark-new.png`) and blocky stair-step glints in `vn-halong-dark-new.png`.
- **Palette slots (`6` water slots `16..21`):** `16: deep`, `17: mid`, `18: wave highlight`, `19: dim aurora sheen`, `20: bright aurora sheen`, `21: bright warm/sun glint` (or `23` for warm window glint).
- **Parameters & Engine Mapping (`frame`):**
  - Strictly clip inside `waterMask` (`y >= horizonY`, excluding `near` shore/posts).
  - **Row-stepped horizontal strips (not vertical solid blocks):**
    - Sample ripple displacement per row: `dx = Math.round(Math.sin(y * 0.35 + t * 2.2) * (1 + 2.5 * v))` where `v = (y - horizonY) / (h - horizonY)`.
    - **Point-light reflection (cabin window / lantern):** Taper half-width from `halfW = 1.5 + v * 6` px (`3px` at shore → `15px` at bottom, capped to `y < horizonY + 0.22 * h`). Instead of filling every pixel, draw **1px-tall horizontal dashes** on rows where `(y + Math.floor(t * 4)) % 2 === 0` AND hash `((x >> 1) * 73 + y * 31 + Math.floor(t * 4)) % 10 < Math.round(7 - v * 4)` (`70%` fill near source tapering to `30%` downward).
    - **Aurora reflection:** Sample `auroraCol[clamp(x + dx, 0, w - 1)]` directly from Recipe 2. Draw `1px`-tall broken wavelets (`len = 2..6px`) on every 2nd or 3rd row where `Math.sin(x * 0.18 - y * 0.25 + t * 1.8) > 0.25`, mapping `auroraCol >= 2` to slot `20` and `auroraCol === 1` to slot `19`.
  - **Result:** Reflections shimmer organically as broken horizontal wavelets tied live to the aurora's current shape and the cabin's exact X coordinate.

---

### Recipe 7: Directional Moonlit Relief, Craters & Snow Drifts
- **Upstream origin:** `noel` `moon()` (L894–906), `range()` (L910–932), `ground` snow drifts (L976–988).
- **Palette slots:** `3` moon slots (`lit #f6f2df`, `limb #e2dcc2`, `crater #d6cfb2` or sky-blended halo) + `3` snow slots (`#eef3fb`, `#b7c6e4`, `#93a8d4`).
- **Parameters & Engine Mapping (`build`):**
  - **Moon (`r = 10..16px` at `480×270`):** Compute directional dot product `shade = (x - mx) * 0.55 + (y - my) * 0.75`. Where `shade > 0.35 * r`, dither between `lit` and `limb` (`ctx.dither(x, y, 0.6, limb, lit, 4)`). Add 2–4 subtle `2–3px` crater clusters in `crater` using deterministic hash cells `(floor((x-mx)/4), floor((y-my)/4))`. Surround rim (`r < d <= 1.75r`) with radial Bayer halo `(1 - (d - r)/(0.75r)) * 0.45` over sky slots.
  - **Snow/terrain contour:** Model broad shadow hollows via `sh = 0.5 + 0.5 * sin(x * 0.035 + sin(y * 0.09) * 2) * cos(y * 0.07 + x * 0.01)`: `sh > 0.78` solid `snowShade`, `0.68..0.78` 4×4 Bayer boundary transition, and `1px` crisp rim (`y === ground(x)`) in `skyLow`-tinted highlight.
  - **Avoid:** Uniform pixel noise over whole snowfields or mountain flanks.

---

### Recipe 8: 3–4 Frame Sprite-Sheet Gait Cycles & Phase-Offset Formations
- **Upstream origin:** `NX_DEER_TOP` + `NX_DEER_LEGS[3]` with `NX_GAIT = [0, 1, 2, 1]` (`scenes.ts` L1386–1406, `user.js` L2112–2170); `NX_WALKER` (`4×8` 2-frame stroll, L1444–1447).
- **API mapping:** `parseSprite` + `createSpriteSheet(sprite, frames)` + `ctx.spriteFrame(sheet, frameIdx, x, y, scale)`.
- **Parameters & Engine Mapping (`build` + `frame`):**
  - **4-beat quadruped / caravan gait (e.g., Sahara camels, birds, reindeer):**
    - Author `3` distinct leg/wing poses packed horizontally in one atlas (`e.g. 24×14 × 3 = 72×14` or `8×5 × 3 = 24×5`) with consistent `pivot` at bottom-center (`{ x: 12, y: 13 }`) so feet stay planted on the terrain waypoint!
    - Map elapsed time via ping-pong lookup `const GAIT = [0, 1, 2, 1]` at **`4–8 fps`** (`step = Math.floor(t * fps)`): `pose = GAIT[(step + unitIndex) % 4]`.
    - Add synchronized `1px` vertical body bob only on extension beat (`dy = pose === 0 ? -1 : 0`)—**no** sliding feet while standing on ground (`dx` advances in discrete whole-pixel steps matching stride `~0.4–0.6 px/s` for distant caravan, `2–3 px/s` for flying birds).
  - **2-frame walker / boatman (`8×12` at `scale=1` or `12×16`):**
    - `2` poses (`stride` vs `passing`) toggled at **`3–4 fps`** (`Math.floor(t * 3.5) % 2`), moving at `3–5 px/s` along a clamped path `[xMin, xMax]` with `ground(x)` height sampling. Author separate left/right frames in the sheet (since `ctx.spriteFrame` does not carry a `flip` arg in `API.md`), and pair a `1px` warm lantern pixel 1px ahead of the leading hand.

---

### Recipe 9: Multi-Tier Particle Depth Pool with Wind Gust Envelope
- **Upstream origin:** `noel` 4-tier snow + wind gust (`user.js` L2534–2605), `sakura` branch gusts.
- **API mapping:** `ParticlePool(capacity, seed)` (`capacity <= 160`, `advance(dt)` with `dt <= 0.2`).
- **Parameters & Engine Mapping (`build` + `frame`):**
  - Allocate **one** `ParticlePool(96, ctx.seed)` (well under the `160` hard cap) + a parallel `Uint8Array(96)` of per-slot `tier` (`0, 1, 2`) and `Float32Array(96)` of `phase`.
  - **3 Depth Tiers (snow, sakura petals, autumn leaves, desert dust):**
    - **Tier 0 (Far, 55% of pool, ~52 particles):** `1×1px`, dim cool slot (`#94b2cc`), `vy = 3..4 px/s`, `swayAmp = 1.0px`.
    - **Tier 1 (Mid, 35% of pool, ~34 particles):** `1×1px`, bright slot (`#d0e4f4` / `#ffffff`), `vy = 6..8 px/s`, `swayAmp = 2.0px`.
    - **Tier 2 (Near, ≤10% of pool, ~10 particles):** `3×3` plus-cross (`px(x,y)` + 4 cardinal neighbors) or `ctx.spriteFrame` `4×4`/`7×7` 2-pose crystal at `2.2 fps`, `vy = 10..13 px/s`, `swayAmp = 3.0px`.
  - **Wind Gust Envelope (deterministic from `t`, no unseeded `Math.random`):**
    - Cycle `12s` (`9.5s` calm `wind = 1.0 px/s` + `2.5s` smoothstep gust peaking at `wind = 6.5 px/s`).
    - Apply `vx = wind * (0.4 + 0.35 * tier) + Math.sin(t * 0.9 + phase) * swayAmp` before `pool.advance(dt)` and wrap/respawn at viewport edges.
    - Draw Tier 0/1 in `fx` (`z: 2`, clipped behind `nearMask`) and Tier 2 in `fx` (`z: 6`, unclipped in front of `near`).

---

### Recipe 10: Rising & Expanding Puff Particles (Chimney Smoke / Mist)
- **Upstream origin:** `noel` chimney smoke (`user.js` L2391–2404; `scenes.ts` L1588–1600) + `NX_CRYSTAL` sprite approach.
- **API mapping:** `createSpriteSheet` (`4` frames of `12×12` or `8×8` smoke puffs) + `ParticlePool(16, seed + 1)`.
- **Parameters & Engine Mapping:**
  - Emit `1` puff every **`0.6–0.8s`**, lifetime **`3.5–4.5s`** (`≤6` concurrent puffs per chimney).
  - Velocity: `vy = -1.8 px/s` (gentle rise), `vx = 0.8 + wind * 0.25 + sin(t * 0.7 + phase) * 0.4 px/s`.
  - **Indexed expansion & fade (no `globalAlpha`):** Map normalized `k = age / life ∈ [0, 1]` to `4` hand-authored `12×12` frames in `smokeSheet`:
    - Frame `0` (`k < 0.22`): compact `3×3` dense core (brightest smoke slot `27`).
    - Frame `1` (`0.22..0.50`): `6×6` rounded puff (`26` + `27`).
    - Frame `2` (`0.50..0.78`): `9×9` airy cluster (`25` + `26` with Bayer cutouts).
    - Frame `3` (`k >= 0.78`): sparse `10×10` dissipating dots (`25` only) before deactivation.
  - **Result:** Continuous, non-repeating chimney plume that dissipates organically into the night sky without alpha blending.

---

### Recipe 11: Rare Causal Event Chain (Meteor / Lantern Drop / Bird Flight)
- **Upstream origin:** `galaxy` meteors (`user.js` L1141–1168) + `noel` Santa/gift parachute/landing spark burst (`user.js` L2459–2532).
- **API mapping:** Seeded schedule + `ParticlePool(16, seed + 2)` + `API.md` `dt <= 0.2`.
- **Parameters & Engine Mapping:**
  - **Strictly ≤1 active rare event per scene**, driven by deterministic modulo intervals (`period = 18..28s`, offset by `ctx.seed`), never running catch-up bursts after tab resume (because `frameLoop` clamps `dt <= 0.2`).
  - **Example A — Night Meteor (Tromsø / Matterhorn / Fansipan):**
    - Active window `0.9s` every `20s`: travels `(0.22w, 0.06h) → (0.48w, 0.18h)` (`~125px` diagonal).
    - Draw `10–14` trailing pixels along the tangent vector: head `2px` in `#ffffff`, next `4px` in `#cfe0ff`, tail `6px` in dim sky-blue slot, with `ctx.dither` gap on tail pixels `k > 6` as `k` fades out.
  - **Example B — Causal Burst:** When a falling spark/leaf/drop hits a surface `y >= groundY`, trigger a `0.7s` radial burst of `8` `1×1px` sparks in the dedicated `ParticlePool` (`vy0 = -6..-10 px/s`, gravity `ay = +22 px/s²`).

---

### Recipe 12: Multi-Beat Twinkling Starfield & Emissive Windows
- **Upstream origin:** `hoian` 2-group stars + 3-group windows (L693–697, L710–717), `noel` 3-group twinkling bulbs (`scenes.ts` L1648–1653) + 4-way cross-flare twinkles (`user.js` L2375–2388), `galaxy` hero stars (L1124–1137).
- **Parameters & Engine Mapping:**
  - **Starfield density:** `24–36` stars total in `v ∈ [0.03, 0.36]` (avoid `>40` so night skies keep quiet breathing space).
  - **Static base vs. selective twinkle:** Paint all stars in `build()` at dim/mid star slots (`4: #62789e`, `5: #9eb8dc`). In `frame()`, animate **only `6–8` hero stars** (`~20%`) on 3 staggered periods (`3.2s, 4.7s, 6.1s`):
    - When `sin(t * 2π / period + starPhase) > 0.85`, promote center pixel to `#ffffff` / `#d4e8ff` (slot `6`) and add `1px` cardinal cross arms (`±1px` in slot `5`) for `~0.4s`—zero full-sky flashing.
  - **Lit windows / lanterns:** Split `4–8` window/lantern pixels into `3` phase groups (`3.5s, 4.9s, 6.3s` slow drift). Toggle only between `#ffcc66` (`warm mid`) and `#fff0b8` (`warm hot`), never snapping to `#000000` dark.

---

### Recipe 13: 3D Interleaved Silhouettes & Gravitational / Atmospheric Ring Occlusion
- **Upstream origin:** `galaxy` `gxDisk` + `gxArcs` + `gxHorizon` (`user.js` L909–982), `gxPlanet` tilted rings (`L858–890`), `hoian` catenary wires (`L732–742`).
- **Parameters & Engine Mapping (`build`):**
  - Any ringed/arched or layered structure (e.g., `world-kyoto` torii tunnel, `galaxy` planet/black hole, `vn-halong` overlapping karst arches) must draw in **back-to-front Z-passes** using `ctx.layer`:
    1. Back half (`y_ring < center_y` or `z_gate = far`, darkened `25%` palette slot).
    2. Central body / path (`disc` or `polygon` with directional shade `(dx - dy) / r`).
    3. Front half (`y_ring >= center_y` or `z_gate = near`, bright lit slot + `1px` rim on lit edge).
  - **Catenary sag formula** (for wires, garlands, hanging vines, bridge cables):
    `y(x) = y0 + sag * (1 - u * u)` where `u = 2 * (x - x0) / span - 1 ∈ [-1, 1]` and `sag = 3..10px`, drawn pixel-by-pixel via `ctx.curve` or snapped `ctx.px` so lines never look like rigid horizontal bars.

---

### Recipe 14: Theme-Aware Day/Night Palette Role Mapping (No Washed-Out Night or Dark Day)
- **Upstream origin:** `autoCycle` day/night theme swap (`user.js` L3447–3455) + `hoian`/`noel` fixed dark palettes vs. `vn`/`sakura` fixed light palettes.
- **API mapping:** `SceneDef.themePalettes` (`light` & `dark` × `dawn/day/dusk/night`), `themeDefaultTime`, `darkness(ctx.time)` (`palette.ts` L9–14).
- **Parameters & Engine Mapping:**
  - **Strict semantic slot locking across all 8 palettes (`2 themes × 4 times`):**
    - Slots `0..3`: Sky ramp (`day` high-value clean `#afc8d7 → #dde1dc`, `night` deep-indigo `#0d172e → #29457c`).
    - Slots `4..6`: Celestial / stars (`day`: faint clouds/sun halo; `night`: stars & moon).
    - Slots `7..10`: Dual-purpose atmosphere slots (`night/dusk`: aurora `#48c090/#5ad8e0/#8e82ae`; `day/dawn`: thin cirrus clouds `#c8dce8/#b8d0e0/#a8c4d8`—**never** neon green aurora on a daytime winter sky!).
    - Slots `22..23`: Emissive vs. daytime paint (`night`: bright warm `#e3b576`/`#fff0b8` window & lantern pools; `day`: muted interior `#5a4236` / subtle lantern paper `#d8b981` with **no** ground halo pool drawn when `darkness(ctx.time) < 0.4`).
  - **Time-gated FX rule:** Check `const nightAmt = darkness(ctx.time)` (where `night=1, dusk=0.7, dawn=0.35, day=0`). Gate stars & lantern pools on `nightAmt >= 0.5`, aurora on `nightAmt >= 0.6` (`tromso`), and swap daytime birds/clouds cleanly when `nightAmt < 0.5`.

---

## 4. Direct Action Plan for Current v2 Scene Fixes

1. **`world-tromso` (highest priority):** Apply **Recipe 1** (12px Bayer sky strips instead of full-sky 8×8 dither), **Recipe 2** (continuous `fbm1`-modulated emerald→cyan→violet aurora curtains masked behind mountains, disabled at `day` per **Recipe 14**), **Recipe 6** (broken 1px horizontal water wavelets for cabin window & live aurora column), and **Recipe 3/4** (warm snow pool around cabin + warm snowflakes near window/porch).
2. **`world-kyoto`:** Replace the flat yellow semicircle beneath the stone lantern with **Recipe 3** (3-ring perspective-foreshortened Bayer pool clipped to stone path, gated off in `light.day` per **Recipe 14**) and **Recipe 1**.
3. **`vn-halong`, `world-matterhorn`, `world-sahara`:** Replace full-sky 8×8 Bayer dither with **Recipe 1**, break flat fog/haze stripes using **Recipe 5** (`mask`-clipped valley/island-foot dithered mist), and apply **Recipe 8** (`createSpriteSheet` + `NX_GAIT` ping-pong) to birds and Sahara camels.
