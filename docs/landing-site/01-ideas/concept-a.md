# Concept Proposal A: Mission Control (The Telemetry Flight Deck)

- **Designer:** Agent Worker A (`eef668b1`)
- **Angle:** Mission Control / Flight Deck
- **Document Path:** `docs/landing-site/01-ideas/concept-a.md`
- **Target Audience:** Senior engineers, technical leads, and engineering directors using autonomous AI coding agents who demand control, multi-agent parallelism, auditability, and total data privacy.

---

## 1. Concept Name & Creative Thesis

### Concept Name
**"FLIGHT DECK: THE COLD-GLASS COCKPIT"** (Mission Control Architecture)

### Creative Thesis
Most AI developer landing pages suffer from the same decorative tropes: pastel mesh gradients, ambiguous glowing 3D spheres, and consumer-grade chatbot bubbles promising "magic" with zero operational transparency. **Flight Deck** rejects the chatbot toy aesthetic completely. It frames OnniCode through the lens of a mission-critical aerospace command center—the calm, focused hush of NASA’s Johnson Space Center or an air-traffic control tower during orbital insertion. 

The emotional posture is **unshakeable operational composure**: deep, near-black avionics glass (`#090909`), hairline instrument borders (`#242424`), and real-time telemetry readouts streaming steps, tokens, diffs, and tool calls over a zero-latency local WebSocket bus. You are not "chatting" with an assistant; you are the **Flight Director** sitting at the master console, directing a specialized fleet of autonomous agent probes (Claude Code, OpenAI Codex, Antigravity, Cursor) operating simultaneously in mathematically isolated git worktrees. Everything is measured, audited, and fenced. Nothing merges without your explicit command clearance.

---

## 2. Visual Language & Design System

The visual language translates the physical weight, hairline precision, and optical clarity of high-end avionics hardware into a modern, responsive web layout.

### 2.1 Color Palette (Hardware & Telemetry Ramp)

| Token Name | Hex Code | Role & Semantics | Contrast Ratio against `#090909` |
| :--- | :--- | :--- | :--- |
| `--surface-void` | `#090909` | Root viewport canvas; deep obsidian black absorbing ambient glare. | Base (1:1) |
| `--surface-bay` | `#111111` | Primary instrument consoles, module cards, telemetry bays. | 1.15:1 |
| `--surface-elevated`| `#151515` | Active tool cards, inspect panels, elevated sensor clusters. | 1.25:1 |
| `--border-hairline` | `#242424` | 1px precision laser-milled instrument borders and dividers. | 2.1:1 |
| `--ink-phosphor` | `#EDEDED` | Primary instrument readouts, headlines, active telemetry values. | 15.8:1 (AAA) |
| `--ink-muted` | `#A1A1A1` | Secondary telemetry labels, timestamps, metadata keys. | 8.4:1 (AAA) |
| `--ink-subtle` | `#8A8A8A` | Disabled channels, background grid coordinates, guide rulers. | 6.2:1 (AA) |
| `--accent-violet` | `#8F86E8` | Primary interactive vector, active tab indicator, focus lock. | 8.1:1 (AAA) |
| `--brand-lime` | `#B4F372` | Brand gradient start; active agent in flight, token generator pulse. | 14.2:1 (AAA) |
| `--brand-yellow` | `#EEFB63` | Brand gradient midpoint; attention alert, pending verification. | 16.5:1 (AAA) |
| `--telemetry-green` | `#10B981` | Clean git diff (`+add`), passed unit tests, clean merge clearance. | 7.9:1 (AA) |
| `--telemetry-amber` | `#FBBF24` | Review gate hold, fenced command notice, worker wait cadence. | 12.1:1 (AAA) |
| `--telemetry-red` | `#EF4444` | Deleted diff (`-del`), pre-push fence trigger, failed test run. | 4.8:1 (AA) |
| `--telemetry-cyan` | `#93C5FD` | Local WebSocket bus heartbeat, peer worker handoff stream. | 11.2:1 (AAA) |

### 2.2 Typography Pairing

