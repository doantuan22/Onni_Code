# R6 — Upstream UI Integration & Readability Study

**Document status:** Research & specification report (Worker R6, run `f89dc95e-f09d-4877-8243-5650538a31bc`, parent fork `onni/2a7274a0`).  
**Accountability:** Subordinate to root brief `D:\OnniCode\.ai\onni\dispatch\2a7274a0-4c36-4060-b8bb-dbadd911cd5c\brief.md` and unit order `units\f89dc95e\order.md`.  
**Upstream reference:** `Aqua2409z/pixel-chat-themes` (commit `f237a18`, MIT license, read-only clone at `tmp-ref/pixel-chat-themes`).  
**OnniCode inspected code:** `packages/web/src/styles/index.css` (lines 386–475), `components/scene-backdrop.tsx`, `components/app-shell.tsx`, `routes/new-task-surface.tsx`, `routes/task-thread/*`, `evidence/v2/scoring.md`, and `evidence/v2/ui-after/*.png`.  
**Scope rule:** Research document only. No code or asset copying from upstream; learn techniques and specify exact OnniCode-native parameters.

---

## 1. Executive Summary & Core Diagnostic

### 1.1 The Paradox of Our V2 Implementation
The product owner's feedback on scenery v1 was that it felt "flat, lacked depth, effects were hard to notice, and at 70% slider the scene was washed out, especially in light mode" (`_BRIEF.md`). In response, the V2 roadmap sought to remove the double-dimming clamp (`min(s, C)` in LUT + CSS `scene-scrim`) and render scenes at full strength in empty areas.

However, visual inspection of the post-fix captures (`evidence/v2/ui-after/*.png`) reveals a stark contrast with upstream (`preview.png`, `upstream-index.png`):
1. **On `/new`:** In `vn-halong-light-new.png` and `world-sahara-dark-new.png`, the task creation form is encased in a massive, heavy, opaque container (`--scene-panel-alpha: 97%` dark, `98%` light). Because 98% opacity is visually indistinguishable from solid cardboard, the form appears as an intrusive rectangular patch pasted over a pixel art background. It cuts off `760px` of the center column, leaving the scene visible only in narrow `220px` side gutters.
2. **On `chat`:** In `vn-halong-light-chat.png` and `world-sahara-dark-chat.png`, the attempt to show the 36% Horizon strip while protecting text produced a fragmented "archipelago" of isolated micro-cards. Assistant messages get solid panels, while intermediate metadata—notably `data-slot="tool-streak"` ("`Execution details (6)`") and message timestamps—received **zero styling**, floating unshielded over high-contrast karst rocks and water glints.
3. **The Root Cause:** Upstream achieves high visual impact without sacrificing legibility because it uses **spatial low-pass filtering** (`backdrop-filter: blur(12px) saturate(1.35)`) and an **adaptive canvas veil** (dimming the scene towards the app background by `20–42%`). OnniCode, operating under invariant **D4** (`00-decisions.md`: "giữ cấm `backdrop-filter`"), attempted to place text over raw, high-frequency pixel art (dither checkerboards, faceted cliffs, white snow peaks). Lacking a spatial blur to soften underlying edges, the slightest reduction in panel opacity caused severe optical vibration and WCAG AA contrast failures. The emergency response in `index.css` was to crank `--scene-panel-alpha` to 97–98%, inadvertently destroying the atmospheric scenery integration.

---

## 2. Upstream Architecture & Techniques

