# Round 1 Mockups — Notes (Sections 2, 3, 4 + Mobile S3)

All images are rendered on `#090909` matte black with `#111111`/`#151515` surfaces, `#242424` 1px hairlines, `#8F86E8` Signal Violet spine, `#EDEDED`/`#A1A1A1`/`#8A8A8A` ink, and real OnniCode vocabulary. Desktop frames are `1440×804` PNG; the mobile frame is `390×699` PNG.

---

## 1. `s2-backends.png` (`1440×804`)

- **What it shows:** Section 02 (*"Bring the agents you already use."*). Left-aligned Signal Spine (`#8F86E8`) passing through the `02` Chakra Petch index badge, followed by a 2-column layout: a 3×3 grid of all 9 supported backends (`Claude Code` / `claude`, `Codex` / `codex`, `OpenCode` / `opencode`, `Cursor Agent` / `cursor`, `pi` / `pi`, `Junie` / `junie`, `GitHub Copilot` / `copilot`, `Cline` / `cline`, `Antigravity` / `agy`) with a mono command preview bar below (`$ onni run --backend agy --workflow review.yaml`), paired with a `workflows/review.yaml` card on the right.
- **Motion state depicted:** Mid-discovery sweep + hover state (~t=0.4s after section entry). Most LEDs have settled to green (`#10B981`), `Cursor Agent` is mid-sweep at amber (`#FBBF24`), and `Antigravity` is in its hovered/selected state (`#151515` surface, `1px solid #8F86E8` hairline) driving the command preview below.
- **Honest critique (weaknesses):**
  1. **Headline tracking & alignment:** The headline *"Bring the agents you already use."* is slightly heavy/bright compared to the subtle instrument aesthetic of `02-concept.md`, and the left margin between the `02` badge on the spine and the headline could be tighter and more consistent with `s4-live.png`.
  2. **Command preview feedback:** Hovering `Antigravity` highlights the tile and updates the command bar, but there is no subtle visual connector or active-line highlight inside `workflows/review.yaml` linking `agy` in the grid to `backend: agy` in the YAML card.
  3. **Missing "discovered" / "missing" degradation state:** All 9 tiles look equally available (8 green, 1 amber). Showing one tile in a muted/degraded state (or an explicit `discovered` count) would better communicate zero-config capability discovery.
  4. **YAML syntax palette:** The YAML keys use a slightly saturated purple that competes a bit with the `#8F86E8` Signal Spine instead of staying in the muted `#A1A1A1` / `#8F86E8` / `#10B981` token range.

---

## 2. `s3-worktrees.png` (`1440×804`)

- **What it shows:** Section 03 (*"Every task gets its own worktree."*). Centered Signal Spine (`#8F86E8`) passing through `03` into a `main` (`git trunk · clean`) node, then forking into 3 parallel 1px violet lanes connected to 3 worktree cards (`Split settings into tabs` / `onni/3f2a91c4` / `claude`, `Add tab keyboard navigation` / `onni/8b14c0e2` / `codex`, `Write settings unit tests` / `onni/c7d04a19` / `agy`), with diff stats (`+142 -38`, `+64 -12`, `+98 -0`), continuing lanes at the bottom, and the `illustration — no repository action` label at bottom-right.
- **Motion state depicted:** Scroll-linked fork settled at `p ≈ 0.85` — the `stroke-dashoffset` fork paths have finished drawing out from `main` into all 3 lanes, the 3 worktree cards have slid into position, and the middle card (`onni/8b14c0e2`) is highlighted as the active running lane.
- **Honest critique (weaknesses):**
  1. **Spine alignment jump between sections:** `s2-backends.png` and `s4-live.png` place the Signal Spine on the left margin (`~80px` from left), whereas `s3-worktrees.png` centers the spine and headline. In the real continuous page, centering the spine only for Section 3 would require a horizontal jog or a deliberate split-transition from left spine → center trunk → back to left spine in Section 4.
  2. **Center lane overlap behind `main`:** Where the 3 violet paths exit the bottom of the `main` pill, they run very close together (3 parallel vertical segments) before branching; a single trunk stem that splits at a clean 3-way junction node would read crisper.
  3. **Card internal spacing:** The diff counts (`+142 -38`) sit at the bottom-right on the same row as the backend pill (`claude`), which works, but the vertical gap between the path (`.ai/onni/worktrees/...`) and the bottom metadata row is slightly looser than the tight top header.

