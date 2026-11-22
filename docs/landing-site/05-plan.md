# 05 — Implementation plan

Round 2 is built as HTML prototypes directly in `site/` (image quota exhausted; owner's instruction).
Binding inputs: `02-concept.md` (direction), `04-review.md` (fixes G1–G7 + per-section list),
`site/README.md` (foundation contract).

## Phases

| Phase | Output | Owner |
| --- | --- | --- |
| P1 Foundation | `styles/tokens.css`, `styles/base.css`, `scripts/choreographer.js`, `index.html` skeleton, `README.md` contract | argon |
| P2 Wiring | per-section CSS/JS files created and linked in `index.html` (so section workers never touch `<head>`) | manager |
| P3 Sections (parallel) | one worker per group, disjoint files | see below |
| P4 Integration | merge, stitch the spine across sections, theme toggle, nav progress | manager |
| P5 QA | browser pass: desktop 1440 / laptop 1280 / mobile 390, reduced motion, light theme, no-JS, console errors, weight budget | reviewer worker |
| P6 Polish | fixes from QA | owners of the affected sections |

## Section ownership (P3)

Each group owns ONLY its `<section>` element inside `index.html` (between its
`<!-- section:<id> -->` … `<!-- /section:<id> -->` markers), plus `styles/sections/<id>.css`
and `scripts/sections/<id>.js` for each of its ids.

| Group | Sections (ids) | Worker | Why |
| --- | --- | --- | --- |
| A | `nav`, `hero` | argon (heavy) | 3-second boot, pinned flatten + fork, the cockpit twin, the scenery window |
| B | `backends`, `worktrees` | hydrogen | discovery sweep, hover-linked YAML, scroll-linked fork SVG |
| C | `live`, `orchestration` | flash-high | pinned scrubbed run with step pills, packet + 409 bounce |
| D | `gate`, `automations` | luna | the wow (click-to-merge convergence), trigger pulses |
| E | `local`, `launch`, `footer` | flash-high | plane peel, copy-to-clipboard + boot log, pixel dawn horizon |

## Shared rules for every section

- Only the foundation contract: `data-reveal` / `.is-in`, `data-stage` + `--p` + `data-step`, `stage:progress`,
  `.hairline-card` + `--mx/--my`, tokens from `tokens.css`. No new global CSS, no new fonts, no libraries, no CDN.
- Animate only `transform`, `opacity`, `clip-path`, `stroke-dashoffset`. Pinned stages ≤ 150vh with step pills.
- Every section: index badge on the spine rail (G2), Inter 600 headline + subline (G3), lamp wash per G4.
- All copy and code is real and from `00-brief.md`; facts per G6.
- `prefers-reduced-motion`: settled state, no pin. No-JS: content readable. Light theme works.
- Inline SVG diagrams carry `role="img"` + `aria-label`; interactive bits are `<button>`s.
- Mobile 390px: spine rail at 20px, diagrams stack.

## Definition of done

`site/index.html` opens from `file://` with no console errors; every section from the concept table is present and
matches `04-review.md`; total weight < 350 KB excluding the images in `03-mockups/`; QA report saved as `06-qa.md`.
