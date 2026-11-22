# Concept D — **"The Living Bus: Telemetry in Flight"**
*(Motion-First Choreographed Scroll Architecture for OnniCode)*

---

## 1. Concept Name & Creative Thesis

**Concept Name:** **The Living Bus — Telemetry in Flight**

**Creative Thesis:**  
Most developer tool landing pages treat motion as cosmetic garnish—cards that fade up 24 pixels as they enter the viewport. For OnniCode, motion *is* the product argument. OnniCode takes chaotic, opaque AI agent work and binds it into isolated git worktrees (`.ai/onni/worktrees/<runId>`), streaming every step, tool call, token, cost tick, and diff across one local WebSocket bus while keeping the human pilot in command of what lands. **"The Living Bus"** transforms the entire web page into a single continuous, scroll-choreographed instrument flight. A live "Signal Spine"—a 1px vertical filament of violet-to-lime light representing OnniCode's local WebSocket + SSE bus—runs down the page and physically branches, fans out into parallel worker worktrees, streams live NDJSON/diff pulses, and hits a mechanical hardware lock at the review gate. Scrolling does not merely reveal static screenshots; the user's scroll velocity acts as the playhead of a deterministic, 60fps local task timeline—from typing a prompt and choosing among nine agent backends, to splitting into isolated `onni/<id8>` branches, to inspecting the diff and clicking Merge. It feels like the tactile precision of Teenage Engineering hardware fused with the spatial depth of Apple's MacBook Pro silicon pages and the dark-room instrument clarity of Linear.

---

## 2. Visual Language

### Color Palette (Anchored in OnniCode's Mercato Token System)
Rather than inventing a detached marketing palette, the site elevates the real cockpit tokens from `packages/web/src/styles/index.css` into a physically lit darkroom environment:

| Role | Token / Name | Hex / Value | Usage in the Motion System |
| --- | --- | --- | --- |
| **Primary Canvas** | `--background` (Void Obsidian) | `#090909` | Deep, non-reflective base canvas; zero elevation drop-shadows on base planes. |
| **Instrument Surface 1** | `--card` (Anodized Slate) | `#111111` | Primary cockpit frames, terminal viewport chassis, and pinned stage containers. |
| **Instrument Surface 2** | `--card-2` (Recessed Bay) | `#151515` | Worktree lanes, diff gutters, and nested sub-panels. |
| **Rail & Chrome** | `--sidebar` / `--muted` | `#0B0B0B` / `#1B1B1B` | Inactive track rails, keycap beds, and recessed status bays. |
| **Hairline Structure** | `--border` (Etched Graphite) | `#242424` | Crisp 1px structural grid lines; illuminated dynamically near the cursor via radial mask. |
| **Primary Ink** | `--foreground` (Phosphor White) | `#EDEDED` | Headlines, active code tokens, and primary telemetry counters. |
| **Secondary Ink** | `--muted-foreground` / `--soft-foreground` | `#A1A1A1` / `#8A8A8A` | Technical annotations, timestamps, file paths, and AA-compliant captions. |
| **Core Signal Accent** | `--violet` (Bus Violet) | `#8F86E8` | Active WebSocket pulse, focus rings, branch divergence arcs, and interactive controls. |
| **Brand Ignition Gradient** | `--grad` (Telemetry Spectrum) | `linear-gradient(135deg, #B4F372 12%, #EEFB63 58%, #BC9AFF 100%)` | Used sparingly as a high-energy light emission along active scroll traces and the hero ignition beam. |
| **Semantic Telemetry** | `--success` / `--pending` / `--danger` / `--info` / `--conflict` | `#10B981` / `#FBBF24` / `#EF4444` / `#93C5FD` / `#FB923C` | Exact state encoding: Emerald (`+diff` / settled done), Amber (pulsing tool-call dot), Red (`-diff` / blocked), Blue (waiting on human review), Orange (merge conflict fence). |
| **Daylight Counterpart** | `.light` Surface Toggle | `#FAFAFA` bg / `#FFFFFF` card / `#6D5FD6` violet | Live theme switch in the navbar demonstrates that OnniCode's token sheet has a true high-contrast `#FAFAFA` daylight mode. |

