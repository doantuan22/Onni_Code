# Concept C — Parallel Worlds: The Merge Is Yours

## 1. Creative thesis

OnniCode turns one repository into a set of parallel worlds: each task gets its own isolated git worktree, its own branch of light, and room to move without disturbing the others. The page should feel less like a dashboard pitch and more like watching a precise system of illuminated lanes emerge from a single source. A manager can divide a goal among workers; their paths progress independently, carrying visible evidence—steps, tool calls, tokens, cost and diffs—until their finished branches arrive at a review point. They do not fuse by themselves. The visitor is the decisive force: one deliberate, human click is the only event that lets the branches converge. The emotional arc is possibility → clarity → control, with a crafted, quiet confidence rather than sci-fi spectacle.

## 2. Visual language

**Palette.** Use the cockpit’s near-black `#090909` as the main night field, with slightly lifted panels `#111111` and `#151515`, hairlines `#242424`, and readable warm-white text `#ededed`. Violet `#8f86e8` is the primary route light: it marks the active task and the human-controlled merge point. Use the brand gradient sparingly—lime `#b4f372` through `#eefb63` to lavender `#bc9aff`—as a small signal of movement or a single hero highlight, not as a permanent rainbow. Status colors should communicate meaning: green `#10b981` for finished well, amber `#fbbf24` for pending, red `#ef4444` for a failed check. Secondary explanatory text is `#a1a1a1`. Keep every color subordinate to contrast and clarity.

**Typography.** Pair Chakra Petch Semibold for large display lines and the wordmark with Inter for body, controls and longer copy; use JetBrains Mono for branch names, paths, short event labels and code-like evidence. Keep display lines compact and expressive, but body copy calm and comfortably readable. Avoid turning whole paragraphs into monospace or using uppercase as a substitute for hierarchy.

**Texture and light.** The field is mostly matte black, with a very faint coordinate grid and occasional tiny stars/points at low opacity. Lanes are thin, crisp strokes with soft violet edge light; bright nodes mark meaningful state changes, not decoration. Panels use subtle surface steps and borders instead of glass blur, thick shadows or floating-card piles. Grain, if present, is static, extremely fine and nearly imperceptible. Light should appear to travel along a route, not bloom across the whole viewport.

**Iconography and imagery.** Draw a small family of consistent line icons—repository/source, isolated branch, worker, activity trace, diff, review gate—using simple geometry and accessible labels. No stock developer photography, humanoid robot mascots, fake terminal walls or invented product screens. Use a deliberately schematic, editorial illustration: lanes, task markers and compact abstract UI fragments that explain the product without pretending to be a screenshot of a feature not in the brief.

## 3. Page structure (nine sections)

### 1. Opening field — establish the parallel worlds
**Purpose:** Explain the central promise immediately and orient the visitor to a tool for people already using coding agents.  
**Headline:** “One repository. Room for many agents.”  
**Subline:** “Run AI coding tasks side by side in isolated worktrees. Follow every branch. Decide what comes together.”  
**Layout:** Full-height dark hero; copy left, a large responsive lane diagram right, compact navigation and one primary “Explore the workflow” anchor. A secondary text link can point to the repository/project destination only if the final site has a confirmed URL.  
**Signature effect:** At load, five thin lanes draw from one origin; each takes a distinct path and receives one small activity marker. Trigger once after the document is ready; 900ms cubic-bezier(0.16, 1, 0.3, 1). No perpetual pulsing.

### 2. The friction — one task need not occupy the whole lane
**Purpose:** Recognize the coordination problem without promising autonomous magic.  
**Headline:** “Parallel work shouldn’t mean losing the thread.”  
**Subline:** “Give each task its own worktree, then keep its progress and changes visible.”  
**Layout:** A short left-aligned statement beside an illustration of overlapping, tangled lines resolving into separate tracks. Beneath, three concise labels: isolation, live visibility, review before merge.  
**Signature effect:** As the section enters the viewport, the overlapping lines separate horizontally into three lanes; 650ms ease-in-out, once. Copy remains static and readable throughout.

### 3. Isolated worktrees — make separation tangible
**Purpose:** Show the concrete per-task boundary and branch identity.  
**Headline:** “Every task gets its own branch of the work.”  
**Subline:** “OnniCode gives each task an isolated git worktree, so parallel changes have room to happen.”  
**Layout:** A large central repository marker fans into three labeled worktree rows. Each row shows a restrained example path and branch label, clearly presented as illustrative examples rather than live product data. A side note explains that isolation is per task.  
**Signature effect:** On scroll entry, the three row outlines extend from the repository marker over 500ms with 80ms stagger, cubic-bezier(0.16, 1, 0.3, 1). No camera movement.

