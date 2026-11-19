---
metadata:
  onni-dependencies: "[]"
name: onni-verify
description: "Verify completion claims and worker reports against fresh commands, diffs and requirements."
---

For each claim, identify what observable result proves it: a test, build, API response, UI interaction or diff. Run the appropriate checks, read exit codes and failures, and map results back to the requested behavior. A narrow passing suite proves its scope only; interrupted, skipped or unavailable checks do not prove success. Record commands and results without secrets.

When reviewing a worker report, inspect its actual diff and validate the supplied evidence. Use Onni verification commands when available. Distinguish an existing failure from a regression by checking the same baseline. Do not accept a worker's success text as independent proof. Explain what remains unverified, including installed desktop behavior versus source-level tests. Check the repository's required gates before committing or proposing a merge. Never merge or push as a side effect of verification.

Apply the user's scope, repository instructions and current run permissions. Onni owns task worktrees and orchestration. A worker must not dispatch further tasks; Antigravity workers finish with a plain text report and must not commit or push.
