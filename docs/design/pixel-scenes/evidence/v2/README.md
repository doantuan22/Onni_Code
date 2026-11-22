# V2 real-app scenery evidence

Captured on 2026-11-22 from this checkout at `http://127.0.0.1:4322`, using
`ONNI_DRY_RUN=1`, a production web build, the local `agent-browser` Chrome
provider, and DPR 1.

## Commands

```sh
node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts --thumbnails
npm run build -w @onni/web
node --import tsx packages/work/src/index.ts --port 4322 --no-open --repo .
agent-browser --session qa-438bbf53 open http://127.0.0.1:4322/new --json
```

The service workspace build was also attempted, but its TypeScript check is
currently blocked by the pre-existing `src/webhooks/transport.ts(108,7)`
`maxRedirections` type error. The TSX service launch above was used for the
local dry-run capture; it successfully served the health endpoint and cockpit.

## Evidence

`ui/` contains the 32 required 1440×900 PNGs:

- `vn-{halong,mu-cang-chai,fansipan,phu-quoc}-{light,dark}-{new,chat}.png`
- `world-{tromso,kyoto,matterhorn,sahara}-{light,dark}-{new,chat}.png`

The `/new` captures use the Full surface. The chat captures were taken from
the dry-run thread `Dry-run scenery evidence task` and use the Horizon surface.
Scenes were selected with the real **Background scenes** popover.

The requested 390×844 narrow `/new` capture set is also present:

- `vn-halong-{light,dark}-narrow-new.png`
- `world-sahara-{light,dark}-narrow-new.png`
- `world-tromso-{light,dark}-narrow-new.png`
- `off-narrow-new.png`

The thumbnail command regenerated all 16 real-engine thumbnails in
`packages/web/public/scenery-thumbs/`.

## Observations

- `/new`: the scene is visible around the reading panel and the selected
  landmark remains identifiable; form text is legible in both themes.
- Chat: the transcript and composer retain readable solid/tinted surfaces;
  the horizon strip is deliberately more limited and can be obscured by the
  dock on narrow frames.
- No automated final-composite AA sampling was available in this capture.
  Therefore this evidence is visual review material, not AA sign-off.

## Defects / follow-up

- The service-workspace build failure above prevents calling this a fully
  production-built service capture, even though the web production build and
  real local dry-run cockpit were used.
