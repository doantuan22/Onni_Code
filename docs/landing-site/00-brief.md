# 00 — Brief: OnniCode landing page

Everything for this project lives in `docs/landing-site/` (ideas, mockups, reviews, plan, final site).

| Folder / file | Content |
| --- | --- |
| `00-brief.md` | this brief (the product facts and the goal) |
| `01-ideas/` | one concept proposal per worker |
| `02-concept.md` | the merged creative direction |
| `03-mockups/` | sketch images (round-1, round-2) + notes |
| `04-review.md` | evaluation of the mockups and the fixes asked for |
| `05-plan.md` | implementation plan |
| `site/` | the final static website (HTML/CSS/JS, no build step) |

## Goal

An introduction website for **OnniCode** that is not an ordinary landing page: harmonious,
beautiful, with premium, high-end motion and effects (think Linear, Vercel, Apple product pages,
Stripe — but with its own identity). It must stay fast, accessible and work as plain static files
(open `site/index.html` directly or serve the folder).

## The product — facts you may use (do not invent features)

- OnniCode is a **local, desktop-first cockpit** for running and tracking AI coding-agent tasks in a repository.
- You describe a task, pick a **backend** — Claude Code, Codex, OpenCode, Cursor Agent, pi, Junie,
  GitHub Copilot, Cline, Antigravity — and a **workflow** (YAML).
- **Each task runs in its own git worktree** (`.ai/onni/worktrees/<runId>`, branch `onni/<id8>`), isolated.
- Everything is **streamed live**: steps, tool calls, tokens, cost, diffs (one WebSocket bus + SSE).
- **Nothing merges itself.** A run settles with its diff left for you to review — an optional diff-first
  review gate — or opened as a draft PR through `gh`. Merging is an explicit click.
- **Local-first, private**: no account, no database, no cloud, no telemetry. State is plain JSON /
  NDJSON / Markdown under `.ai/onni/` and `~/.onni/`.
- **Zero config**: no file to create, no setting to set; capabilities are discovered from the repo,
  the environment, `gh` and installed agent CLIs. Missing pieces degrade to a smaller cockpit.
- **Manager / worker orchestration**: a manager agent plans, splits work by file ownership,
  dispatches parts to a roster of worker agents (different backends/models), verifies their branches
  and merges them — fenced by a roster, limits, and a pre-push fence for unattended runs.
- **Automations**: GitHub polls (new PR, new issue, label, review), Jira/Linear tracker events,
  schedules (daily, weekdays, every N hours, once) each launch an ordinary task.
- **Unattended safety**: run limits (cost, time, hangs), dispatch depth caps, no auto-landing.
- **Desktop app**: Tauri 2 shell (Windows installer bundles engine + Node). Also a CLI: `onni`,
  `onni run` executes a workflow with no server.
- Tech: strict TypeScript, Hono, Zod contracts, React 19 + Vite + Tailwind v4 cockpit.
- `ONNI_DRY_RUN=1` runs the whole cockpit offline with mocked agents — a demo with no login.
- License: MIT; a hard fork of the cezar engine.

## Existing brand cues

- Cockpit is dark-first: background `#090909`, primary color **violet**; light theme `#fafafa`.
- Brand font: **Chakra Petch** (display), plus a sans for body. Logo: `packages/web/public/logo.png`,
  `packages/web/public/icon.svg`, more under `packages/web/public/brand/`.
- The cockpit has pixel-art "scenes" (scenery) behind the chat — a playful, crafted touch.

## Audience

Developers and tech leads who already use AI coding agents and want control, parallelism,
reviewability and privacy. The page language: **English** primary (copy can later get a Vietnamese toggle).
