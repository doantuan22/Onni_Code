# 04 — Review of round-1 mockups

Reviewer: manager. Inputs: `03-mockups/round-1/*.png` and the worker self-critiques `notes-*.md`.
Verdict scale: **keep** (build as shown), **fix** (build with the listed changes), **redo**.

## Overall

The direction works. The mockups read as one calm, dark, precise product page: hairline cards,
mono vocabulary, sparse violet, real product names. What makes them feel premium is restraint —
keep it. The weak points are **consistency** (spine position, index badge style, frame size,
headline weight differ per image) and **truthfulness of the details** (garbled code, platforms
and CLI flags that do not exist).

## Decisions that apply to every section

| # | Issue seen | Decision |
| --- | --- | --- |
| G1 | Spine sits left in s2/s4/s8, center in s3/s5/s6/s9, right-of-center in s7 | **The spine lives in a fixed left rail** (x = container left − 48px on desktop, 20px on mobile). Where a section's diagram is centered (s3 fork, s5 tree, s6 gate), a branch leaves the rail horizontally at the section index and feeds the diagram's top node — a "tap", not a moved spine. |
| G2 | Index badge differs: boxed (s2, s3, s4, s9), plain violet (s5, s7, s8), grey (s6) | One style: Chakra Petch 600, 13px, violet, inside a 28px hairline square sitting on the spine rail, as in s2/s4. |
| G3 | Headline weight varies (bold s2/s3, light s5/s7/s8) | Inter 600, `clamp(2.4rem, 5vw, 4.25rem)`, -0.025em, `#EDEDED`; subline Inter 400 `#A1A1A1`. Every section has a subline (s5–s8 lost theirs). |
| G4 | Amber lamp glow strong in s2/s3/s5 | Lamp wash max `rgba(251,191,36,0.06)` and only behind the focal object; alternate warm (odd sections) and neutral violet-grey (even) so the page breathes. |
| G5 | Garbled or fake code (s6 diff) | All code/diff text is real, short and authored in HTML — never generated pixels. |
| G6 | Facts | `onni run "<task>" --workflow quick-task` (there is **no** `--backend` flag); desktop installer is **Windows** (do not claim macOS/Linux downloads); no external download URL is confirmed → CTAs are anchors + copyable commands. |
| G7 | "illustration — no repository action" labels | Keep on s3, s4, s6 only; 12px, `#8A8A8A`, bottom-right of the figure. |

## Per section

| Section | Verdict | Changes |
| --- | --- | --- |
| Hero (`hero-*.png`) | see addendum | (pending the hero worker) |
| s2 Backends | **keep** | YAML keys in `#A1A1A1`, values `#EDEDED`, strings `#10B981`; hovered tile also highlights the matching `backend:` line in the YAML; one tile shown as "not installed" (dimmed LED, `#8A8A8A`) to tell the discovery story; command line `onni run "Split settings into tabs" --workflow review`. |
| s3 Worktrees | **fix** | Single trunk stem → one 3-way junction node; fork fed from the spine rail (G1); restore diff stats and `git trunk · clean` on mobile. |
| s4 Live | **fix** | Right pane: full-height diff with context lines; diff matches the active step; footer gets clickable step pills `1 Read · 2 Edit · 3 Test · 4 Settle` (replaces "Step 3 / 4" text). |
| s5 Orchestration | **keep** | Packet glyphs → 6px rounded capsules; add subline; label the fence "roster" and the bounce "409 · not in roster"; worker cards show their file scope (`settings-tabs.tsx`, `settings.tsx`, `settings.test.ts`). |
| s6 Gate waiting | **fix** | Real diff (from s4), lanes must visibly **stop at a gap** above the card (a 24px dashed gap); `Merge` is the only violet button. |
| s6 Gate merged | **keep — the wow** | This is the signature frame: lanes curve into one node, the ignition gradient flashes once along the merge bar, "Your decision" marker stays. Keep the gradient to this one place. |
| s7 Automations | **keep** | Trigger titles in Inter (mono only for values like `weekdays 09:00`); the task card's badge "waits at review gate" is exactly the message. |
| s8 Local | **fix** | Headline typo → "No account. No cloud. Just files on your machine."; remove stray "JetBrains Mono" label; the three planes are the scroll-peel; add the `.ai/onni/` file list on the bottom plane. |
| s9 Launch | **fix** | Desktop card: "Tauri 2 shell · Windows installer"; CLI card shows `onni` and `onni run "<task>"`; the pixel horizon becomes the real scenery asset (`assets/scenery/*-light.png` at dawn) scaled ×4 with `image-rendering: pixelated`; footer: wordmark · MIT · fork of cezar · no telemetry. |
| Mobile (s3, s6) | **fix** | Spine rail at 20px, diagrams stack vertically, no element below 12px text. |

## Round 2

The image-generation quota ran out (Gemini image 429, ~5h reset; OpenCode has no image balance).
On the owner's instruction, **round 2 is built as HTML prototypes instead of images**: each section
is implemented directly in `site/` against the foundation contract, so the reviewed "mockup" is
the real page. Fixes above are the acceptance list for that round.