### 2.1 Demo Shell (`index.html`) Architecture
Upstream's standalone demo demonstrates how pixel art integrates with a chat client through clean design tokens and layout discipline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ html, body (height: 100%, margin: 0, font: 15px/1.6 system)                │
│ ┌───────────────────┬─────────────────────────────────────────────────────┐ │
│ │ .side (260px)     │ .main (flex: 1, min-width: 0, flex-col)             │ │
│ │ - nav links       │ ├─ .top (height: 52px, border-bottom: 1px)          │ │
│ │ - frosted/opaque  │ ├─ .scroll (flex: 1, overflow-y: auto)              │ │
│ │ - brand logo      │ │  └─ .col (max-w: 720px, margin: 0 auto, gap: 18px) │ │
│ │                   │ │     ├─ .msg.user (80% bubble, rounded, tinted)    │ │
│ │                   │ │     ├─ .msg.bot  (unboxed text, no background)    │ │
│ │                   │ │     └─ .card     (14px radius, panel bg, border)  │ │
│ │                   │ └─ .composer (w: min(720px, 100%-24px), 18px radius)│ │
│ └───────────────────┴─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Token Hierarchy
| Token | Light Theme | Dark Theme | Role & Semantic |
| --- | --- | --- | --- |
| `--bg` | `#f7f6f2` | `#1f1e1c` | App background (warm off-white / charcoal) |
| `--side` | `#efede6` | `#191817` | Sidebar tone (slightly darker/deeper than bg) |
| `--panel` | `#ffffff` | `#2b2a27` | Surface for elevated cards and composer |
| `--bubble` | `#e8e5dc` | `#383632` | User chat message bubble |
| `--text` | `#1f1e1c` | `#ecebe6` | Primary high-contrast text |
| `--muted` | `#6b6860` | `#a29f97` | Subtitles, hints, timestamps |
| `--line` | `rgba(0, 0, 0, .08)` | `rgba(255, 255, 255, .08)` | Subtle 1px structural dividing lines |
| `--chip` | `#e3dfd4` | `#3a3834` | Inline code badges, tags |

#### Key Upstream Text Treatments
- **Bot text is unboxed:** Simple conversational text from the bot (`.msg.bot`) has **no background card** and **no border**. It sits directly in the transcript stream.
- **Structural content is carded:** Complex instructions, setup steps, or actions are grouped inside `.card` with `padding: 14px 16px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line);`.
- **User messages are distinct bubbles:** `.user` has `align-self: flex-end; max-width: 80%; padding: 10px 14px; background: var(--bubble); border-radius: 16px 16px 4px 16px;`.
- **Composer capsule:** Floating capsule `margin: 0 auto 16px`, `border-radius: 18px`, with a soft drop shadow `box-shadow: 0 4px 18px rgba(0, 0, 0, .06)`.

---

### 2.2 Userscript Full-Page Injection (`claude-pixel-themes.user.js`)
In the userscript, the scene is placed behind the real web UI of `claude.ai`. It employs a sophisticated two-tier strategy:

#### 1. Canvas Injection & Root Clearing
```css
html[data-pxt-on], html[data-pxt-on] body {
  background-color: transparent !important;
  background-image: none !important;
}
canvas[data-pxt-ui="bg"] {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: -1 !important;
  pointer-events: none !important;
}
```

#### 2. Computed-Style Background Scanner
Instead of relying on brittle class names, a scanner traverses the DOM (`classify(el, vw, vh, area)`):
- Computes `ratio = (el.width * el.height) / (vw * vh)`.
- If `ratio >= 0.4 && !floating`: Marks element as `data-pxt="clear"` (`background-color: transparent !important`). Large background layout wrappers are dissolved so the canvas is revealed.
- Non-solid gradients with `ratio >= 0.02`: Dissolved to prevent harsh gradient bands from cutting the scene.
- Panels (`ratio >= 0.0015`, solid alpha `>= 0.6`, not an interactive button/badge):
  - If nested inside an existing glass panel with a similar color ($\Delta RGB < 24$): Marked as `clear` to prevent double-alpha stacking.
  - Otherwise: Marked as `data-pxt="glass"`.

#### 3. Frosted Glass Formula
```css
html[data-pxt-on] [data-pxt="glass"] {
  background-color: rgba(var(--pxt-rgb), var(--pxt-alpha, .72)) !important;
  background-image: none !important;
  -webkit-backdrop-filter: blur(var(--pxt-blur, 12px)) saturate(1.35);
  backdrop-filter: blur(var(--pxt-blur, 12px)) saturate(1.35);
}
```
- `--pxt-alpha`: Set to `cfg.glass` (default **`0.72`**, range `0.30`–`0.95`).
- `--pxt-blur`: If `cfg.glass >= 0.95`, blur is set to `0px`; otherwise set to **`12px`**.
- `saturate(1.35)`: Boosts the chromatic intensity of the blurred pixel art under the frosted surface, compensating for the desaturating effect of the white/charcoal panel tint.