---

## 3. `s4-live.png` (`1440×804`)

- **What it shows:** Section 04 (*"See the work while it happens."*). Left-aligned Signal Spine (`#8F86E8`) passing through `04` and branching horizontally into the pinned cockpit twin panel (`Run 3f2a91c4 · onni/3f2a91c4 · claude`, tabular counters `14,820 tok · $0.18 · 00:42`). Left pane shows 3 streamed step rows with `read_file`, `edit_file`, and `run_command` tool-call pills plus `12 passed`. Right pane shows the inset diff viewer for `packages/web/src/routes/settings.tsx` with a typing violet cursor. Footer shows `Step 3 / 4`, a 75% progress bar, and `illustration — recorded run`.
- **Motion state depicted:** Pinned scroll scrub at `p = 0.75` (`Step 3 / 4` active). Steps 1 and 2 are complete (`#10B981`), Step 3 (`Run vitest suite`) is active (`#8F86E8`) with `12 passed`, and the diff viewer is mid-type on line 4 (`<TabPanel id="resources" />|`).
- **Honest critique (weaknesses):**
  1. **Diff viewer vertical centering:** The inset diff box in the right pane is vertically centered with large empty `#111111` padding above and below it, making the right pane feel under-filled compared to the left pane. Filling the right pane height (or showing surrounding context lines) would look much more like a real cockpit twin.
  2. **No visible scroll-step pills:** `02-concept.md` specifies step pills on pinned stages so visitors can jump (`Step 1`–`4` or reduced-motion tabs). Currently the footer only shows static `Step 3 / 4` text and a progress bar, not interactive step pills.
  3. **Diff line semantic mismatch with active step:** Step 3 (`Run vitest suite`) is active on the left while the diff on the right is still typing `settings.tsx` (which belongs to Step 2 `Extract tab panels`), creating a slight narrative mismatch in the scrubbed state.

---

## 4. `s3-mobile.png` (`390×699`)

- **What it shows:** Mobile (`390px` wide) view of Section 03 (*"Every task gets its own worktree."*), including the 56px sticky top bar (`onni` wordmark + menu icon), left-margin Signal Spine (`#8F86E8`) passing through `03`, `main` trunk pill, and 3 stacked worktree cards connected via horizontal 1px violet branch ticks, ending with `illustration — no repository action`.
- **Motion state depicted:** Settled mobile fork state (vertical stack). The trunk and all 3 worktree cards are revealed, with Card 2 (`onni/8b14c0e2` / `codex`) highlighted in `#8F86E8` violet.
- **Honest critique (weaknesses):**
  1. **Missing diff stats on mobile:** Unlike `s3-worktrees.png`, the mobile cards omit the `+142 -38` diff counters, losing part of the visual proof of isolated work per branch.
  2. **`main` pill lacks `git trunk · clean` sublabel:** Desktop shows `main` + `git trunk · clean` + branch icon, whereas mobile only shows a plain `main` text pill, making it feel slightly bare.
  3. **Card 2 violet border contrast:** On the small mobile viewport, the `#8F86E8` border on Card 2 is slightly brighter/thicker-looking than the 1px `#242424` hairlines on Cards 1 and 3; toning it to `rgba(143,134,232,0.5)` would keep the 1px hairline restraint.
  4. **Sticky nav progress hairline missing:** `02-concept.md` specifies a 1px spine-colored progress hairline along the bottom of the 56px sticky nav; here the nav bottom border is uniform `#242424`.