### Typography Pairing
- **Brand & Section Indices — `Chakra Petch` (SemiBold 600):** Inherited directly from OnniCode's brand mark guideline. Its chamfered, mechanical 45° corners anchor the `onni` wordmark, oversized section coordinates (`// 01` through `// 09`), and hardware state badges (`[GATE: REVIEW]`, `[FENCE: NO-PUSH]`).
- **Editorial & UI Architecture — `Inter Variable` (400, 500, 600):** Tightened to `-0.025em` tracking for large scroll-pinned headlines (`clamp(2.25rem, 4.5vw, 4.25rem)`) and `-0.006em` at `13px–15px` for dense cockpit UI labels.
- **Live Telemetry & Code — `JetBrains Mono Variable` (400, 500, 700):** Applied with `font-variant-numeric: tabular-nums` so live-ticking token counters, millisecond timers, branch hashes (`onni/e489da51`), and YAML workflow snippets never jitter horizontally during scroll playback.

### Texture & Lighting
- **No Blurry Neon Fog:** In keeping with the cockpit's strict "1px border + surface step, never blurry glassmorphism" rule, depth comes from **specular edge lighting** rather than heavy `backdrop-filter: blur()`.
- **Cursor-Reactive Specular Grid:** Every card and structural cell shares a unified CSS custom property pair (`--mouse-x`, `--mouse-y`) updated in a single `requestAnimationFrame` tick. A radial mask (`radial-gradient(380px circle at var(--mouse-x) var(--mouse-y), rgba(143,134,232,0.38), transparent 70%)`) reveals the 1px `#242424` borders as if an overhead work-lamp is sweeping across precision-milled black metal.
- **Pixel-Art Horizon Depth:** A subtle homage to OnniCode's built-in pixel-art scenery (`[data-slot='scene-backdrop']`). Behind the hero cockpit window sits a multi-plane parallax pixel-art twilight horizon rendered on a crisp `image-rendering: pixelated` canvas that shifts 3% against scroll and dims smoothly when the cockpit reading lane activates.

