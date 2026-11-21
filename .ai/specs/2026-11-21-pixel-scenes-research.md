# Pixel scenes — research and plan (NOT implemented)

Source studied: https://github.com/Aqua2409z/pixel-chat-themes (MIT, v2.1.0, updated 2026-11-19).
Goal: turn its idea into an optional Cockpit feature: animated pixel/ASCII backgrounds ("scenes").

## 1. What the upstream repo is

A theme pack for **claude.ai**, not a library. Three deliverables:

| Piece | What it does | Reusable here? |
| --- | --- | --- |
| `claude-pixel-themes.user.js` (~137 KB, vanilla JS) | Full-screen `<canvas>` at z-index -1, scene drawn as a grid of tiles each holding an ASCII glyph; a DOM scanner turns opaque backgrounds transparent/frosted; `/theme` picker, hotkeys, localStorage `pixel-themes:v1` | **The scene engine yes; the scanner and picker no** (they exist only because claude.ai's DOM is not theirs) |
| `pixel-themes/` (TS plugin for Claude Code Desktop, `scenes.ts` 89 KB SVG/SMIL scenes) | Uses Claude Code's plugin API (`claude-code` package) | No — host-specific API |
| `index.html`, `setup.html`, docs | Demo and install wizard | No |

Engine design (worth copying, written fresh):
- `World`: canvas + `tiles` map, `cols/rows` from a `cell` size (glyphs only if `cell >= 8`), `dpr` scaling.
- Theme contract: `{ id, name, dark, alias, glyphs, bg(ctx,w,h), init(world), frame(world, dt), under?, over? }`.
  Static parts are rendered once to an offscreen layer (`under`/`over`); only `frame` runs per tick.
- Draw primitives: `tile`, `sprite` (ASCII-art + palette), `glyph`, `dot`, `glow`; helpers `hash`, `rgba`, `vgrad`.
- Runs at 10–12 fps (the pixel look and cheap), pauses on hidden tab, stops under `prefers-reduced-motion`.
- Sliders: calm veil, panel opacity, density, speed, motion on/off, auto theme by time of day.
- No `innerHTML`, no inline `<style>`; local-only, no network.

Scenes: Vietnam flag/Ha Long, Sakura/Fuji, Cosmic Galaxy (mouse gravity), Hoi An lanterns, Christmas village. Themes are culture-specific; we would not ship them as-is.

## 2. Fit with OnniCode

Already in the repo, so the feature has a natural home and precedent:
- `packages/web/src/components/ghost-code-backdrop.tsx` — a decorative, `aria-hidden`, `pointer-events-none`, reduced-motion-aware backdrop on `/new`. Pixel scenes are the same family.
- `components/appearance-provider.tsx` + `lib/appearance.ts` + `routes/settings/appearance.tsx` — preferences persisted in global `~/.onni/ui-state.json` (`appearance` key, schema in `packages/contract/src/workspace.ts` ~L184 / L346), mirrored to localStorage for pre-paint, written as the FULL object.
- `bg-background` on the shell root (`app-shell.tsx:274`) and tokens in `styles/index.css`.

Constraints from AGENTS.md that shape the design:
- Zero config: default OFF-equivalent (no scene), no required state; delete the key → no scene.
- Local-first, no telemetry, no new network. Pure client rendering → no server logic needed.
- New persisted fields must be optional so old `ui-state.json` still parses.
- Contract is zod in `packages/contract`; web must not import Node-only code.
- No `ONNI_*` env var is needed (client-only, user-chosen in Settings). If one were added, `.env.example` must change in the same commit.
- Do not copy upstream code verbatim without attribution: it is MIT, so keep its notice if any code is derived; the cleaner path is a fresh engine with the same contract and an "inspired by" credit in docs.

## 3. Proposed design

**Placement (decision made):** scene canvas behind the cockpit shell, not a DOM scanner. Our own markup lets us do this with tokens instead of upstream's computed-style hack:
- Mount `<PixelScene />` as the first child of the app shell root, `position: fixed; inset: 0; z-index: 0; pointer-events: none; aria-hidden`.
- When a scene is active, the root sets `data-scene="on"` on `<html>`; CSS in `index.css` then makes `--background` a semi-transparent token (`color-mix(in srgb, var(--background) var(--scene-opacity), transparent)`) and applies `backdrop-filter: blur` only on shell panels (sidebar, header, cards). Main content keeps solid text contrast.
- A "calm" veil slider (0–100 %) guarantees readability; default high.

**Engine** (`packages/web/src/lib/pixel-scenes/`):
- `engine.ts` — `World` class, tick loop via `requestAnimationFrame` throttled to ~12 fps, `visibilitychange` pause, `ResizeObserver`, dpr cap 2, offscreen static layers.
- `scenes/*.ts` — one file per scene implementing the theme contract above (lazy `import()` so the default bundle is untouched).
- `registry.ts` — id → loader, name, `dark` flag, aliases.
- Initial scene set (original art, not upstream's): `rain-terminal` (code rain, ties to the product), `night-sky`, `sakura`, `snow` — 3–4 scenes max for v1. Upstream's cultural scenes can be contributed later as optional packs with credit.

**Settings** (extend Appearance, not a new page): `appearance.scene` = `{ id: string | 'off', veil: 0–1, density: 0–1, speed: 0–1, motion: boolean }`, all optional in `appearanceSchema`; `normalizeAppearance` clamps and falls back to off. Because `AppearanceProvider.save` writes the full object, the new keys must be added to `Appearance`, normalize, the localStorage mirror and the pre-paint script in `packages/web/index.html` (the comment in `lib/appearance.ts` says both must change together — only the on/off flag is needed pre-paint).

**Accessibility / performance:** respect `prefers-reduced-motion` (render one static frame), pause when hidden or when the window is unfocused, cap fps, skip on `max-xl`/small screens by default, no glyph text when cell < 8, expose a one-click "off". Never animate behind code editors/diff views at full opacity — veil stays on.

**Out of scope:** the upstream userscript/plugin installers, `/theme` slash command, Tampermonkey path, donation links, Claude Code plugin API, DOM scanner.

## 4. Implementation plan (for a later task)

Parts, with disjoint file ownership:

1. **Contract + persistence** (`packages/contract/src/workspace.ts`, `packages/web/src/lib/appearance.ts`, `components/appearance-provider.tsx`, `index.html` pre-paint) — optional `scene` object, normalize/clamp, mirror key, tests (`lib/appearance.test.ts`, contract-parity). Owner of the shared `Appearance` type; other parts use it.
2. **Engine + 3 scenes** (`packages/web/src/lib/pixel-scenes/**`) — pure TS, unit-testable with a fake 2D context (tile math, density, determinism via seeded `hash`, fps throttle, reduced-motion stills). Depends only on the part-1 type for options.
3. **Mount + CSS tokens** (`components/pixel-scene.tsx`, `app-shell.tsx`, `styles/index.css`) — canvas lifecycle, lazy load, translucent `--background` under `data-scene`, mobile gating. Depends on 1 and 2.
4. **Settings UI** (`routes/settings/appearance.tsx` + test) — scene picker with thumbnails (render each scene once to a small canvas), sliders, motion toggle, "off". Depends on 1.
5. **Docs** — `docs/reference.md` (Appearance section), credit "inspired by Pixel Chat Themes (MIT)", no env vars.

Parts 2 and 4 can run in parallel after part 1; 3 integrates. Verification: `npm run typecheck`, `npm test -- packages/web/src/lib/pixel-scenes`, appearance/settings tests, `npm run build`, one manual `ONNI_DRY_RUN=1 npm run dev` pass at light/dark and with reduced-motion on; check bundle size delta (scenes must be lazy chunks).

## 5. Risks and open decisions

- **Readability**: transparent backgrounds over animation can hurt contrast — mitigated by the veil token; needs a contrast check in both themes.
- **Battery/GPU**: `backdrop-filter` is costly; limit to a few panels, off when `motion` is false.
- **Design guardian**: `design-guardian.test.ts` may flag new colors/tokens — check before building scenes.
- **Scope of scene art**: ASCII sprite art is the bulk of the effort (upstream's scenes are ~100 KB); v1 should stay procedural (particles, gradients) instead of hand-drawn sprites.
- **Owner decisions needed**: (a) ship cultural upstream scenes with credit, or only original ones; (b) default scene "off" (recommended) vs. a gentle default; (c) apply to whole shell vs. only `/new` hero first (smaller, lower-risk first step that reuses the ghost-code slot).
