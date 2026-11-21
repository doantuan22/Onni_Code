# Onni mascot — critical design review

Reviewed 2026-11-21 against the shared brand brief and the assigned robot-fox direction. **Verdict: revise before adoption.** The palette and vector construction are sound, but this currently reads as a friendly monitor robot, with weak state differentiation and an unreliable small-size identity. No artwork or generator was changed for this review.

## Evidence and scores

Inspected `mascot-sheet.png` (32px and 256px, light and dark), all seven SVGs, `sprite-frames.json`, `mascot-gen.mjs`, the existing `../../logo.png` and the proposed sibling logo mark. Coordinates below are zero-based source-grid pixels, with inclusive ranges unless stated otherwise. Scores are out of 10; 10 means ready to ship against the brief.

| Criterion | Score | Assessment |
| --- | ---: | --- |
| Silhouette / robot-fox identity | 3 | The 22px-wide rectangular monitor dominates; capped antenna stalks and small wheels communicate TV robot. No muzzle, tapered cheeks or tail establishes a fox. |
| Charm | 6 | Large eyes, tiny catchlights and compact proportions are approachable. The unchanged grin makes working/error feel emotionally generic; the square eye sockets can read as glasses. |
| Palette discipline | 9 | Exactly six permitted opaque colours per SVG, plus transparency. Amber remains a small accent. Navy and ink are too close to separate on dark surfaces. |
| Pose distinctness | 3 | Working is visibly wider, but success/error largely reuse idle's face and body. Sleep depends on side marks and pupil removal rather than a resting posture. |
| Animation frames | 2 | Six total frames: idle has two; working, success, error and sleep each have one. This is mostly a set of stills, not a usable animated state set. |
| 16px readability | 2 | The named 16px variant is a cropped-content 32px grid, not a hand-tuned 16px design. Face details fall between output pixels. |
| 32px / 256px readability | 6 | Robot and broad facial expression read on white. Enlarging makes construction clean but exposes the flat, repeated poses. Dark silhouette breaks apart. |
| SVG rules | 10 | All seven parse as XML, use only svg/title/g/rect, square 32×32 viewBoxes, integer axis-aligned rects and crispEdges; six fills, no forbidden effects or embedded images. |
| Generator / preview completeness | 6 | Dependency-free ESM creates string grids, JSON, vector assets and nearest-neighbour PNG through zlib/PNG chunks. However the sheet omits 16px, the separate head and the blink frame, and provides no frame timing. |

Scores separate visual suitability from structural compliance; valid SVG does not establish a finished mascot.

## Suspicions: findings

| Suspicion | Finding | Concrete evidence |
| --- | --- | --- |
| No readable `<` logo motif | **Confirmed visually.** An attempted motif exists in code, but its geometry is wrong. | The generator calls x15/y10 and x17/y10 amber pixels a “tiny < motif”. Both dots occupy the same row, with **azure**, not navy, between them. No diagonal staircase or left apex exists. Compare the logo's actual chevron. |
| Poses too similar | **Confirmed, with working the strongest exception.** | First-frame differences from idle across 1,024 grid cells: working 94 (9.2%), success 14 (1.4%), error 18 (1.8%), sleep 32 (3.1%). These counts include decorative marks; they are supporting evidence, not a perceptual metric. Shared head/body silhouette and eye direction dominate the sheet. |
| Error still smiles | **Confirmed.** | The original white mouth at x13–18/y16 and x14–17/y17 survives except x15–16/y16, overwritten with ink. The lower four white pixels remain a smiling bowl around the new dark notch; amber at x15–16/y18 resembles a tongue/status light. |
| Navy outline vanishes on dark | **Confirmed; the actual outer outline is ink.** | Sheet background and outer outline both use #06101F, so that edge has 1:1 contrast. Navy #0A1A2F against ink is approximately 1.09:1. The ears' caps disappear, and feet, neck and arms lose separation. Azure face borders remain visible, so the whole mascot does not disappear. These ratios describe the failure, not a WCAG requirement for decorative art. |
| TV robot rather than robot-fox | **Confirmed as a design judgment.** | Ear caps are five-pixel horizontal bars that narrow downward; fox ears should taper upward. A flat 22×12px monitor, flat cheeks and wheeled body reinforce the appliance reading. The generator itself calls the face “monitor-like”. |
| 16px head illegible | **Substantially confirmed, not literally invisible.** | `onni-mascot-16.svg` has viewBox 0 0 32 32 and simply removes rows y20 onward. Its visible bounds x5–26/y2–19 become roughly 11×9px at 16px, leaving six empty output rows below. Single-source-pixel highlights and mouth rows become half-pixels. Two nearest-neighbour sampling phases lose different details (mouth, dots or eye highlight). A generic face remains, but its expression and identity are unstable. |

## Frame and implementation observations