1. **Display & Section Eyebrows: Chakra Petch (SemiBold 600, Uppercase)**
   - *Characteristics:* Chamfered technical corners that mirror hardware bezels and avionics engravings.
   - *Usage:* Brand mark, section indexes (`// 01 / FLEET DISPATCH`), primary telemetry metrics, and modal dialog titles. Tracked wide (`letter-spacing: +0.06em`).
2. **Body & Interface Text: Inter Variable (-0.011em tracking)**
   - *Characteristics:* Neutral, highly legible grotesque sans-serif with optimized tabular numbers and optical kerning.
   - *Usage:* Explanatory copy, feature descriptions, buttons, tooltips.
3. **Telemetry, Terminal & Code Diffs: JetBrains Mono Variable**
   - *Characteristics:* Crisp monospace with distinct character disambiguation (`0` vs `O`, `l` vs `1`), tight line-height, and `font-variant-numeric: tabular-nums`.
   - *Usage:* Real-time token streaming counters, git branch references (`onni/9c00ba46`), shell command traces, and line-by-line diff inspections.

### 2.3 Texture, Lighting & Surface Materials
- **Laser-Etched Orthographic Grid:** A subtle 32px × 32px coordinate grid rendered in hairline CSS SVG (`stroke: rgba(255, 255, 255, 0.03)`), crossed by dynamic hairline crosshairs at section intersections.
- **Micro-Raster CRT Scanline:** An ultra-faint 2px vertical raster overlay (`linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.22) 50%)`) at 3% opacity across terminal preview bays, giving stdout text authentic monitor phosphorescence without obscuring readability.
- **Focused Instrument Backlight:** Diffuse, low-spread backlights (`box-shadow: 0 0 32px rgba(143, 134, 232, 0.08)`) positioned strictly behind active interactive nodes, preventing messy ambient glare.
- **Pixel-Art Horizon Accent:** A discreet, stylized 16-bit atmospheric gradient line docked along the lower edge of key preview bays, directly referencing OnniCode's signature pixel-art scenery system.

### 2.4 Iconography & Imagery Style
- **Iconography:** Sharp 1.5px stroke monoline vector icons with 45-degree corner bevels. Avoid rounded, bubbly app icons; every glyph represents an actual physical switch, oscilloscope, terminal bus, or git tree node.
- **Imagery:** 100% vector diagrams, live interactive SVG worktree topographies, real code syntax highlighters (Shiki dark theme matching Onni’s terminal colors), and high-resolution simulated cockpit viewports. No fake 3D silicone hands or generic generative AI illustrations.

---

## 3. Page Structure & Section Choreography (8 Sections)

The page unfolds as an operational briefing, transitioning from executive fleet oversight down to granular git mechanics and air-gapped security.

```
+-------------------------------------------------------------------------+
| [00] AVIONICS STATUS BAR (Fixed): WS Active | Localhost:4321 | 0 Cloud  |
+-------------------------------------------------------------------------+
| [01] HERO: The Master Flight Deck (Interactive 3-Agent Worktree Bay)    |
+-------------------------------------------------------------------------+
| [02] MULTI-ENGINE HANGAR: 9 Agent Backends (Zero-Reconfiguration Rack)  |
+-------------------------------------------------------------------------+
| [03] WORKTREE HYPERVISOR: Ephemeral Git Isolation (Zero Staged Clobber) |
+-------------------------------------------------------------------------+
| [04] TELEMETRY RADAR: Live WebSocket Bus (Tokens, Tool Calls, Diffs)    |
+-------------------------------------------------------------------------+
| [05] ORCHESTRATION TACTICS: Manager-Worker Roster & Safety Rails        |
+-------------------------------------------------------------------------+
| [06] THE REVIEW GATE: Nothing Merges Itself (Diff-First Landing Bay)    |
+-------------------------------------------------------------------------+
| [07] THE AIR-GAPPED BUNKER: Zero Config, Zero Cloud, 100% Plain Files   |
+-------------------------------------------------------------------------+
| [08] FLIGHT DISPATCH: Assume Command (Native Desktop App & CLI Install) |
+-------------------------------------------------------------------------+
| [09] COCKPIT STATUS FOOTER: Build Info, MIT License, System Specs       |
+-------------------------------------------------------------------------+
```

---

