---
metadata:
  onni-dependencies: "[]"
name: onni-react
description: "Optimize React rendering, subscriptions and client data flow when React is present."
---

Confirm the actual framework, React version and data/cache library first. Prioritize measured waterfalls, duplicated subscriptions, large eager dependencies and unnecessary renders. Start independent reads together, defer unnecessary work, and subscribe at the lifetime of the data. Clean up listeners, timers and subscriptions. Use functional state updates when composing on prior state and keep effect dependencies accurate.

Derive values during render when possible instead of mirroring server data into state. Preserve unsaved edits explicitly when an editor needs a draft. Use stable keys and correct project-scoped query keys. Reuse the application's existing transport and cache rather than adding polling or another socket. Measure before adding memoization or micro-optimizations. Use the existing bundler for lazy modules. Next.js server components, next/dynamic, Vercel services and SWR are not prerequisites; do not introduce them into a Vite or other React application.

Apply the user's scope, repository instructions and current run permissions. Onni owns task worktrees and orchestration. A worker must not dispatch further tasks; Antigravity workers finish with a plain text report and must not commit or push.
