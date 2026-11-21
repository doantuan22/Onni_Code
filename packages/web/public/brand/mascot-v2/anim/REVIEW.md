# Motion asset review — 2026-11-21

## Verdict

**Ship only as an internal motion study; do not yet treat this as the production
`<Mascot/>` library.** The source files are internally consistent and all body
sprites pass the requested technical checks, but the most important transitions
contain very visible pose cuts. The strong silhouette and palette make the
library promising, while the dark-background contrast and the missing runtime
contract keep it below consumer-ready.

## Scores

| Area | Score | Notes |
| --- | ---: | --- |
| File integrity / manifest references | 10/10 | All 47 referenced body frames and 9 referenced effect PNGs exist. All body frames are 96 × 96, 8-bit RGBA PNGs, with only alpha values 0 and 255. |
| Manifest completeness for a React player | 7/10 | Canvas size, global ground anchor, state `staticFrame`, frame durations, `loop`/`once`/`pingpong`, effects, and effect cue coordinates are present. It lacks an explicit manifest schema/versioned player contract, effect dimensions/origin, state fallback, and an exhaustive transition policy. |
| Preview-player correctness | 8/10 | The embedded preview has generation cancellation, clears its active timeout on selection, handles `pingpong` without duplicated end frames, uses the idle sequence, and uses `staticFrame` for reduced motion. It needs defensive handling for malformed `idleVariations` and failed image decoding. |
| Idle / derived eyes | 6/10 | The 0→1 breathing/tail shift is legible, and frame 2 is a readable blink. The direct cut from the 135 ms blink (2) to idle pose 3 is harsh, while the generated closed eyes are flat navy arcs with no eyelid/cheek transition. |
| Working / thinking | 6/10 | Working has only ~152–160 changed pixels per step, so typing reads mostly through the laptop silhouette and dots rather than paws. Thinking has a clear raised-gaze idea and question cue, but the body’s alternating 750–893 pixel warp reads as tail/ear jitter. |
| Success / error | 8/10 | Success reads immediately as a cheer/jump; error has a clear, punchy shake. Error’s 480 ms neutral hold is disproportionately long relative to three 75 ms shake poses and the ping-pong repetition. |
| Sleep / wake | 5/10 | Sleep breathes subtly and the Z cue communicates the state. Wake 1→2 cuts from the full sleeping silhouette to a heavily squashed standing blink (~3,815 changed pixels), then cuts again to idle (~2,518); it does not read as a continuous wake. |
| Loading / celebrate | 7/10 | Loading is a readable bounce, though not semantically “loading” without its dots. Celebrate has a clear aerial cheer, but its 2→3 landing is abrupt and duplicates the success pose language. |
| State transitions | 4/10 | `idle-to-working` and `working-to-idle` use a squash frame, but the respective 1→2 / 1→2 cuts change ~2,834 / ~2,896 pixels and switch between unrelated silhouettes. Only three directed transitions are declared. |
| Anchoring, continuity, effects | 6/10 | Standing feet remain on y=90 across idle/working/thinking/error and generally land coherently on y=90. Airborne poses intentionally move. Tail and ear outlines visibly warp between idle/thinking poses; navy outlines and blue glyphs are low contrast against the navy backdrop. Most glyphs are clear at 2×; the one-pixel typing/loading dots and thin 1× `zzz` are weak at 1×. |
| **Overall** | **6.7/10** | Technically clean, visually promising, but motion continuity and the integration contract need another pass. |

## Technical audit

- **References:** every `frames/*` and `effects/*` `src` in
  `animations.json` resolves. No missing manifest assets were found.
- **Body-frame format:** 47/47 frames are 96 × 96; all are RGBA and use binary
  alpha only. The generator independently enforces this in
  `anim-gen.mjs:169–177`.
- **Frame counts:** idle 4, working 4, thinking 4, success 4, error 4, sleep
  4, wake 4, loading 6, celebrate 5, and each direction transition 4
  (**47 total**).
- **Bytes:** body frames 74,055 B; effect PNGs 964 B; `strips.png` 78,104 B;
  shipped raster visual assets total **153,123 B**. The whole directory before
  this review is **311,549 B**, including the 113,606 B self-contained preview,
  generator, manifest, README, and SVG effect alternatives.
- **Anchoring:** global anchor/baseline is `(48, 91)` in
  `animations.json:7–10`. Standing frame opaque bounds end at y=90; sleep
  intentionally ends at y=89. This prevents ordinary foot hopping, but no
  per-frame anchor metadata protects a future editor from regressing it.

## State-by-state motion read

| State | Motion read | Review |
| --- | --- | --- |
| `idle` | Breathe and blink | Readable, but frame 3 is an over-large tail/ear correction after the blink. |
| `working` | At a laptop / typing | Pose is clear; paw movement is too subtle for typing to read independently. |
| `thinking` | Looking up / pondering | Question mark sells it; body oscillation feels less intentional than the cue. |
| `success` | Cheer / small jump | Strongest one-shot animation; good takeoff and held finish. |
| `error` | Shake / alarm | Clear horizontally, though the rhythm waits too long before repeating. |
| `sleep` | Breathing asleep | Soft and stable; the `zzz` motion is the main readable change. |
| `wake` | Waking up | Does not read continuously because the prone-to-squash pose cut is too large. |
| `loading` | Bounce / wait | Reads as bounce; needs dots for “loading.” |
| `celebrate` | High cheer | Clear, but landing is a pose cut and visually close to success. |
| `idle-to-working` | Start working | Concept is correct; silhouette replacement between frames 1 and 2 is conspicuous. |
| `working-to-idle` | Stop working | Same issue in reverse; returning from laptop to blink squash is not a physical path. |

