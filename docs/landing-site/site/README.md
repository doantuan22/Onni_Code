# OnniCode Landing Site — Foundation & Section Author Contract

A plain static site (`docs/landing-site/site/`) implementing the **"Parallel Light"** creative direction ([`../02-concept.md`](../02-concept.md)) and product brief ([`../00-brief.md`](../00-brief.md)).

- **No build step, no npm, no CDN.**
- **Works directly from `file://`** (double-click `index.html`) or from any static file server.
- **Readable without JavaScript:** `[data-reveal]` elements stay at `opacity: 1` unless `html.js-ready` is set by `choreographer.js`.

---

## 1. How to Open or Serve

### Option A — Direct `file://`
Open `docs/landing-site/site/index.html` directly in any modern browser. All fonts, brand marks, and pixel-art scenery use relative paths (`assets/...` and `../assets/...`).

### Option B — Any local static server
```bash
# Python
python -m http.server 8080 --directory docs/landing-site/site

# Node (npx serve)
npx serve docs/landing-site/site
```

---

## 2. File Map

```text
docs/landing-site/site/
├── index.html                 # Semantic skeleton: sticky nav (#0), 9 sections (#hero..#launch), footer, .spine
├── README.md                  # This contract for section authors
├── styles/
│   ├── tokens.css             # @font-face (Chakra Petch 600, Inter Variable, JetBrains Mono Variable),
│   │                          # :root dark tokens, [data-theme="light"] daylight tokens, clamp() type,
│   │                          # spacing scale, tight radii, durations (120/180/250/400/600ms), easings
│   ├── base.css               # Reset, body type, .container (1200px), 2px violet focus ring, .eyebrow,
│   │                          # .hairline-card (--mx/--my radial border), film grain overlay, .mono,
│   │                          # .btn-primary/.btn-ghost, .chip, .led--done/pending/review/failed,
│   │                          # .spine, .reveal/.is-in, .stage/.stage__sticky, prefers-reduced-motion
│   └── sections.css           # Shared stylesheet where section authors add section-specific rules
├── scripts/
│   └── choreographer.js       # Zero-dep ES module: reveal observer, single-rAF stage progress (--p),
│                              # pointer tracker (--mx/--my), ResizeObserver layout cache, theme toggle
└── assets/                    # Pre-populated (do not modify)
    ├── brand/                 # icon.svg, onni-lockup.svg, onni-mark*.svg, logo.png
    ├── fonts/                 # chakra-petch-latin-600, inter-(latin|latin-ext|vietnamese), jetbrains-mono-latin
    └── scenery/               # 320x180 pixel-art PNG pairs (*-dark.png / *-light.png, e.g. vn-halong-dark.png)
```

---

## 3. Section IDs & Structure (`index.html`)

`<header class="site-header">` is Section `0` (sticky 56px navigation). `<main>` contains the nine numbered `<section>` shells:

| Index | `<section id="...">` | Eyebrow | Headline | Mode |
| --- | --- | --- | --- | --- |
| `00` | `<header class="site-header">` | — | `onni` · Worktrees · Live · Orchestration · Local · lamp toggle · Try offline | Sticky 56px |
| `01` | `#hero` | `01` | **One repository. Room for many agents.** | Pinned stage (`data-stage data-steps="4"`) |
| `02` | `#backends` | `02` | **Bring the agents you already use.** | Standard flow |
| `03` | `#worktrees` | `03` | **Every task gets its own worktree.** | Standard flow (or scroll-linked SVG) |
| `04` | `#live` | `04` | **See the work while it happens.** | Pinned stage (`data-stage data-steps="4"`) |
| `05` | `#orchestration` | `05` | **One manager. A fenced roster of workers.** | Standard flow |
| `06` | `#gate` | `06` | **Nothing merges itself.** | Interactive human merge gate |
| `07` | `#automations` | `07` | **Work that starts on its own — and still waits for you.** | Standard flow |
| `08` | `#local` | `08` | **No account. No cloud. Just files on your machine.** | Standard flow |
| `09` | `#launch` | `09` | **Sit down at the cockpit.** | Standard flow + copyable CLI |

---

## 4. CSS Variable & Data-Attribute Contract for Section Authors

### 4.1 One-Shot Entrance Reveal (`data-reveal` / `.reveal` → `.is-in`)
- Add `data-reveal` (or class `.reveal`) to any element that should fade and rise `14px` on first viewport entry.
- Optional stagger: set inline `style="--reveal-delay: 120ms"` (use multiples of `60ms` or `120ms`).
- `choreographer.js` observes `[data-reveal], .reveal` and adds `.is-in` once.
- When JS is off or `prefers-reduced-motion: reduce` is active, `[data-reveal]` renders immediately at `opacity: 1; transform: none`.

