# Phase 2 brief — raise scene quality to the upstream bar

Owner feedback (2026-11-22): quality is still poor; scenes are flat/tiny/noisy and the scene+chat
integration is weak. Learn from the MIT reference repo Aqua2409z/pixel-chat-themes (technique only;
never copy its code/glyphs/assets). Read BEFORE editing: `R5a-upstream-render-vn-sakura.md`,
`R5b-upstream-render-night-fx.md`, `R6-upstream-ui-integration.md`, `R7-gap-analysis.md` (your scene's
section + cross-cutting), `engine/API.md`, `03-scene-set.md` (your scene).

## Quality bar (every scene)
1. One BIG hero subject, 15–40% of the frame, placed in the visible gutters (`/new`: u 0.65–0.95 or
   0.05–0.30; chat Horizon strip is the lower ~36%: keep the subject in v 0.55–0.95). Never behind the
   centred form card (u 0.27–0.73, v 0.07–0.47).
2. Silhouette first, then value: >=5 layers, clear far→near value ladder, cool far / warm-saturated near.
3. NO full-sky Bayer/checker dither. Skies are 4–6 clean bands with <=6px dithered seams. Texture only
   inside terrain/sprites (12–18%).
4. Light: one light direction, rim light on lit edges, radial glow (3-stage stepped, no checkerboard) for
   sun/lamps/windows. Water: broken reflection strips, tapered glint cone, 6-phase cycle.
5. >=3 visible motions and >=1 animated sprite with 3–4 poses; wind/cloud drift at 0.15–0.4 px/s.
6. Palettes: light and dark are DIFFERENT designs, 32 indexes max, dark != darkened light.
7. Time-bound effects follow ctx.time (see `darkness()` in engine/palette.ts).

## Workflow
Edit only your scene module(s)/sprites/tests. Export sheets with:
`node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts --scene <id> --out <dir>` then OPEN the
PNG sheets and judge them honestly against `.ai/onni/tmp-ref/shots/upstream-index.png` / R7 targets;
iterate at least 3 times. Own test file must pass (`npm test -- <file>`). Do not edit registry.ts,
golden-hashes.json or engine/**. Antigravity rules: no commit/push/env/CLI report; end with a plain
summary listing files, commands, iterations and honest residual defects.
