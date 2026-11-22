# Round 1 Mockup Notes & Self-Critique (Designer A)

- **Worker:** Mockups R1 a (`5f70ffda-6fa9-4d12-be95-6527c237dc0a`)
- **Design Direction:** `02-concept.md` ("Parallel Light")
- **Deliverables:**
  - `style-tile.png` (1440×960)
  - `hero-desktop-load.png` (1440×960)
  - `hero-desktop-scrolled.png` (1440×960)
  - `hero-mobile.png` (390×844)
  - `notes-a.md` (this file)

---

## 1. Mockup Breakdowns & Motion States

### 1.1 `style-tile.png` (1440×960)
- **Motion State Depicted:** Settled static token specification & design system primitives.
- **What it shows:**
  - **Color Palette Tokens:**
    - Canvas Void: `#090909`
    - Surface 1 (Cards): `#111111`
    - Surface 2 (Recessed Bays): `#151515`
    - Hairline Border: `#242424` (lit to `#8F86E8` on focus/active)
    - Phosphor Ink: `#EDEDED` (primary, 15.8:1 AAA contrast)
    - Muted & Soft Inks: `#A1A1A1` and `#8A8A8A` (WCAG AA floor)
    - Signal Violet: `#8F86E8` (the live bus, active selection, interactive vector)
    - Ignition Gradient: `linear-gradient(135deg, #B4F372, #EEFB63, #BC9AFF)` (strictly capped at ≤ 3 uses on the page)
    - Status LEDs: Done (`#10B981`), Pending (`#FBBF24`), Review (`#93C5FD`), Failed (`#EF4444`) with optical glow radii
    - Daylight Studio counterpart preview (`#FAFAFA` bg, `#FFFFFF` card, `#171717` ink, `#6D5FD6` violet)
  - **Typography Scale:**
    - Chakra Petch (SemiBold 700 / 600): Wordmark (`onni`), section indexes (`// 01 / PARALLEL LIGHT`), hardware state badges
    - Inter Variable: Display headlines in sentence case (`One repository. Room for many agents.`, `-0.025em` tracking) and body copy (`14px`–`17px`, `1.6` line-height)
    - JetBrains Mono: Tabular code diffs (`+184 / -42 lines`), worktree paths (`.ai/onni/worktrees/3f2a91c4`), branches (`onni/3f2a91c4`), and CLI commands (`ONNI_DRY_RUN=1 npm run dev`)
  - **Interactive Components & Controls:**
    - Primary Button (`#8F86E8` background, `#090909` text, `6px` radius)
    - Secondary Button (`#111111` surface, `1px solid #242424` border, `#EDEDED` text)
    - Ignition Gradient Action Button (`#B4F372 → #EEFB63 → #BC9AFF` 1px border)
    - Zero-Config Command Pill (`$ ONNI_DRY_RUN=1 npm run dev` with emerald check)
    - Backend Chips (9-way switchboard: Claude Code, OpenAI Codex, Antigravity, Cursor, OpenCode, Copilot, pi, Junie, Cline)
    - 1px Signal Spine filament with glowing packet node

#### Honest Critique (3+ Weaknesses):
1. **Daylight Theme Swatch is Compressed:** While the dark mode palette is explored thoroughly, the Daylight Theme is shown as a single compact card rather than a full complementary swatch strip.
2. **Missing Form Input States:** The style tile demonstrates buttons and chips well, but lacks a dedicated text input / textarea state showing focus states, hover borders, and error validation states for the task composer.
3. **Ignition Gradient Border Contrast:** On high-glare displays, the thin 1px ignition gradient border on the secondary button might blur into adjacent card surfaces unless accompanied by the subtle purple back-glow.

---

