# Round-1 Mockups — Notes & Critique (Sections 5–9 + Mobile)

All 7 mockups were generated on the `#090909` matte dark canvas with `#111111`/`#151515` surfaces, `#242424` hairlines, `#EDEDED` ink, `#8F86E8` Signal Spine, and real OnniCode vocabulary (`onni/<id8>`, `.ai/onni/worktrees/<runId>`, `ONNI_DRY_RUN=1 npm run dev`).

---

## 1. `s5-orchestration.png` (Desktop 1376×768)

- **What it shows:** Section `05` ("One manager. A fenced roster of workers."). A `Manager · claude` node dispatches downward along `#8F86E8` lines to three listed workers inside a dashed `Roster fence` box (`claude (onni/3f2a91c4)`, `codex (onni/8b12c409)`, `agy (onni/1d4e70b2)`), while an amber `#FBBF24` packet aimed outside the fence bounces off with a `409 blocked by roster` badge next to `cursor — not in roster`.
- **Motion state:** Mid-dispatch cycle (t ≈ 0.5s after manager dispatches: staggered downward packets in flight, `claude` green report returning upward, unlisted `cursor` packet mid-bounce off the fence).
- **Honest critique (weaknesses):**
  1. **Signal Spine break:** The top `#8F86E8` Signal Spine is interrupted by the headline text rather than running continuously beside or behind the header into the Manager node.
  2. **Inconsistent return arrows:** `codex` has a green upward line whose packet chevron points *downward*, and `agy` uses a `#8F86E8` violet upward return path instead of `#10B981` emerald like `claude`.
  3. **Bounce geometry:** The amber packet bounces off the top-right corner of the `Roster fence` box rather than aiming toward `cursor — not in roster` and visibly deflecting off the right wall of the fence.
  4. **Subtle card shadows:** The Manager and worker cards have slight drop shadows instead of purely flat luminance steps + 1px `#242424` hairlines.

---

## 2. `s6-gate-waiting.png` (Desktop 1376×768)

- **What it shows:** Section `06` ("Nothing merges itself."). The `#8F86E8` Signal Spine splits into 3 parallel worktree lanes (`onni/3f2a91c4`, `onni/8b12c409`, `onni/1d4e70b2`) that terminate at open circular endpoints above a visible horizontal gap. Below the gap sits the `Review Gate` panel with a `review` pill, changed files (`settings-tabs.tsx +142 -38`, `settings.test.ts +64 -0`), a diff snippet, `Open draft PR` and `Merge` buttons, and the `illustration — no repository action` caption.
- **Motion state:** Paused / waiting at the review gate **before** the visitor clicks `Merge`.
- **Honest critique (weaknesses):**
  1. **Garbled diff code:** Inside the diff preview box, the generated TypeScript lines are nonsensical/garbled (`typeSeck()`, `.nonovvatioèloetip()`, `const nooder: {settings-tabs();`). Needs real, clean TypeScript diff lines in Round 2.
  2. **Center lane label overlap:** The `onni/8b12c409` label sits directly on top of the center lane line, breaking the line visually instead of sitting beside it.
  3. **Review pill contrast:** The `review` badge uses a solid `#93C5FD` fill with dark text; a subtle tinted/bordered pill (`rgba(147,197,253,0.12)` + `#93C5FD` border/text) would feel calmer and more consistent with the dark cockpit UI.
  4. **No outgoing Signal Spine:** The spine stops at the panel; in the full page flow, a faint/dormant outgoing spine below the gate would better telegraph that the downstream path is waiting on the click.

---

## 3. `s6-gate-merged.png` (Desktop 1376×768)

- **What it shows:** Section `06` ("Nothing merges itself.") after human approval. The 3 worktree lanes (`onni/3f2a91c4`, `onni/8b12c409`, `onni/1d4e70b2`) enter the `Review Gate` panel, converge onto a single horizontal ignition-gradient latch (`#B4F372 → #EEFB63 → #BC9AFF`), and exit downward as one `#8F86E8` Signal Spine line. The panel shows an emerald `Merged` pill and a `Your decision` marker badge.
- **Motion state:** **After** the visitor clicks `Merge` (t = 600ms settled convergence + ignition flash + `Your decision` marker).
- **Honest critique (weaknesses):**
  1. **Missing diff context:** Unlike `s6-gate-waiting.png`, the merged state drops the file list (`settings-tabs.tsx`, `settings.test.ts`), making the transition between waiting and merged feel like two different panels rather than one panel morphing in place.
  2. **Excessive glow on the ignition bar:** The `#B4F372 → #EEFB63 → #BC9AFF` bar has a soft outer bloom that edges toward "neon fog"; a crisper 2px–3px hairline flash with minimal radial falloff would fit the instrument aesthetic better.
  3. **Section index decoration:** A tiny cube/hexagon icon appeared to the left of `06`, which is not part of the `02-concept.md` typography system (only `06` in Chakra Petch).

---

## 4. `s7-automations.png` (Desktop 1376×768)

