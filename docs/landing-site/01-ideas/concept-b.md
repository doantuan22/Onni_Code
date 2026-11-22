# Concept B — The Quiet Studio (Calm Craft)

## 1. Concept Name & Creative Thesis

**Concept Name:** *The Quiet Studio*

**Creative Thesis:**  
Most AI developer tools sell noise: glowing neon grids, hyperactive particle storms, and breathless promises of autonomous replacement. *The Quiet Studio* takes the opposite stance—the feeling of a late-evening craftsperson's workbench. A single warm desk lamp illuminates dark slate surfaces while a pixel-art window looks out onto a still night sky; inside, isolated git worktrees sit like neat wooden trays, each holding one focused agent task. Nothing phones home, nothing merges behind your back, and every diff waits calmly on the bench until you inspect the grain and click approve. The site feels handmade, unhurried, and deeply private: a quiet room where AI agents do the heavy planing while you keep your hands on the chisel.

---

## 2. Visual Language

### Color Palette (Grounded in Cockpit Tokens)
The palette inherits OnniCode's actual dark-first instrument-panel tokens and introduces a restrained "desk-lamp" warmth for atmospheric depth:

- **Studio Canvas (Primary Dark):** `#090909` — deep near-black background, never pure `#000000`, so surfaces breathe.
- **Workbench Surface (`--card`):** `#111111` — primary elevated panel; **Recessed Tray (`--card-2`):** `#151515`.
- **Instrument Hairline (`--border`):** `#242424` — 1px structural dividers that separate zones without heavy drop shadows.
- **Primary Ink (`--foreground`):** `#ededed` — crisp off-white; **Muted Ink:** `#a1a1a1`; **Soft Ink (WCAG AA floor):** `#8a8a8a`.
- **Cockpit Violet (`--violet`):** `#8f86e8` — the single interactive accent (active tabs, focus rings, primary CTAs, live branch badges).
- **Warm Lamp Wash (Atmospheric):** `rgba(251, 191, 36, 0.07)` — soft radial amber glow behind focal hardware/UI frames, echoing `#fbbf24` (`--pending`).
- **Semantic Status LEDs:** Emerald `#10b981` (settled / diff additions), Amber `#fbbf24` (pending / active pulse dot only), Info Blue `#93c5fd` (awaiting human review), Conflict Orange `#fb923c` (merge conflict), Danger Red `#ef4444` (failed / diff deletions).
- **Brand Hairline Gradient:** `linear-gradient(135deg, #b4f372 12%, #eefb63 58%, #bc9aff 100%)` — used strictly as a 1px accent rule or subtle badge edge, never as a loud background fill.
- **Daylight Studio Toggle (Light Theme):** `#fafafa` canvas, `#ffffff` card, `#171717` ink, `#6d5fd6` AA-safe violet, `#e4e4e4` hairline.

### Typography Pairing
- **Brand & Architectural Numerals:** **Chakra Petch (SemiBold 600)** — the cockpit's existing chamfered wordmark face, reserved for the `onni` mark, section index numbers (`01`–`08`), and micro-labels.
- **Editorial & UI Copy:** **Inter Variable** — set at `-0.025em` tracking for large display headlines (`clamp(2.25rem, 4.5vw, 4rem)`) and `1.6` line-height for body prose (`16px`–`18px`).
- **Technical & Artifact Layer:** **JetBrains Mono Variable** — used for branch names (`onni/<id8>`), worktree paths (`.ai/onni/worktrees/<runId>`), YAML workflow snippets, token/cost readouts, and CLI commands (`onni run`).

### Texture, Lighting & Surfaces
- **2% Tactile Film Grain:** An inline SVG `feTurbulence` noise overlay at `opacity: 0.025` over `#090909` prevents flat digital banding and gives the dark canvas the feel of matte anodized aluminum or dark drafting paper.
- **Single-Source Desk Lamp Lighting:** One soft radial gradient (`600px`–`900px`) anchors the top of the hero and gently highlights the top 1px border of key panels (`linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0))`).
- **Flat Instrument Separation:** Surfaces step by 4–6% luminance (`#090909` → `#111111` → `#151515`) with `1px solid #242424` borders instead of blurry SaaS drop shadows.

### Iconography & Imagery Style
- **Iconography:** Crisp `1.5px` stroke geometric line icons paired with `6px` circular status LEDs (amber pulsing dot for active work, emerald dot for settled, violet for focus).
- **Imagery:** A deliberate pairing of **pixel-art cockpit scenery** (rendered with `image-rendering: pixelated` inside framed "studio windows" with layered parallax silhouettes) and **razor-sharp UI slices** of the actual OnniCode cockpit—live SSE step streams, unified diffs, and manager–worker trees.

---

## 3. Page Structure (8 Sections in Order)

