# Windows agent launch repair and runner audit

## Evidence and limits

The dispatched Codex workers `546e3582-07a9-4222-9ed5-f94461e2e9d1`
and `e18f07d1-47b0-4fa6-b8f0-a806f315dfca`, owned by manager
`f991f179-712a-4ec3-8066-de4c55f7df21`, created their worktrees and failed
at `CreateProcessW` before the app-server initialize response on 2026-11-20.
Exit 125 belongs to Onni's wrapper, not a responding Codex model.

The old wrapper discards the system error text and PowerShell displays only its
outer invocation exception. It does not record the selected executable. Therefore
the exact native error of these historical runs cannot be recovered from their logs.
Do not claim a specific PATH, authentication, or model failure for those runs.

Read-only version probes reproduce the identical old error with a bare `codex`
passed to the Win32 boundary (file not found) and the app's extensionless `codex`
file (invalid Win32 application). The npm CLI via Node and the adjacent
`codex.exe` both start successfully. These probes do not call a model.

## Implementation plan

1. Add regression fixtures for bare task commands, explicit extensionless Windows
   launchers, npm shims, child working directories, and actionable native errors.
   Run them against the original implementation and retain the failing evidence.
2. Normalize Windows task commands before the Job Object payload is produced,
   using the shared shell-free shim resolver and the actual child environment and
   cwd. Resolve explicit extensionless paths to their `.exe` sibling when present;
   support extensionless Node entrypoints by their shebang. Preserve argument arrays,
   the existing native/shim selection order, and non-Windows behavior.
3. Include the Win32 code and system message for failed CreateProcessW calls.
   Unwrap PowerShell invocation exceptions; attach executable and cwd on failure.
   Do not log argv, prompt, payload, or environment. Keep suspended launch,
   assign-before-resume, kill-on-close, and cleanup failures intact; never retry
   outside the Job Object or add a shell fallback.
4. Inspect all nine factory runners for executable resolution, child environment,
   early process failure, RPC settlement, stdin errors, teardown, timeout and
   permission behavior. Record concrete findings separately from untested risks.
5. Run focused real-process/runner suites, then typecheck, all Vitest suites,
   node:test, build and package verification in repository order. Record platform
   limitations and unrelated failures. Do not infer live vendor compatibility
   from mocks or claim that old logs establish a native error they did not save.

## Acceptance criteria

- Task launch handles native PATH commands and supported npm/Node launchers with
  spaces and literal shell metacharacters without starting a shell.
- A failed native launch identifies its executable, cwd and native code.
- Existing cancellation and natural-completion ownership tests remain green.
- Codex initializes and closes through the real task launcher without a model call.
- Audit results cover Claude, Codex, OpenCode, Cursor, Pi, Junie, Copilot, Cline,
  and Antigravity, with evidence and explicit validation limits.

## Results

### Repaired launch defects

- `spawnTaskProcess` now resolves task executable names against the child PATH
  and unwraps supported npm shims before calling the explicit Win32 launcher.
- Explicit extensionless paths select their `.exe` sibling when available;
  extensionless Node entrypoints use Node after checking the shebang.
- Relative task shims resolve against the task cwd. Argument quoting remains in
  the existing C# launcher, with no cmd/PowerShell command evaluation added.
- CreateProcessW failures retain the native code and system text. The wrapper
  reports the innermost exception with executable/cwd, without prompt argv.
- No permission, auto-merge, dispatch-limit, timeout or Job Object fence changes.

Five new regressions failed before the repair; all 19 tests across windows-shim,
task-process-spawn and windows-job-process then passed. The ownership tests include
natural completion and cancellation with descendant cleanup.

The real installed Codex CLI completed `initialize` and closed with exit 0,
empty stderr, through `spawnCodexAppServer` with ONNI_TASK_ID set. No thread or
model turn was created. This validates the repaired launch path, not historical
error attribution or all vendor operations. Existing installed Onni binaries
still need to be rebuilt/restarted to use source changes.

### Initial runner findings

All five findings below are addressed by the follow-up implementation in
`2026-11-20-agent-runner-repairs.md`. The evidence below records the original state;
follow-up validation and its limits are maintained in that document.

