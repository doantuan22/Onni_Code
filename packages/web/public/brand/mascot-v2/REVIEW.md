# Mascot v2 extraction review

**Verdict: do not ship this extraction.** The source artwork has a strong, cute
robot-fox identity, expressive faces, and an identifiable cyan `<` badge. The
current extraction reduces it to small, noisy, inconsistent sprites and carries
magenta-key contamination into every final pose.

## Inspection scope and method

Reviewed `concepts-b/sheet.png`, `concepts-b/concept-1.png`, the extraction
implementation in `extract/extract.mjs`, every final pose at native size and
4× in `final/preview.png`, both head exports, and `sprite-frames.json`.

The five pose frames are correctly described as adjacent `96 × 96` frames at
`x = 0, 96, 192, 288, 384`. All five pose SVGs contain only `<rect>` elements
(`1177`–`1624` rects per file; no other drawing elements). They match their
corresponding PNG construction: `extract.mjs` passes the same `pix` buffer to
both the PNG encoder and the rect-only SVG writer. This is structurally sound,
but it faithfully preserves the bad extracted pixels.

## Measured defects

### 1. Magenta-key fringe is confirmed (critical)

The palette explicitly includes salmon `#F08982`, a key-background remnant,
and it appears in every output: idle 42 pixels, working 65, success 144,
error 46, sleep 43, and hero 79. It is most conspicuous as the pink/red halo
around ears, tails, feet, effects, and the sleep `z` marks. The cause is
`keyed()` treating only pixels within a very small distance of pure magenta as
transparent, followed by palette quantisation that maps residual anti-aliased
magenta to salmon.

### 2. Crop and fragment quality is not production-safe

The manual source rectangles include neighbouring art or cut through pose
silhouettes before the 4 px cell vote. In the final:

- **Success** has a detached cyan/white vertical shard at left (`x=18–21,
  y=22–24`) and detached effect components; the raised-arm/ear silhouette
  feels cropped rather than deliberately bounded.
- **Error** has a visibly isolated fragment to the lower-right of the body
  (three disconnected components overall), matching the suspicion of stray
  right-edge source material.
- **Sleep** retains the thin top-left vertical fragment around `x=12` plus
  separate `z` components (five components overall); its visual weight is
  split between the resting character and accidental-looking marks.
- **Working** has five components, including a 6-pixel detached upper-right
  remnant. The laptop overlaps the body/tail after reduction and reads as a
  muddy blue mass rather than a laptop.

No final alpha touches a 96 px canvas edge, so this is primarily **source-crop
and internal silhouette clipping**, not PNG canvas-edge clipping. That still
looks like cropped limbs in success/error at 1×.

### 3. Scale and baseline are inconsistent

Measured opaque bounds show the poses do not share a visual scale or grounded
baseline:

| Pose | Opaque bounds (x, y) | Content size | Lowest opaque y |
| --- | --- | ---: | ---: |
| idle | 25–70, 13–91 | 46 × 79 | 91 |
| working | 15–79, 4–91 | 65 × 88 | 91 |
| success | 18–76, 4–91 | 59 × 88 | 91 |
| error | 22–73, 4–91 | 52 × 88 | 91 |
| sleep | 12–83, 20–90 | 72 × 71 | 90 |

The algorithm scales each crop independently to fit its largest dimension.
Thus idle is materially smaller/narrower than the other standing poses, while
sleep is widest but shorter. Shared `oy = SIZE - dh - 4` gives a nominal
ground, not a pose-specific ground/contact baseline.

### 4. Four-pixel sampling loses the source's appeal

The generated source is detailed but still legible: clean dark outlines,
large amber eyes, separate laptop planes, and a consistent chibi anatomy.
`GRID = 4` uses one winning colour per 4 × 4 source cell and then rescales the
result. It erases one-to-three-pixel facial, outline, and cyan-accent detail
while preserving arbitrary edge noise. The final reads more like a damaged
downsample than intentional pixel art.

The 24-entry palette is also too broad and internally inconsistent: it has
near-duplicate whites/blues, several dull blue-greys, two oranges, and the
unwanted salmon/key residue. The source's crisp navy/cyan/white/amber hierarchy
becomes a noisy, dull blue field, especially on working's laptop and tail.

### 5. Hero and heads drift from the intended system use

`concept-1.png` is a front-facing, much larger hero with a raised arm and
large amber eyes; the sheet idle is a smaller standing full-body pose. The
extracted hero is therefore not a clean large-scale version of the sheet
character: its 72 × 88 bounding box is substantially larger than idle's
46 × 79, with a different gesture and eye/face treatment.

The head files are not usable avatars at their advertised sizes. The crop
includes lower-body/tail leakage: the head-32 has a separate 8-pixel
bottom-right component and head-16 has a separate 2-pixel component. At 16 px
the face is only marginally recognisable; at 32 px it is recognizable but too
tightly cropped, with ears/chin clipped by all four edges.