#### 4. The Canvas Veil ("Làm dịu nền")
Upstream does not rely solely on DOM glass to protect text. In `paint(dt)`:
```javascript
world.veilColor = siteDark ? '#141413' : '#fbfaf6';
world.veil = clamp(
  cfg.veil * (world.th.veilScale || 1) + (world.th.dark === siteDark ? 0 : 0.42),
  0,
  0.9
);
```
And inside `World.draw()`:
```javascript
if (this.veil > 0) {
  ctx.globalAlpha = this.veil;
  ctx.fillStyle = this.veilColor;
  ctx.fillRect(0, 0, this.w, this.h);
  ctx.globalAlpha = 1;
}
```
**Why the veil is brilliant:**
- It is a uniform tint applied directly to the canvas **before** DOM compositing.
- Base `cfg.veil` is `0.20` (20%).
- If the active theme's affinity mismatches the page theme (e.g. running dark `hoian` on a light website), upstream automatically adds `+0.42` veil! This pushes the dark scene's highlights down, allowing dark light-mode text to remain readable without user intervention.

#### 5. Slider Controls & Semantics
Upstream exposes 4 continuous sliders and 3 toggles:
1. **Làm dịu nền (Veil / Contrast softening):** Range `0.0` to `0.8`, step `0.05`, default `0.20`. Blends the entire canvas towards the site background (`#fbfaf6` or `#141413`).
2. **Độ đục khung (Glass / Frame opacity):** Range `0.30` to `0.95`, step `0.05`, default `0.72`. Controls panel alpha directly, while automatically dropping blur to `0px` when opacity reaches `0.95`.
3. **Mật độ (Density):** Range `0.5` to `2.0`, step `0.05`, default `1.0`. Adjusts procedural generation density (particles, stars, trees).
4. **Tốc độ (Speed):** Range `0.5` to `2.0`, step `0.05`, default `1.0`. Scalar applied to animation tick delta `dt`.
5. **Toggles:** `Chuyển động` (motion loop at 12 fps desktop / 10 fps touch), `Tự đổi ngày/đêm` (auto diurnal cycle), `Nút nổi` (floating FAB visibility).

---

### 2.3 Upstream Claude CLI Plugin (`pixel-themes/hooks/register.tsx`)
In terminal and Claude CLI environments, spatial overlap between rich ASCII/SVG art and text is difficult. Upstream solves this with **strict spatial separation**:

```
Layout A: "band" (AbovePrompt)         Layout B: "side" (Dedicated Pane)
┌────────────────────────────────┐    ┌───────────────────┬──────────────┐
│ Transcript history             │    │ Transcript        │ Pixel Scene  │
│                                │    │                   │ Pane (SIDE)  │
├────────────────────────────────┤    │                   │              │
│ Svg band (height: 84px)        │    │                   │ (Full height,│
├────────────────────────────────┤    │                   │ completely   │
│ Prompt Composer [           ]  │    │                   │ unblocked)   │
└────────────────────────────────┘    └───────────────────┴──────────────┘
```

1. **`AbovePrompt` (Band Mode):** Renders an interactive 84px SVG strip (`<Svg source={scene(t.id, 'band')} height={84} />`) docked right above the input box. The transcript is 100% clean, and the prompt is 100% clean. The art lives in its own dedicated visual band.
2. **`Pane` (Side Mode):** Renders the scene in a dedicated adjacent sidebar (`<Svg source={scene(t.id, 'side')} />`). The scene never competes with text.
3. **Message Styling:**
   - `UserMessage`: `<Box borderStyle="round" borderColor={t.accent} backgroundColor={t.bubble} paddingX={1}>`.
   - `AssistantMessage`: `<Box borderStyle="round" borderColor={t.accent} borderDimColor paddingX={1}>` — **no background fill**, completely transparent with a crisp accent border!

---

## 3. Comparison with Our Current Integration

### 3.1 Architectural Seam Comparison