### 4. Pick the agent and workflow — keep the operator in charge
**Purpose:** Establish the task setup in plain terms.  
**Headline:** “Choose the backend. Shape the workflow.”  
**Subline:** “Describe a task, select an available coding-agent backend, and use a YAML workflow.”  
**Layout:** Two connected columns: a typographic list of backend names from the brief and a compact workflow-sheet illustration with a few generic step labels. Do not imply every backend is installed or available in every environment; capability discovery is part of the zero-config story.  
**Signature effect:** A selected backend chip receives a violet outline and the workflow line draws into view on focus/entry; 220ms for the chip, 450ms for the line. Respect actual keyboard focus if made interactive; otherwise render as a static explanatory diagram.

### 5. Manager and workers — split without losing ownership
**Purpose:** Explain orchestration and distinct worker branches.  
**Headline:** “One manager. A roster of focused workers.”  
**Subline:** “A manager can split work by file ownership, dispatch parts, verify worker branches and bring the results back for review.”  
**Layout:** One manager node sits above three worker lanes, each labeled with a distinct task slice. Below, a small rail clarifies that roster, limits and pre-push safeguards fence unattended work; do not describe these as a sandbox.  
**Signature effect:** The manager node sends three short route pulses down separate lanes, staggered 120ms, each lasting 520ms with ease-in-out. The paths remain separate at rest.

### 6. Live evidence — progress you can inspect
**Purpose:** Make visibility concrete rather than claiming opaque speed.  
**Headline:** “See the work while it happens.”  
**Subline:** “Follow steps, tool calls, tokens, cost and diffs as each task runs.”  
**Layout:** A large illustrative activity panel sits alongside the lane diagram. It shows a few clearly labeled event rows and a compact diff preview, with annotation that these are the kinds of signals surfaced—not a claim that the page is connected to a live run.  
**Signature effect:** One event row fades/slides into the panel every 700ms for a short, finite demonstration, using opacity and 6px translate only. The demo starts on intersection and pauses when outside the viewport.

### 7. The review gate — branches wait for your decision
**Purpose:** State the product’s defining control promise.  
**Headline:** “Nothing merges itself.”  
**Subline:** “Review the diff. Open a draft pull request if you choose. Merge only with an explicit click.”  
**Layout:** Three branch lines arrive at a clearly visible gap before a human-controlled merge control. Show two outcomes as text: keep changes in the worktree for review, or open a draft PR through `gh`. The merge control is an illustration, not a working merge action.  
**Signature effect:** On entry, the lanes stop at the gap. A visible pointer-like focus ring appears around the merge control only after the visitor clicks the illustrative “Review” affordance; clicking then animates the lines into one path over 600ms. Include nearby text “Illustration only — no repository action” if the control could be mistaken for real functionality.

### 8. Local-first, zero-config — privacy by architecture
**Purpose:** Make local operation and capability discovery credible.  
**Headline:** “Your cockpit stays close to your code.”  
**Subline:** “No account, database, cloud or telemetry. OnniCode discovers what’s available and degrades to a smaller cockpit when something is missing.”  
**Layout:** A quiet two-column section: a local repository/folder schematic and a checklist of factual properties from the brief. Include the CLI and Tauri desktop shell as product facts, without suggesting unsupported platform guarantees.  
**Signature effect:** A soft boundary line traces around the local folder illustration on entry, 700ms linear; external/cloud icons are absent rather than crossed out with alarmist motion.

### 9. Close — invite a deliberate next step
**Purpose:** End with a clear summary and suitable action.  
**Headline:** “More parallel work. Still your call.”  
**Subline:** “Run and track coding-agent tasks locally, inspect the branches, and choose what lands.”  
**Layout:** Centered closing statement over the now-complete lane diagram, plus a confirmed install/repository link when available. Keep the footer plain: MIT license and links only when their destinations are known.  
**Signature effect:** The lanes settle into a quiet, aligned composition as the section enters view; 500ms ease-out, once. No flashing call-to-action or auto-redirect.

## 4. Hero in detail

**First three seconds:** At 0ms, the page is already legible: headline, subline, navigation and a still, low-contrast origin point render without waiting for animation. From 120–700ms, three to five hairline routes extend outward from that point; they use distinct curves and restrained hues within the violet family, not one lane per advertised backend. From 700–1,400ms, a small square task marker travels a short distance on each route, at different delays, then stops beside a tiny “task” or “worker” label. From 1,400–2,100ms, the primary route gets a brief lift in brightness and the merge gate becomes visible as a gap farther down the composition. By 2,100ms everything is still. At no point does a route cross the merge gap automatically.

