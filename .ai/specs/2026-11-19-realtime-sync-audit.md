# Realtime synchronization audit

Scope: mutations through one running OnniCode server, their shared query caches, and recovery
after a workspace SSE reconnect or a hidden tab becoming visible. This is an API/component
audit; it does not certify the currently installed Tauri binary or every browser flow.

## Confirmed defects and changes

| Surface | Defect | Change |
| --- | --- | --- |
| Project removal | Invalidating an unfinished initial GET leaves that request running. Its old answer can restore the removed row. A confirmed DELETE also left the existing cache unchanged until another GET finished. | Cancel old reads, remove the confirmed row immediately, and reconcile from REST. |
| Add / clone / create project | Navigation and other readers depended on a successful follow-up list GET despite already having the authoritative new row. | Insert or replace that row in the shared cache before reconciliation. |
| Project tags / parallel limit | PATCH updated its own tab but emitted no workspace event. | Emit `project-updated`; open clients patch the registry and refresh derived dashboard/task-index queries. |
| Global settings / branding | Successful writes emitted no invalidation for other clients. | Emit `workspace-config-changed`; clients refresh workspace config and health. |
| Workspace UI preferences | Other clients did not learn about persisted preferences until a later read. | Emit `workspace-ui-state-changed` and invalidate the shared preference cache. |
| Agent accounts / account selections | Create, edit, delete and selection writes updated only the calling client. | Emit `agent-profiles-changed`; invalidate the account cache, including its detail/status children. |
| Reconnect / foreground return | Config, UI preferences and account queries were absent from reconciliation. | Include all three cache families. |
| Open settings editors | Several fields copied server values only on mount, so refreshing their query did not refresh the actual input. | Follow server changes while clean; preserve unsaved typing in folder, global instruction, memory, monitoring and limits editors. |

These events reuse the existing workspace mutation stream. No periodic HTTP polling, additional
EventSource, WebSocket, or environment switch is introduced. Events are emitted after successful
writes; rejected account/config writes emit nothing. Project row payloads are validated against
the existing contract before entering the cache.

## Verification

- Regression tests for registry writes, unfinished GETs and cross-client PATCH events fail on
  the original source: seven failures. Source was restored after the baseline run.
- API tests cover persisted config/UI/account write events and rejected writes.
- SSE transport tests cover all new event names.
- React tests cover registry mutation cache updates, incoming events, stale request cancellation,
  settings invalidation and preservation of unsaved input.
- Existing task events, deletion, tracker updates, dashboard summaries, usage, reconnect and
  visibility handling are exercised by the global-events suite.
- The focused API/cache/Settings/component run passed **49 files, 830 tests** with ordinary
  Windows host access. A later cache/editor rerun after the derived-config invalidation change
  passed **3 files, 149 tests**. Type checking and the production build/pack gate passed.
- The broad `npm test` attempt inside the sandbox was stopped after widespread Windows
  fixture failures; it is **not a passing full-suite result**. The Git changes and lifecycle
  settlement suites were rerun with ordinary host access and passed **94 tests**.

## Boundaries

- The boot folder remains served for the lifetime of its server, even after deregistration.
  Existing zero-config behavior may show it as **not registered**, especially with an empty
  registry. Deregistration does not delete repository files or stop the server.
- Direct CLI/file changes and a second independent server do not publish into this process's
  in-memory event bus. Reconnect/foreground reconciliation re-reads their persisted state;
  continuous foreground synchronization across independent processes is not added here.
- Existing browser-specific preferences and active task drafts retain their established ownership.
  The new settings editor synchronization preserves a local unsaved draft rather than silently
  overwriting it with another client's edit.