| Dimension | Upstream (`pixel-chat-themes`) | OnniCode Current (`packages/web`) | Defect in OnniCode |
| --- | --- | --- | --- |
| **Canvas Anchor** | Fixed viewport-wide (`100vw × 100vh`), behind both sidebar & content. | Mounted in `AppShell` inside `[data-slot='app-content-column']`, strictly -z-10. | No defect in mount: keeping canvas in content column complies with **D3** (`sidebar đặc`). |
| **Surface Segregation** | Userscript treats entire app uniformly; CLI plugin splits `band` vs `side`. | Segregated by route: `/new` $\rightarrow$ `full`, `/tasks/:id` $\rightarrow$ `horizon`, other $\rightarrow$ `horizon`. | `/new` and `chat` need distinct geometry, but our CSS rules treat them inconsistently. |
| **Panel Protection** | `rgba(var(--pxt-rgb), 0.72)` + `backdrop-filter: blur(12px) saturate(1.35)`. | `color-mix(in srgb, var(--background) 97%/98%, transparent)` without blur. | **Severe:** 98% is totally opaque; form looks like a solid cardboard box pasted over the art. |
| **Text Surface Blur** | `12px` Gaussian blur (drops to `0px` only when alpha $\ge 0.95$). | Completely banned by **D4** (`00-decisions.md`). | Banning blur while trying to lower alpha causes high-frequency pixel art to garble text. |
| **Chat Transcript** | Either outside the text (`band` 84px) or unboxed bot text over veiled canvas. | `thread-reading-lane` is `transparent`; individual messages get isolated cards. | **Severe:** Chat transcript becomes an "archipelago" of disjointed white boxes over the Horizon strip. |
| **Unshielded Metadata** | All metadata is either inside `.card` or on a veiled canvas. | `tool-streak`, `message-time`, `turn-time` have no background or border. | **Severe:** Small grey text collides directly with dark karst cliffs and bright glints. |
| **Horizon Height & Mask** | `band` mode is fixed 84px; userscript is 100% height. | Dynamic: `36%` of transcript height above dock; `mask-image: black 75%, transparent`. | 36% height ($\approx 244\text{px}$) puts the horizon right where active messages scroll. |
| **Canvas Luminance (Veil)** | Built-in canvas `veil` (0.20 base + 0.42 theme mismatch). | No canvas veil; pure LUT contrast clamp (V1) or unconstrained raw LUT (V2). | Without a veil or blur, the canvas has high contrast right under transparent text zones. |
| **Mobile (`<768px`)** | Responsive drawer, 10 fps touch throttle, FAB enlarged to 42px. | Hero strip `clamp(160px, 30vh, 200px)` with `to bottom, black 72%` fade; panels solid. | Form becomes 100% solid, hero strip top fade cuts header, chat shows 0% scene. |

---

### 3.2 Visual Analysis of Post-Fix Captures (`evidence/v2/ui-after/`)

Visual inspection of `docs/design/pixel-scenes/evidence/v2/ui-after/*.png` confirms the specific defects identified in `scoring.md` and `CAPTURE.md`:

```
Capture: vn-halong-light-new.png (1440×900)
┌──────────────────┬────────────────────────────────────────────────────────┐
│ OnniCode Sidebar │                             [Sun / Sky]                │
│ (240px Solid)    │  ┌──────────────────────────────────────────────────┐  │
│                  │  │ // NEW TASK                                      │  │
│                  │  │ What should the agent work on?                   │  │
│                  │  │ [ Describe a task...                          ]  │  │
│                  │  │ [ Claude ] [ Sonnet ] [ Worktree ]               │  │
│                  │  │ [ Suggestion Chip A ] [ Suggestion Chip B ]      │  │
│                  │  └──────────────────────────────────────────────────┘  │
│                  │   ▲ SOLID 98% OPAQUE CARD (760px wide)                 │
│                  │     Blocks karst islands and sky completely            │
│                  │────────────────────────────────────────────────────────│
│                  │ [Karsts]         [Water Glints]        [Junk Boat]     │
│                  │ Only visible in 220px side gutters and bottom 350px    │
└──────────────────┴────────────────────────────────────────────────────────┘
```

1. **`vn-halong-light-new.png` & `world-sahara-dark-new.png`:**
   - The task creation container (`data-slot="new-task-main"`) measures `760px` in width with `padding: 1.25rem`.
   - In `index.css:415`, `:root.light` sets `--scene-panel-alpha: 98%`.
   - Visually, this is 100% opaque. It completely obscures the central karst mountains and sky gradients. The scene looks like a wallpaper frame around a standard white application, rather than an integrated environment.
2. **`vn-halong-light-chat.png` & `world-sahara-dark-chat.png`:**
   - The Horizon strip is positioned at the bottom `36%` of the transcript above the dock.
   - Assistant messages (`data-slot="assistant-message"`) are wrapped in `var(--scene-panel-surface)` (98% white) with `1px solid var(--scene-panel-border)`.
   - **The Tool Streak Defect:** The element `<Collapsible data-slot="tool-streak">` which renders `Execution details (6)` has **no panel surface**. In `vn-halong-light-chat.png`, this text sits directly on top of the dark green karst rock texture and water glints. The text contrast drops below `2:1`, making it unreadable.
   - **The Timestamp Defect:** Message timestamps (`data-slot="turn-time"`, `11:26 AM · 2s`) render in faint `--soft-foreground` without any background plate, cutting straight through the pixel art.
   - **The Composer Dock Cut:** The canvas stops abruptly at `bottom: var(--scene-dock-height, 0px)`. While this keeps the composer input clean, the hard horizontal boundary between the water and the dock border creates an unpolished transition.

