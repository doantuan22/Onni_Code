# Brand assets

- `logo/` — the approved logo (navy ring + azure `<`). Now the system logo: `public/icon.svg`, desktop icons. Regenerate: `node logo/logo-gen.mjs`; desktop PNG/ICO: `node ../../../desktop/scripts/icon-raster.mjs`. `icon.icns` needs macOS (`packages/desktop/scripts/icon.mjs`).
- `mascot-v2/` — mascot "Onni" (cute pixel robot-fox). Made from AI-generated images (`concepts-a/b/c`, B chosen) and extracted to pixel art by `extract/extract.mjs` into `final/` (5 poses, hero, 16/32 heads, sprite sheet). Review + resolution in `mascot-v2/REVIEW.md`. Not wired into the UI yet.
- `mascot/` — v1, code-drawn mascot. Superseded by `mascot-v2/`; kept for reference.