- The idle blink clears only pupil interiors, leaving bright 5×4px eye sockets and adding one dark bottom pixel per eye. It reads as hollow square eyes more readily than closed lids. Sleep inherits this treatment.
- Sleep's side symbols are right-angle brackets, not readable stepped Zs: the large one runs x24–27/y6–9 and overlaps the head around y9. The lower one also abuts the face. Keep symbols clear of the silhouette.
- Success adds a narrow raised appendage largely against the right edge of the head; the eyes and body stay unchanged. Its mouth grows by only two pixels. The gesture needs more separation to read at 32px.
- Working adds two side blocks and a lower strip, but no keyboard/tool action or second frame makes their purpose clear.
- JSON has consistent 32-row, 32-column grids and valid palette symbols. Read-only reconstruction confirms all seven SVGs match the intended JSON grids (head variant equals idle through y19). It contains no durations, playback order policy or loop/one-shot semantics. No runtime playback was supplied or evaluated.
- The preview sheet has light/dark surfaces and integer 8× enlargement as required. Its first two rows occupy only the leftmost 160px. No labels identify pose order, which is idle, working, success, error, sleep. Transparent space should not substitute for missing size/animation evidence.

## Review validation

Read-only XML checks passed for all seven SVGs: allowed elements, integer geometry, crispEdges, square viewBox and six colours. JSON dimensions/palette and SVG-to-frame parity passed. Inspected the PNG and a temporary two-phase 16px head sampling preview; the latter diagnoses information loss, not exact browser rasterization. Generator source was inspected rather than rerun in the asset directory, preserving the explicit no-asset-edit constraint. Full application check outcomes belong in the worker report; they do not change these asset findings.

## FIX LIST — prioritized

1. **P0 — make error unambiguously concerned.** Before adding error details, clear the entire inherited mouth rectangle x13–18/y16–18 to navy. Replace it with a neutral 4×1px white dash at x14/y17, or a distinct stepped frown; remove the amber “tongue”. Change eyelids/brows as well, without relying on amber warning marks. Acceptance: error is distinguishable from idle in monochrome at 32px.
2. **P0 — author a real 16×16 head.** Give the small SVG a 0 0 16 16 viewBox and its own sixteen 16-character rows. Use approximately x1–14/y1–14 for the head/ears, ≥2px eye masses separated by ≥2px, a ≥2×1px mouth, and no subpixel catchlights. Remove forehead confetti at this size. Acceptance: actual 16px light/dark renders preserve the same face and ear identity without sampling-phase dependence.
3. **P0 — recover dark-surface silhouette.** Preserve transparent backgrounds, but use sky/azure on exposed ear tips, cheek edges, arms and feet, or supply a deliberately tuned dark-surface variant. Start with a 1-source-pixel sky edge on the outer silhouette; avoid flooding the entire face. Acceptance: both ear tips, head corners, body and feet remain separable against #06101F and #0A1A2F at 32px. Recheck at 16px independently.
4. **P1 — establish fox anatomy before polishing expressions.** Replace the flat ear caps with upward-tapering stepped ears (for example rows of width 1, 3, 5 from tip downward), inset azure interiors, and keep ≥2px clear space between ears and head centre. Step each lower cheek inward by 1–2px over the last 3 head rows to form a muzzle; add a compact pale muzzle/nose and, if space permits, a stepped side tail with a light tip. Redraw overlapping eyes/mouth after the silhouette change. Acceptance: a filled-silhouette thumbnail suggests a fox, while face/body details still communicate robot.
5. **P1 — replace the two dots with one real brand chevron.** On the 32px design, a concrete 3×5px `<` can occupy x15–17/y9–13: rows `..S`, `.S.`, `S..`, `.S.`, `..S` (sky; transparent cells retain the underlying fill). Reserve a clear patch or move the badge to the torso to avoid eyes. Use one motif, not repeated amber dots. Tune a separate 3×3px staircase only if it fits the 16px face. Acceptance: the symbol points left at 32px and matches the logo's visual grammar.
6. **P1 — redraw state gestures, not just accessories.** Give success both raised arms with ≥1px background gaps from the head and closed happy eyes; working should lean or direct its gaze toward a clearly stepped keyboard/tool; sleep should lower the head/body by 1–2px and use actual horizontal eyelids. Move sleep symbols ≥1px outside the head, with stepped diagonals if using Zs. Keep a common ground baseline and recognizable ears. Acceptance: all five states can be named from unlabelled 32px thumbnails, including a greyscale pass.
7. **P1 — supply motion and playback intent.** Add at least two meaningful frames for working, success, error and sleep; replace hollow-socket blinking with full closed lids. Suggested starting timings: idle 1,800ms open + 100ms blink; working 200–300ms alternating action; success 120–180ms raised gesture then held settle; error a brief 1px shake then concerned hold; sleep 600–900ms breathing frames. Record explicit duration and loop/one-shot policy alongside each state, keep body anchors stable, and provide a reduced-motion static frame. Preview the actual sequence before declaring it animated.
8. **P2 — finish the review sheet and regeneration check.** Show every pose and frame, plus the separate head, at actual 16px and 32px and integer-scaled 256px on both surfaces. Identify pose/frame order in accompanying metadata or labels outside the mascot assets. Preserve the six-colour palette, rect-only geometry, square viewBoxes and dependency-free generator. Regenerate once, confirm SVG/JSON/PNG agreement and a clean second generation, then repeat the unlabelled state and silhouette reviews.