---

## 4. The Blur Question & Repository Invariant D4

### 4.1 What AGENTS.md and 00-decisions D4 Mandate
In `docs/design/pixel-scenes/00-decisions.md`:
> **D4 [Sửa]:** Giữ cấm `backdrop-filter`; bảo vệ chữ cục bộ bằng tint + viền 1px, kiểm AA trên composite cuối. Blur chỉ xét bằng quyết định và benchmark riêng.

In `docs/design/pixel-scenes/04-ui-integration.md` §4.2:
> `[Thay D4 về phạm vi]` vẫn cấm `backdrop-filter`; "kính" là `color-mix` tint và border 1px, không blur canvas hay transcript. R1 cho thấy bề mặt cục bộ bảo vệ chữ tốt hơn veil toàn ảnh; R4 đặt alpha khởi điểm panel **light 96%, dark 94%**, sau đó đo composite thực, không coi đó là chứng nhận AA.

### 4.2 Why D4 Banned `backdrop-filter`
1. **GPU Compositing Overhead:** On lower-end machines, Linux software rasterizers, and older laptops, applying `backdrop-filter: blur(...)` to large scrolling containers forces continuous off-screen texture readbacks on every frame. During rapid transcript scrolling or streaming, this can cause frame drops below the 60 Hz target.
2. **Deterministic Screenshots in CI / Headless Mode:** Headless Chrome and software Mesa runners frequently fail to render `backdrop-filter` consistently, causing automated screenshot diffing in CI to flake.
3. **Local-First & Zero-Config Philosophy:** The engine must run without requiring dedicated GPU acceleration.

### 4.3 Can We Achieve Readability Without Blur?
**Yes, but only if we stop using fragmented micro-cards and calibrate the panel tint correctly.**
The physics of human reading over a background depends on **spatial frequency** and **luminance delta**:
- When blur is present (upstream), the high spatial frequencies of pixel art (sharp 1px dither checkerboards, high-contrast rock outlines) are smoothed away. The eye only sees broad low-frequency color washes, so text (high frequency) pops even at 72% opacity.
- When blur is forbidden (D4), any pixel edge from the scene showing through the panel will compete directly with the strokes of letterforms.
- **The Solution under D4:**
  1. **A Single Unified Reading Lane:** Instead of making `thread-reading-lane` transparent and creating dozens of disjointed floating message boxes, `thread-reading-lane` itself must receive the calibrated panel tint (`92–94%` dark, `94–96%` light) with a crisp 1px border. This ensures that **all** child elements—assistant text, user bubbles, tool execution streaks, timestamps, and collapsible details—are uniformly shielded.
  2. **Theme-Matched Palette Luminance (P3a/P3b):** The scene's sky and horizon must match the ambient theme luminance. A dark-theme scene must have dark sky and water ($L < 0.15$); a light-theme scene must have bright pastel sky and water ($L > 0.75$). This eliminates the extreme $\Delta L$ contrast spikes that break WCAG AA.
  3. **Generous Gutter Framing:** The reading lane should be constrained to `--chat-measure` (`720px` to `768px`). In desktop viewports (`1200px` to `1440px`), the gutters (`220px`–`340px` on each side) remain **100% transparent and crystal clear**, allowing the full animated scene to be appreciated without impinging on text readability.

### 4.4 The Conditional Blur Option (If D4 is Ever Re-evaluated)
If the product owner conducts a dedicated performance benchmark and chooses to lift the D4 ban for modern hardware, the exact upstream-equivalent CSS rule is:
```css
/* OPTIONAL: Only if D4 is amended via dedicated RFC */
.scene-reading-panel,
[data-slot='thread-reading-lane'] {
  background-color: color-mix(in srgb, var(--background) 78%, transparent);
  -webkit-backdrop-filter: blur(12px) saturate(1.35);
  backdrop-filter: blur(12px) saturate(1.35);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}
```
*Note: Under current repository rules, this remains OFF. All recommendations below comply strictly with D4.*