### Section 01 — The Quiet Header (Navigation)
- **Purpose:** Orient the visitor without clutter; offer instant theme switching (Night Studio / Daylight Studio) and a direct download/CLI jump.
- **Copy Draft:** Wordmark `onni` (Chakra Petch) + 4 quiet links (`Workbench`, `Worktrees`, `Orchestration`, `Automations`) + pill CTA `Download Desktop` / `onni run`.
- **Layout:** Single `56px` sticky bar with `backdrop-filter: blur(12px)`, `1px` bottom `#242424` border, and a subtle Day/Night lamp toggle icon.
- **Signature Effect:** Scrolling past `80px` transitions the header background from transparent to `rgba(9, 9, 9, 0.85)` and reveals a `1px` brand-gradient progress hairline along its bottom edge (`transform: scaleX(0..1)`, driven by scroll ratio, linear easing).

### Section 02 — Hero: The Quiet Workbench
- **Purpose:** Establish the emotional promise—local, private, calm control over AI coding agents—within 3 seconds.
- **Copy Draft:**
  - *Headline:* **Your agents work the night shift. You keep the keys.**
  - *Subline:* **A local, desktop-first cockpit for running AI coding tasks in isolated git worktrees—live-streamed, diff-reviewed, and never merged without your click.**
- **Layout:** Centered editorial headline above a wide, framed cockpit viewport (`max-width: 1120px`) backed by a layered pixel-art studio window. Below the headline: two quiet actions (`Download for Windows` + `Try offline: ONNI_DRY_RUN=1`).
- **Signature Effect:** Detailed in Section 4 below (lamp warm-up + pixel-art parallax + live mocked SSE stream + Day/Night lamp switch).

### Section 03 — Zero Config, Nine Hands (Supported Backends)
- **Purpose:** Show that OnniCode discovers what you already have installed and requires no config files or accounts.
- **Copy Draft:**
  - *Headline:* **Bring the agents you already trust.**
  - *Subline:* **Zero config files. OnniCode discovers your repo, `gh` CLI, and installed backends—Claude Code, Codex, OpenCode, Cursor Agent, pi, Junie, GitHub Copilot, Cline, and Antigravity.**
- **Layout:** Asymmetric 2-column split: left side holds the editorial statement and a terminal snippet (`onni` discovering local tools); right side displays a 3×3 tactile grid of backend "tool tiles" with status LEDs (`detected` vs `optional`).
- **Signature Effect:** On scroll entry (`IntersectionObserver`, threshold `0.25`), the 9 tiles perform a staggered "tool-check" sweep: each tile's LED blinks amber (`180ms`) then settles to emerald (`#10b981`) or quiet slate (`#8a8a8a`) in a `60ms` cascade (`cubic-bezier(0.22, 1, 0.36, 1)`), mimicking local environment discovery.

### Section 04 — Isolated Trays (One Git Worktree Per Task)
- **Purpose:** Explain the core technical guarantee: parallel tasks never trample each other's files or your main working tree.
- **Copy Draft:**
  - *Headline:* **Every task gets its own wooden tray.**
  - *Subline:* **Each run boots in an isolated git worktree at `.ai/onni/worktrees/<runId>` on branch `onni/<id8>`. Run three tasks side by side; your working branch stays untouched.**
- **Layout:** Horizontal 3-lane diagram styled like physical workbench trays. Each lane shows a live branch tag (`onni/47546303`), a tiny file-tree diff count (`+42 -11`), and an active backend badge.
- **Signature Effect:** Clicking or hovering any tray gently elevates it by `4px` (`220ms`, `cubic-bezier(0.2, 0.8, 0.2, 1)`), dims the sibling trays to `0.55` opacity, and slides open a clean monospace path inspector underneath showing the exact worktree directory and branch ref.

### Section 05 — The Live Stream & The Review Gate (Nothing Merges Itself)
- **Purpose:** Contrast live observability (steps, tool calls, tokens, cost over WebSocket + SSE) with deliberate human authority (diff-first review gate, explicit merge click, draft PRs via `gh`).
- **Copy Draft:**
  - *Headline:* **Watch every step. Own every merge.**
  - *Subline:* **Tool calls, tokens, and diffs stream live over one local bus. When a run settles, its diff waits at the review gate—or opens as a draft PR through `gh`. Nothing merges itself.**
- **Layout:** Split 55/45 interactive showcase. Left: a compact live-streaming step log (`read_file`, `edit_file`, `npm test`, token/cost counter). Right: a crisp unified diff card with an interactive `Approve & Merge` / `Open Draft PR` button pair.
- **Signature Effect:** As the user scrolls into the section, the left log streams 4 compact steps at `240ms` intervals; once the final test step turns emerald, the right-side diff card's `Review Gate` badge softly pulses once (`600ms`, `ease-out`) and unlocks the `Explicit Merge` button with a tactile press state (`scale(0.98)` on click, confirming *"Local merge only — never auto-pushed"*).

