# After-fix capture (2026-11-22, refreshed after phase 2 rewrite)

Captured by the manager from a production web build of this branch (`npm run build -w @onni/web`),
`ONNI_DRY_RUN=1`, port 4377, `agent-browser` from `~/.cache/agent-tools/agent-browser`, DPR 1.
Scene selected via `PUT /api/v1/workspace/ui-state`, theme via `localStorage['onni-theme']`.

Files: `<scene>-<light|dark>-<new|chat>.png` (1440×900, 32), `<scene>-<theme>-new-narrow.png`
(390×844: vn-halong, world-sahara, world-tromso, 6), earlier `background-scenes-popover-light.png`.

## What the shots show
- `/new`: the reading panel is now opaque (root cause: `--scene-panel-*` were scoped to the backdrop,
  so sibling panels rendered transparent). Text is legible; the scene shows in the gutters.
- Chat: Horizon strip is visible above the dock; message surfaces are protected. Small metadata
  lines (timestamp, "Execution details") still sit unprotected on the strip.
- `/scenery-thumbs/<id>-<theme>.png` is served (HTTP 200).

## Known defects (not fixed)
- `vn-fansipan` is still the weakest scene: the cloud sea is a large flat mass with little volume.
- Reviewer scores in `../scoring.md` pre-date these fixes; they are not the product owner's sign-off.
- Narrow shots and the full matrix were not re-scored after the fixes.

## Phase 2 update (learned from Aqua2409z/pixel-chat-themes, technique only)
All 8 scenes were redrawn using R5a/R5b/R6/R7 (see `../../research/`). The 39 PNGs here were re-captured
from a fresh production build. Per-scene honest state:
- Good: world-kyoto, world-tromso, vn-fansipan, vn-halong, vn-phu-quoc, vn-mu-cang-chai (curved terraces).
- Fair: world-sahara (caravan still small), world-matterhorn (hooked horn better, but cropped at the right
  edge and the lake is a large flat area).
- Chat: the reading lane is opaque in the centre, so the scene shows mostly in the two gutters; this is the
  main remaining integration weakness. `backdrop-filter` stays banned (D4); lifting it is the owner's call.
- Reviewer/owner scoring was NOT redone; `../scoring.md` pre-dates phase 2.