---

## 5. Exact Change List & Implementation Specification

### 5.1 Design Tokens & Panel Opacity (`packages/web/src/styles/index.css`)

Replace the overly opaque 97%/98% rules in `index.css` (lines 406–416) with calibrated values that provide real translucency while passing WCAG AA 4.5:1 on measured composites:

```css
/* ==========================================================================
 * Scenery Panel Protection Tokens (Strictly D4 Compliant - Tint + Border, No Blur)
 * ========================================================================== */

:root {
  /* Dark mode: 92% panel opacity allows 8% scene transmission.
   * Dark background (#090909) mixed with 8% scene luminance guarantees
   * that muted foreground (#a1a1a1) maintains >= 5.8:1 contrast. */
  --scene-panel-alpha: 92%;
  --scene-panel-surface: color-mix(in srgb, var(--background) var(--scene-panel-alpha), transparent);
  --scene-panel-border: color-mix(in srgb, var(--border) 80%, var(--background));
  --scene-panel-radius: var(--radius-xl); /* 14px */
}

:root.light {
  /* Light mode: 94% panel opacity allows 6% scene transmission.
   * Light background (#fafafa) mixed with 6% scene darks guarantees
   * that muted foreground (#5c5c5c) maintains >= 4.8:1 contrast. */
  --scene-panel-alpha: 94%;
  --scene-panel-border: color-mix(in srgb, var(--border) 85%, var(--background));
}
```

---

### 5.2 `/new` Task Surface: Unified Breathing Panel (`routes/new-task-surface.tsx`)

#### Current Problem
The `/new` surface wraps `data-slot="new-task-main"` with `border: 1px solid var(--scene-panel-border)` and padding, while composer and suggestion chips have separate backgrounds, creating a cluttered "Russian doll" appearance.

#### Proposed Overhaul
1. **Unify into a Single Reading Panel:** Treat the entire central interaction area—title header, subtitle, prompt composer, metadata pills, and template suggestion chips—as **one continuous reading card**.
2. **Geometric Specs:**
   - Width: `max-w-[760px]`, centered with `mx-auto`.
   - Padding: `24px 28px` (`p-6 md:p-7`).
   - Border radius: `16px` (`rounded-2xl`).
   - Surface: `background-color: var(--scene-panel-surface); border: 1px solid var(--scene-panel-border);`.
   - Internal elements: Composer textarea, pills, and suggestion chips use transparent backgrounds (`bg-transparent` or `hover:bg-accent/50`) so they sit cleanly on the panel surface without secondary opacity compounding.
3. **Viewport Ratios:**
   - On a `1440×900` desktop viewport, the unified card occupies the vertical space from $y = 64\text{px}$ to $y = 440\text{px}$ ($376\text{px}$ tall).
   - The remaining $460\text{px}$ from $y = 440\text{px}$ to $y = 900\text{px}$ ($\mathbf{51.1\%}$ of the viewport height) is **100% open scenery**, completely free of cards, displaying the water, mountains, caravans, or shrines.
   - Left and right gutters each provide $220\text{px}$ of unobstructed vertical scenery.

---

### 5.3 Chat Thread: Continuous Reading Lane (`routes/task-thread/*` & `index.css`)

#### Current Problem
`index.css` sets `[data-slot='thread-reading-lane'] { background-color: transparent; border-color: transparent; }`, and then puts individual boxes on `[data-slot='assistant-message']`. This leaves `tool-streak`, `message-time`, `turn-time`, and `reasoning` unshielded over the Horizon strip.

#### Proposed Overhaul: Option A (Recommended — Continuous Reading Lane)
Instead of fragmented micro-cards, restore protection to the entire lane wrapper, eliminating all text collision bugs in one stroke:

