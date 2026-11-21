# OnniCode logo review

**Reviewed:** 2026-11-21  
**Assets reviewed:** `logo-preview.png`, `onni-mark.svg`, `onni-mark-16.svg`,
`onni-mark-mono.svg`, `onni-lockup.svg`, `onni-lockup-rects.svg`, and
`logo-gen.mjs`.  
**Scale:** 1 = does not meet the brief; 3 = usable with clear revision work; 5 =
ready to ship.

## Summary

The concept is directionally appropriate: a pixelated ring paired with a prompt
chevron/cursor is relevant to a local coding-agent cockpit, and the generated
preview proves the intended use cases. It is not yet a strong replacement for
the current pixel-block `O` + chevron. The candidate is very close to a generic
blue “terminal in a ring” app badge, loses the brief's navy/azure two-colour
identity in its primary mark, and becomes visually busy at favicon scale.

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Distinctiveness vs. current logo | **3/5** | The inner prompt/cursor is a meaningful coding cue, but the outer blue ring still reads as a generic `O`/app badge. At small scale it is less immediately recognizable than the current block `O` and separate navy chevron. |
| Brand-palette fidelity | **2/5** | The primary mark uses azure `#0B6BFF` and sky `#5CA8FF` only (`logo-gen.mjs:5-10`, `mark` at lines 14-31). Navy `#0A1A2F`, a required half of the established identity, appears only in the mono alternative and the wordmark's “Code”. This makes the main symbol azure-only. |
| Legibility at 16 px / 32 px | **2/5** | `onni-mark-16.svg` has a 14×14-pixel painted footprint with a 2-pixel-thick ring, leaving its chevron and cursor compressed into the centre. In the 16 px preview the cursor is indistinct and the mark reads as a small blue eye/ring. At 32 px the silhouette and chevron become readable, but the detached cursor remains an unexplained blob. |
| Dark and light surfaces | **3/5** | The blue is clear on the navy preview and acceptable on white, and the preview correctly shows both. On light, the 1 px sky-blue bevel has little structural value and lowers edge clarity; on dark, the absence of navy prevents the mark from using the full brand contrast. There is no independent dark/light mark treatment beyond placing the same mark on each surface. |
| Grid craft | **2/5** | The right-hand bevel creates uneven edge steps: rows `y=1..4` extend sky blue through `x=11..13`, while the lower right is a solid azure wall. The mark's row `y=10` adds an isolated two-cell cursor at `x=10..11`, separated from the chevron by three empty cells and from the rim by one; at 16 px this reads as a stray pixel mass rather than a cursor. The asymmetry is not consistently explained by a lighting direction. |
| Wordmark / lockup quality | **3/5** | Colour ownership is correct in both lockups: “Onni” is azure and “Code” navy. The text lockup permits a non-pixel font rendering despite `crispEdges`; its `textLength` compression may vary by installed font. The rect lockup is sturdier, but only seven grid rows high and reaches the viewBox's right edge (`x=64` in a 65-wide viewBox), so it has no right-side breathing room. |
| SVG rules compliance | **3/5** | Positive: SVG element usage is limited to `svg`, `title`, `rect`, `g`, and the permitted `text`; geometry is integer-aligned rects; `shape-rendering="crispEdges"` is present; the grid generator is a single dependency-free `.mjs`; no gradients, images, or filters occur. Gaps: the lockup viewBoxes are rectangular (`72 16` and `65 16`) rather than the brief's square-viewBox rule, and the primary mark does not exercise the fixed navy+azure system. The rect-only lockup requirement is met by `onni-lockup-rects.svg`. |

## Detail

### Mark construction

The main 16×16 grid has a strong, centred overall footprint, but it mixes two
visual ideas at the same tiny scale: a beveled ring, a left-pointing prompt, and
a separate cursor. The chevron becomes legible only after enlargement. The
highlight begins across the top and upper-right, but its abrupt stop after
`y=4` makes the upper half look beveled and the lower half merely blue. The
monochrome mark has a more even perimeter, confirming that the colour treatment
rather than the base silhouette is the source of most of the imbalance.

### Lockups

The preview sheet is useful and correctly includes 16, 32, 64, and 256 px
examples plus dark and light surfaces. The displayed lockup looks crisp because
the PNG uses the rect-built grid. The separate text lockup should not be relied
on as the canonical pixel lockup: a browser can substitute a different
`Chakra Petch` font and its smooth glyph edges conflict with the pixel-art
promise. The rect lockup should be retained as the deterministic version.

## FIX LIST

1. **Restore navy to the primary mark (highest priority).** In the `mark` grid
   in `logo-gen.mjs`, make the structural ring navy (`N`) and reserve azure
   (`A`) for the coding glyph, or make the outer ring navy with azure on the
   upper-right bevel. Keep sky (`S`) to at most a short 1-cell highlight; do
   not ship an azure-only primary mark.
2. **Remove or integrate the isolated cursor.** The two `A` cells at grid
   coordinates `x=10..11, y=10` should either be removed, or joined to the
   chevron with a deliberate 1-cell stem (for example, add cells at
   `x=9, y=9..10`) and given a consistent cursor shape. Re-test at native
   16 px; if it does not read as a cursor without zoom, omit it.
3. **Normalize the rim's pixel staircase.** Rebuild rows `y=1..5` and their
   lower counterparts as paired left/right steps around one centre line. In
   particular, replace the upper-right-only sky run at `x=9..13, y=1..3`
   with a continuous, intentional 1-cell bevel, or remove it entirely. The
   rim should not change from highlighted stepped geometry above to a flat
   two-cell wall below.
4. **Give the 16 px mark more central clarity.** Reduce the ring to a
   consistent 1-pixel stroke at the middle rows (`y=5..11`), or enlarge the
   chevron's open counter by one cell on each side. Preserve at least a
   1-pixel transparent margin, but do not spend a 14×14 footprint on a
   2-pixel rim when the coding glyph is only 2 pixels wide.
5. **Make the rect lockup safe at its right edge.** Change
   `onni-lockup-rects.svg` generation so the viewBox is at least `67 16`
   (two empty grid columns after the last wordmark cell), rather than ending
   the `e` at `x=65`. Centre the resulting lockup in the preview sheet.
6. **Resolve the square-viewBox requirement explicitly.** Keep the mark SVGs
   square, but either place the lockups in documented square canvases with
   transparent padding or obtain an explicit brief exception for horizontal
   lockups. The current `72 16` and `65 16` viewBoxes cannot satisfy that
   requirement as written.
7. **Choose one canonical lockup for pixel output.** Use
   `onni-lockup-rects.svg` wherever the brand promises pixel art; retain
   `onni-lockup.svg` only as an optional typographic lockup after verifying
   Chakra Petch availability and cross-platform rendering.