### Section 01: The Master Flight Deck (Hero)
- **Purpose:** Instantly position OnniCode as an industrial-grade local command cockpit; demonstrate multi-agent concurrency and live telemetry within the first 5 seconds.
- **Headline Draft:** 
  `COMMAND THE FLEET FROM A LOCAL FLIGHT DECK.`
- **Subline Draft:** 
  `Run Claude Code, Codex, Antigravity, and Cursor in parallel git worktrees. Stream every token, tool call, and diff live over a local WebSocket bus. Zero cloud. Zero auto-merges.`
- **Layout Description:** 
  - **Left Bay (45%):** Mission header with live pulsing status badge (`SYS: READY // REPO: CONNECTED`), bold display title in Chakra Petch, dual CTAs (*"Download Desktop Cockpit"* and *"Copy CLI Command"*), and live metric chips (Localhost :4321, 0 Cloud Latency, 1 Worktree/Task).
  - **Right Bay (55%):** The **Flight Simulator Console**—an interactive multi-pane cockpit displaying 3 concurrent agent runs (Manager planning, Worker 1 refactoring TypeScript contracts, Worker 2 running Vitest suite) operating in real-time with synchronized telemetry meters.
- **Signature Effect / Animation:** 
  - *Console Initialization Sequence:* On page mount, a horizontal violet hairline radar beam sweeps down the console (800ms, `cubic-bezier(0.16, 1, 0.3, 1)`). Hairline borders fade in, terminal text types out in JetBrains Mono at 45 chars/sec, and token meters scrub upwards from `0` to `1,420 tok/s` with smooth inertial easing.

---

### Section 02: The Multi-Engine Hangar (Agent Backends)
- **Purpose:** Prove OnniCode is completely vendor-agnostic and unifies fragmented developer tools under one master interface.
- **Headline Draft:** 
  `9 AGENT ENGINES. ONE STANDARDIZED SEAM.`
- **Subline Draft:** 
  `Plug in Claude Code, OpenAI Codex, Antigravity, Cursor Agent, Pi, Copilot, Junie, or Cline. Switch models and harnesses per task with zero config files.`
- **Layout Description:** 
  - An avionics rack selector featuring 9 modular engine pods arranged horizontally. 
  - Clicking or hovering an engine pod locks the bay: the active pod illuminates with violet backlighting while the inspector display updates to show the engine's exact local CLI discovery path (`Discovered: /usr/local/bin/claude`), supported protocols (v1 AgentEvent, v2 UiEvent), and permission capabilities.
- **Signature Effect / Animation:** 
  - *Turbine Bay Spin-Up:* Selecting an engine triggers a 250ms mechanical slide-and-lock transition. The status LED flips from dim amber (`STANDBY`) to bright phosphor violet (`ARMED`), accompanied by a micro-shimmer line crossing the panel header.

---

### Section 03: The Worktree Hypervisor (Git Isolation)
- **Purpose:** Solve the greatest fear of coding-agent users—polluted working branches, clobbered unstaged changes, and git index locks.
- **Headline Draft:** 
  `EPHEMERAL WORKTREES. ZERO GIT CONFLICTS.`
- **Subline Draft:** 
  `Every task automatically spins up its own isolated worktree at .ai/onni/worktrees/<runId> on branch onni/<id8>. Four agents can refactor the same repository simultaneously without ever touching your working copy.`
- **Layout Description:** 
  - Interactive git topology radar. A central root trunk (`main` branch) radiates four clean, isolated orbital tracks. 
  - Each orbital track hosts an active task container with its own isolated directory path, HEAD commit hash, and real-time diff badge (`+84 / -12`). An animated visualization shows how agents operate in parallel and settle without colliding.
- **Signature Effect / Animation:** 
  - *Orbital Branch Splitting:* Scroll-triggered SVG path drawing. As the user enters the viewport, the central git branch divides into four glowing neon pathways (600ms, `cubic-bezier(0.25, 1, 0.5, 1)`). Data packets pulse along the curves at 2.4s intervals, showing files committing to isolated branches.

---

### Section 04: The Telemetry Matrix (Live Streaming)
- **Purpose:** Contrast OnniCode's radical transparency against opaque web chatbots that hide tool execution, subprocess calls, and cost.
- **Headline Draft:** 
  `RADAR-GRADE TELEMETRY. NO BLACK BOXES.`