### 1.2 `hero-desktop-load.png` (1440×960)
- **Motion State Depicted:** Desktop viewport at `t = 3.0s` after load (the "Cold-Boot Sequence" has settled; cockpit twin is tilted at `rotateX(12deg)`, the prompt has typed itself, and the Signal Spine filament has just fired its downward pulse out of the Run button).
- **What it shows:**
  - **Section 0 (Sticky Nav, 56px):**
    - Wordmark `onni` with official brand mark
    - Core navigation links: `Worktrees` · `Live Stream` · `Orchestration` · `Local-First`
    - Right tools: `Night Studio` lamp toggle with amber status dot, offline dry-run pill (`ONNI_DRY_RUN=1`), and primary `Download` button
    - Bottom 1px hairline border with initial violet progress line
  - **Section 1 (Hero):**
    - Eyebrow badge: `01 // PARALLEL LIGHT · LOCAL COCKPIT`
    - Main headline: `One repository. Room for many agents.` (Inter, sentence case, `48px`, `-0.03em` tracking)
    - Subline: `A local cockpit for AI coding agents. Every task in its own git worktree, streamed live, merged only by you.`
    - Dual CTA actions: `[Download Desktop Cockpit]` (signal violet) + `[onni run --workflow dev.yaml]` (monospace copyable)
  - **The Cockpit Twin (3D Tilted Hero Centerpiece):**
    - Perspective tilt `rotateX(12deg)`
    - Window titlebar: `OnniCode Cockpit — local repo: onnicode (127.0.0.1:4321)` + `LIVE WS :4321` emerald indicator
    - Pixel-art night horizon window (`scenery-thumbs/vn-fansipan-dark.png`) rendered with `image-rendering: pixelated` across the top right
    - Task prompt composer: `"Split the settings page into tabs and add tests"`
    - Worktree metadata: `.ai/onni/worktrees/3f2a91c4` · `branch: onni/3f2a91c4`
    - Roster badge: `3 workers (claude + codex + agy)`
    - Run button: `[Dispatch Run]` with ignition gradient border
    - **The Signal Spine emission:** 1px glowing violet filament emerging downward from the Run button with an active white-violet light packet
    - Live telemetry status bar: `ACTIVE // ROSTER FENCED`, `142 tok/s`, `$0.00 (LOCAL)`, `0.00 KB/s (AIR-GAPPED)`