### 4.2 Scroll-Linked Pinned Stages (`data-stage`, `data-steps="N"`, `--p`, `data-step`)
- Mark a pinned section with `class="stage" data-stage` and optional `style="--stage-h: 145vh"` (keep `<= 150vh`).
- Place sticky viewport content inside `<div class="stage__sticky">`.
- On scroll, `choreographer.js` computes:
  ```js
  p = clamp((scrollY - start) / (height - innerHeight), 0, 1)
  ```
  using **one** passive `scroll` listener and **one** `requestAnimationFrame` that sleeps when idle.
- **Written to the `[data-stage]` element:**
  - `--p`: float string in `[0, 1]` (e.g. `0.425`). Bind CSS transforms/opacities/stroke-dashoffset to `var(--p)`.
  - If `data-steps="N"` is set on the stage:
    - `data-step`: integer string `"0"` through `"N-1"` (`Math.min(N - 1, Math.floor(p * N))`).
    - `--step`: integer CSS custom property `0` through `N - 1`.
    - Any button with `data-step-target="k"` inside the stage gets `aria-current="true"` when `k === step`, and clicking it scrolls smoothly to step `k`.
- **DOM CustomEvent (`stage:progress`):**
  - Dispatched on the `[data-stage]` element whenever `p` or `step` changes:
    ```js
    stageEl.addEventListener('stage:progress', (e) => {
      const { p, step } = e.detail; // p: number in [0, 1], step: integer 0..N-1
    });
    ```
- **Reduced motion:** `choreographer.js` sets `--p: 1` (and final `step`), and `base.css` collapses `.stage` / `.stage__sticky` to normal static flow.

### 4.3 Cursor-Lit Hairline Cards (`.hairline-card`, `--mx`, `--my`)
- Add `.hairline-card` (or `.hairline-card.hairline-card--surface-2`) to any console, tile, or panel.
- `choreographer.js` tracks `pointermove` and writes `--mx` and `--my` (in `px` relative to the card's top-left corner).
- `base.css` renders a `1px` radial violet specular border mask around `var(--mx) var(--my)` on hover/focus-within.

### 4.4 Theme Toggle & Pixel Scenery (`data-theme`, `data-theme-toggle`, `img[data-scene]`)
- `document.documentElement.dataset.theme` is `"dark"` (default) or `"light"`.
- Clicking any `[data-theme-toggle]` button flips `data-theme` between `"dark"` and `"light"`, persists to `localStorage` (`onni-landing-theme`), updates `<meta name="theme-color">`, and toggles `aria-pressed`.
- Any `<img data-scene="..." src="assets/scenery/foo-dark.png">` automatically has its `src` swapped between `-dark.png` and `-light.png` (or explicit `data-src-dark` / `data-src-light` attributes if provided).

### 4.5 Page-Level Scroll Variables
- `--page-p` (`0` to `1`) is written on `document.documentElement` to drive `.site-header__progress`.
- `.site-header` receives `data-scrolled="true"` and `.is-scrolled` once `scrollY > 80`.

---

## 5. Design Tokens Quick Reference (`styles/tokens.css`)

| Category | CSS Custom Properties |
| --- | --- |
| Surfaces | `--background` (`--canvas`), `--card` (`--surface-1`), `--card-2` (`--surface-2`), `--sidebar`, `--muted` |
| Hairline & Ink | `--border` (`--hairline`), `--foreground` (`--ink`), `--muted-foreground` (`--ink-muted`), `--soft-foreground` (`--ink-soft`) |
| Signal & Ignition | `--violet` (`--primary`, `--signal`), `--violet-foreground`, `--violet-glow`, `--violet-wash`, `--grad` (`--ignition`) |
| Status | `--done` (`--success`), `--pending`, `--pending-strong`, `--review` (`--info`), `--failed` (`--danger`), `--conflict` |
| Atmosphere | `--lamp-warmth`, `--lamp-gradient` |
| Fonts | `--sans`, `--mono`, `--brand` |
| Type Scale | `--text-xs`, `--text-sm`, `--text-base`, `--text-body`, `--text-lead`, `--text-lg`, `--text-xl`, `--text-2xl`, `--text-3xl`, `--text-display` |
| Durations | `--duration-micro` (`120ms`), `--duration-fast` (`180ms`), `--duration-base` (`250ms`), `--duration-slow` (`400ms`), `--duration-dramatic` (`600ms`) |
| Easings | `--ease-out`, `--ease-in-out`, `--ease-spring` (with `linear()` overshoot spring) |
| Radii | `--radius-xs` (`2px`), `--radius-sm` (`4px`), `--radius` (`6px`), `--radius-lg` (`8px`), `--radius-xl` (`10px`), `--radius-2xl` (`16px`) |