### Iconography & Imagery Style
- **1px Vector Schematics:** Custom 16×16px and 20×20px geometric icons with 1.5px stroke width, mitered corners (matching Chakra Petch's chamfers), and animated `stroke-dashoffset` paths.
- **DOM-Native Cockpit Twins over Flat PNGs:** Instead of fuzzy raster screenshots, the cockpit visuals are built as semantic, ultra-crisp HTML/CSS/SVG instrument frames populated with authentic OnniCode data (real file trees, real diff hunks, real backend badges for Claude Code, Codex, OpenCode, Cursor Agent, pi, Junie, GitHub Copilot, Cline, and Antigravity).

---

## 3. Page Structure (9 Choreographed Scenes)

### Section 01 — The Ignition Stage (Hero)
- **Purpose:** Establish immediately what OnniCode is—a local, desktop-first cockpit for running and tracking AI coding-agent tasks in isolated git worktrees—while delivering an unforgettable kinetic cockpit reveal.
- **Headline Draft:** `Every agent. Its own worktree. Your command.`
- **Subline Draft:** `OnniCode is the local cockpit for AI coding agents. Dispatch Claude Code, Codex, Cursor, OpenCode, Copilot, Junie, pi, Cline, or Antigravity into isolated git branches—streaming steps, tool calls, tokens, and diffs live, with zero cloud and zero auto-merge.`
- **Layout Description:** Full-viewport pinned stage (`160vh` scroll track, `100dvh` sticky frame). Top floating command bar with the `onni` Chakra Petch wordmark, live theme switch (`#090909` / `#FAFAFA`), and GitHub MIT badge. Center-top copy block (`max-w: 760px`) above a 3D-tilted (`rotateX(14deg)`) interactive cockpit stage showing a live task composer and worktree rail, underscored by the subtle pixel-art twilight horizon.
- **Signature Effect / Animation:** **The Ignition Scrub.** On initial load, the prompt types itself into the composer; as the user begins scrolling (`0% → 100%` of the `60vh` pin), the camera tilts from `rotateX(14deg) scale(0.92)` to `rotateX(0deg) scale(1)` (`cubic-bezier(0.16, 1, 0.3, 1)`), while the single violet Signal Spine shoots downward from the composer's "Run" button and splits into three live worktree lanes.

### Section 02 — The Nine-Backend Switchboard & YAML Workflows
- **Purpose:** Show that OnniCode is vendor-agnostic: one prompt and one YAML workflow can drive nine distinct coding-agent CLIs without lock-in.
- **Headline Draft:** `Nine agent backends. One unified protocol.`
- **Subline Draft:** `Pick the right engine for the task—Claude Code, Codex, OpenCode, Cursor Agent, pi, Junie, GitHub Copilot, Cline, or Antigravity—paired with repeatable YAML workflows.`
- **Layout Description:** A two-column split (`5:7` grid). Left column holds the narrative, a YAML workflow preview card (`workflow.yaml`), and a 3×3 tactile hardware matrix of the nine backends. Right column holds a normalized live event stream inspector showing how disparate CLI outputs map onto OnniCode's unified event bus.
- **Signature Effect / Animation:** **The Backend Rotary Patch.** As the section scrolls through its center zone (or when the user hovers/clicks any of the 9 backend tiles), an SVG patch cable morphs its Bézier control points (`420ms`, `--ease-spring`) from the active backend tile into the YAML workflow node and updates the live CLI command preview (`claude`, `codex`, `opencode`, `cursor`, `pi`, `junie`, `copilot`, `cline`, `agy`) with a 120ms phosphor text-scramble transition.

### Section 03 — Worktree Isolation (The Branching Loom)
- **Purpose:** Visualize the core architectural promise: every task gets its own physical git worktree at `.ai/onni/worktrees/<runId>` on branch `onni/<id8>`, so parallel agents never trample each other's working tree or index.
- **Headline Draft:** `Parallel without collision. One worktree per task.`
- **Subline Draft:** `Forget stashing or locked indexes. OnniCode forks every run into .ai/onni/worktrees/<runId> on its own onni/<id8> branch, anchored cleanly to your base ref.`
- **Layout Description:** A pinned horizontal-within-vertical scroll scene (`220vh` outer container). The trunk branch (`main`) runs horizontally across the top rail; below it, three full worktree cards (`onni/a7c3f109`, `onni/41e8b220`, `onni/e489da51`) sit in parallel slots showing isolated filesystem changes, independent `git status` trees, and concurrent test runs.
- **Signature Effect / Animation:** **Scroll-Linked Git Forking.** Tied 1:1 to scroll progress (`0.0 → 1.0`), the single violet trunk line physically splits into three glowing SVG bezier rails (`stroke-dashoffset` driven by scroll). Each worktree card slides out along its rail with staggered depth (`translateZ(0px)`, `translateY` 0→24px, `cubic-bezier(0.16, 1, 0.3, 1)`), while file-lock badges pulse green to prove zero cross-contamination across shared files.

### Section 04 — The Live Telemetry Bus (WS + SSE Stream)
- **Purpose:** Demonstrate that OnniCode never leaves you staring at a dead spinner—steps, tool calls, reasoning, tokens, cost, and diffs stream in real time over one local WebSocket bus and SSE.
- **Headline Draft:** `Watch the thought process. Every tool call, token, and diff—live.`
- **Subline Draft:** `One demand-driven WebSocket bus streams every agent step as it happens. Inspect tool arguments, track token and cost velocity, or scrub the live transcript without polling.`
- **Layout Description:** Full-width instrument dashboard frame divided into three synchronized panes: (1) The Live Transcript & Tool Streak lane (with the `.shimmer` active tool title), (2) The Token & Cost Odometer strip, and (3) The Real-Time Diff Streamer.
- **Signature Effect / Animation:** **Velocity-Coupled Telemetry Scrub.** Scrolling down advances an authentic 18-second task recording frame-by-frame; scrolling up rewinds it. Tool-call pills expand with `--ease-spring` (`250ms`), the active tool title runs the exact Mercato linear shimmer (`1.8s linear infinite`), and tabular-numeral counters roll upward smoothly while green/red diff lines type into the right pane.

### Section 05 — Manager / Worker Orchestration & The Roster Fence
- **Purpose:** Explain how complex tasks scale safely: a Manager agent decomposes work by file ownership, dispatches subtasks to a fenced Roster of Worker agents across different backends/models, verifies their branches, and merges locally.
- **Headline Draft:** `One manager. A fenced roster of workers.`
- **Subline Draft:** `Let a manager agent plan and split work by file ownership across specialized workers. A live roster enforces who can run, caps depth at 1, commits WIP before forking, and reports results back automatically.`
- **Layout Description:** Interactive topological tree diagram occupying a `1200px` wide stage. At the crown sits the **Root Manager** node (`onni/9c00ba46`); below it sits the **Roster Fence** boundary line (`409 Conflict` guard against unlisted backends) and four **Worker Units** (`Depth 1`) each assigned an explicit file-scope badge and backend chip.
- **Signature Effect / Animation:** **The Dispatch Fan-Out & Settle Cycle.** Entering the viewport at `30%` threshold triggers a choreographed 4-stage sequence (`total 2.4s`, scrubbable or replayable via click): (1) Manager commits WIP badge locks (`180ms`), (2) four violet dispatch packets travel down the SVG edges to the workers (`500ms`, `cubic-bezier(0.65, 0, 0.35, 1)`), (3) worker progress rings fill in parallel while an attempt to dispatch an unlisted 5th worker bounces off the Roster Fence with an amber `409 Roster Fence` spark, and (4) emerald settle-reports flow back up to the manager.

### Section 06 — The Diff-First Review Gate & Unattended Safety Fences
- **Purpose:** Prove OnniCode's core safety invariant: **Nothing merges itself.** Highlight the diff-first review gate, draft PR creation via `gh`, run limits (cost, time, hangs), and the unattended Git pre-push fence.
- **Headline Draft:** `Nothing merges itself. Fenced by design.`
- **Subline Draft:** `Autonomous and dispatched runs are fenced against auto-landing and unauthorized git push. Bound every tree by cost, wall-clock time, retry limit, and subtask count—then review the exact diff before you click merge.`
- **Layout Description:** Split security schematic. Left side: **The Pre-Push & Limits Guard** featuring live gauges for Cost Cap, Wall-Clock Timeout, Idle/Hang Sweep, and Dispatch Depth, plus a visual intercept of an unattended `git push` blocked by `push-guard`. Right side: **The Diff-First Review Gate** card parked at `review` state (`#93C5FD` info blue), displaying a clean unified diff with explicit `[Open Draft PR (gh)]` and `[Merge Branch]` hardware buttons.
- **Signature Effect / Animation:** **The Mechanical Gate Lock.** As the scroll playhead reaches the bottom of the automated run trace, the moving lime-violet signal pulse slams into a horizontal crossbar labeled `REVIEW GATE`. The bar compresses 4px with spring physics (`--ease-spring`, `400ms`), shifts the status pill from amber `--pending` (`#FBBF24`) to human-review `--info` (`#93C5FD`), and illuminates the diff hunks (`rgba(16, 185, 129, 0.1)` additions, `rgba(239, 68, 68, 0.1)` deletions). Clicking `[Merge Branch]` in the demo triggers a satisfying tactile latch animation.

### Section 07 — Automations (Bounded Polls, Trackers & Schedules)
- **Purpose:** Showcase how OnniCode handles recurring engineering work natively: GitHub polls (new PR, new issue, label added/removed, review submitted or requested), Jira/Linear tracker events, and cron/one-shot schedules—always previewed before enabling.
- **Headline Draft:** `Triggers that launch tasks—while you sleep.`
- **Subline Draft:** `Poll GitHub PRs, issues, labels, and reviews, watch connected Jira or Linear trackers, or schedule runs on a clock. Preview matches safely while paused, then let every occurrence spawn an isolated OnniCode task.`
- **Layout Description:** Three radial/linear trigger lanes converging into a single `onni task` spawner card: Lane A (**GitHub Poll**: `PR review requested`, filtered by label/reviewer), Lane B (**Tracker Event**: `Jira / Linear issue created or transitioned`), and Lane C (**Schedule**: `Weekdays 07:00` / `Tonight 23:00`). Below sits a live terminal strip showing `onni automation check <id>` previewing matches in paused state.
- **Signature Effect / Animation:** **The Pulse Harvester.** Three concentric radar sweep arcs tick at staggered intervals (`2.4s`, `3.2s`, `4.0s`). When a sweep crosses an event dot (`PR #142 labeled bug`, `LINEAR-88 created`, `07:00 cron`), a glowing capsule detaches, slides along the track into the Task Spawner (`380ms`, `cubic-bezier(0.16, 1, 0.3, 1)`), and mints a fresh `onni/<id8>` worktree card. A toggle lets visitors click `Preview Match (Paused)` vs `Enabled`.

### Section 08 — Zero-Config & Local-First Anatomy (`.ai/onni/` X-Ray)
- **Purpose:** Reinforce trust for privacy-conscious developers and tech leads: no account, no database, no cloud, no telemetry. Everything is plain JSON, NDJSON, and Markdown on disk, discovered automatically from the repo, environment, `gh`, and installed CLIs.
- **Headline Draft:** `No cloud. No database. Just plain files on your machine.`
- **Subline Draft:** `Zero config to start—OnniCode discovers your repo, gh CLI, and installed agents automatically, or degrades gracefully. Delete .ai/onni/ anytime and it rebuilds cleanly.`
- **Layout Description:** An exploded isometric "X-Ray" view of a local repository directory tree on the left (`.ai/onni/worktrees/`, `.ai/onni/runs/*.json`, `transcript.ndjson`, `HANDOFF.md`, `~/.onni/config.json`) paired with a 4-pillar zero-config matrix on the right (`Zero Account`, `Zero Telemetry`, `Graceful Degradation`, `Offline Dry-Run: ONNI_DRY_RUN=1`).
- **Signature Effect / Animation:** **The X-Ray Layer Peel.** Scrolling across this section separates three stacked translucent planes (`translate3d(0, calc(var(--scroll-p) * -28px), 0)`)—top plane: Cockpit UI; middle plane: Zod-validated `/api/v1` contract layer; bottom plane: raw `.json`, `.ndjson`, and `.md` files on disk. Hovering any UI element highlights the exact local file path that backs it with a connecting vertical laser line.

### Section 09 — Launchpad (Desktop App, CLI & Offline Dry-Run Finale)
- **Purpose:** Convert interest into immediate local exploration via the Tauri 2 Desktop shell (Windows NSIS installer bundling engine + Node), the CLI (`onni`, `onni run`), or the zero-login `ONNI_DRY_RUN=1` sandbox.
- **Headline Draft:** `Take the cockpit Seat. Local in sixty seconds.`
- **Subline Draft:** `Run the native Tauri 2 desktop shell, boot the local web cockpit from your terminal, or execute headless YAML workflows with onni run. Try the entire cockpit offline right now with ONNI_DRY_RUN=1.`
- **Layout Description:** Centered high-contrast command deck framed by the full pixel-art horizon scenery at the bottom edge of the page. Two primary cards sit side-by-side: **Desktop App (Tauri 2 Shell)** with download/build actions, and **CLI & Dry-Run Sandbox** with one-click copyable terminal commands (`ONNI_DRY_RUN=1 npm run dev`, `onni`, `onni run`). Footer includes MIT License, hard fork of the cezar engine credit, and keyboard navigation legend.
- **Signature Effect / Animation:** **The Terminal Dry-Run Simulator & Horizon Dawn.** Clicking the copy button on `ONNI_DRY_RUN=1 npm run dev` not only copies the command (morphing the icon into an emerald checkmark in `180ms`) but fires a 2-second mini boot sequence inside the embedded terminal (`API :4321 ready • Mocked agents active • Opening cockpit…`) while the pixel-art horizon beneath gently brightens its sky gradient mask.

---

## 4. Hero in Detail

### The First 3 Seconds of Motion (0.0s → 3.0s Load Choreography)
The hero does not dump fifteen elements onto the screen at once; it executes a precise **Cold-Boot Instrument Sequence**:
- **0.0s – 0.4s (The Loading Sweep Hand-off):** Mirrors OnniCode's real `index.html` boot splash. On a `#090909` canvas, the geometric `onni` mark breathes in (`scale(0.97) → scale(1)`, opacity `0.55 → 1`), and a single 1px violet bar crosses a hairline track (`cubic-bezier(0.65, 0, 0.35, 1)`).
- **0.4s – 1.1s (Chassis & Horizon Assembly):** The 1px `#242424` cockpit grid lines draw outward from the center via CSS `scaleX`/`scaleY` (`500ms`, `cubic-bezier(0.16, 1, 0.3, 1)`). The tilted cockpit window (`perspective(1400px) rotateX(14deg)`) rises 28px into place while the pixel-art Horizon strip fades up along the lower 36% mask.
- **1.1s – 2.2s (Headline & Live Composer Ignition):** The headline words stagger in by line (`120ms` stagger, `translateY(14px) → 0`). Inside the cockpit composer card, a simulated prompt finishes typing in `JetBrains Mono`: `"Refactor auth middleware & verify session tests"`, the backend chip cycles rapidly through `claude → codex → cursor` before locking onto a multi-worker roster, and the `[Dispatch Task]` button pulses with the `#B4F372 → #EEFB63 → #BC9AFF` brand gradient border.
- **2.2s – 3.0s (First Telemetry Heartbeat):** The status indicator switches to live emerald (`#10B981`), the worktree badge prints `.ai/onni/worktrees/e489da51 (onni/e489da51)`, and the Signal Spine emits its first downward light pulse, inviting the user to scroll.

### Scroll Behaviour (`0vh → 60vh` Pinned Stage)
As the user scrolls through the hero's pinned range:
1. **Perspective Flatten:** The cockpit frame rotates smoothly from `rotateX(14deg) scale(0.92)` to `rotateX(0deg) scale(1.0)` while the hero copy above translates upward and dims to `opacity: 0.15`, handing full visual authority to the cockpit instrument panel.
2. **Worktree Fan-Out Inside the Cockpit:** Between `25%` and `85%` of the hero scroll progress, the single task inside the cockpit splits visibly into a Manager header and three parallel Worker worktree rows (`onni/a7c3f109 [claude]`, `onni/41e8b220 [codex]`, `onni/e489da51 [agy]`), each streaming live tool streaks and diff counters (`+142 −38`).
3. **Spine Handoff:** At `90% → 100%` scroll progress, the glowing Signal Spine exits the bottom border of the hero cockpit and anchors directly into the top of Section 02's 9-Backend Switchboard, creating one unbroken mechanical thread.

### The One "Wow" Moment
**"The Live Worktree X-Ray Scrub."**  
Halfway through the hero scroll (or whenever the user drags the interactive timeline scrubber bar embedded directly on the bottom edge of the hero cockpit), the cockpit view performs a real-time **spatial explosion**: the unified task view separates in 3D Z-space into three physical parallel branch lanes (`onni/a7c3f109`, `onni/41e8b220`, `onni/e489da51`), showing three different AI backends editing files simultaneously in isolated worktrees without a single git conflict—and then collapsing cleanly back into one diff-first review gate waiting for the user's click. In three seconds of scrolling, a developer understands OnniCode's entire value proposition without reading a paragraph.

---

## 5. Motion Principles, Performance Budget & Accessibility

### 5 Core Motion Principles
1. **Scroll Is a Deterministic Playhead, Never a Trigger Bomb:** Scrolling should feel like scrubbing a precision timeline in a video editor or logic analyzer. If the user scrolls backward 80px, the branch split and telemetry counters reverse 80px smoothly—never re-triggering jarring one-shot entrance animations.
2. **Hardware Honesty (1px Hairlines & Surface Steps, Zero Muddy Blur):** Follow OnniCode's Mercato token philosophy (`index.css`). Separation is achieved through `#090909 → #111111 → #151515` surface steps and cursor-lit `#242424` 1px borders. Never stack `backdrop-filter: blur()` over scrolling content.
3. **One Shared Timing Vocabulary:** All non-scrubbed micro-interactions use the exact cockpit tokens from `packages/web/src/styles/index.css`:
   - `--duration-micro: 120ms` (keycaps, hover states, copy feedback)
   - `--duration-fast: 180ms` (tab switches, chip toggles)
   - `--duration-base: 250ms` (drawer/panel transitions)
   - `--duration-slow: 400ms` (stage reveals, gate latches)
   - Curves: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)`, and the real `linear(...)` overshoot `--ease-spring` for modal/card entrances.
4. **Cause-and-Effect Continuity (The Signal Spine):** Nothing moves in isolation. A packet leaving the Manager node in Section 05 visibly arrives at the Worker node; a pulse hitting the Review Gate in Section 06 physically deflects the gate bar before lighting the diff hunks.
5. **Rest Is Part of Choreography:** High-density technical text (diffs, YAML workflows, file paths) never moves while the user is reading it. Once a pinned stage locks into its reading phase, text planes remain rock-solid (`translate3d(0,0,0)`) while only the telemetry pulses and progress bars animate inside bounded slots.

### Strict Performance Budget
- **Compositor-Only Properties:** 100% of scroll-linked and continuous animations touch only `transform` (`translate3d`, `scale`, `rotateX`), `opacity`, and SVG `stroke-dashoffset`. Zero layout-thrashing animations on `top`, `left`, `width`, `height`, or `box-shadow`.
- **60fps / 120Hz ProMotion Target:** Main-thread JavaScript work per scroll frame must stay under **2.5ms** on a mid-range laptop. All DOM measurements (`getBoundingClientRect`) are cached once on load and recalculated only on `ResizeObserver`.
- **Single `requestAnimationFrame` Loop:** Cursor spotlight coordinates (`--mouse-x`, `--mouse-y`) and scroll progress variables (`--scroll-p`) share one unified `rAF` tick that sleeps automatically (`cancelAnimationFrame`) whenever scroll velocity and pointer delta drop to zero.
- **Viewport Gating via `IntersectionObserver`:** Off-screen sections pause all loops, SVG pulses, and canvas draws completely (`data-active="false"`).
- **Asset Weight Cap:** Total page weight `< 350 KB` transferred (self-hosted WOFF2 Latin + Vietnamese font subsets, inline SVGs, zero external video files, zero heavy 3D meshes).

### Reduced-Motion Fallback (`prefers-reduced-motion: reduce`)
- **First-Class Static Schematic Mode:** When `prefers-reduced-motion: reduce` is active (or toggled manually via a persistent `[Motion: Full / Reduced]` switch in the header), all scroll-pinning spacers collapse to standard document flow (`100vh` stages instead of `220vh` scrub tracks).
- **Instant State Switchers Replace Scroll Scrubs:** Multi-stage scroll scenes (Hero worktree fan-out, Section 03 Git Forking, Section 05 Manager/Worker dispatch) render in their complete, legible "settled" state with clean `[1. Dispatch] [2. Parallel Run] [3. Review Gate]` step tabs so reduced-motion visitors can inspect every state at their own pace with zero translation or 3D tilt.
- **Token-Level Compliance:** Just as in `packages/web/src/styles/index.css`, `.shimmer`, `.loading-sweep`, and `.loading-mark` disable keyframe loops automatically under `@media (prefers-reduced-motion: reduce)`.

### Accessibility Notes
- **AA/AAA Contrast Across Dark & Light Themes:** All ink tokens follow the cockpit's verified contrast matrix (`#EDEDED` and `#A1A1A1` on `#090909`/`#111111`; `#171717` and `#5C5C5C` on `#FAFAFA`/`#FFFFFF`), with `--pending-strong` used whenever amber appears as text.
- **Screen-Reader Clean Decorative Slashes:** Section eyebrows use `content: '//' / ''` so screen readers announce the heading cleanly without reading `"slash slash"`.
- **Keyboard-First Scrubbing & Navigation:** Every pinned scene and interactive switchboard supports `Tab`, `ArrowLeft`/`ArrowRight` (to step through task timeline frames), and `Space`/`Enter` (to toggle backends, preview automations, or trigger the review-gate merge demo). Interactive SVG schematics carry proper `role="region"`, `aria-label`, and hidden semantic `<ol>` equivalents for screen readers.

