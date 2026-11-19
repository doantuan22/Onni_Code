# Skill upgrade: offline pilot

Optimization: [implementation and validation](optimization-implementation.md),
following the [20 November plan](optimization-plan.md).

Implementation date: 2026-11-19 (Asia/Bangkok). This is an integrated pilot, not a
claim that a GitHub popularity ranking predicts better coding outcomes.

## What is available

Nine concise Onni adaptations are shipped in `packages/work/skills-curated/skills`.
They appear as read-only built-ins in the existing catalog and slash picker,
without configuring a Git source, installing a CLI plugin or downloading at boot.

| Name | Intended use | Source |
| --- | --- | --- |
| `onni-plan` | Manager planning and scoped orders | Superpowers writing-plans |
| `onni-debug` | Worker root-cause investigation | Superpowers systematic-debugging |
| `onni-verify` | Manager/worker evidence checks | Superpowers verification-before-completion |
| `onni-tdd` | Worker behavior-driven test cycles | Matt Pocock tdd |
| `onni-design` | Module interfaces and compatibility | Matt Pocock codebase-design |
| `onni-review` | Correctness and specification review | Matt Pocock code-review |
| `onni-react` | React data flow and rendering | Vercel React best practices |
| `onni-react-composition` | React component APIs and state ownership | Vercel composition patterns |
| `onni-frontend-design` | UI implementation within an existing design system | Anthropic frontend-design |

Exact repository URLs, commits, source/content hashes and adaptation notes are
in [the manifest](../../packages/work/skills-curated/manifest.json). License texts
and attribution ship with the package. These are rewritten adapters, not full
copies of the upstream plugin or a replacement for every upstream feature.

Use `/onni-debug Investigate the stale project list` at the beginning of a task
or message, or select the skill in a workflow. Managers receive a short routing
hint and can prefix a worker objective with the selected skill. The normal
Onni prompt expansion/provisioning path handles it. A skill does not grant
permissions, inherit itself into children or add native nested subagents.

## Baseline inventory and migration decisions

The pre-change local discovery snapshot contained 15 unique skills: two from this
repo (`e2e`, `om-prepare-test-env`) and thirteen global skills supplied by another
tool. The automation playbook is separately capability-gated. No project or
organisation skills repository was configured in the inspected snapshot.

Keep `e2e`, launcher notes and `create-onni-automation`: they implement local QA or
Onni-specific workflows. Keep all externally owned global skills. There is no
existing generic coding bundle in this snapshot whose removal would improve it.
The pilot therefore fills missing capabilities rather than deleting these skills.
Names use `onni-` to avoid silently changing existing workflow behavior.

Local, user and team skills win name collisions. Override a bundled skill with a
project-owned skill of the same name if needed; remove that override to return
to the fallback. Existing workflow/preset names were not rewritten. Returning
to the previous build removes these fallbacks without modifying user content.

Five source repositories were inspected. Superpowers and Matt Pocock supply
engineering candidates; Vercel supplies React candidates; Anthropic supplies UI
design. Trail of Bits is deferred for a separate security bundle with its own
license/tool review. UI UX Pro Max and Python Playwright were not substituted for
the current QA pipeline. This is narrower than the plan's proposed 15–20-repo
survey and does not establish an exhaustive search optimum.

## Validation

- All nine skill directories passed the skill-creator frontmatter validator.
- Focused discovery/provisioning/API/manager tests: 79 passing tests; prompt and
  package-gate checks plus the new integration tests: 33 passing tests.
- Removing curated discovery made two new regression tests fail; restoring it
  made the suite pass. Project overrides and worker discovery paths are covered.
- Typecheck and production build/pack gate passed. The pack gate checks the
  skill content, manifest, attribution and license files as well as application assets.
- Core unit suite: 47 passed, one existing capability skip; this is not an all-tests-pass claim.
- Package tests: all 5 passed, including discovery from an installed tarball, not
  just the source tree.

## Model evaluation and limits

[Raw fixture answers and usage](evaluation.json) record 18 valid sequential runs:
three synthetic cases × baseline/adapted × three repetitions, alternating order
between repetitions. Cases cover stale-response resurrection, project cache/draft
leaks, and unsupported completion claims. All valid runs used zero tools.

Manual rubric review found the required diagnosis/evidence points in all nine
answers per condition. The adapted verification answers were more careful about
independently verifying a worker's claims. This did not improve overall correctness
on these relatively easy fixtures: both conditions were already correct.

| Measure | Baseline | Adapted |
| --- | ---: | ---: |
| Valid answers | 9 | 9 |
| Mean elapsed time | 8,848 ms | 10,006 ms |
| Total input tokens reported | 153,480 | 154,810 |
| Total output tokens reported | 1,531 | 1,729 |

The pilot is about 13% slower by mean wall time and consumes slightly more input
tokens. These results do **not** meet the proposed 15% efficiency improvement
criterion, nor prove a quality improvement. Keep selection explicit and avoid
automatically attaching every playbook to every task. Six other adapters were
structurally tested but not model-benchmarked in this pilot.

The runner used Codex CLI 0.167.2 with `--ignore-user-config`, its built-in model
default, ephemeral sessions and a temporary directory outside this repository.
The exact served model identity was not emitted in the captured events, which
limits reproducibility. Baseline prompts used the same CLI/default and fixtures.
The substantial system prompt overhead is included in the reported tokens.
No USD estimate is inferred from token counts.

An earlier run with user configuration emitted two non-answer items; the harness
stopped and that run was excluded. It is not counted as a valid benchmark.
No result here establishes successful code changes, browser flows, performance
on all nine backends or behavior of an already installed desktop binary.

For another explicit evaluation, run from the repository root:

```sh
node packages/work/scripts/eval-curated-skills.mjs 3 .tmp/curated-evaluation
```

This command invokes the logged-in Codex CLI and can consume usage; it is never
called by the application, build or unit tests. It stops on a failed invocation
or non-answer tool items. The next promotion gate is a larger coding benchmark
with fixed model identity and the plan's twelve scenarios across representative
backends. No upstream updater, telemetry, visual companion or runtime installer
is introduced by this pilot.