**Scroll behavior:** Use normal document scrolling—no mandatory smooth-scroll hijack, pinned multi-screen choreography or scroll-jacking. The hero diagram may shift by at most 12px vertically with scroll on capable devices, but this parallax is optional and disabled on touch/reduced-motion. Each later diagram animates only when entering view, once; leaving and re-entering should not restart a sequence. On narrow screens, place the illustration below the copy and simplify lanes to avoid tiny labels.

**The wow moment:** The visitor clicks a clearly labeled, illustrative review control; the waiting branches converge in one crisp motion, then a small “Your decision” marker remains at the join. The contrast between long independent work and this one short, intentional action tells the story better than a particle explosion. It is a demonstration, not a product operation; label it accordingly.

## 5. Motion principles, budget and access

1. **Motion explains state.** A line moves only to show separation, progress, waiting or a chosen merge.
2. **One focal movement at a time.** Supporting labels stay still while a route draws or a marker travels.
3. **Arrive, then rest.** No infinite ambient particles, shimmering text, cursor trails or auto-looping demos.
4. **Use transform and opacity.** Avoid animating layout dimensions, large blurs or full-screen filters.
5. **Keep the decision human.** No merge-like convergence occurs without an explicit visitor action.

Budget the hero to one lightweight SVG illustration, ideally under 40KB compressed, with no video or WebGL. Keep all animated elements below roughly 20; cap concurrent motion to three active elements, use `IntersectionObserver`, and stop off-screen demos. Target a total initial transfer below 500KB before fonts, defer noncritical scripts, and make the page useful with JavaScript disabled. Prefer local/system font stacks or self-hosted subsets if permitted by the final static-site setup.

For `prefers-reduced-motion: reduce`, render every path in its final resting state, remove parallax and travel, and replace reveal transitions with immediate visibility. The explanatory text and merge decision remain unchanged. All controls need semantic HTML, visible keyboard focus, logical tab order and usable touch targets; the illustrative control must announce that it is a demo. SVGs need a concise accessible name when informative and `aria-hidden="true"` when decorative. Keep text contrast at WCAG AA, never communicate status by color alone, and ensure animated content does not flash.

## 6. Static-site tech approach

Use semantic HTML, CSS custom properties, inline SVG for the lane diagrams, and a small vanilla JavaScript module for intersection-triggered entrances and the one illustrative click interaction. CSS handles transforms, opacity and the reduced-motion media query. No GSAP, Lenis or Three.js: the concept needs a few precisely timed vector strokes, not a timeline engine, smooth-scroll override or 3D scene. This keeps the site openable as plain static files, avoids a CDN dependency, lowers transfer and failure risk, and makes accessibility fallbacks straightforward. If the final site requires external links or analytics, do not add them without the project’s explicit direction; the brief’s local-first privacy promise should be visible in the page itself.

## 7. Risks and how to avoid them

- **It becomes generic cyberpunk.** Avoid neon grids covering every surface, glowing orbs, lens flares and artificial “AI brain” imagery. Use near-black restraint, thin lines and sparse violet light.
- **The lanes imply uncontrolled automation.** Keep worker branches visibly separate and waiting. Make the review point and explicit human action central; never auto-animate a merge on page load.
- **The interface looks like a fabricated screenshot.** Label diagrams as explanatory, keep UI fragments abstract, and use only facts in the brief. Do not invent metrics, success rates, agent capabilities or workflow features.
- **The visual becomes too abstract to explain the product.** Pair each metaphor with literal language: “isolated git worktree,” “live diffs,” “manager and workers,” “explicit click.” Re-state the meaning at each step.
- **Motion feels cheap or tiring.** Avoid repeated loops, overshoot, excessive stagger and scroll-controlled spectacle. Use finite durations, small distances and long still intervals.
- **It performs poorly on mobile or older devices.** Use SVG/CSS rather than a canvas scene; remove parallax on touch, simplify lane count at small widths and keep text outside the diagram.
- **It overstates privacy or safety.** Quote only the brief’s local-first properties and describe safeguards precisely. A roster is a fence, not a sandbox; unattended runs have limits and do not auto-land. Do not imply the marketing illustration enforces those controls.

Plain-text summary: Parallel Worlds presents each task as an isolated lane of light, makes live work visible, and reserves convergence for the person reviewing and explicitly choosing to merge.