---

## 6. Technical Approach for a Plain Static Site (`site/`)

The brief requires `docs/landing-site/site/` to work as **plain static files**—opening `site/index.html` directly or serving the folder with no build step.

### Recommended Stack: **Zero-Dependency Vanilla HTML / CSS / ES Modules (No External CDN Required)**
While we could pull GSAP + ScrollTrigger from a CDN, a **pure vanilla implementation with a ~180-line custom `ScrollChoreographer` module + native CSS Custom Properties** is strongly preferred for OnniCode for four reasons:
1. **True Local-First & Offline Fidelity:** OnniCode's core identity is local-first with zero cloud dependencies. If a developer clones the repo and opens `docs/landing-site/site/index.html` on an airplane with no Wi-Fi, a CDN-dependent GSAP/Lenis page breaks completely. A zero-CDN architecture works offline 100% of the time.
2. **Native Scroll Feel (No Lenis Hijacking):** Developers and tech leads dislike scroll-jacking libraries that override native trackpad momentum, PageDown keys, or find-in-page (`Cmd+F`). Native browser scrolling paired with sticky stage containers (`position: sticky; top: 0; height: 100dvh`) gives silky native momentum while mapping scroll progress (`0.0 → 1.0`) directly to CSS variables.
3. **Architecture Breakdown (`docs/landing-site/site/`):**
   - `index.html`: Semantic HTML5 structure, inline SVG schematics (Signal Spine, 9-Backend patch cables, Worktree fork tree, Manager-Worker topology), and accessible step controls.
   - `styles/tokens.css`: Direct port of OnniCode's Mercato color, typography, radius (`4px/6px/8px/10px`), and `--ease-spring` `linear()` tokens from `packages/web/src/styles/index.css`, supporting both `:root` (dark `#090909`) and `.light` (`#FAFAFA`).
   - `styles/choreography.css`: Sticky stage layouts, 3D perspective transforms driven by `calc(var(--progress) * ...)`, cursor radial-gradient border masks, and `@media (prefers-reduced-motion: reduce)` overrides.
   - `scripts/choreographer.js`: Lightweight (~4 KB) vanilla ES module that:
     - Tracks active sections via `IntersectionObserver`.
     - Computes clamped section progress `p = clamp((scrollY - start) / distance, 0, 1)` inside a single passive scroll + `requestAnimationFrame` batch.
     - Updates `--p` on the active `<section>` and drives the deterministic SVG `stroke-dashoffset`, tabular counter interpolation, and timeline scrubber bar.
     - Powers interactive micro-demos (Backend 9-way patch switcher, Roster Fence `409` test button, Diff-First Review Gate latch, `onni automation check` preview toggle, and one-click CLI command copy).

