---
metadata:
  onni-dependencies: "[]"
name: onni-design
description: "Design or refactor module interfaces while preserving behavior and repository conventions."
---

Map callers, ownership, invariants, error cases and existing tests before choosing an interface. Prefer a small interface that hides useful complexity, with changes concentrated in the owning module. Name the old mechanism's guarantees before replacing a timer, cache, lock or cap. Follow existing project vocabulary instead of imposing a new architecture or glossary.

Compare at least two designs when the choice is consequential. Consider default behavior with no configuration, construction sites, serialization, old persisted state, and transitions out of new states. Introduce abstractions for demonstrated variation rather than hypothetical extensions. Preserve package boundaries and expose testable behavior through the same interface callers use. Keep the change within the requested scope; do not create independent subagents or worktrees to explore designs.

Apply the user's scope, repository instructions and current run permissions. Onni owns task worktrees and orchestration. A worker must not dispatch further tasks; Antigravity workers finish with a plain text report and must not commit or push.
