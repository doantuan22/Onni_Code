# Onni mascot placement plan

## Decision

Onni should be a **meaningful state illustration**, not a status replacement or an
always-present assistant. The cockpit is a dense developer tool: put the mascot in
full-page empty, loading, and terminal-state surfaces where there is already reserved
space; use a brief one-shot only for an unambiguous success. Do not add it to rows,
chips, banners, the transcript, or editor/diff surfaces.

The source already has a good chassis for this: `CenteredState` deliberately reserves a
56px icon tile for empty/error states, and `LoadingSplash` reserves a centered mark and
progress track. Keep those layouts' dimensions stable. The mascot is decorative in
addition to—not instead of—the existing text, icon, `role=status`, `role=alert`, or
status dot.

### Ranked placements

`96px` is the source canvas. Display it only at the listed integer scales: 96 (1x),
192 (2x), 288 (3x), or 384 (4x). Pixel art must use `image-rendering: pixelated` and
explicit width/height attributes so it cannot cause layout shift.

| Rank | Priority | Real file + component | Current behaviour / exact current copy | State and placement | Size | Animation trigger | Risk and mitigation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | P0 | `packages/web/src/routes/tasks-overview.tsx` — `TasksEmptyState` (`kind === 'no-tasks'`) | Hero `CenteredState` with twinkle backdrop: **“No tasks yet”**, “Describe a task to get started.”, **“New task”**. This is explicitly the only hero empty state. | **idle**; replace the decorative `ListChecksIcon` tile content, while keeping its semantic text and CTA. Best first impression/onboarding hook. | **192px (2x)**, rendered in a fixed 192×192 area above the existing title, not inside the 56px tile. | Static idle frame; optional single 2-frame blink after first paint, never looped. | Low density risk because this screen has no task rows. Do not make the CTA move; reserve the box. Decorative `alt="" aria-hidden`. |
| 2 | P0 | `packages/web/src/components/loading-splash.tsx` — `LoadingSplash`; routed by `routes.tsx`, including `routes/task-thread/thread-loading.tsx` | Centered brand mark, wordmark and progress: **“Loading…”** / **“Loading dashboard…”**; task fallback says **“Loading task…”** and “Fetching the run and its session transcript.” | **loading**; display beside/replacing the non-semantic `BrandMark` only on full-page splash variants, retaining wordmark, heading, and progressbar. | **96px (1x)** (not 52px/40px, which would break the integer-scale rule); desktop splash may use 192px. | A restrained 2–3 frame loop only while pending; stop immediately when route resolves. | Medium: loading is frequent and route fallbacks must stay cheap. Preload only the loading frame; no JS timer when reduced motion; preserve `role="status"` and current progressbar label. |
| 3 | P0 | `packages/web/src/routes/task-thread/review-panel.tsx` — `AcceptCelebration` | Existing one-shot twinkle on review → done, with **“✓ Changes accepted”**; review banner says **“Review the changes before anything lands.”** and “Nothing merges on its own.” | **success**; place a small mascot in the existing fixed celebration overlay, not in the review banner or accept button. | **96px (1x)** | Existing review → done transition, for the existing 1,500ms window, once only. | Low if it remains decorative and one-shot. Must share `prefersReducedMotion()` behaviour (render no animated mascot) and never obscure Accept/PR controls. |
| 4 | P0 | `packages/desktop/ui/index.html` — `.stage` splash and failure state | Startup: **“Starting OnniCode…”**, “Launching the local cockpit.”, violet sweep. Failure changes to **“OnniCode stopped”** and shows **“Restart OnniCode”**. | **loading** at startup; **error** when `body.failed`. This is the only pre-React visual surface. | **192px (2x)** in the current fixed mark footprint enlarged/reserved before paint. | Loading may use the existing 1.5s sweep cadence; error is static. | Medium: this HTML cannot use React, saved theme, or lazy assets. Embed/copy a tiny static sprite/frame locally; honor its existing reduced-motion query and retain `alt=""`, live title, and failure text. |
| 5 | P1 | `packages/web/src/routes/task-thread/task-thread.tsx` and `routes/task-workspace/task-workspace.tsx` — missing/error `CenteredState` | **“Task not found”** / “No run has this id. It may have been deleted, or the link is from another machine.”; or **“Could not load this task”**, followed by server error and **“Back to tasks”**. | **error** for load failure; **thinking** (static, neutral) for not found. Reuse the common state component, but keep different icon/text semantics. | **192px (2x)** | Static. A single 150ms settle-in is allowed only when motion is permitted. | Low; these are terminal full-page states. Never imply an agent can repair a deleted/missing task. |
| 6 | P1 | `packages/web/src/routes/automations/automations-list.tsx` — empty `CenteredState` | **“No automations yet”**, “Create one paused, preview it, then enable it.”, **“New automation”**. | **sleep**; Onni resting beside the existing neutral empty state conveys dormant scheduling without claiming work has started. | **192px (2x)** | Static; no sleep-loop animation. | Low; good semantic match, but not core first-run flow. Keep the safety instruction visually and semantically primary. |
| 7 | P1 | `packages/web/src/routes/inbox.tsx` — empty/error `CenteredState` | Empty: **“Inbox empty”**, “Agents drop follow-up suggestions here when they finish a task.” Error: **“Could not load the inbox”**. Off state: **“The follow-up inbox is off”** and its `ONNI_FOLLOWUPS=1` guidance. | **idle** for empty; **error** for load error; no mascot for capability-off explanation. | **192px (2x)** | Static. | Low, but lower priority because it is capability-gated and often absent. Never decorate configuration/off states as though they are an error. |
| 8 | P1 | `packages/web/src/routes/not-found.tsx` — `NotFoundRoute`; `routes/unknown-project.tsx` — `UnknownProjectRoute` | 404: **“Page not found”**, “Nothing lives at this address. The link may be mistyped, or it points at something that is gone.” Unknown project: **“{name} isn’t registered here”**. | **thinking**; static “looking around” state in neutral dead ends. | **192px (2x)** | Static. | Low; the existing Compass/FolderSearch icons remain the accessible conceptual indicator. |
| 9 | P2 | `packages/web/src/routes/dashboard/queue.tsx` — `Queue` | Healthy empty line: **“All caught up — no tasks need your input”**. Error retry: **“Could not check current task state.”** | **success**, but only as a 96px illustration when the card has a deliberately expanded empty layout in a future dashboard pass; do not squeeze it into today's one-line dense card. | **96px (1x)** | Static; no celebratory loop. | High density risk today. The current compact status dot is better until the card receives purposeful empty-state space. |
| 10 | P2 | `packages/web/src/components/command-palette.tsx` — `PaletteContent` transcript states | **“Searching transcripts…”**, **“Failed to search transcripts”**, **“No transcript matches”**, and general **“Nothing matches.”** | **thinking** / **error**, but only a future 96px illustration in the empty result region. | **96px (1x)** | Static; loading could have a tiny loop. | High: modal result lists need scan density and keyboard focus stability. Do not ship in initial implementation. |
| 11 | P2 | `packages/web/src/components/provider-banner.tsx` — `ProviderBanner` | **“Provider authentication failed during a task: {providers}.”**; **“No agent provider credentials were found.”**; **“Configure providers”**. | **error**, but **do not add** a mascot to the inline banner. If a provider setup page gets an empty state later, use 192px there. | N/A inline | None. | High: the 36px alert must remain terse, actionable, and screen-reader-friendly. |
| 12 | P2 | `packages/web/src/routes/new-task-surface.tsx` — `NewTaskSurface` | Full-screen composer hero with twinkles and ghost code; it is an active creation screen rather than an empty state. | **thinking** only as a future, static 96px peripheral illustration if it has a reserved noninteractive rail; not in/over the prompt composer. | **96px (1x)** | Static. | High: competes with typing, attachment controls, picker pills, and deep-link/autostart behaviour. Exclude v1. |

