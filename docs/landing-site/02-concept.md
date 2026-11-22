# 02 — Merged creative direction: "Parallel Light"

Synthesis of the four proposals in `01-ideas/`:
A *Flight Deck* (mission control), B *The Quiet Studio* (calm craft), C *Parallel Worlds* (lanes of light),
D *The Living Bus* (motion-first scroll story).

## What we keep from each

| From | Kept | Dropped (and why) |
| --- | --- | --- |
| A Flight Deck | instrument precision, hairline consoles, tabular telemetry, live cockpit "twin" in the hero | CRT scanlines, uppercase shouting, "0ms latency / LAT-LNG" decoration, Lenis scroll-jacking, invented stats (`tok/s`) — they read as cheap sci-fi |
| B Quiet Studio | warmth and restraint, film grain, single-lamp lighting, pixel-art window/horizon, the Night / Daylight lamp toggle, "nothing phones home" tone | "wooden trays" wording (too literal); header blur everywhere |
| C Parallel Worlds | the core metaphor: **each task is a lane of light**; branches **wait at a gap** and converge **only when the visitor clicks** — the wow moment; honest "illustration only" labels; motion explains state | — |
| D Living Bus | **the Signal Spine**: one 1px violet filament running the whole page, forking and rejoining; scroll as a deterministic playhead in a few pinned stages; cursor-lit hairline borders; one shared timing vocabulary from the cockpit tokens; zero-dependency `choreographer.js` | 220vh+ pins (too long), 3D "X-ray explosion" in the hero (too much at once) |

## Thesis

> **One repository. Many lanes of light. Nothing lands without you.**

The page is a dark, quiet instrument room. A single violet filament — the Signal Spine, OnniCode's live bus —
starts at the task prompt in the hero, forks into parallel worktree lanes, carries live evidence
(steps, tool calls, tokens, diffs) down the page, stops at the review gate, and only rejoins into one
line when the visitor clicks *Merge*. Calm, precise, crafted; premium through restraint, typography and
perfectly timed light — never through neon fog.

Emotional arc: **calm → possibility (fan-out) → clarity (live evidence) → control (your click) → trust (local)**.

## Visual system

**Color** (cockpit tokens, dark-first):

| Role | Hex |
| --- | --- |
| Canvas | `#090909` |
| Surface 1 / 2 | `#111111` / `#151515` |
| Hairline | `#242424` (lit to violet near the cursor) |
| Ink / muted / soft | `#EDEDED` / `#A1A1A1` / `#8A8A8A` |
| Signal violet (the spine, focus, CTAs) | `#8F86E8` |
| Ignition gradient (≤ 3 uses on the page: hero beam, merge flash, final CTA edge) | `#B4F372 → #EEFB63 → #BC9AFF` |
| Status | done `#10B981`, pending `#FBBF24`, review `#93C5FD`, failed `#EF4444` |
| Lamp warmth (radial wash behind focal frames only) | `rgba(251,191,36,0.06)` |
| Daylight theme | `#FAFAFA` bg, `#FFFFFF` card, `#171717` ink, `#6D5FD6` violet, `#E4E4E4` hairline |

**Type:** Chakra Petch 600 for the wordmark, section indices (`01`–`09`) and small labels;
Inter (variable) for headlines (-0.025em, `clamp(2.4rem, 5vw, 4.5rem)`) and body (17px / 1.6);
JetBrains Mono with tabular numbers for paths, branches, counters, code. Sentence case — no all-caps headlines.

**Light & texture:** matte black with 2–3% static film grain; one lamp-like radial light per section;
surfaces separated by 1px hairlines and luminance steps, not blur or heavy shadows; hairlines catch a
violet specular glint around the cursor. Pixel-art night horizon (crisp, `image-rendering: pixelated`)
appears in the hero window and returns, dawn-lit, at the end.

**Imagery:** DOM/SVG "cockpit twins" built from real product vocabulary (real backend names, real paths
`.ai/onni/worktrees/<runId>`, branch `onni/<id8>`, real commands `onni run`, `ONNI_DRY_RUN=1 npm run dev`).
Examples are labelled as illustrations. No stock photos, robots, glowing brains, fake metrics.

## Page structure

