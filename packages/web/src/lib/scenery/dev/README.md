# Scene snapshots

Run from the repository root with the installed workspace dependencies.

```sh
node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts
node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts --scene <id>
node --import tsx packages/web/src/lib/scenery/dev/scene-snap.ts --fixture
```

The tool writes one PNG per scene in `.tmp/scene-snap/`. Use `--out <dir>` to choose another directory. Read each sheet left to right as dawn, day, dusk and night. The rows are light then dark at each resolution, in order 320×180, 480×270 and 240×300. Each tile is rendered at its native size with 70% visibility over the theme background.

The printed hashes use FNV-1a over the RGBA bytes of the 320×180 frame at `t=0`, with seed 42 and the untinted palette. After reviewing a new or intentionally changed scene, put its four hashes under its registry ID in [`golden-hashes.json`](golden-hashes.json). The test compares the committed list against the full registry and the engine fixture.

```sh
npm test -- packages/web/src/lib/scenery/dev/scene-snap.test.ts
```
