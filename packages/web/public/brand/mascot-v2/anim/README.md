# Onni motion library

Open `anim-preview.html` directly to play the eleven states and transitions. It embeds the sprites and responds to the system's reduced motion setting. Use **Dark backdrop** to check contrast. Regenerate the assets with:

```sh
node packages/web/public/brand/mascot-v2/anim/anim-gen.mjs
```

`animations.json` uses a 96 × 96 canvas, with its origin at the top left and the ground anchor at (48, 91). Frame and effect paths are relative to the manifest. Read frame durations in milliseconds; `once` holds its final frame and `pingpong` reverses without repeating the end frames. Frame indices are zero based. Idle uses the listed sequence, inserting a weighted variation between frames on a 3–5 second timer. Use `staticFrame` when reduced motion is on.

Effect cues place the glyph's top left in canvas pixels for the entire referenced frame. Draw the tracks marked `behind` before the body and the other tracks after it. The standalone body frames contain no effects; each effect is available as both PNG and rect-only SVG.

`strips.png` uses manifest order from top to bottom: idle, working, thinking, success, error, sleep, wake, loading, celebrate, idle to working, and working to idle. Each pair of rows uses the same frames from left to right, first on white and then on navy. Effects are shown in both rows.

At small sizes, the typing paws, raised gaze, and breathing are subtle; their dot, question, and Z cues help distinguish the states. Wake and the working transitions cut between the original silhouettes with a squash pose between them. Loading is a bounce because the masters do not include running poses. The original navy outlines have low contrast on the navy backdrop.
