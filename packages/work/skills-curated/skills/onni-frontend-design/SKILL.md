---
metadata:
  onni-dependencies: "[]"
name: onni-frontend-design
description: "Build or improve frontend UI within an existing product brief and design system."
---

Identify the audience, primary task, actual content and existing design tokens. Preserve the user's requested visual direction and established component system. For a new surface, choose a coherent layout, typography and palette tied to its purpose; avoid decorative patterns that obscure information hierarchy. For a bug fix, preserve the surrounding design and implement the requested behavior.

Design loading, empty, error and success states as part of the feature. Include mobile layout, keyboard navigation, visible focus, readable contrast, semantic labels and reduced-motion support. Reuse existing fonts/assets and never fetch external assets implicitly. Keep implementation jargon out of product copy. Inspect screenshots or the running UI when tools permit; a source-only check does not establish visual quality. Use the repository's existing QA launcher and browser runner rather than installing another stack. State any visual checks you could not perform.

Apply the user's scope, repository instructions and current run permissions. Onni owns task worktrees and orchestration. A worker must not dispatch further tasks; Antigravity workers finish with a plain text report and must not commit or push.
