# Onni motion library — player contract v2

Open `anim-preview.html` directly, including offline. It embeds the sprites and the **same** `player-contract.mjs` used by the generator. Choose a state/bridge, use **Dark backdrop**, and cycle **Size** through 1×, 2× and 3×. System reduced motion paints `staticFrame` with its effects and cancels animation timers immediately.

Regenerate only this asset set (no app build or server required):

```sh
node packages/web/public/brand/mascot-v2/anim/anim-gen.mjs
```

The generator checks decoded PNG references/dimensions, binary alpha, the source palette, canvas margins, v2 field/cross-field validation, malformed input cases, every state pair, and the embedded preview in an isolated VM with fake images, clock and DOM. That fixture checks playback logic, not browser rendering.

## Art and motion

All body art comes from `../final/onni-{idle,working,success,error,sleep}.png`. Nearest-neighbor transforms and a head/body/tail registration rig create the in-betweens; there is no translucent blend, dithering or replacement vector body. The sleeping sockets open in place before the head lifts. Eight wake frames and eight frames per working bridge keep intermediate silhouettes on screen; working bridges are exact reverses of each other. Grounded feet end on y=90, with the anchor just below at y=91 (sleep intentionally ends at y=89).

Idle breathing uses frames `[0,1]`; a weighted variation inserts the complete `[2,3,4,1]` closing/closed/opening/recovery sequence every 3–5 seconds. Closed eyes hold 95 ms. Thinking keeps a shared silhouette and moves the cues. Working alternates opposite two-pixel paw offsets locally. Error holds neutral 210 ms and each shake 100 ms. Celebrate descends for 120 ms before its landing compression. Dots and Z glyphs have white contrast pixels for the navy background.

`strips.png` is 768 × 2200. Manifest order top to bottom: idle, working, thinking, success, error, sleep, wake, loading, celebrate, idle to working, working to idle. Each pair of rows shows frames in index order, white first then navy, with cues composited in player order. It is a pose sheet, not a timeline: idle plays the sequence/variation above rather than every frame in strip order.

## Consumer boundary

`player-contract.d.mts` is the versioned TypeScript contract, paired with the browser-safe validator/helpers in `player-contract.mjs`. Pass the manifest through `validateManifest(unknown)` **before** requesting images/timers. Invalid data throws an Error naming the field; do not silently play partial data. The validator rejects unknown/missing states, nonpositive/nonfinite durations, out-of-range static/sequence/variation/cue indices, invalid intervals or weights, missing effect dimensions/origin and out-of-canvas effect placement.

- `version` must be `2`. Version 1's variation `{frame}` became `{frames:[...]}`; do not treat old single-frame choices as v2 data.
- Canvas is 96 × 96 with top-left origin. `sizes` lists suggested CSS pixel sizes `[24,48,96,192,288]`; preserve the square aspect ratio and use pixelated scaling. The 24 px size is a compact static badge; fine details are clearest at 96+ px.
- `anchor` and every frame's `anchor` are canvas-space `(48,91)` with `baseline:91`. Align that point to the component's placement anchor.
- Paths resolve relative to `animations.json`, **not the application route**. Decode before switching; decode errors should include the relative `src`.
- Each frame owns its positive `durationMs`. `playbackOrder(state)` expands `pingpong` without repeating endpoints. `loop` repeats. `once` honors the last duration, then `onComplete:'hold-last'` leaves the final frame painted until a new request. It does not implicitly return to idle.
- Idle variation choices contain a whole frame sequence with a positive weight. `chooseVariation(variation)` selects one sequence; play it to completion, then resume the saved normal sequence cursor. Do not advance that cursor during a variation. Compute the next deadline from the validated `[lo,hi]` interval.
- Effects declare `width`, `height`, `origin:{x,y}`, optional `behind`, and cues. Draw at `cue.attach - effect.origin` in canvas pixels for the full cue frame. Draw `behind:true` tracks, body, then other tracks. Multiple cues may share a frame. Both PNG and rect-only SVG alternatives are regenerated from one glyph.

## Exhaustive state-change policy

`resolveChange(manifest, from, requested, reducedMotion, interrupted)` defines all 121 state pairs, plus unknown requested states. Unknown names become `fallbackState:'idle'`. Same-state requests keep the current cursor/deadline.

The three named directed edges play a bridge and then start the destination: `idle→working`, `working→idle`, `sleep→idle`. A consumer plays the returned `state` and hands off to `thenState` **after** the bridge's final-frame duration. Every other change explicitly snaps to the destination's `staticFrame`, holds that frame's duration, then starts normal playback. There is no unspecified crossfade. An interrupted bridge cancels its timer/decode generation and follows that same destination-static rule. Reduced motion skips all bridges and stays static.

The preview's bridge buttons also allow playing each bridge directly from frame 0 for inspection; that is a preview control, not an extra state-change policy.

## React integration handoff

No React `<Mascot/>` implementation currently exists under `packages/web/src`. Adding one is outside this asset-only folder. A future component should import the `.mjs` helpers (with the adjacent `.d.mts` declarations), fetch and validate the manifest once, resolve paths against its URL, and use these helpers rather than copy assumptions from the HTML. For example:

```ts
import { validateManifest, playbackOrder, resolveChange } from './player-contract.mjs'

const manifest = validateManifest(await response.json())
const next = resolveChange(manifest, previous, requested, reducedMotion, interrupted)
const state = manifest.states[next.state]
const order = playbackOrder(state)
```

Clean up the timer and invalidate pending decodes on prop changes/unmount. Keep the manifest immutable after validation. Use the returned initial/static frame and `thenState`, the explicit origins, and the declared per-frame timing. The preview demonstrates cancellation and rendering but is not itself a React hook.

The master art still constrains topology: wake changes from a curled body to a standing body and the laptop enters during seating. The new registered parts reduce the former full-silhouette cuts; they are not newly painted pose masters. Navy outlines also remain intentionally low contrast on navy; use the white backdrop when maximum outline separation is needed.
