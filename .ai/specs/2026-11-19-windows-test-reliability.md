# Windows test reliability and lifecycle supervision

## Objective and plan

Resolve the 260 Vitest failures observed at `c288d19` without disabling tests,
changing public contracts, weakening process ownership, or allowing unattended landing.

1. Reproduce the failed suites with the OS access required by their real process fixtures.
2. Repair lifecycle supervision while retaining conservative recovery and cleanup gates.
3. Correct portable fixtures and asynchronous readiness assumptions.
4. Prove the process regression fails against the original executor.
5. Run typecheck, all Vitest suites, node:test, build, and packaged CLI tests in order.

## Baseline evidence

- The restricted run recorded 260 failed, 13,347 passed, and 48 skipped tests.
- Replaying the 40 failed files outside the tool sandbox recorded 20 failed,
  689 passed, and 2 existing platform skips. Webhook suites passed there.
- In the restricted environment, the Windows CIM boot probe is denied. Process
  identity remains fail-closed; no webhook ownership check is removed or mocked globally.
- The remaining failures included real MSYS supervision races, POSIX-only fixture
  commands, an obsolete OpenCode HTTP stub, fixture disposal, and startup timing.

## Repairs

### Lifecycle execution

The Windows supervisor is now the current native Node executable, which waits for
the existing durable launch gate before starting noninteractive `bash -c` with stdin
closed. It forwards output and reports the command exit code through the existing
private marker, then remains alive until the owner terminates the captured tree.

The previous Bash supervisor could exit while `taskkill /T` was terminating its
MSYS descendants. The resulting nonzero taskkill status made a successful command
look unsafe to reclaim. A concurrent short-command fixture reproduces that race
against the original executor and passes with the native supervisor.

The wall-clock timeout, escalation bounds, output limits/redaction, and persistence
gate are unchanged. Taskkill failure or unclosed pipes still mean unknown quiescence
and retained worktree ownership. Persisted Windows PIDs are never signalled on recovery.
POSIX process-group execution is unchanged.

### Test portability and resource lifetime

- Use native filesystem mkdir and the shared Bash resolver in fixtures.
- Pin both HOME and USERPROFILE in skills fixtures so Windows cache writes stay temporary.
- Assert the documented null-size degradation when `du` is unavailable.
- Dispose the manager before removing the variant fixture directory.
- Give Finish the existing suite readiness bound rather than a 1.5-second cold-start assumption.
- Exercise zero-cost reservation accounting through the runner contract, preserving
  the assertion that incomplete zero-cost evidence cannot release a child reservation.
- Limit the Windows Vitest worker pool to four; Linux/macOS defaults and all test
  inclusion rules are unchanged. Product run limits are unaffected.

### QA launcher

The launcher fixture resolves Git Bash on Windows and translates discovered MSYS
executable paths for native Node. QA app descriptors contain native Node PIDs;
app liveness and stop commands now use Node instead of MSYS shell PID lookup.
Shell-owner lock checks retain shell PID semantics. Signals reject nonpositive or
noninteger PIDs. The launcher still controls only its recorded, repo-started app.

## Verification

- Original 40 failed files: 709 passed, 2 existing platform skips after the fixes.
- Executor regression: red against the original source, green after restoration;
  all 12 executor tests pass, including taskkill failure and persistence failure.
- QA launcher: cold boot, reuse, health, and shutdown pass on Windows/Git Bash.
- Full Vitest: **13,608 passed, zero failed**, 48 existing skips; 875 passed
  files and 4 existing skipped files (879 total). No new test exclusion was added.
- Typecheck: passed across contract, API client, service and web.
- node:test: **47 passed, zero failed**, 1 existing setsid capability skip.
- Build and `check:pack`: passed (1,369 packed files).
- Package tests: **5/5 passed**, including clean consumer installation, CLI and WASM navigation.
- `git diff --check`: passed.

Validation used Windows host process/filesystem access; the tool sandbox's CIM
restriction was not bypassed in product code. Linux/macOS execution still belongs
to their CI gates; no cross-platform success is inferred from this Windows run.

Logs are local under `.tmp/fix260-*`; they are not required runtime state.
