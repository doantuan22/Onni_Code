# Scene snapshots

Run from the repository root with the installed workspace dependencies.

```sh
node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts
node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts --scene <id>
node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts --fixture
node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts --thumbnails
node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts --scene <id> --thumbnails --thumb-out .tmp/scenery-thumbs
```

The tool writes review artifacts per scene in `.tmp/scene-snap/`; use `--out <dir>` to choose another directory:

- `raw/<id>/<theme>/<time>/<size>.png` contains the uncomposited engine frame for both themes, four times, and native 320×180, 480×270, and 240×300 buffers.
- `sheets/<id>-<theme>.png` is a themed contact sheet. Read it left to right as dawn, day, dusk, night; the three rows are 320×180, 480×270, and 240×300.
- `static/<id>-<theme>.png` and `metadata/<id>-<theme>.json` contain the theme-default 480×270 frame and its reproducibility fields (seed, time, backend, and visibility).

Add `--thumbnails` to render the theme-default 320×180 static thumbnail from the engine into `packages/web/public/scenery-thumbs/<id>-<theme>.png`. Use `--thumb-out` to review thumbnail files outside the public directory.

The printed hashes use FNV-1a over the RGBA bytes of the 320×180 frame at `t=0`, with seed 42 and the untinted legacy palette. The command never changes [`golden-hashes.json`](golden-hashes.json); update that file only in an explicit, reviewed golden-update change. The test compares the committed list against the full registry and the engine fixture.

```sh
npm test -- packages/web/src/lib/scenery/dev/scene-snap.test.ts
```