- **Subline Draft:** 
  `Stream every execution step, shell tool call, token velocity, and diff hunk in real time over our unified WebSocket bus. Full audit trails written to plain NDJSON on disk.`
- **Layout Description:** 
  - A 4-panel flight telemetry instrument cluster:
    1. *Token & Cost Tachometer:* Real-time velocity gauge showing tokens/second and cumulative session expenditure.
    2. *Tool Execution Oscilloscope:* Chronological waterfall of subprocess calls (`git status`, `npm test`, `read_file`) with exact execution runtimes and process PIDs.
    3. *Live Diff Hunk Stream:* High-contrast code viewer displaying line additions and deletions as they are written by the agent.
    4. *Process Liveness Monitor:* Active PID watch and heartbeat pings preventing zombie subprocesses.
- **Signature Effect / Animation:** 
  - *Live Telemetry Pulse:* Monospace counters use custom requestAnimationFrame ticker physics to roll numbers up with inertia. Diff code lines flash soft green (`rgba(16, 185, 129, 0.25)`) on insertion and settle into crisp syntax colors over 350ms.

---

### Section 05: Orchestration Tactics (Manager-Worker Roster)
- **Purpose:** Showcase advanced autonomous engineering teams where a high-level manager agent plans and delegates work to specialized workers without risking runaway loops.
- **Headline Draft:** 
  `THE MANAGER PLANS. THE ROSTER EXECUTES.`
- **Subline Draft:** 
  `Dispatch multi-agent operations with strict ownership fences. A manager agent breaks architecture into modular units, assigns workers by file boundaries, and verifies every branch before landing.`
- **Layout Description:** 
  - Tactical command hierarchy diagram:
    - Root Node: Manager Agent (`claude-3-7-sonnet` planning tasks and inspecting repo).
    - Branch Dispatches: 3 Worker Nodes (`codex` refactoring API schemas, `antigravity` editing docs under strict allow-rules, `cursor` updating React UI).
    - Perimeter Boundaries: Highlighted visual "Fences" representing budget limits, dispatch depth caps, and the hard unattended pre-push fence.
- **Signature Effect / Animation:** 
  - *Fenced Perimeter Patrol:* A subtle scanning laser border sweeps the boundary of the worker cluster. When a simulated worker attempts an unauthorized `git push`, the perimeter flashes amber (`FENCE TRIPPED: Push Denied in Autonomous Mode`), demonstrating OnniCode's safety guarantees.

---

### Section 06: The Review Gate & Landing Bay (Human-in-the-Loop)
- **Purpose:** Deliver the core trust guarantee: OnniCode will never corrupt production code or push unreviewed changes to your remote repo.
- **Headline Draft:** 
  `NOTHING MERGES ITSELF. YOU HOLD THE LAUNCH KEY.`
- **Subline Draft:** 
  `When a run completes, its changes sit safely parked in its worktree. Inspect the full diff, review tests, and merge with an explicit click—or export cleanly to a GitHub draft PR.`
- **Layout Description:** 
  - An interactive "Landing Deck" featuring a side-by-side diff review workstation. 
  - Above the diff sits the **Clearance Interlock**: an aerospace-inspired physical authorization switch with three mutually exclusive actions:
    1. `Keep in Worktree` (Leave isolated for manual testing).
    2. `Export Draft PR` (Push cleanly via authenticated `gh` CLI).
    3. `Authorize Local Merge` (Explicit local fast-forward merge into main).
- **Signature Effect / Animation:** 
  - *Interlock Engage:* Clicking an action flips the clearance switch with a tactile 180ms spring animation (`cubic-bezier(0.34, 1.56, 0.64, 1)`). A verification laser line passes through the diff viewer, turning all staged changes to confirmed emerald green (`#10B981`).

---

### Section 07: The Air-Gapped Bunker (Local-First Architecture)
- **Purpose:** Overcome enterprise and security-conscious developer objections regarding cloud privacy, data leaks, and proprietary code training.
- **Headline Draft:** 
  `AIR-GAPPED BY DESIGN. ZERO CLOUD. ZERO TELEMETRY.`