- **What it shows:** Section `07` ("Work that starts on its own — and still waits for you."). Three trigger cards on the left (`GitHub poll`, `Jira / Linear`, `Schedule`) merge along `#8F86E8` lines into an `onni task` card showing `worktree .ai/onni/worktrees/7e4d12a0`, `branch onni/7e4d12a0`, and a `waits at review gate` badge, with the vertical Signal Spine entering from top and exiting downward.
- **Motion state:** Settled trigger-to-task minting state (pulse arrives from triggers → `onni task` card minted → lane exits toward the review gate).
- **Honest critique (weaknesses):**
  1. **Trigger card font mismatch:** The trigger titles (`GitHub poll`, `Jira / Linear`, `Schedule`) and `onni task` are rendered in monospace instead of Inter (sans), making them compete visually with the mono sub-labels and paths.
  2. **Solid blue badge:** Like `s6-gate-waiting`, `waits at review gate` is a bright solid `#93C5FD` pill that draws more attention than the `onni task` title itself.
  3. **Top spine alignment:** The incoming Signal Spine enters the right edge of the `onni task` card cleanly, but its X-position is far to the right of the `07` index, so it doesn't align with a consistent page-wide spine column.

---

## 5. `s8-local.png` (Desktop 1376×768)

- **What it shows:** Section `08` ("No account. No cloud. Just files on your machine."). Left-aligned `08` index and headline beside a vertical `#8F86E8` Signal Spine; on the right, three isometric layered planes (`Cockpit UI`, `/api/v1 contract`, `Plain files`) inside a dotted boundary labelled `your machine` with `no account · no database · no telemetry`.
- **Motion state:** Scroll-peeled state (all three architectural planes separated vertically along the Z/Y axis so each layer is readable).
- **Honest critique (weaknesses):**
  1. **Headline typo (must fix in Round 2):** Reads `"No account. No No cloud. Just files your machine."` (duplicated `No`, missing `on` before `your machine`). A retry edit pass was blocked by `gemini-3.1-flash-image` quota exhaustion (`429 RESOURCE_EXHAUSTED`, ~4h56m reset).
  2. **Leaked font label (must fix in Round 2):** The bottom-right corner literally prints `"JetBrains Mono"` above `"no account · no database · no telemetry"`.
  3. **Low contrast on plane subtitles:** `Hono · Zod · WebSocket bus` and `.ai/onni/ · ~/.onni/ · JSON · NDJSON · MD` are slightly dim against the `#111111` plane surface.
  4. **Spine hidden behind planes:** The vertical violet spine only peeks between the planes on the far left of the isometric stack rather than visibly threading through the 3 layers.

---

## 6. `s9-launch.png` (Desktop 1376×768)

- **What it shows:** Section `09` ("Sit down at the cockpit."). Centered `09` badge and headline, `#8F86E8` Signal Spine terminating at the `Desktop app` card (`Tauri 2 shell · Windows / macOS / Linux` + ignition-gradient-edged `Download` button) beside the `CLI` card (`onni · onni run`), a copyable `ONNI_DRY_RUN=1 npm run dev` bar with an emerald checkmark and 2-line boot log, a pixel-art dawn horizon strip, and the minimal footer (`onni` · `MIT · fork of cezar · no telemetry`).
- **Motion state:** Post-copy / settled dawn state (command copied → emerald `#10B981` check + 2-line boot log visible; horizon brightened to dawn).
- **Honest critique (weaknesses):**
  1. **Boxed `09` index:** `09` is enclosed in a rounded violet rectangle rather than plain Chakra Petch numerals like sections `05`–`08`.
  2. **Centered vs. spine-anchored layout:** The centered symmetry looks very clean, but the Signal Spine terminates at the top edge of `Desktop app` (off-center left) while the `09` badge is dead-center.
  3. **Empty CLI card body:** The `CLI` card only shows `>_` in the bottom-left and feels slightly under-populated compared to the `Desktop app` card with its `Download` button.
  4. **Pixel horizon dithering:** The dawn sky uses fine checkerboard dithering that looks great at 1:1, though we should ensure the final `site/assets/` pixel horizon PNG uses crisp integer-scaled pixels (`image-rendering: pixelated`) without JPEG compression artifacts.

---

## 7. `s6-mobile.png` (Mobile 768×1376, 9:16 aspect for 390px layout)

- **What it shows:** Mobile responsive view of Section `06` ("Nothing merges itself."). Sticky 56px mobile header (`onni` + menu icon + `#8F86E8` progress hairline), `06` index, headline, 3 compact vertical worktree lanes (`onni/3f2a91c4`, `onni/8b12c409`, `onni/1d4e70b2`) stopping at a gap above a stacked `Review Gate` card (`settings-tabs.tsx +142 -38`, `review` pill, diff box, full-width `Merge` and `Open draft PR` buttons), and `illustration — no repository action`.
- **Motion state:** Waiting state before the Merge click (mobile 390px viewport).
- **Honest critique (weaknesses):**
  1. **Garbled diff snippet:** The diff box contains synthetic nonsense (`diff { if -= settings-tabs.tsx(); };`) with repeated line number `18`.
  2. **Missing incoming Signal Spine:** There is no `#8F86E8` spine connecting from the top bar / headline into the 3 worktree lanes; the 3 lanes just float below their branch labels.
  3. **Missing `settings.test.ts` row:** Only `settings-tabs.tsx` is shown, whereas the desktop waiting state shows both files.
  4. **Wordmark & index font:** `onni` and `06` rendered in Inter/sans rather than Chakra Petch 600.