### Section 06 — The Manager–Worker Bench (Orchestration & Fences)
- **Purpose:** Explain multi-agent coordination without hype: a manager plans, splits by file ownership, dispatches to a worker roster, and stays bounded by limits and pre-push fences.
- **Copy Draft:**
  - *Headline:* **One manager plans. A fenced roster builds.**
  - *Subline:* **Split work by file ownership across different backends and models. Unattended runs stay bounded by cost, time, hang limits, dispatch depth caps, and a pre-push fence.**
- **Layout:** Clean top-down tree diagram: 1 Manager node (`planner`) branching via crisp 1px SVG orthogonal lines to 3 Worker nodes (`backend`, `ui`, `tests`), flanked by a compact "Safety Fences" spec strip (`max_cost`, `max_duration`, `no auto-land`, `pre-push guard`).
- **Signature Effect:** On scroll reveal, the SVG connector lines draw smoothly from manager to workers (`stroke-dashoffset` over `700ms`, `cubic-bezier(0.16, 1, 0.3, 1)`), followed by each worker node's file-ownership pill fading in (`200ms` stagger). Hovering a fence rule highlights the exact boundary on the tree.

### Section 07 — Quiet Hours & Local-First Privacy (Automations + State)
- **Purpose:** Present scheduled/event-driven automations alongside OnniCode's uncompromising privacy architecture (no account, no database, no cloud, no telemetry).
- **Copy Draft:**
  - *Headline:* **Quiet hours on autopilot. Zero bytes in the cloud.**
  - *Subline:* **Trigger ordinary tasks from GitHub polls, Jira/Linear events, or cron schedules. All state lives as plain JSON, NDJSON, and Markdown under `.ai/onni/` and `~/.onni/`.**
- **Layout:** Two-panel horizontal band: Left panel shows 3 calm trigger cards (`New PR opened`, `Weekdays 08:00`, `Jira issue assigned` → `launches onni task`). Right panel is a transparent "File Cabinet" inspector displaying real local state paths (`~/.onni/config.json`, `.ai/onni/runs/`).
- **Signature Effect:** A subtle `1.2s` rhythmic "heartbeat" pulse travels along the hairline connector from a selected trigger card into a local `.ai/onni/` folder icon, visually proving that even automated runs stay strictly inside the local machine.

### Section 08 — Take It Home (Desktop, CLI & Dry-Run Demo)
- **Purpose:** Give developers a concrete, frictionless next step: install the Tauri 2 Windows app, run the `onni` CLI, or test offline with `ONNI_DRY_RUN=1`.
- **Copy Draft:**
  - *Headline:* **Sit down at the bench.**
  - *Subline:* **Tauri 2 desktop shell with bundled engine, or standalone `onni run` CLI. MIT licensed. Test the entire cockpit offline right now with `ONNI_DRY_RUN=1`.**
- **Layout:** Centered closing card lit by a warm desk-lamp radial glow, featuring a copyable `ONNI_DRY_RUN=1 npm run dev` command pill, a primary `Download Desktop (Windows)` button, and a minimal footer (`MIT License · Local-first · No telemetry`).
- **Signature Effect:** Clicking the command pill swaps the copy icon for a crisp emerald checkmark (`180ms` spring) and displays *"Mocked agents ready — no login required."*

---

## 4. Hero in Detail

### The First 3 Seconds of Motion
- **0.0s – 0.5s (Lamp Warm-Up):** The page opens on `#090909`. A soft radial amber-violet desk-lamp glow (`opacity: 0 → 1`) blooms behind the central cockpit frame over `500ms` (`cubic-bezier(0.22, 1, 0.36, 1)`), illuminating the pixel-art window scenery first.
- **0.4s – 1.1s (Editorial Entrance):** The `onni` eyebrow badge and the Chakra Petch / Inter headline rise `16px` (`translateY(16px) → 0`, `opacity: 0 → 1`) over `650ms`, followed `120ms` later by the subline and CTA pair.
- **1.0s – 3.0s (The Living Bench):** Inside the framed cockpit preview, a single mocked task (`onni/47546303`) quietly comes alive: two tool-call rows stream in (`read_file`, `edit_file`), the token counter ticks smoothly upward, and the pixel-art night sky drifts 1px every `400ms` in the background.

### Scroll Behaviour
As the user scrolls through the first `90vh`, the pixel-art studio backdrop moves at `0.35x` scroll speed while subtly dimming (`opacity: 1 → 0.25`), letting the crisp cockpit UI frame glide forward (`translateY(0 → -24px)`) and settle cleanly into Section 03 without jarring scroll-jacking.