## Preview / consumer readiness

The preview is a useful inspection tool, not a reusable player:

- `select()` increments `generation` before awaiting images and clears the last
  timeout (`anim-preview.html:47–55`), so stale selections do not repaint.
- The default sequence and `pingpong` order are correct
  (`:57–59`); `once` holds its last painted frame by returning before scheduling
  a new timeout (`:93–97`).
- Reduced-motion correctly paints `staticFrame` (`:77–79`) and the media-query
  change reruns the current state (`:116`).
- `nextVariation()` is only invoked when `variation` exists, but it assumes
  valid `intervalMs` and nonzero weighted choices (`:61–65`, `:84–88`). This is
  safe for the generated JSON, not safe as a general manifest-player boundary.
- `im.decode()` rejection only becomes the generic caption; it does not record
  which source failed (`:38–44`, `:102–103`).

## FIX LIST

1. **Replace the wake bridge:** redraw `frames/wake-2.png` so it retains the
   sleeping body/tail orientation while opening the eyes and lifting the head,
   then add at least one intermediate stand-up frame before `wake-3.png`.
   Update `wake` frame entries at `animations.json:383–399` and durations to
   give the head-lift/stand-up 140–180 ms each. The current 1→2 transition is
   the largest pose cut in the set.
2. **Make each working transition physically continuous:** redraw
   `frames/idle-to-working-2.png` and `frames/working-to-idle-2.png` as
   in-between seated/turning poses that preserve the preceding silhouette;
   do not jump directly between the squashed blink and laptop pose. Update
   the corresponding lists at `animations.json:638–654` and `:661–677`.
3. **Smooth the idle blink:** add a closing-eye in-between or replace
   `frames/idle-3.png` with a post-blink pose closer to `idle-2.png`; use a
   sequence such as `[0, 1, closing, closed, opening, 1]` rather than the
   current `[0, 1, 3]` at `animations.json:42–45`. Keep the closed pose to
   roughly 80–110 ms, not 135 ms.
4. **Improve derived eyes at their source:** replace `eyes(..., 'closed')` in
   `anim-gen.mjs:88–92` with asymmetric/curved eyelids that preserve the socket
   outline and add a one-frame close/open interpolation. The present seven-pixel
   navy arc makes the blink look stamped on rather than anatomical.
5. **Give working visible paw cadence:** increase the local hand displacement
   in `typing()` (`anim-gen.mjs:112–117`) and make `working-1` through `-3`
   alternate left/right paw positions by at least 2 px at 96 px. Retain feet
   at y=90; do not solve it by moving the whole body.
6. **Stabilize thinking’s silhouette:** reduce the tail and ear local offsets
   used for `thinking` in `anim-gen.mjs:182`, or redraw the three frames with
   shared ear/tail outline pixels. Let the question cue carry the secondary
   motion instead of alternating broad body warps.
7. **Retune error rhythm:** change `error-0` from 480 ms to about 180–240 ms
   and increase each shake pose in `animations.json:253–270` from 75 ms to
   roughly 90–110 ms. This removes the long neutral pause while keeping a
   readable three-beat shake.
8. **Add a landing ease to celebrate:** insert a bent-knee/descending frame
   between `celebrate-2.png` and `celebrate-3.png`; revise entries
   `animations.json:506–527` so the new pose lasts ~120 ms. The current
   aerial-to-ground change is a visible pose cut.
9. **Improve small/dark effect readability:** redraw
   `effects/typing-dots.png`, `effects/loading-dots.png`, and `effects/zzz.png`
   with a 1 px light/white or amber contrast edge (and regenerate their SVGs
   from `anim-gen.mjs:203–205`). Check them at native 1× on `#08122d`; the
   current blue one-pixel details recede into the mascot’s navy outline.
10. **Publish a real player contract:** add a versioned JSON schema/type beside
    `animations.json` that validates state names, duration > 0, frame indices,
    weighted variation choices, and effect bounds. Include effect
    `width`/`height` plus an explicit origin, a fallback state, and documented
    behavior after `once`; then make `<Mascot/>` consume that contract rather
    than duplicating assumptions from `anim-preview.html`.
11. **Complete transition policy:** either declare intentional transitions for
    every supported state pair or document that unsupported changes cross-fade
    or snap to `staticFrame`. The current map at `animations.json:684–688`
    covers only `idle→working`, `working→idle`, and `sleep→idle`, so a React
    caller has no defined behavior for success/error/loading/celebrate changes.
12. **Harden the preview before using it as a fixture:** in
    `anim-preview.html:38–44` include `src` in decode failures; at `:61–65`
    and `:84–88` validate `hi >= lo`, positive finite weights, and an in-range
    chosen frame. Add an error status that identifies the malformed field
    instead of silently relying on generator-only invariants.
