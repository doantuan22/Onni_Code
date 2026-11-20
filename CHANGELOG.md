# Changelog — OnniCode

All notable changes to OnniCode are recorded here. This repository keeps the cezar engine's
provenance in `NOTICE`; cezar's own release notes are not copied into it.

## 2026-11-20 — Cockpit polish and local Windows packaging

- **Workspace.** New tasks start with full-width Chat; Review stays an explicit preset and
  saved arrangements remain available. Mobile navigation is compact, Context views stay
  reachable, and the active conversation no longer has a purple outline.
- **Controls and feedback.** Larger small-button targets, focused task-settings editors,
  collapsible execution diagnostics and resume commands, and one ordinary waiting-task entry
  in the sidebar. The footer and Tools tooltip show the running engine's version.
- **Fonts and motion.** Local Vietnamese subsets for Inter and JetBrains Mono, reduced-motion
  aware scrolling, and a static decorative backdrop.
- **Windows.** Background process launches hide console windows. The packaging runbook now
  documents the bundled engine, Node.js, RTK OSS and Repo Map assets, optional checkout linking,
  script-owned desktop versioning and scoped cleanup of generated output.
- **Documentation.** Current build/test guidance replaces stale Windows failure counts;
  historical feature surveys and design records are explicitly distinguished from current
  instructions. Old installer and staging artifacts are removed before rebuilding locally.

## 2026-10-30 — Cleanup: no network in the shell, local build only

- **Desktop engine.** The shell no longer downloads anything. It runs the engine named by
  `ONNI_DESKTOP_ENTRY`, else the one `node packages/work/dist/index.js link --use` registered
  under `~/.onni/versions/current`; the Versions menu still switches between linked checkouts.
  The managed Node runtime (`node_runtime.rs`, `~/.onni/node`) and the six crates that fetched
  and unpacked it (`reqwest`, `rustls`, `sha2`, `flate2`, `tar`, `zip`) are gone — Node 20+ must
  already be installed, and the failure page says so. With no built engine the page names
  `npm install`, `npm run build` and `link --use`, plus the two environment overrides. The
  splash's download progress bar went with the download.
- **Dead flags and modules.** `ONNI_NO_BANNER` and `ONNI_DESKTOP_NO_UPDATE` had no reader left and
  are deleted, with their test/e2e plumbing. `server/tracker/config.ts`, the `Kbd` primitive and
  the unused `Separator` wrapper are gone.
- **Rename.** Every internal identifier is now `onni`: the directory `packages/work`, the
  packages `@onni/{work,contract,api-client,web,desktop}`, the `onni` command, the `ONNI_*`
  environment variables, `.ai/onni/`, `~/.onni/`, `~/.cache/onni/`, the `onni/<id8>` branch
  prefix and the desktop product `Onni Work` (`com.onni.work`). No compatibility layer and no
  data migration is included.
- **History.** `.ai/runs/` (360 files of past run logs) is removed; `.ai/specs/`,
  `.ai/skills/` and `.ai/agentic.config.json` stay.

## 2026-10-29 — Fork hardening (Phase 2)

Onni Work is now maintained as an independent project: every functional link to cezar's
upstream services is cut, while the internal identifiers still carried the upstream
`cez`/`cezar` names.

- **Attribution.** `Copyright (c) 2026 DOANTUANIT` added below the original cezar copyright in
  `LICENSE` and `packages/work/LICENSE`; new `NOTICE` records the derivation. Root `README.md`
  rewritten for Onni Work; upstream `README.zh-CN.md` / `README.zh-TW.md` removed.
- **Manifests.** `repository` metadata points at this project, `packages/work` and
  `packages/api-client` are private, all `publishConfig` entries and the stale
  `api-client` repository path are gone, `packages/desktop` and the Rust crate declare their
  license, and the Arch `PKGBUILD` no longer points at the upstream repository.
- **Updater.** The Tauri updater ships no endpoints and no public key. Every desktop update path
  (shell update, npm install/update-on-restart, first-run install, menu and IPC command) is
  compiled off. The CLI's `install`/`update`/`versions`/`use` and the self-update service are
  gated by a new `ONNI_SELF_UPDATE` flag, off by default, and answer
  "không khả dụng trong Onni Work".
- **Telemetry.** Removed outright: the service module, `/api/v1/telemetry/*` routes and contract
  schema, the cockpit's consent bar and Settings → Privacy section, and the desktop shell's
  `telemetry.rs`, `send_error_report` command and failure-page report card are gone.
- **Star count.** Removed outright: `GET /api/v1/star-count`, its contract schema and reader, the
  sidebar ⭐ chip, the first-run toast and the dialog are gone; nothing asks github.com for a count.
- **Skills.** No default team skill repository is configured: `DEFAULT_SKILLS_REPOS` is empty, so
  `GET /api/v1/config` reports `teamSkills: false` out of the box and Settings says a `skillsRepos`
  entry is needed before team skills can load. Local, agent-mirror and built-in skills are
  unaffected, and the skills repos you name yourself still load. The terminal promo banner
  (`skills-banner.ts`) is gone for the same reason.
- **Docs.** The Next.js documentation site (`docs/site`, its `docs:*` scripts and the
  `docs:*` scripts and the docs skill), `docs/upstream/`, the server-install guides, the brand assets, the ADR and
  the screenshots are removed. `docs/reference.md`, `docs/project-overview.md`,
  `docs/upstream-audit.md`, `docs/adding-issue-tracker.md`, `docs/issue-trackers.md`,
  `docs/e2e-verification.md` and `docs/superpowers/` stay.
