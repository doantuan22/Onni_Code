---
metadata:
  onni-dependencies: "[]"
name: onni-tdd
description: "Implement behavior changes with focused red-green-refactor tests using the repository test runner."
---

Find the public behavior and existing test seam. Choose one vertical slice, write the smallest test that demonstrates the requested behavior, run it and confirm it fails for the expected reason. Implement the minimum change, run the test until green, then refactor while keeping it green. Continue slice by slice rather than writing a large speculative test suite first.

Test observable behavior, boundaries and error paths. Prefer real small collaborators to mocks that mirror internal calls. For races, control completion order instead of relying on timing sleeps. Use the pinned repository test runner and keep unit suites independent of servers/browsers when the repo requires it. Apply the repository's policy for documentation and low-impact changes; do not add tests just to restate an implementation. Report the actual red/green evidence and remaining verification gaps.

Apply the user's scope, repository instructions and current run permissions. Onni owns task worktrees and orchestration. A worker must not dispatch further tasks; Antigravity workers finish with a plain text report and must not commit or push.