- **Subline Draft:** 
  `No account. No remote database. No telemetry phone-homes. Your code, prompts, and run history remain exclusively on your local SSD in plain JSON and Markdown.`
- **Layout Description:** 
  - Four tactile diagnostic telemetry cards arranged in a 2x2 instrument panel:
    1. *Outbound Telemetry Ping:* Displays `0.00 KB/s` network transmission with an animated flatline oscilloscope.
    2. *Plain File Storage:* Interactive file tree preview showing `.ai/onni/config.json`, `runs/*.ndjson`, and `brief.md`—proving zero proprietary binary blobs.
    3. *Zero-Config Discovery Engine:* Live detection readout scanning local git environment, installed CLIs, and environment variables on boot.
    4. *Self-Healing Engine:* Illustrates how deleting `.ai/onni/` safely resets state without software crashes.
- **Signature Effect / Animation:** 
  - *Network Flatline Oscilloscope:* A continuous horizontal green canvas line pulses with a calm, flat cardiac rhythm, occasionally displaying a tiny local IPC blip between Hono server and Tauri frontend.

---

### Section 08: Flight Dispatch (Call to Action & Download)
- **Purpose:** Convert interest into immediate installation via native desktop package or direct developer CLI.
- **Headline Draft:** 
  `ASSUME COMMAND OF YOUR LOCAL FLEET.`
- **Subline Draft:** 
  `Download the native desktop cockpit powered by Tauri 2, or launch workflows directly from your terminal. Open source under the MIT license.`
- **Layout Description:** 
  - Dual launch modules:
    - **Module A (Desktop Cockpit):** Primary download button with automatic OS detection (Windows MSI/NSIS, macOS DMG, Linux AppImage), installer checksums, and version tags.
    - **Module B (Headless CLI):** Monospace terminal block containing `npm install -g @onni/work` and `onni run --workflow review.yaml`, accompanied by a one-click copy button and quick-start flags (`ONNI_DRY_RUN=1`).
- **Signature Effect / Animation:** 
  - *Terminal Copy Confirmation:* Clicking the CLI copy trigger triggers a high-speed phosphor flash across the code block, momentarily turning borders bright violet (`#8F86E8`) and updating the copy chip to `// CLIPPED TO CLIPBOARD // FLIGHT READY`.

---

## 4. Hero Section in Exhaustive Detail

The Hero is the critical anchor of the site. It must convince a discerning developer within 3 seconds that OnniCode is an authentic, hyper-capable local system.

```
+-------------------------------------------------------------------------------------------------------+
|  // ONNICODE AVIONICS V1.0         WS://127.0.0.1:4321 [CONNECTED]        ZERO-CLOUD TELEMETRY: ACTIVE |
+-------------------------------------------------------------------------------------------------------+
|                                                   |                                                   |
|  // 00 / COMMAND PROTOCOL                         |  +-- COCKPIT FLIGHT SIMULATOR (LIVE BUS) -------+ |
|                                                   |  | [BAY-1: CLAUDE] [BAY-2: CODEX] [BAY-3: AGY]  | |
|  COMMAND THE FLEET FROM                           |  +----------------------------------------------+ |
|  A LOCAL FLIGHT DECK.                             |  | > onni run refactor-auth.yaml                | |
|                                                   |  | * Worktree: .ai/onni/worktrees/eef668b1      | |
|  Run Claude Code, Codex, Antigravity, and Cursor  |  | * Branch:   onni/eef668b1 (isolated)         | |
|  in parallel git worktrees. Stream every token,   |  | * Telemetry: 142 tok/s | Cost: $0.00 (Local) | |
|  tool call, and diff live over a local bus.       |  | * Diff:     +184 lines / -42 lines           | |
|                                                   |  |                                              | |
|  [ DOWNLOAD DESKTOP COCKPIT ]  [ COPY CLI RUN ]   |  |  auth_middleware.ts:                         | |
|                                                   |  |  + export function verifyToken(req: Request) | |
|  -----------------------------------------------  |  |  - export function oldAuthCheck(req: any)    | |
|  LOC: 127.0.0.1:4321 | LATENCY: 0ms | DISPATCH: OK |  +----------------------------------------------+ |
+-------------------------------------------------------------------------------------------------------+
```