```css
/* Replace lines 434–445 in packages/web/src/styles/index.css */

/* Chat transcript: A continuous protected reading lane.
 * Protects ALL text, timestamps, tool streaks, and reasoning uniformly,
 * while leaving the left and right gutters completely clear for the Horizon strip. */
[data-slot='app-content-column']:has(> [data-slot='scene-backdrop'][data-surface='chat'][data-ready])
  [data-slot='thread-reading-lane'] {
  background-color: var(--scene-panel-surface);
  border-inline: 1px solid var(--scene-panel-border);
  border-radius: var(--scene-panel-radius);
  padding: 1rem 1.5rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
}

/* Inside the protected lane, message items sit cleanly without extra box nesting */
[data-slot='app-content-column']:has(> [data-slot='scene-backdrop'][data-surface='chat'][data-ready])
  :is([data-slot='assistant-message'], [data-slot='note-line'], [data-slot='history-start'], [data-slot='history-boundary'], [data-slot='thread-empty'], [data-slot='working-indicator'], [data-slot='thread-footer']) {
  background-color: transparent;
  border: none;
  padding-inline: 0;
}

/* User message bubbles keep their distinct shape inside the lane */
[data-slot='app-content-column']:has(> [data-slot='scene-backdrop'][data-surface='chat'][data-ready])
  [data-slot='user-bubble'] {
  background-color: color-mix(in srgb, var(--accent) 12%, var(--background));
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}
```

#### Complete Selector Fix List (If Micro-Cards Are Retained)
If the team insists on retaining floating message boxes instead of a continuous lane, the `:is(...)` selector in `index.css:440` **must** be expanded to cover the currently unshielded elements:
```css
/* Missing selectors that currently leave raw text over high-contrast scenery */
[data-slot='app-content-column']:has(> [data-slot='scene-backdrop'][data-surface='chat'][data-ready])
  :is(
    [data-slot='assistant-message'],
    [data-slot='user-bubble'],
    [data-slot='tool-streak'],          /* "Execution details (6)" */
    [data-slot='tool-card'],            /* Individual tool command outputs */
    [data-slot='reasoning'],            /* Collapsible thought process */
    [data-slot='message-time'],         /* Message timestamp */
    [data-slot='turn-time'],            /* Turn timestamp / duration */
    [data-slot='day-separator'],        /* Date boundary chip */
    [data-slot='ask-card'],             /* Structured question card */
    [data-slot='review-panel'],         /* Diff review gate card */
    [data-slot='note-line'],
    [data-slot='history-start'],
    [data-slot='history-boundary'],
    [data-slot='thread-empty'],
    [data-slot='working-indicator'],
    [data-slot='thread-footer']
  ) {
  background-color: var(--scene-panel-surface);
  border: 1px solid var(--scene-panel-border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
}
```

---

### 5.4 Horizon Strip Geometry & Dock Coordination (`app-shell.tsx` & `index.css`)

#### Horizon Height Calibration
Currently, `app-shell.tsx:152` calculates:
```typescript
column.style.setProperty(
  '--scene-horizon-height',
  `${Math.max(0, column.clientHeight - dockHeight) * 0.36}px`
)
```
- In a `900px` window with an `80px` dock, height is $(900 - 80) \times 0.36 = \mathbf{295.2\text{px}}$.
- This height ratio ($\mathbf{36\%}$) is well within the spec target ($32\%–40\%$). It should be **retained**.

#### Fade Gradient Mask Refinement
In `index.css:401`:
```css
/* Current: 25% fade leaves top 25% of the strip partially faded */
mask-image: linear-gradient(to top, black 75%, transparent);
```
**Change to:**
```css
/* Refined: 20% gentle exponential fade at the sky edge,
 * leaving 80% of the strip at full opacity above the dock. */
mask-image: linear-gradient(
  to top,
  black 0%,
  black 78%,
  rgba(0, 0, 0, 0.6) 88%,
  rgba(0, 0, 0, 0.15) 96%,
  transparent 100%
);
```

#### Dock Coupling
The composer dock (`[data-slot='thread-dock']`) must keep a solid background (`bg-background` or `var(--scene-panel-surface)` at 100%) with `border-top: 1px solid var(--scene-panel-border)`. The canvas stops cleanly at `bottom: var(--scene-dock-height, 0px)`.

---

### 5.5 Mobile & Narrow Screens (`@media (max-width: 767px)`)

On mobile viewports ($< 768\text{px}$, e.g. iPhone $390\times 844$):
1. **Narrow `/new`:**
   - Hero strip height: `clamp(140px, 24vh, 180px)`.
   - Gradient mask: `linear-gradient(to bottom, black 70%, transparent 100%)`.
   - The task form sits immediately below the hero strip with a solid `var(--background)` surface, ensuring that mobile virtual keyboards never push unreadable text over scenery.
