# One & One recovery and verification hardening

## Scope and plan

Address F1–F6 in `docs/one-and-one-self-healing-audit-2026-11-26.md` without changing pair topology, fan-out, permissions, environment defaults, or adding dependencies.

1. Reproduce the failures with regression tests before production edits.
2. Persist bounded report delivery attempts on the current order; reconcile review and interrupted acceptance as well as in-flight workers. Preserve user-stopped managers and live/scheduled workers. Use at-least-once delivery: the existing boolean transport cannot promise exactly-once provider consumption.
3. Add optional outcome/checkpoint/verification fields so old state still parses. Reject failed reports, including the legacy failure prefix. New checkpointed reports need verification for the current clean HEAD before acceptance and finalization. Existing legacy reports retain compatibility. No discovered checks requires an explicit manager review note; unavailable is never passed. Dry-run remains explicitly unavailable and runs no checks.
4. Support explicit `onni task verify` on the shared checkout under its repository lease, revalidate order/peer/phase and HEAD after checks, and use the pair baseline for optional comparisons. Do not automatically spawn new verification processes.
5. Retry only transient lock failures in checkpoint/diff, with bounded asynchronous waits and state revalidation. Keep conflicts, branch mismatch and permission errors fail-closed. Request only diff metadata during handoff.
6. Run focused regressions, contract parity, typecheck, full tests, core unit tests, build and package checks. Record actual outcomes and unrelated failures. Do not commit or push as part of this request.

## Invariants and exits

- Manager idle remains resumable; worker `waiting` without an owner gets the same grace as a ghost `running` worker and reports failure rather than silently parking forever.
- `reported` order plus in-flight phase completes its report transition. `accepted` current order plus review phase completes acceptance idempotently. Stopped/complete/superseded state always wins.
- Delivery attempts persist before sending, back off, have a ceiling, and stop once acceptance/revision acknowledges the report. Restart may replay a report whose transport accepted it but whose manager never acted; include the stable order ID in the message.
- Verification evidence is written only by the engine, scoped to the current order, and invalidated by a changed HEAD or dirty tracked/untracked source. Pair controls and marker acceptance share the same store guard.
- A no-checks repository still works via explicit manual review; missing tooling is reported as unavailable and is not silently treated as green.
- Repository locks remain coordination fences, not security sandboxes. Do not remove timers, limits, or the explicit user Finish action.

## Progress

- [x] Audit reviewed at HEAD `11c02bd`; existing desktop changes left intact.
- [x] Regression tests confirmed red before production edits (4 failures). Additional selective source-stash proof reproduced verifier, retry and large-diff failures (3 failures), then restored the source.
- [x] Recovery and delivery implemented and verified.
- [x] Shared-checkout verification and acceptance guards implemented and verified.
- [x] Retry and diff optimization implemented and verified.
- [ ] Repository validation completed; outcomes recorded.

Focused validation: 95/95 tests passed across pair store, coordinator, reconciler, shared-checkout verification, runtime locking and API. Full workspace typecheck passed. Repository-wide validation is running.

The existing API refusal regression also exposed idle settlement treating `review` as a ghost: deletion returned 409 after stopping the pair. Preserve intentional review gates before idle settlement; the original API test now passes without changing its expectation.