### 4.1 The First 3 Seconds of Motion (Frame-by-Frame Choreography)

- **0.00s – 0.35s (Avionics Cold Boot):**
  - Viewport initializes in deep obsidian black (`#090909`).
  - An orthographic 32px coordinate grid fades into 3% opacity (`opacity: 0 -> 0.03`).
  - Corner coordinate markers `[LAT: 00.00 // LNG: 00.00]` appear in muted monospace at the four viewport edges.
- **0.35s – 0.85s (Laser Framing & Wireframe Lock):**
  - A horizontal violet laser line (`1px solid #8F86E8`, with a soft 8px bloom) sweeps downward from viewport top to bottom (500ms, `cubic-bezier(0.16, 1, 0.3, 1)`).
  - As the beam passes, hairline panel borders (`#242424`) snap into place with a subtle mechanical lock sound aesthetic.
  - The top fixed status bar illuminates: `WS BUS: CONNECTED (127.0.0.1:4321)`.
- **0.85s – 1.60s (Monolithic Typography Strike):**
  - The headline `COMMAND THE FLEET FROM A LOCAL FLIGHT DECK` is unveiled using a high-precision vertical clip-path reveal (`clip-path: polygon(0 100%, 100% 100%, 100% 100%, 0 100%) -> polygon(0 0, 100% 0, 100% 100%, 0 100%)`).
  - Duration: 650ms, ease: `cubic-bezier(0.16, 1, 0.3, 1)`.
  - Subline and action buttons stagger in 120ms later with a smooth 8px upward translation.
- **1.60s – 3.00s (Cockpit Flight Simulator Activation):**
  - The right-hand console bay powers up. Three agent status tiles flash sequentially (`CLAUDE-CODE`, `CODEX`, `ANTIGRAVITY`).
  - A synthetic task command types into the simulated prompt bar: `onni run --workflow refactor-auth.yaml`.
  - Three orbital worktree branches animate into existence; token velocity dials spin up to `142 tok/s`; the diff viewer begins streaming synchronized green (`+`) and red (`-`) code modifications.

### 4.2 Scroll Behaviour & Parallax Mechanics
- **Sticky Avionics HUD:** The top status bar stays pinned to the top of the viewport. As the user scrolls, a hairline progress gauge tracks page depth as "ORBITAL ALTITUDE" (0% at hero to 100% at footer).
- **Sub-Surface Coordinate Parallax:** The background orthographic coordinate grid translates on the Y-axis at 0.12x scroll velocity, creating subtle structural depth beneath the solid console bays without causing disorientation.
- **Inertial Panel Snapping:** Using smooth momentum scrolling (Lenis), cards glide with weight and come to rest with zero jitter.

### 4.3 The One Signature "WOW" Moment: The Interactive Worktree Split-Screen
In the center of the hero console sits the **"Omni-Worktree Reticle"**. 
Visitors can drag a vertical interactive laser slider across three concurrent agent bays:
- **Position A (Left):** Reveals **Claude Code** refactoring backend Hono API routes with live tool call streaming.
- **Position B (Center):** Reveals **Antigravity** executing strict allow-rule verification with automated parent-child reports.
- **Position C (Right):** Reveals **Codex** generating comprehensive Vitest test suites.

As the user slides the control, the audio-visual feedback is instantaneous: active agent telemetry metrics crossfade smoothly, the underlying git worktree branch path highlights on an orbital map, and the live diff inspector instantly switches file contexts in 60fps real-time. This proves immediately and interactively that OnniCode runs multi-agent swarms in completely isolated parallel environments.

---

## 5. Motion Principles, Performance Budget & Accessibility

### 5.1 Motion Principles (The 4 Avionics Laws)

1. **Mechanical Decisiveness (No Cartoon Rubber Bands):**
   Avionics instruments do not wobble, bounce, or exhibit whimsical elastic stretching. Entrances accelerate swiftly and brake firmly. Transitions use our calibrated easing curve:
   ```css
   --ease-cockpit: cubic-bezier(0.16, 1, 0.3, 1);
   --ease-spring-lock: cubic-bezier(0.34, 1.56, 0.64, 1); /* Reserved solely for physical toggle switches */
   ```
