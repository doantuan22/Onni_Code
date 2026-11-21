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
- Canvas is 96 × 96 with top-left origin. `sizes` lists suggested CSS pixel sizes `[24,48,96,192,288,384]`; preserve the square aspect ratio and use pixelated scaling. The 24 px size is a compact static badge; fine details are clearest at 96+ px.
- `anchor` and every frame's `anchor` are canvas-space `(48,91)` with `baseline:91`. Align that point to the component's placement anchor.
- Paths resolve relative to `animations.json`, **not the application route**. Decode before switching; decode errors should include the relative `src`.
- Each frame owns its positive `durationMs`. `playbackOrder(state)` expands `pingpong` without repeating endpoints. `loop` repeats. `once` honors the last duration, then `onComplete:'hold-last'` leaves the final frame painted until a new request. It does not implicitly return to idle.
- Idle variation choices contain a whole frame sequence with a positive weight. `chooseVariation(variation)` selects one sequence; play it to completion, then resume the saved normal sequence cursor. Do not advance that cursor during a variation. Compute the next deadline from the validated `[lo,hi]` interval.
- Effects declare `width`, `height`, `origin:{x,y}`, optional `behind`, and cues. Draw at `cue.attach - effect.origin` in canvas pixels for the full cue frame. Draw `behind:true` tracks, body, then other tracks. Multiple cues may share a frame. Both PNG and rect-only SVG alternatives are regenerated from one glyph.

## Exhaustive state-change policy

`resolveChange(manifest, from, requested, reducedMotion, interrupted)` defines all 121 state pairs, plus unknown requested states. Unknown names become `fallbackState:'idle'`. Same-state requests keep the current cursor/deadline.

The three named directed edges play a bridge and then start the destination: `idle→working`, `working→idle`, `sleep→idle`. A consumer plays the returned `state` and hands off to `thenState` **after** the bridge's final-frame duration. Every other change explicitly snaps to the destination's `staticFrame`, holds that frame's duration, then starts normal playback. There is no unspecified crossfade. An interrupted bridge cancels its timer/decode generation and follows that same destination-static rule. Reduced motion skips all bridges and stays static.

The preview's bridge buttons also allow playing each bridge directly from frame 0 for inspection; that is a preview control, not an extra state-change policy.

## React consumer

`packages/web/src/components/mascot.tsx` is the actual React consumer. It loads and validates `animations.json` and the browser-safe `player-runtime.mjs`/`player-contract.mjs` from the local public asset directory. Only type imports reach the adjacent `.d.mts` declarations at build time; public runtime modules remain separately served assets. The shared runtime calls the contract helpers; it does not duplicate the preview's frame/variation/transition assumptions.

```tsx
import { Mascot } from '@/components/mascot'

<Mascot state="loading" size={96} />
<Mascot state="success" size={192} animated />
<Mascot state="idle" size={96} animated loop />
```

Props: `state`, `size` (manifest-supported CSS pixels; invalid values fall back to 96), `animated`, `loop`, `decorative`, `label`, `className`, `onError`, and `onComplete`. Loading animates and loops by default. Other states default to static; explicitly opt in to animation. Working loops when animated; idle/thinking/error/sleep need `loop` to repeat. Once states always finish and hold. Decorative is true by default; `decorative={false}` requires a caller-localized `label`.

The component reserves a square box before loading and respects reduced motion. The native runtime lays out individual PNG images at their declared dimensions, frame anchors and effect origins, and uses stepped Web Animations timelines with exact frame durations. There is no canvas or per-frame JavaScript animation loop. Idle variations briefly pause the native normal timeline, play their sequence, then resume the saved cursor. Named bridge completion hands off after the final-frame duration. Cues marked behind precede the body; multiple cues on one frame remain independent.

Images decode before switching; decode errors identify the source and failures can be retried on the next state request. Asset loads have a 10-second deadline. Prop changes invalidate pending work, unmount cancels animations/decode deadlines, and missing native animation support degrades to `staticFrame`. Native runtime fixtures run in the generator. The permitted `brand-asset.test.ts` verifies the React component's SSR dimensions/decorative/accessibility markup; browser playback was not exercised by those checks. App placements remain opt-in through importing this component.
The master art still constrains topology: wake changes from a curled body to a standing body and the laptop enters during seating. The new registered parts reduce the former full-silhouette cuts; they are not newly painted pose masters. Navy outlines also remain intentionally low contrast on navy; use the white backdrop when maximum outline separation is needed.
