---
metadata:
  onni-dependencies: "[]"
name: onni-react-composition
description: "Refactor React component APIs and shared state when boolean props or duplicated behavior cause defects."
---

Identify the concrete duplicated behavior or conflicting component states. Prefer explicit variants, composition and focused components over proliferating boolean props. Lift shared state to the nearest common owner and keep context interfaces narrow. Separate state ownership from presentation so different screens render the same authoritative value.

Preserve keyboard, focus, accessible labels and existing public component contracts. Respect the project's React version and installed UI primitives. Context should not force every consumer to rerender on high-frequency unrelated updates; use existing selectors or stores for those values. Keep drafts local and server facts in the shared cache. Verify consumers, state transitions and unmount cleanup after restructuring. Avoid migrating an entire component system when a local fix satisfies the request.

Apply the user's scope, repository instructions and current run permissions. Onni owns task worktrees and orchestration. A worker must not dispatch further tasks; Antigravity workers finish with a plain text report and must not commit or push.