### The One "Wow" Moment
In the top-right corner of the hero's cockpit frame sits a tactile **Studio Lamp Switch** (`Night #090909` / `Daylight #fafafa`). Clicking it triggers a circular clip-path / crossfade (`450ms`, `cubic-bezier(0.4, 0, 0.2, 1)`) that shifts the pixel-art scenery behind the chat from a quiet midnight window to crisp morning daylight—and simultaneously flips the entire hero cockpit preview to OnniCode's real `.light` token sheet (`#fafafa`, `#ffffff`, `#6d5fd6`). It is an immediate, tactile proof of craft that showcases both the pixel-art soul and the dual-theme engineering.

---

## 5. Motion Principles, Performance & Accessibility

### Motion Principles
1. **Uncluttered & Purposeful:** Motion only exists to clarify state (discovery, isolation, streaming, review) or atmosphere (lamp light, pixel drift). Never bounce or spin for decoration.
2. **Instrument Crispness:** Micro-interactions (`150ms–240ms`) use snappy deceleration (`cubic-bezier(0.2, 0.8, 0.2, 1)`); architectural reveals (`500ms–750ms`) use smooth exponential settle (`cubic-bezier(0.16, 1, 0.3, 1)`).
3. **GPU-Only Properties:** Animate strictly `transform`, `opacity`, and `clip-path`. Never animate `width`, `height`, `top`, `left`, or `box-shadow` on scroll.
4. **One Focal Motion Per Viewport:** Only one element streams or pulses in view at any moment, keeping the page calm to read.

### Performance Budget
- **Total Page Weight:** `< 120 KB` gzipped (HTML + CSS + JS + SVG grain + compressed pixel-art sprite/PNGs), excluding optional webfont subsets.
- **Fonts:** Self-hosted `.woff2` subsets for `Inter Variable`, `JetBrains Mono Variable`, and `Chakra Petch 600` (matching the cockpit's offline-first philosophy), loaded with `font-display: swap`.
- **Runtime:** Zero layout thrashing; `IntersectionObserver` pauses off-screen pixel-art / stream timers automatically so idle CPU stays near `0%`.

### Reduced-Motion & Accessibility
- **`prefers-reduced-motion: reduce`:** Disables scroll parallax, lamp bloom transitions, pixel-art drift, and auto-typing streams. All sections render immediately at `opacity: 1` with the mocked cockpit showing a clean, settled task state.
- **Contrast & Keyboard Navigation:** Every text pairing respects WCAG AA (`>= 4.5:1`), honoring the cockpit's own soft-ink floor (`#8a8a8a` on `#090909`, `#6b6b6b` on `#fafafa`). Every interactive tray, review-gate demo button, and lamp toggle is a native `<button>` with visible `2px solid #8f86e8` `:focus-visible` rings.

---

## 6. Tech Approach (Plain Static Site)

- **Stack:** Pure **HTML5 + CSS3 (Custom Properties + `@layer`) + Vanilla ES2022 JavaScript**—zero build step, zero bundler, zero `node_modules`. Opening `site/index.html` directly from disk (`file://`) or serving it statically works identically.
- **External Libraries:** **None required.** `IntersectionObserver` handles all section reveals and pauses off-screen timers; CSS `transition` and `linear()` / `cubic-bezier()` handle all springs and micro-interactions; a tiny `< 80`-line `app.js` drives the Day/Night lamp toggle, worktree tray selector, interactive review-gate demo, and clipboard copy.
- **Why Zero-Dep Fits the Brand:** OnniCode's core promise is *zero config, local-first, works offline*. Shipping a landing page with zero third-party CDNs and zero tracking scripts practices the exact same philosophy.

---

## 7. Risks & How to Avoid Feeling Cheap

1. **Blurry Pixel Art:** Stretching pixel-art scenery with bilinear browser scaling makes it look like a low-res JPEG. *Fix:* Export crisp integer-scaled assets and enforce `image-rendering: pixelated; image-rendering: crisp-edges;`.
2. **Generic "AI Neon" Creep:** Overusing the `#b4f372 → #eefb63 → #bc9aff` gradient or adding glowing purple blurs everywhere will make the site look like a generic crypto/AI template. *Fix:* Keep 90% of the page in quiet `#090909` / `#111111` / `#ededed` with `1px #242424` borders; use the gradient only as a `1px` scroll rule and `#8f86e8` strictly for interactive focus.
3. **Fake-Feeling Terminal Demos:** Endless looping typewriter animations feel gimmicky. *Fix:* Make the hero stream short, realistic (`read_file`, `edit_file`, `npm test`), and settle cleanly into a reviewable state—just like a real OnniCode run.
4. **Heavy Scroll-Jacking:** Hijacking wheel velocity breaks developer trust. *Fix:* Keep native browser scrolling untouched; use subtle, bounded `transform` parallax (`<= 24px`) and crisp reveal states.