2. **Telemetry-Driven Cadence:**
   Animation durations directly correspond to simulated information bandwidth. Token counters update at 30ms-50ms increments; terminal stdout lines appear at 25ms staggers; section cards reveal in rapid 60ms ripples.
3. **State-Informative Motion Only:**
   Zero animations exist purely for ornament. Motion is deployed strictly to signal:
   - Channel state transitions (`STANDBY -> ARMED -> DISPATCHED`).
   - Boundary enforcement (laser scanline flashing on fence violation).
   - Data transmission (pulse packets traveling along git worktree branches).
4. **Hardware-Accelerated Isolation:**
   All animated properties are strictly constrained to `transform`, `opacity`, and `clip-path`. Layout-triggering properties (`width`, `height`, `margin`, `padding`, `top`, `left`) are strictly forbidden during runtime transitions.

### 5.2 Performance Budget
- **Total Initial Page Weight:** < 140 KB (gzipped, excluding fonts).
- **Font Assets:** Max 45 KB woff2 (subset latin & latin-ext for Chakra Petch, Inter, JetBrains Mono).
- **Frame Rate Target:** Rock-solid 60 FPS / 120 FPS on Apple Silicon and modern desktop GPUs.
- **DOM Node Count:** < 850 total elements.
- **No Heavy 3D Frameworks:** Zero Three.js or heavy WebGL dependencies; all visual effects are achieved via optimized 2D canvas routines and pure SVG vector geometry.

### 5.3 Reduced-Motion Fallback (`prefers-reduced-motion: reduce`)
For users with vestibular motion sensitivities or those who prefer static presentations:
```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .scanline-overlay, .laser-sweep, .radar-pulse {
    display: none !important;
  }
  .telemetry-counter {
    /* Immediately display final static metrics */
    opacity: 1 !important;
  }
}
```
All dynamic typing effects are bypassed; full terminal text and final diffs are painted immediately on mount.

### 5.4 Accessibility (a11y) Architecture
- **Contrast Ratios:** Every text and data token strictly adheres to WCAG 2.1 AA standards (minimum 4.5:1 for body copy; primary phosphor text `#EDEDED` achieves 15.8:1 AAA contrast on `#090909`).
- **Semantic Landmark Hierarchy:** Proper HTML5 landmark structure (`<header>`, `<nav>`, `<main>`, `<section aria-labelledby="…">`, `<footer>`).
- **Screen Reader Data Labels:** All live-updating telemetry streams and monospace metric meters are wrapped with accessible descriptions:
  ```html
  <div class="telemetry-node" role="status" aria-live="polite">
    <span class="sr-only">Active Token Velocity:</span>
    <span aria-hidden="true" class="mono-val">142 tok/s</span>
  </div>
  ```
- **Visible Keyboard Navigation:** Complete keyboard focus management using a high-contrast violet outline ring (`outline: 2px solid #8F86E8; outline-offset: 2px;`) across all interactive switches, tabs, and buttons.

---

## 6. Technical Implementation for Plain Static Site

The website must be delivered as clean, plain static files (`site/index.html`, `site/styles.css`, `site/main.js`) capable of opening directly in any browser (`file://`) or being served by any minimal HTTP daemon with zero build steps or bundlers.

### 6.1 Recommended Architectural Stack

1. **HTML5 Semantic Core (`site/index.html`):**
   - Clean, valid HTML5 with zero framework overhead.
   - Built-in SVG sprite symbols for hardware glyphs and icons.
2. **Modern CSS Architecture (`site/styles.css`):**
   - Native CSS variables (`:root`) mirroring OnniCode's exact design system tokens.
   - CSS Grid and Flexbox for rock-solid responsive instrument layouts.
   - Hardware-accelerated CSS animations (`@keyframes`) for ambient sweeps, pulses, and scanlines.
3. **Vanilla JavaScript Modular Engine (`site/main.js`):**
   - High-performance, lightweight event delegates.
   - Custom `requestAnimationFrame` ticker for smooth numeric roll-ups.
   - IntersectionObserver API for scroll-triggered section initializations.

