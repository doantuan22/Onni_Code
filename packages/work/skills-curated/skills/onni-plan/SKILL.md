---
metadata:
  onni-dependencies: "[]"
name: onni-plan
description: "Plan scoped implementation work and worker assignments after requirements are known."
---

Identify the requested outcome, affected files, existing conventions and the checks that would prove the result. Record a short plan at the repository's established location. Split only at independently verifiable outcomes, with one owner for shared contracts and files. Each part needs scope, dependencies, acceptance criteria and evidence. Include failure/recovery cases, not just the happy path.

In manager mode, save the tree plan using Onni's existing commands. Dispatch only within the current roster and limits. Put the chosen worker skill at character zero of the objective, for example: /onni-debug Investigate the stale project list. Include all necessary context: workers do not inherit this conversation or the manager's selected skill. Use Onni dependencies for ordered tasks. No native nested subagents or additional worktrees. Small tasks can remain a short inline plan.

Apply the user's scope, repository instructions and current run permissions. Onni owns task worktrees and orchestration. A worker must not dispatch further tasks; Antigravity workers finish with a plain text report and must not commit or push.
