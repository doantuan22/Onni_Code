# OpenCode over ACP — golden fixtures

Spec `.ai/specs/2026-09-19-runner-seam-native-backends.md`, Phase 3. These fixtures pin the
`opencode acp` runner that replaced the 1.x HTTP server API (`opencode serve` + SSE), which changed
shape going 1.x → 2.x. ACP is the version-stable seam OpenCode ships for editors, so the frames here
are what a future 3.x keeps speaking.

## Provenance — read this before trusting a frame

`AGENT_PROTOCOL.md` §7 requires fixtures to be verified against **upstream wire shapes, never your
own assumptions**, and to cite the source they were derived from. Here is the honest accounting:

| Scenario | How the frames were obtained |
|---|---|
| `initialize`, `session/new`, `session/prompt`, the `read` tool lifecycle, `agent_thought_chunk`, `usage_update`, the prompt result's top-level `usage` | **Captured live** on 2026-11-17 by piping `opencode acp` against OpenCode 2.3.0. These frames are verbatim. |
| `shell` / `edit` / `todowrite` / a failing `read` / the `subagent` delegation | **Assembled from OpenCode's own ACP tool shapes**, matching the emitters the live probe exercised; each frame matches a real shape, none is invented. |

The live capture was a single short `read` turn against a real model, so only one tool's full
lifecycle (`read`, `pending` → `in_progress` → `completed`) and the text/reasoning/usage channels are
verbatim. The remaining tools were assembled from the same argument and content shapes OpenCode
emits, exactly the offline method the spec used for codex and Copilot.

### Re-recording a live capture

```bash
opencode acp   # speak ACP on stdio; feed initialize / session/new / session/prompt frames
```

## File layout

Line 1 is a `{"fixture": {…}}` header (source, CLI version, ACP docs, scenario). Every other line is
`{"dir":"out"|"in","frame":<JSON-RPC message>}` in wire order — `out` is what onni wrote to the
agent's stdin, `in` is what the agent wrote to stdout. `opencode-ui-mapper.test.ts` replays exactly
those frames through `mapOpencodeFrame`, the same way the runner drives it, and asserts
`toStrictEqual` against the `.expected.json`. The same expected files feed `ui-parity.test.ts`.

## What each fixture covers

| Fixture | Parity rows it carries |
|---|---|
| `tool-lifecycle` | `plan.updated` via the `todowrite` tool, a `read` tool `pending` → `running` → `completed`, `shell`/`edit` tools with structured diffs, a failing `read`, reasoning items, `usage.updated` with raw counts, `turn.completed` with directional usage and `stopReason: end_turn` |
| `subagent` | the `subagent` tool (ACP kind `think`) → a v2 `task` item; the child's tool call is **not** nested (see below) |
| `cancel` | `stopReason: cancelled`, and a tool the cancelled turn left pending settled as failed rather than spinning |
| `auth-required` | the fatal `session.error` an unauthenticated host gets |
| `malformed` | the robustness contract: unknown kinds, null content, a non-array plan, a nameless tool call, an update for no session, a frame with no direction — no events, no throw |

## Where OpenCode differs from the plain ACP reading

Three deviations are load-bearing, and all three are why `opencode-ui-mapper.ts` exists:

1. **The wire `title` is the bare tool name.** A `read` update carries `title: "read"`, not "Reading
   calc.py". `toolTitleOf` derives a readable title from the call's `rawInput` (`Read calc.py`,
   `Ran npm test`, `Edit calc.py`), and only when the update carries arguments — OpenCode's
   `completed` update omits `rawInput`, so the title the earlier update built is kept.
2. **The plan is a tool call, not a `plan` update.** OpenCode has no native plan channel in ACP;
   its plan tool is `todowrite`, whose `rawInput.todos` carry the entries. `planFromToolCall` maps
   it. `toolKindOf` also maps `subagent` (ACP kind `think`) to `task` and `shell` to `execute`,
   since those names cannot be expressed by the ACP `kind` alone.
3. **Sub-agent work is attributed to the ROOT session, not the delegating call.** A delegated
   agent's tool calls carry `_meta["opencode/child-session"].parentID` set to the **root** ACP
   session id — not the delegating `subagent` call's `toolCallId`. There is therefore **no real
   `parentItemId`**; the child tool cards appear flat, beside the `task` item, exactly as the wire
   puts them. This is the opposite of Copilot, whose `agentId` is the delegating call's id.

## Things deliberately NOT mapped

- **`usage_update`.** OpenCode's is `{used, size, cost}` — a **context-window gauge** plus cost,
  not token counts. Per-turn usage rides on the `session/prompt` result as a top-level `usage` in
  exactly the ACP shape the shared mapper reads (`{inputTokens, outputTokens, totalTokens,
  thoughtTokens?, cachedReadTokens?}`). Feeding `{used, size}` into `usage.updated` would report the
  window size as tokens spent.
- **`session_info_update`, `current_mode_update`, `config_option_update`,
  `available_commands_update`, `user_message_chunk`.** Nothing in the cockpit renders them yet; the
  `available_commands_update` marker is consumed by the runner as the end of a `session/load`
  replay, and the rest are exercised in `malformed.ndjson` to pin that they produce no events
  rather than errors.
- **`session/set_model`.** OpenCode answers `-32601` for it, so the model goes through the
  version-stable config file (`OPENCODE_CONFIG_CONTENT` → `{model: "provider/model"}`) instead —
  never an ACP call. Same for private MCP servers: they ride the config file's `mcp` key, the one
  channel proven on both 1.x and 2.x.
