# Agent runner lifecycle and launch repairs

Follow-up to `2026-11-20-windows-agent-launch-audit.md` findings A1–A5.

## Plan and safety constraints

1. **Junie (A1):** reproduce exits during initialize, authenticate and session/new
   with timeout disabled. Reject pending RPCs when stdout closes and reject later
   requests on that closed transport, including the authenticate catch path.
   Preserve intentional cancellation, original exit details and queued-turn ordering.
2. **Pi (A2):** exercise end, interrupt, timeout and hardStop with a child that
   handles SIGTERM. Escalate using real termination state, not child.killed; keep
   watchdogs alive until process exit even when stdout closes early. Distinguish
   Onni-originated signal exits from real failures and clear timers after exit.
3. **Command environment (A3):** build the child environment before resolving its
   executable in OpenCode, Copilot, Cline, Junie and Antigravity. Use that same env
   and cwd for resolution and spawn. Preserve explicit binary overrides and dry-run
   routing; test conflicting parent/child PATH values. Keep shell-free argument arrays.
4. **Diagnostics (A4):** introduce a small bounded stderr collector retaining both
   startup context and the latest diagnostic tail. Wire all nine runners, preserving
   UTF-8 decoding and existing error classification. Test repeated and oversized
   chunks, boundary sizes, truncation and useful first/last errors.
5. **Windows command length (A5):** measure the fully quoted command line in UTF-16
   code units, including executable, every argument, escapes and the terminating
   null. Use the existing native launcher's quoting rules. Reject oversized input
   before spawn with a useful message containing no prompt or grants. Do not shorten
   prompts, discard permissions or introduce a shell fallback.
6. Prove regressions fail before fixes, run focused suites after each group, then
   run typecheck, full Vitest, node:test, build and packaged CLI verification in
   repository order. Record existing platform exclusions and actual scope tested.

No new env knobs or dependencies. No changes to permission policy, unattended
fences, automatic landing, Job Objects, run limits or stored/public schemas.
The earlier Codex launch fixes and unrelated working tree edits must be retained.
No paid model turns or installed-app replacement are needed for these repairs.

## Progress

### Implementation

- A1: Junie rejects bootstrap requests after EOF and refuses new RPC requests on
  the closed transport. This also covers the swallowed authenticate failure path.
- A2: Pi end sends EOF, then SIGTERM after the existing 10s grace, then SIGKILL
  after another 10s when still alive. Interrupt, hardStop and timeout send SIGTERM
  immediately and arm SIGKILL after 10s. All checks use actual termination state.
  Stdout EOF no longer clears the process watchdog, and unsolicited stdout closure
  starts graceful shutdown. Intentional signal exits emit a note rather than a
  failure; unrelated nonzero exits still fail.
- A3: OpenCode, Copilot, Cline and Junie resolve using their built child env/cwd.
  Antigravity now resolves its default at session launch from the child env;
  explicit overrides and dry-run mocks retain precedence. Version probing uses
  the same executable and environment as the task.
- A4: All nine runners use BoundedDiagnostics. It retains at most 65,536 UTF-16
  units including a truncation marker, with one quarter reserved for startup
  context and the rest for the latest output. Small output is unchanged. Existing
  stream decoders remain in place; truncation avoids splitting surrogate pairs.
- A5: The shared Windows task boundary validates all fully quoted argv, including
  the executable and terminating null, against the 32,767 UTF-16-unit limit. The
  quoting rules mirror windows-job-spawn.ps1. Oversized commands fail before spawn,
  without printing arguments or dropping any permission grants. Antigravity's
  existing prompt-only limit is also retained.

### Regression evidence and focused checks

- `followup-before.log`: all 13 new lifecycle/PATH regressions failed before the
  fixes (initialize/authenticate/session-new, Pi shutdown modes and parent/child PATH).
- `diagnostics-length-before.log`: the Antigravity long-command regression failed
  before the guard; new helper suites could not load before the helpers existed.
- Initial focused checks: 42 tests passed across six files; an additional 161
  tests passed across ten existing runner/ownership suites. All nine runner families
  are covered by those runs. One further Pi EOF regression was added afterward.
- Typecheck passed after the first complete implementation.

### Final validation

- Typecheck: passed for all workspaces (`followup-typecheck-final.log`).
- Full Vitest: **13,718 passed, 1 failed**, 48 pre-existing skipped tests;
  888 passed files, 1 failed file, 4 pre-existing skipped files.
  The single failure was `EPERM: scandir` on a temporary worktree lifecycle lock
  in `worktree-lifecycle.test.ts`, during the rejected-provider disposal case.
  That test mocks ClaudeCliRunner; its failure was in the unmodified lifecycle
  file-lock reader. A complete targeted rerun of that suite passed **19/19**
  (`followup-worktree-rerun.log`). Treat this as an intermittent Windows lock
  access failure, not a clean full-suite pass or proof that the lock race is fixed.
  All new regression tests and all runner suites passed in the full run.
- node:test: **47 passed**, no failures, 1 existing capability skip.
- Build: passed, including check:pack (1,395 packed files, 1,175 dist files
  mapped to source, 180 web/dist files).
- Packaged CLI: **5/5 passed**, including clean installation, dry-run CLI workflow,
  declaration checks and native-free WASM navigation.
- Real process probe: Junie startup exit now rejects immediately with exit 7 and
  stderr, child confirmed dead (`junie-repaired.log`). The same probe previously
  remained pending after exit.
- Codex native metadata-only initialize probe still succeeds, closes with exit 0
  and empty stderr (`handshake-followup.log`); no model turn was created.
- `git diff --check`: passed. No test skip/disable, permission or schema change.

Logs live under `.tmp/codex-launch-diagnosis/` and are optional diagnostics.
No real model turn, account change, or installed desktop replacement was performed.
Mock lifecycle checks are not claims of live vendor compatibility; Linux/macOS
behavior remains subject to their CI runs. Source and the repository build contain
the repairs; the separately installed desktop application has not been replaced.

### Pre-commit fixture stabilization

The first pre-commit full run also exposed a readiness race in the lifecycle
coordinator regression: its default one-second polling deadline could expire
before a Windows command started, and a fixed 0.2-second sleep did not guarantee
the configuration edit happened while that command was live. The fixture now
waits up to its neighbors' existing five-second readiness bound and uses an
explicit release file after saving the edit. Its original readiness, output order
and replan assertions remain unchanged. The repaired test passed individually.
No product timeout, lock, ownership fence or test exclusion was changed.

That full run additionally recorded a transient dispatch 409 in
`antigravity-api.test.ts` and an unhandled late complexity check after a
manager-worker fixture's directory was removed. Those failures are retained in
`precommit-test.log`; they have not been claimed fixed by the fixture change.
The final complete gate runs with two Windows workers to reduce native-process
contention without disabling or automatically retrying tests.