*(Optional progressive enhancement: If the team desires CSS Scroll-Driven Animations where supported, `@supports (animation-timeline: view())` can handle simple progress bars directly on the compositor thread while `choreographer.js` drives the multi-step DOM telemetry counters and interactive scrubbers across all browsers.)*

---

## 7. Risks — What Could Make It Feel Cheap, and How to Avoid It

| Risk / "Cheap" Failure Mode | Why It Hurts OnniCode's Brand | Concrete Mitigation in Concept D |
| --- | --- | --- |
| **1. Generic "AI SaaS" Purple Glow & Glassmorphism Overload** | Heavy `blur(40px)` blobs and floating neon gradients make OnniCode look like a vaporware cloud wrapper—the exact opposite of a local, zero-telemetry instrument cockpit. | **Enforce the Mercato Surface Rule:** Zero ambient background blur blobs. Use crisp `#090909 / #111111 / #151515` flat surfaces separated by 1px `#242424` borders that catch sharp, localized specular light only along the 1px border stroke. |
| **2. Scroll-Jacking & Trackpad Drag (The "Heavy Marketing Page" Syndrome)** | Developers immediately close sites that hijack wheel events, lag behind trackpad velocity, or trap the user in a 6-screen-tall pinned section with no skip affordance. | **Native Sticky Scrubbing + Compact Pin Ratios:** Never intercept `wheel` or `touchmove`. Keep pinned scroll tracks tight (`150vh–200vh` max per pinned stage, never `400vh+`) and provide clickable step pills (`[01] [02] [03]`) inside every pinned stage so users can click-to-jump instantly. |
| **3. Fake or Hallucinated Telemetry / Toy Code Snippets** | Senior engineers spot `foo/bar` placeholder diffs and invented CLI flags in half a second, destroying technical credibility. | **Use Real Repository Artifacts:** Populate every cockpit twin with authentic OnniCode paths (`.ai/onni/worktrees/e489da51`, `branch onni/e489da51`), real CLI commands (`onni run`, `onni automation check <id>`, `ONNI_DRY_RUN=1 npm run dev`), real invariants (`409` roster fence, `push-guard`), and all nine real backends. |
| **4. Visual Noise When Everything Animates at Once** | If counters tick, borders shimmer, horizon clouds move, and cards slide simultaneously, the eye has no focal point and the frame rate drops. | **Single-Focal-Point Rule:** At any scroll position, only **one** primary kinetic element is in flight (followed by the Signal Spine). Surrounding reference chrome dims its border contrast to `#1B1B1B`, and continuous loops (`.shimmer`, radar sweeps) pause the instant a section leaves the central viewport band. |
| **5. Jittery Numbers & Layout Shifts During Live Stream Playback** | When token counters (`14,820 tok`) or timers (`00:04.2s`) change character widths during scroll playback, adjacent UI chips twitch horizontally. | **Strict Tabular Grid Discipline:** Apply `font-family: var(--mono); font-variant-numeric: tabular-nums` and fixed `min-width` slots (`ch` units) to every live counter, branch hash, and diff badge so text updates never trigger reflow. |
