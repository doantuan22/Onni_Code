---
metadata:
  onni-dependencies: "[]"
name: onni-review
description: "Review a concrete diff for correctness, repository standards and requested behavior."
---

Resolve the requested review base or use the task's established diff base; include staged/unstaged changes when they are the review target. Read the spec/user request and applicable repository instructions. If no spec is available, review correctness and state that limitation; do not require issue-tracker setup.

Inspect the diff along two axes: correctness and repository standards; and fidelity to the requested outcome. Trace callers and failure paths, especially default behavior, concurrency, persistence and cross-project state. Treat code smells as prompts for investigation, not findings by themselves. Report actionable regressions with location, triggering scenario, impact and evidence. Separate verified problems from uncertainty and style preferences. A review worker performs the review itself; a manager may allocate independent reviews through Onni only within its roster. Do not spawn native subagents, commit, merge or push as part of a review.

Apply the user's scope, repository instructions and current run permissions. Onni owns task worktrees and orchestration. A worker must not dispatch further tasks; Antigravity workers finish with a plain text report and must not commit or push.