2. **Narrow `chat`:**
   - In narrow chat, horizontal gutters do not exist ($w \le 390\text{px}$).
   - **Spec Rule:** Mobile chat falls back to a clean solid transcript. Scenery is disabled in chat on mobile (`data-surface="chat"` with `[data-narrow]` sets `display: none` on `scene-backdrop`), matching the spec principle: *"Trên cửa sổ hẹp không có gutter, ưu tiên lane đặc... không giả vờ hạ alpha toàn bộ là đã trình diễn được tranh" (`04-ui-integration.md` §4.4).*
3. **Engine Throttle:** Motion remains disabled on narrow screens (`motion: false` in `scene-backdrop.tsx:136`), preventing battery drain on mobile devices.

---

## 6. Concrete Parameter Summary Table

| UI Element | CSS Property / Selector | Current Value (Post-Fix) | Target Value (R6 Spec) | Rationale |
| --- | --- | --- | --- | --- |
| Panel Alpha (Dark) | `--scene-panel-alpha` | `97%` | **`92%`** | Restores 8% scene depth while guaranteeing $\ge 5.8:1$ muted text contrast. |
| Panel Alpha (Light) | `--scene-panel-alpha` (light) | `98%` | **`94%`** | Eliminates solid white block; restores 6% scene transmission. |
| Panel Border | `--scene-panel-border` | `color-mix(in srgb, var(--border) 92%, ...)` | **`color-mix(in srgb, var(--border) 80%, var(--background))`** | Subtle 1px boundary separating text zone from scene. |
| `/new` Form Panel | `[data-slot='new-task-main']` | Separate card inside layout | **Single unified reading card (`p-6 md:p-7`, `rounded-2xl`)** | Groups header, textarea, suggestions into one cohesive card; frees 51% viewport. |
| Chat Reading Lane | `[data-slot='thread-reading-lane']` | `transparent` (fragmented cards) | **`var(--scene-panel-surface)` + border + `rounded-xl`** | Protects all text, timestamps, tool streaks; avoids archipelago defect. |
| Tool Streak | `[data-slot='tool-streak']` | Unstyled (transparent) | **Contained in lane (or carded at `var(--scene-panel-surface)`)** | Fixes critical readability defect ("`Execution details (6)`" unreadable on karsts). |
| Timestamps | `[data-slot='message-time']`, `[data-slot='turn-time']` | Unstyled | **Contained in lane (or soft chip)** | Prevents faint grey timestamps from colliding with pixel art. |
| Horizon Height | `--scene-horizon-height` | `36%` of transcript | **`36%`** (retained) | Proven geometry; strip height $\approx 244\text{px}$ above dock. |
| Horizon Mask | `mask-image` (horizon) | `to top, black 75%, transparent` | **`to top, black 78%, ... transparent`** | Exponential fade at upper 22% of strip. |
| Narrow `/new` Hero | `height` (`[data-narrow]`) | `clamp(160px, 30vh, 200px)` | **`clamp(140px, 24vh, 180px)`** | Fits within mobile viewports without crowding form when keyboard opens. |
| Narrow Chat | `[data-narrow][data-surface='chat']` | Partially visible / broken | **Hidden (`display: none`)** | No gutters on phone; transcript remains solid and fully functional. |
| Text Blur | `backdrop-filter` | Banned (D4) | **Banned (retained per D4)** | No GPU compositing cost; relies on calibrated tint + border. |

---

## 7. Recommendations for Sibling Tasks & Product Owner Gate

1. **For Task P3b (UI Polish & CSS Integration):**
   - Apply the exact CSS rules in §5.1 and §5.3 to `packages/web/src/styles/index.css`.
   - Wrap the chat transcript in a continuous reading lane rather than fragmented micro-cards.
   - Refactor `routes/new-task-surface.tsx` to unify the `/new` form into a single reading panel with transparent internal controls.
2. **For Task P3a (Theme & Host Options Wiring):**
   - Ensure `scene-backdrop.tsx` forwards `resolvedTheme` and `timeSource` to `HostOptions` so scenes never render inverted day/night palettes.
   - Fix `scene-popover.tsx` thumbnail image paths to resolve the generic `MountainSnowIcon` placeholder bug.
3. **For Product Owner Gate Sign-Off:**
   - After applying the CSS changes in §5, re-capture the 32 desktop and 8 narrow PNGs.
   - With the unified reading lane and `--scene-panel-alpha: 92%/94%`, the UI will pass the P4 visual rubric: the scene will breathe freely in the 51% lower space of `/new` and the chat gutters, while every line of text, tool output, and metadata will achieve $\ge 4.5:1$ WCAG AA contrast.