## Visual scores (10 = release-ready)

Scores are for the *final extracted assets*, assessed on both white and dark
navy preview backgrounds.

| Criterion | Score | Assessment |
| --- | ---: | --- |
| Cuteness | 6/10 | Source character is appealing; pink halos, fragments, and tiny output suppress it. |
| Detail fidelity | 3/10 | 4 px reduction destroys clean source details while retaining noise. |
| Readability at 32 px | 4/10 | Standing pose is recognizable, but working/error/sleep semantics blur. |
| Readability at 64 px | 6/10 | Faces read, but stray pixels and muddy working laptop remain obvious. |
| Light-background behaviour | 3/10 | Salmon/magenta fringe is immediately visible. |
| Dark-background behaviour | 5/10 | Navy outline loses separation; cyan/white still read, fringe remains. |
| Cross-pose consistency | 4/10 | Mismatched body scale, crop treatment, baseline, and effect handling. |
| SVG delivery format | 8/10 | Correct rect-only, crisp-pixel representation; it needs corrected source pixels. |

## Resolution

Partial. The extractor now rejects magenta-dominant/near-magenta pixels, uses a nine-swatch brand palette, and samples at a 2 px grid. The generator completed and wrote 18 assets. The preview at native scale and 4x was inspected after regeneration: idle, success, and error are recognizable, but working and sleep appear as detached fragments, and the hero/head crops are malformed. The generated preview is therefore not clean and this extraction is not ready to ship. Source-sheet regions contain complete working and sleeping poses; the current crop/component selection is failing to retain them, so this is not evidence that the source itself cuts off a limb. Remaining fixes: robust per-region component selection, normalized standing scale/baseline, explicit effect handling, face-specific head masters, and canonical hero alignment. No full suite, build, or typecheck was run.

## Prioritized FIX LIST

1. **Replace `keyed()` with a chroma-key plus alpha-matte rule.** Mark a source
   pixel transparent when it is magenta-dominant (`r > 180`, `b > 100`,
   `g < 90`) or within a tested Euclidean distance of `#FF00FF`; before palette
   lookup, discard partially keyed edge pixels rather than quantising them.
   Acceptance: final PNGs contain **zero** `#F08982` pixels and zero
   magenta-dominant opaque pixels.
2. **Remove `#F08982` and other key-derived colours from `palette`, then lock it
   to deliberate brand swatches.** Use a small, documented set of navy
   (`#0A1A2F` plus two outline/shade variants), azure `#0B6BFF`, sky
   `#5CA8FF`, white, one pale blue, and amber `#FFB020` plus one amber shade.
   Acceptance: no more than 12 opaque colours per sprite; amber is preserved
   for eyes/accent; no salmon/pink output exists.
3. **Derive each source pose crop from connected components after keying, not
   hard-coded `boundsList` alone.** Start from a generous named region, retain
   components touching the pose's main component or explicitly whitelisted
   effects, reject components below a measured area threshold, and add at least
   8 source pixels of transparent padding around the retained union.
   Acceptance: no non-whitelisted component under 12 final pixels; success has
   no left shard, error no right fragment, and sleep no top-left fragment.
4. **Use a smaller pixel grid or a controlled two-stage resample.** Replace
   `GRID = 4` with 2 px (or retain source pixels through a nearest-neighbour
   scale before final palette reduction); use alpha-aware/tally-weighted colour
   selection so foreground edges do not lose to keyed background. Acceptance:
   laptop keyboard/screen separates from tail at 64 px and eyes/badge retain
   at least two intentional tones.
5. **Normalise standing-pose scale and anchor their feet to one baseline.**
   Store per-pose crop/scale metadata; fit idle, working, success, and error to
   a shared target body height and align their foot-contact row to `y=91`.
   Treat sleep as a separately documented horizontal layout. Acceptance:
   standing body heights differ by at most 4 final pixels and all foot contacts
   share one y coordinate.
6. **Make detached effects an explicit layer.** Keep success sparkles and sleep
   `z` marks only when they pass component/colour rules, position them from
   per-pose metadata, and give them their own safe padding. Acceptance:
   effects are intentional, separated by at least 2 transparent pixels, and
   never resemble cropped body fragments.
7. **Generate heads from a face-specific crop, not fixed hero coordinates.**
   Find/fix the head bounding box with transparent margin, exclude the torso
   and tail, and export separately tuned 32 px and 16 px masters. Acceptance:
   neither head has opaque edge pixels or detached components; both eyes and
   ear silhouette are recognisable at native size.
8. **Choose one canonical idle design before extraction.** Either regenerate
   the hero to match the five-pose sheet or derive the hero from the same idle
   art with a documented larger rendering. Acceptance: hero and idle share the
   same face marking, badge placement, proportions, and palette, rather than
   merely related species/design cues.