## Candidate coverage and exclusions

The table covers the highest-value implementations. Other real `CenteredState` consumers
(Git/GitHub/Skills/Settings/Tracker/Workflow views) inherit the component capability but
are **not rollout targets**: their messages often describe local data facts such as “No
changes yet”, “Nothing selected”, or “Agent permission settings did not load”; introducing
mascot art to every one would make a developer tool feel noisy and slow.

### Do not put Onni here

- **Sidebar/brand mark:** `components/brand-mark.tsx`, `components/app-shell.tsx` and
  `sidebar-frame.tsx`. The 40px canonical mark is navigation identity, not character art;
  retain `/icon.svg` and the current lockup. A 96px source cannot appear at a compliant
  integer scale there.
- **Run status, queue rows, task table, and review banner:** `run-header.tsx`,
  `tasks-overview.tsx`, `dashboard/queue.tsx`, `review-panel.tsx`. Status dots and pills
  are compact, repeat hundreds of times, and carry accessible state already.
- **Transcript, diffs, terminals, editors and workspace panes:** task-thread,
  task-git and task-workspace components. Never animate adjacent to code or a moving log;
  it harms scanning and risks scroll/layout instability.
- **Toasts, provider/connection/offline banners, dialogs, command menus and form fields:**
  `ui/toaster.tsx`, `provider-banner.tsx`, command palette, composer, account/setup forms.
  They are transient/actionable and typically have a 36–60px height budget. Use icon +
  text, as today.
- **Every successful task:** do not fire success art for routine run completion, browser
  notifications, or a row changing status. Limit success to the explicit review acceptance
  moment already represented by `AcceptCelebration`.

## Implementation contract

### Component and assets

Create `packages/web/src/components/mascot.tsx` (not inside `public`) as the only React
reader of public assets:

