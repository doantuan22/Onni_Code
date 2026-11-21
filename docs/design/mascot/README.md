# Onni mascot — design and demo (not part of the product)

**Status: design record + standalone demo only.** The mascot is NOT wired into the cockpit, the desktop shell or any shipped asset. `packages/web` does not import anything from here, and nothing under `docs/` is served. Adopting it later is a separate owner decision (see "If adopted").

The approved **logo** is separate and already live (`packages/web/public/icon.svg`, sources in `packages/web/public/brand/logo/`).

## What it is
"Onni" — a cute pixel robot-fox: navy/azure armour, white face, amber eyes, a `<` chevron badge on the chest that echoes the logo. Pixel art derived from AI-generated images (not hand-coded grids).

## How it was made (design → review → fix, repeated)
1. v1 (code-drawn 32x32 grid) was rejected as not cute/detailed enough. Removed; kept in git history.
2. Concepts generated with three image-capable workers (`demo/concepts-a|b|c`). B (robot-fox) chosen; A ("Onni-Bot", white helmet robot) is a documented alternative; C was unusable.
3. `demo/extract/extract.mjs` (no deps) keys the magenta background, snaps to the 2px pixel grid and locks a 9-colour brand palette → `demo/final/` (5 poses, hero, 16/32px heads, sprite sheet). Review and resolution: `demo/REVIEW.md`.
4. `demo/anim/anim-gen.mjs` derives animation frames and pixel effects from those poses: 11 states (idle w/ blink, working, thinking, success, error, sleep, wake, loading, celebrate, idle<->working bridges), 61 frames of 96x96, 9 effect glyphs. Review and resolution: `demo/anim/REVIEW.md`; manifest contract: `demo/anim/README.md`.

## Run the demo
No server needed; the preview embeds its sprites:

    start docs/design/mascot/demo/anim/anim-preview.html      # Git Bash on Windows
    open  docs/design/mascot/demo/anim/anim-preview.html      # macOS

Pick a state, toggle the dark backdrop, cycle 1x/2x/3x. `prefers-reduced-motion` shows the static frame. Stills: `demo/final/preview.png`, `demo/anim/strips.png`.

Regenerate (each is dependency-free):

    node docs/design/mascot/demo/extract/extract.mjs
    node docs/design/mascot/demo/anim/anim-gen.mjs

## Where it could go (analysis, not implemented)
`demo/PLACEMENT.md` ranks the candidate surfaces. Short version: full-page empty/loading/terminal states only (first-task empty state, route loading splash, "Changes accepted" moment, desktop splash, task error/404), never in dense surfaces (sidebar, rows, transcript, diffs, toasts, banners). Integer scales of the 96px canvas only; respect reduced motion; a Settings → Appearance off-switch, no new `ONNI_*` variable.

## Known limits
- Transition frames (wake, idle<->working) are collaged from pose art and look slightly glitchy; they show for ~100 ms.
- Browser playback was verified by fixtures, not a live browser run in CI; use the preview to judge timing.
- Chevron badge is faint below 96px; sparkle effect of the original success pose was dropped.
- One frame set per pose; richer cycles need more generated source frames.

## If adopted
Add a `<Mascot/>` component in `packages/web/src/components/`, copy only the needed frames into `packages/web/public/`, add the Settings switch, and follow the six steps in `demo/PLACEMENT.md`. Run the full gates then; none were run for this design work.