### 6.2 Optional CDN Enhancements (and Why We Choose Them)

| Library | Distribution | Weight | Justification |
| :--- | :--- | :--- | :--- |
| **GSAP 3.12** | CDN (`cdn.jsdelivr.net`) | ~58 KB | The undisputed industry standard for timeline-orchestrated animations, precise SVG path morphing, and complex sequencing. Eliminates timing glitches and callback hell in vanilla JS. |
| **Lenis Scroll** | CDN (`cdn.jsdelivr.net`) | ~12 KB | Provides silky, high-end inertial scrolling that gives the page an architectural, luxury feel without hijacking native keyboard controls or breaking accessibility. |
| **Shiki (Optional or Pre-rendered)** | Pre-rendered HTML | 0 KB runtime | Pre-generating syntax-highlighted code blocks directly into HTML templates avoids multi-megabyte client-side bundle downloads while delivering terminal-accurate colors. |

### 6.3 Why We Explicitly Reject Three.js / Heavy WebGL
While a 3D rotating spaceship or spinning wireframe globe might seem tempting for a "Mission Control" theme, it directly undermines OnniCode's brand promises:
- **Performance:** Three.js adds 600KB+ of JavaScript, consumes significant battery, and drops frames on integrated laptop GPUs.
- **Product Truth:** OnniCode is an ultra-fast, local-first coding cockpit. A developer reading about local performance will immediately recognize a sluggish WebGL canvas as bloat.
- **Aesthetic Precision:** Crisp 1px SVG lines, sharp monospace typography, and responsive 2D canvas radar displays look significantly sharper and more authentic to real software engineering than generic 3D meshes.

---

## 7. Risks, Pitfalls & How to Avoid Making It Feel Cheap

| Risk | What Makes It Feel Cheap | Concrete Architectural Fix in Concept A |
| :--- | :--- | :--- |
| **The "Cheesy Hacker Matrix" Trap** | Overusing neon green terminal text, falling digital rain, fake skull graphics, or Hollywood "ACCESS GRANTED" popups. | **Strict Swiss-Avionics Restraint:** Use cool neutral phosphor `#EDEDED` as the dominant ink; limit green strictly to semantic git diff additions (`#10B981`); employ professional, restrained layout geometry influenced by aerospace flight software and Stripe/Linear precision. |
| **Sluggish "Animation Hostage" UI** | Forcing visitors to sit through 4-second loading splash screens or unskippable letter-by-letter typing animations before they can read the headline. | **Zero Content Gating:** All essential headlines and CTAs are rendered instantly or within 400ms. Animation runs as an ambient accompaniment, never a modal barrier. Every interactive switch responds within 16ms of user interaction. |
| **Disneyland "Fake Feature" Fluff** | Showing fabricated UI cards with buzzwords like "Autonomous Quantum Reasoning" or inventing nonexistent cloud features. | **100% Product Fidelity:** Every metric, diagram, and code snippet mirrors the actual OnniCode repository: worktree paths (`.ai/onni/worktrees/<id>`), branch nomenclature (`onni/<id8>`), exact runner names (`claude`, `codex`, `antigravity`), and authentic configuration parameters (`ONNI_DRY_RUN=1`). |
| **Visual Clutter & Cognitive Overload** | Cramming hundreds of tiny flashing gauges, blinking dots, and conflicting borders onto the screen until it looks like an unreadable mess. | **Strict Visual Hierarchy:** Use deep `#090909` negative space; cards are delineated by subtle 1px `#242424` borders rather than heavy contrast boxes; secondary telemetry is tucked into quiet 11px monospace badges; main headlines remain massive, bold, and instantly scannable. |

---

## 8. Summary & Transition to Mockup Phase

Concept A (**Flight Deck: The Cold-Glass Cockpit**) presents OnniCode as the definitive master command station for modern autonomous agent engineering. By anchoring the creative identity in aerospace telemetry, ephemeral git worktree isolation, and zero-compromise local privacy, it directly addresses the desires and hesitations of elite software engineers.

- **Next Step:** Proceed to visual sketching and mockup generation in `docs/landing-site/03-mockups/`, prototyping the master hero console, orbital worktree radar, and clearance interlock switch.