| ID | Priority | Affected backends | Trigger and consequence | Evidence / proposed repair |
| --- | --- | --- | --- | --- |
| A1 | P1 | Junie | CLI exits before answering initialize or session/new; session result remains pending, even though stdout ended. | Reproduced with an exit-7 fixture and timeoutMs=0: result still pending after 1500ms. `junie-runner.ts` awaits Promise.all of bootstrap and readLoop, but only calls rejectPending after that wait. Reject outstanding RPCs at EOF, following the Codex transport fix; cover initialize and session/new failures. |
| A2 | P1 | Pi | A CLI that ignores SIGTERM can outlive ordinary end/interrupt; a handled exit 143 is also treated as a failure. | Code inspection: `pi-runner.ts` end schedules only SIGTERM; interrupt sends only SIGTERM; SIGKILL is confined to separately invoked hardStop. There is no intentional-termination exit classification. Add the existing real-termination watchdog and track Onni-originated signals, preserving cancel semantics. Not reproduced against a live Pi CLI; Windows Job Object teardown supplies a stronger stop there than POSIX SIGTERM. |
| A3 | P2 | OpenCode, Copilot, Cline, Junie, Antigravity | A per-run PATH differs from the engine PATH; the runner may select the engine's executable before passing the child its own env. | Constructors call spawnableCommand/antigravityLaunch without the built child env; Junie transport does likewise. Once a parent-PATH hit is absolute, final-boundary normalization cannot undo it. Build env first and use that same env for resolution and spawn. Static finding; no claim that this caused the historical Codex failures. |
| A4 | P2 | Claude, Codex, Cursor, Pi, Junie, OpenCode, Copilot, Cline | A noisy long-running CLI writes repeated stderr; the engine retains every chunk until the session ends. | Each runner appends stderr chunks without a retained-byte limit; slicing the final error does not bound accumulation. Use a bounded diagnostic tail and preserve useful startup failures. Antigravity already has an approximate 16k retained-character guard. Memory-pressure risk, not a measured production OOM. |
| A5 | P2 | Antigravity | Prompt itself passes the 24k check but executable, quoted prompt, permission grants and other argv push the full Windows command line over the OS limit. | `antigravity-runner.ts` validates only args[1]. `buildAntigravityArgs` also adds command grants and other flags. Measure the fully quoted Windows command line before launch and report the limit; do not silently drop grants or relax permissions. Static risk; not reproduced against the live agy CLI. |

Priority here describes operational impact, not a security boundary. These are
follow-up findings requested by the owner, initially recorded separately from the launch fix.

### Backend coverage

| Backend | Initial launch / lifecycle review | Follow-up finding |
| --- | --- | --- |
| Claude (including claude-cli alias) | disclaimedCommand + child env + shared task launcher; stdin error listener, intentional-signal handling and EOF escalation present | A4 |
| Codex | shared task launcher; pending bootstrap RPCs rejected at EOF; native initialize probe succeeded | A4; exact historical native failure unavailable |
| OpenCode | ACP launch, stream EOF rejection, bounded handshakes, permission response and teardown reviewed | A3, A4 |
| Cursor | resolved launch env, stdin errors, streamed result error tracking and timeout kill path reviewed | A4 |
| Pi | RPC launch, stdin errors, response errors, settled marker, end/interrupt/hardStop reviewed | A2, A4 |
| Junie | ACP launch, handshake, pending requests, stdio and escalation reviewed | A1, A3, A4 |
| Copilot | ACP launch, EOF rejection, handshake bounds and teardown reviewed | A3, A4 |
| Cline | ACP launch, EOF rejection, handshake bounds and teardown reviewed | A3, A4 |
| Antigravity | launch, closed stdin, no-answer detection, prompt limit and permission policy reviewed; experimental allow-rules remains unchanged | A3, A5 |

This is a focused launch/lifecycle audit, not an exhaustive certification of each
vendor CLI. No paid tasks, external submissions, or permission changes were used.

### Repository validation

- Typecheck: passed across all workspaces.
- Full Vitest on Windows host: 885 passed files, 13,697 passed tests, no failures;
  4 files / 48 tests skipped by pre-existing suite configuration. No skip was added.
- node:test on Windows host: 47 passed, no failures, 1 existing capability skip.
- Regression evidence: `.tmp/codex-launch-diagnosis/regression-before.log`
  (5 failures before source changes) and `regression-after.log` (19 passed).
- Live metadata-only handshake: `.tmp/codex-launch-diagnosis/handshake.log`.
- Junie exit/pending reproduction: `.tmp/codex-launch-diagnosis/junie-audit.log`;
  the child is confirmed dead while the session result remains pending.
- Initial build compiled both server and UI, then the sandbox denied npm-cache
  access during check:pack. The complete host rerun passed, including check:pack
  (1,389 packed files, 1,169 dist files mapped to source, 180 web/dist files).
- Packaged CLI tests: 5/5 passed, including installation into a clean consumer,
  the dry-run CLI workflow, declaration checks and native-free WASM navigation.
- `git diff --check`: passed.

Local `.tmp` logs are optional diagnostic artifacts, not required application state.

All five repository gates completed in order. Full build output is in
`.tmp/codex-launch-diagnosis/build-host.log`; package results are in `package.log`.
Windows is verified here; Linux/macOS behavior still relies on their CI gates.
