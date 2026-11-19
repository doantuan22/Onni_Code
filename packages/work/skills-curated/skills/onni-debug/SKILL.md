---
metadata:
  onni-dependencies: "[]"
name: onni-debug
description: "Diagnose reproducible bugs, test failures and race conditions before changing behavior."
---

Start with the exact reported symptom and a tight reproduction. Read errors, relevant history and a known working path. Trace data across boundaries; for async failures capture request start, mutation/event, cancellation and response ordering. Inspect only relevant settings; redact credentials and personal data in evidence.

State one hypothesis and the evidence supporting it. Change one variable to test it. If a hypothesis fails, revise it rather than stacking speculative fixes. Reduce the reproduction to the smallest failing case, then fix the owning mechanism. A regression check must fail with the old source and pass with the fix. Restore source carefully and preserve unrelated edits during this check. Run the relevant repository checks and report any environment limitations. Do not broaden the assignment into unrelated cleanup.

Apply the user's scope, repository instructions and current run permissions. Onni owns task worktrees and orchestration. A worker must not dispatch further tasks; Antigravity workers finish with a plain text report and must not commit or push.