| # | Section | Headline (draft) | Signature motion |
| --- | --- | --- | --- |
| 0 | Nav (sticky, 56px) | `onni` wordmark · Worktrees · Live · Orchestration · Local · lamp toggle · "Try offline" | becomes opaque after 80px; 1px spine-colored progress hairline along its bottom |
| 1 | Hero | **One repository. Room for many agents.** — *A local cockpit for AI coding agents. Every task in its own git worktree, streamed live, merged only by you.* | 3-second boot (below); cockpit twin tilted `rotateX(12deg)` flattens on scroll (pinned ~140vh); spine leaves the Run button and forks into 3 lanes |
| 2 | Backends + workflow | **Bring the agents you already use.** — the nine backends + a YAML workflow | 3×3 tile grid; on entry a "discovery sweep" blinks each LED amber → green (60ms cascade); hovering a tile swaps the mono command preview (`claude`, `codex`, `agy`…) |
| 3 | Worktrees | **Every task gets its own worktree.** | scroll-linked fork: trunk `main` splits into 3 lanes (`stroke-dashoffset` tied to progress), worktree cards slide out along them, path + branch label in mono |
| 4 | Live evidence | **See the work while it happens.** | pinned ~150vh: scroll scrubs a recorded run — step rows, tool-call pills, tabular token/cost counters, diff lines typing; scroll back rewinds |
| 5 | Manager / workers | **One manager. A fenced roster of workers.** | manager node sends 3–4 packets down to workers (staggered 120ms); a packet to an unlisted worker bounces off the roster fence (amber); green reports flow back up |
| 6 | Review gate — **the wow** | **Nothing merges itself.** | lanes arrive and stop at a visible gap; panel shows the diff + `Open draft PR` / `Merge`; clicking *Merge* converges the lanes into one line (600ms), one ignition flash, a "Your decision" marker remains. Labelled "illustration — no repository action". |
| 7 | Automations | **Work that starts on its own — and still waits for you.** | three trigger lanes (GitHub poll, Jira/Linear event, schedule) pulse into one `task` card that mints a new lane |
| 8 | Local-first, zero config | **No account. No cloud. Just files on your machine.** | layered planes peel apart on scroll: cockpit UI → `/api/v1` contract → plain JSON/NDJSON/MD files; a dotted boundary traces "your machine" around it |
| 9 | Launch | **Sit down at the cockpit.** | desktop app + CLI cards, copyable `ONNI_DRY_RUN=1 npm run dev` (copy → emerald check + 2-line boot log), pixel horizon brightens to dawn; footer: MIT · fork of cezar · no telemetry |

CTAs only point to anchors and copyable commands — no external URL is confirmed yet.

## Hero, in detail

- **0–0.4s** canvas `#090909`; the `onni` mark breathes in; a 1px violet bar crosses a hairline (mirrors the real cockpit boot splash).
- **0.4–1.1s** grid hairlines draw out from center; the tilted cockpit twin rises 24px; pixel-art night horizon fades into its window.
- **1.1–2.2s** headline lines stagger in (`translateY(14px)→0`, 120ms stagger); inside the twin, a prompt types itself (*"Split the settings page into tabs and add tests"*), backend chip settles on a roster.
- **2.2–3.0s** status dot turns green, worktree badge prints `.ai/onni/worktrees/3f2a91c4 · onni/3f2a91c4`, the spine emits its first downward pulse. Then everything rests.
- **Scroll (pinned)**: twin flattens to 0deg/scale 1, headline dims, the task splits into Manager + 3 worker rows; at the end the spine exits the twin and continues into section 2.

## Motion rules

1. **Motion explains state** — separation, progress, waiting, a chosen merge. Nothing decorative loops forever.
2. **One focal movement per viewport**; reading text never moves while being read.
3. **Scroll is a playhead** (reversible) inside ≤ 3 pinned stages, each ≤ 150vh, each with step pills to jump. Native scrolling — no wheel hijack, no smooth-scroll library.
4. **One vocabulary**: 120 / 180 / 250 / 400 / 600ms; `--ease-out: cubic-bezier(0.16,1,0.3,1)`, `--ease-in-out: cubic-bezier(0.65,0,0.35,1)`, a `linear()` spring for latches.
5. **The decision is human** — convergence happens only on the visitor's click.

**Performance:** only `transform`, `opacity`, `clip-path`, `stroke-dashoffset`; one rAF loop that sleeps when idle;
IntersectionObserver pauses off-screen work; < 350 KB total; fonts self-hosted woff2 with system fallbacks.
**Reduced motion:** pins collapse to normal flow, every scene renders in its settled state with step tabs; no parallax, no typing.
**Accessibility:** WCAG AA contrast in both themes, semantic headings, real `<button>`s with visible violet focus rings,
SVG diagrams with `aria-label` + a hidden text equivalent, works without JS (all content readable).

## Tech

Plain static site in `site/`: `index.html`, `styles/tokens.css`, `styles/site.css`, `scripts/choreographer.js`
(section progress → CSS vars `--p`), `scripts/demos.js` (lamp toggle, backend switch, review-gate merge, copy),
`assets/` (logo, pixel horizon PNGs, fonts). Zero dependencies, no CDN, opens from `file://`.

## Mockup brief (for round 1)

Every mockup: dark theme `#090909`, 1440px-wide desktop frame (plus selected 390px mobile frames), the exact
palette/type above, sentence-case headlines from the table, the violet Signal Spine visible as the connecting
thread between sections, real product vocabulary only, generous whitespace, no stock imagery.