#### Honest Critique (3+ Weaknesses):
1. **Perspective Tilt May Occlude Bottom Telemetry:** On smaller laptop screens (e.g., 13" 1280×800 or 1440×900 display scale), a 12° perspective tilt pushes the bottom telemetry footer close to the fold unless the scroll transition flattens it early.
2. **Pixel-Art Scenery is Subdued:** In this mockup, the Fansipan pixel-art horizon is rendered at 18% opacity with a mask so as not to overwhelm the prompt text. In the final implementation, we could offer an interactive opacity slider or make it slightly more vivid when hovering the window.
3. **CTA Row Density:** Having both "Download Desktop Cockpit" and the CLI command in the hero before the visitor has scrolled through the product story might feel slightly premature; some visitors might prefer a single "Explore the architecture" anchor.

---

### 1.3 `hero-desktop-scrolled.png` (1440×960)
- **Motion State Depicted:** Desktop viewport during scroll (pinned hero stage at ~65% progress: the 3D tilt has flattened to `rotateX(0deg)`, headline copy has receded/dimmed to hand authority to the cockpit, and the task has divided into the Manager unit and 3 parallel worker worktree lanes).
- **What it shows:**
  - **Nav Progress:** Navigation bar is now `rgba(9,9,9,0.94)` with `backdrop-filter: blur(16px)`, and the bottom violet hairline has filled 35% of the viewport width.
  - **Receded Headline Header:** Headline is preserved at `opacity: 0.45` with section coordinate `// 01 PARALLEL WORKTREES PINNED (STAGE PROGRESS: 65%)`.
  - **Flattened Cockpit Console:**
    - Full orthographic laser-milled 1px hairline presentation
    - Titlebar: `OnniCode Cockpit — 4 Worktrees Active (Isolated) · 0 Git Conflicts`
  - **Internal Multi-Worker Decomposition:**
    - **Root Manager Card:** `onni/3f2a91c4 [claude-3-7-sonnet]` planning architecture; `WIP COMMITTED` before fork; streaming at `184 tok/s`.
    - **Roster Fence Divider:** Prominent 1px divider with amber badge `ROSTER FENCE // DEPTH 1 CAP · PRE-PUSH GUARD ARMED · 409 ON UNLISTED`.
    - **Three Worker Worktrees:**
      - Worker 1: `onni/4a1b8c2d [codex]` on `packages/web/src/routes/settings/`, streaming tests (`+84 / -12 lines`, status: `RUNNING`)
      - Worker 2: `onni/9e2f3a1b [antigravity]` on `packages/contract/src/settings.ts`, verifying Zod contracts under allow-rules (`+46 / -0 lines`, status: `SETTLED REPORT`)
      - Worker 3: `onni/7c5d2e8f [cursor]` on `packages/web/src/components/settings-tabs.tsx`, implementing Tailwind v4 accessible tab UI (`+128 / -34 lines`, status: `RUNNING`)
    - **Signal Spine Network:** Multi-branch SVG filament network connecting manager to the three worker rows and converging into a single outgoing filament at the bottom card edge (`SIGNAL SPINE // LEADING TO SECTION 02`).
    - **Convergence Indicator:** `REVIEW GATE (NOTHING MERGES ITSELF)`.

#### Honest Critique (3+ Weaknesses):
1. **High Information Density:** With 4 concurrent tasks, file scopes, diff additions/deletions, and telemetry readouts, first-time visitors who are not familiar with git worktrees might feel visual overwhelm. Tooltips or hover state highlights will be necessary.
2. **Convergence Lead Requires Subsequent Section Context:** The spine extending off the bottom of the card looks great, but without seeing Section 02 directly underneath, the visitor must understand instinctively that scrolling will continue the thread.
3. **Worker 2 Status Distinction:** Worker 2 is "Settled Report" while Workers 1 and 3 are "Running". While this accurately showcases OnniCode's asynchronous settle architecture, the visual contrast between the blue review badge and the green running badges could be amplified with a small checkmark icon.

---

### 1.4 `hero-mobile.png` (390×844)
- **Motion State Depicted:** Mobile viewport (iPhone 14/15/16 standard 390px width) at initial scroll rest.
- **What it shows:**
  - **iOS Chrome & Header:** System status bar (9:41, 5G), compact 52px mobile navigation with `onni` logo, night lamp toggle dot, and 2-line hamburger icon.
  - **Mobile Hero Copy:**
    - Eyebrow: `01 // PARALLEL LIGHT`
    - Scaled headline: `One repository. Room for many agents.` (`26px`, bold, line-height 1.2)
    - Subline: `A local cockpit for AI coding agents. Every task in its own git worktree, streamed live, merged only by you.` (`13px`, `#A1A1A1`)
  - **Stacked Mobile CTAs:** Full-width violet button (`Download Desktop Cockpit`) + secondary command pill (`$ ONNI_DRY_RUN=1 npm run dev`).
  - **Mobile Cockpit Card:**
    - Branch tag: `onni/3f2a91c4 (isolated)` + `WS :4321` status dot
    - Prompt preview: `"Split settings page into tabs and add tests"`
    - Stacked worker lanes: Manager (claude), Worker 1 (codex), Worker 2 (agy), Worker 3 (cursor) with live diff badges (`+84/-12`, `+46/-0`, `+128/-34`)
    - Continuous vertical 1px violet Signal Spine threading through all lanes
    - Bottom telemetry bar: `142 tok/s · $0.00 · FENCED // DEPTH 1`
  - **iOS Home Indicator bar**

#### Honest Critique (3+ Weaknesses):
1. **Vertical Real Estate Squeeze:** On 390×844px screens, displaying both the hero copy, dual CTAs, and the 4-lane cockpit card fills the entire viewport, leaving no room for a peek of the subsequent section.
2. **Font Size at Lower Bounds:** In the mobile cockpit lanes, text size drops to 10px in JetBrains Mono. While crisp on Retina displays, it approaches the accessibility floor for users with low vision.
3. **Tilted Cockpit Omitted on Mobile:** In the desktop hero, the 3D tilt (`rotateX(12deg)`) is a signature delight moment. On mobile, we flattened it completely for readability. We should test if a subtle 4° perspective or swipe carousel feels better in Round 2.

---

## 2. Summary of Created Assets & Evidence

| Asset File | Dimensions | Format | Size |
| :--- | :--- | :--- | :--- |
| `docs/landing-site/03-mockups/round-1/style-tile.png` | 1440 × 960 | PNG | 122,511 bytes |
| `docs/landing-site/03-mockups/round-1/hero-desktop-load.png` | 1440 × 960 | PNG | 338,031 bytes |
| `docs/landing-site/03-mockups/round-1/hero-desktop-scrolled.png` | 1440 × 960 | PNG | 210,543 bytes |
| `docs/landing-site/03-mockups/round-1/hero-mobile.png` | 390 × 844 | PNG | 86,198 bytes |
| `docs/landing-site/03-mockups/round-1/notes-a.md` | — | Markdown | ~9 KB |

All assets conform strictly to the binding creative direction in `02-concept.md`:
- Pure `#090909` dark canvas with 1px `#242424` hairlines and `#111111`/`#151515` surfaces
- Signal violet `#8F86E8` filament line and pulse nodes
- Ignition gradient `#B4F372 → #EEFB63 → #BC9AFF` applied with strict restraint
- Real product invariants (fenced roster, depth 1 cap, pre-push guard, isolated worktrees `.ai/onni/worktrees/<runId>`, branch `onni/<id8>`, local WebSocket `:4321`, zero cloud / air-gapped)
- Authentic brand typography (Chakra Petch, Inter in sentence case, JetBrains Mono).