```tsx
type MascotState = 'idle' | 'working' | 'thinking' | 'success' | 'error' | 'sleep' | 'loading'

<Mascot
  state="loading"
  size={96}              // 96 | 192 | 288 | 384 only
  animated               // ignored for reduced motion
  loop                   // false for success/idle/error/sleep by default
  decorative             // default true: alt="" aria-hidden
  className="..."
/>
```

- Validate/correct invalid sizes in development; consumers must reserve the exact box with
  `width` and `height`. `decorative` stays true for all table placements; if a future
  placement needs an announcement, announce the existing textual status separately, not
  the image.
- Map state to stable public URLs below
  `packages/web/public/brand/mascot-v2/`. Keep `<img>` dimensions, `draggable={false}`,
  `decoding="async"`, and pixelated image rendering. Do not use canvas or a continuous
  JavaScript animation loop.
- Use a single transparent PNG/WebP sprite sheet only after measuring it against individual
  state images. Initial recommendation: **individual static frame + optional state animation
  sheet**, lazy-loaded by `Mascot`; preload only `loading` because full-screen fallbacks
  need it. This avoids making the main bundle pay for idle/error/sleep art. Use CSS
  `steps()` background positioning for sheets rather than decoding seven animated GIFs.
- Keep the desktop splash independent: it cannot import React/Vite paths. Give
  `packages/desktop/ui/` a copied, small loading/error asset or inline data URI and add
  its dimensions before first paint.

### Motion, accessibility, themes, and copy

- Respect `prefers-reduced-motion: reduce`: render the state’s first/static frame;
  no blinking, bobbing, or frame cycling. This matches the existing splash and
  `AcceptCelebration`, which already suppress motion.
- Motion is state-bound: `loading` loops only while a request is pending; `working` is
  reserved for a future dedicated, non-dense active-run hero; `success` plays once;
  `idle`, `thinking`, `error`, and `sleep` are static by default.
- Provide dark and light palette variants only if the art cannot maintain contrast with a
  shared transparent palette. Select with `<picture>`/media or CSS, not a duplicate
  runtime fetch. Do not tint the existing canonical navy/azure logo; it has intentional
  dark-mode tile handling in `brand-mark.tsx`.
- All user-facing new copy goes through `useI18n().t(...)`. The app already supports
  English and lazy-loaded Vietnamese dictionaries in `src/lib/i18n/`; English keys are
  source strings and `vi-*.ts` holds translations. Mascot images contain no text; otherwise
  they cannot localize.

### Preference/off switch

Add a UI-only **“Mascot illustrations”** Switch in global Settings → Appearance,
persisted in the existing workspace `ui-state` appearance/preferences path (with a default
of **on**). The switch suppresses nonessential mascot images and animations, but never
removes text, controls, status dots, or splash progress.

Default-on is appropriate because the feature is local, zero-network, and has no external
cost/exposure; it is a cosmetic working default and is reversible in Settings. It does
**not** need an `ONNI_*` environment variable: per `AGENTS.md`, adding an environment
knob for a local presentation preference is the wrong configuration mechanism. The
system reduced-motion preference always wins over the toggle’s animation setting.

## Suggested implementation order (six small steps)

1. **Asset contract and component:** add mascot source/output assets under
   `packages/web/public/brand/mascot-v2/`; add
   `packages/web/src/components/mascot.tsx` and focused tests. Include only the static
   loading/idle/error/success frames first.
2. **Preference seam:** extend the existing appearance/UI-state types and
   `packages/web/src/components/appearance-provider.tsx`; add the Switch to
   `packages/web/src/routes/settings/appearance.tsx` and translations under
   `packages/web/src/lib/i18n/`.
3. **First-run hero:** integrate in
   `packages/web/src/routes/tasks-overview.tsx` (`TasksEmptyState` no-tasks branch);
   add/update its render tests.
4. **Route loading:** integrate in `packages/web/src/components/loading-splash.tsx`,
   retain all title/progress semantics, and verify `routes.test.tsx` fallbacks and
   reduced-motion behaviour.
5. **Terminal/success/error states:** add the review one-shot in
   `packages/web/src/routes/task-thread/review-panel.tsx`, plus task error/not-found
   handling in `task-thread.tsx` and `task-workspace.tsx`; test static/reduced-motion
   cases.
6. **Desktop and secondary empties:** update `packages/desktop/ui/index.html` and then
   opt in automations/inbox/404 routes (`automations-list.tsx`, `inbox.tsx`,
   `not-found.tsx`, `unknown-project.tsx`). Measure emitted assets before considering
   P2 dashboard or palette experiments.

## Verification checklist

- Test each placement with the mascot preference on/off, light/dark, 96/192px dimensions,
  keyboard navigation, and `prefers-reduced-motion`.
- Confirm loading fallback titles remain exact (for example, “Loading task…”), visual
  assets have no text, and `role=status`/`role=alert` behaviour is unchanged.
- Run focused web unit tests first, then the repository quality gates required by the
  change; check the built asset sizes before accepting animation sheets.
