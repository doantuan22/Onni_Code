/**
 * OpenCode's ACP dialect — the per-runner mapper `AGENT_PROTOCOL.md` §9 step 4 asks for, over the
 * shared `acp-ui-mapper.ts`.
 *
 * Every rule here was read off a live `opencode acp` probe against OpenCode 2.3.0 — the handshake,
 * the `session/new` `configOptions` result, the `read` tool lifecycle, and the `session/prompt`
 * result are verbatim frames (`.ai/tmp-opencode-probe3-out.txt`, recorded 2026-11-17). OpenCode
 * speaks unmodified core ACP, so the shared mapper already reads its frames; what this dialect adds
 * is the small per-agent knowledge:
 *
 *  - the wire `title` is the bare tool name ("read", "shell"), so `toolTitleOf` derives a readable
 *    title from the call's arguments;
 *  - `subagent` (kind `think`), `todowrite` and `shell` are tool names the ACP `kind` cannot
 *    express — `toolKindOf` maps them;
 *  - the plan is a `todowrite` tool call whose `rawInput.todos` carry the entries, not a `plan`
 *    update — `planFromToolCall` maps it;
 *  - auth wording, for the `session/new` error and any prose that carries the same failure.
 */
import {
  createAcpUiState,
  mapAcpFrame,
  type AcpDialect,
  type AcpUiMapperState,
  type AcpUiMapping,
} from './acp-ui-mapper.ts';
import type { PlanEntry, ToolKind } from './ui-events.ts';
import { toolDisplay } from './tool-display.ts';

/** What a user needs in order to run OpenCode. */
export const OPENCODE_AUTH_HINT =
  'OpenCode needs a login — run `opencode auth login`, or set a provider key in `~/.config/opencode/auth.json`.';

/** The run-time line for a rejected credential. "authentication failed" is what
 *  `isRuntimeProviderAuthFailure` keys on, so the server raises `provider-auth-required`. */
export const OPENCODE_AUTH_FAILURE_MESSAGE =
  'OpenCode authentication failed — run `opencode auth login`, or set a provider key in `~/.config/opencode/auth.json`.';

/**
 * OpenCode answers an unauthenticated `session/new` with a JSON-RPC error whose message carries
 * "Authentication required" (the `session/load` of a stale session can answer the same way). The
 * wording patterns cover the same failure arriving as prose on another frame.
 */
const AUTH_FAILURE_PATTERNS = [
  /authentication required/i,
  /not (?:logged in|authenticated|signed in)/i,
  /\bopencode auth (?:login)?\b/i,
  /invalid api key|unauthorized|\b401\b/i,
] as const;

/** True for the OpenCode auth failures onni has seen on the wire (see the fixtures). */
export function isOpencodeAuthFailure(text: string): boolean {
  return AUTH_FAILURE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * OpenCode carries the tool's own name on the wire (`name: "read"`), unlike Copilot, which carries
 * only a rendered title and a kind. The name is the primary key; the ACP `kind` is the fallback
 * for a frame that omitted it.
 */
export function opencodeToolName(update: Record<string, unknown>): string {
  const name = typeof update.name === 'string' && update.name ? update.name : undefined;
  if (name) return name;
  return typeof update.kind === 'string' && update.kind ? update.kind : 'tool';
}

/**
 * Tool names OpenCode uses that the ACP `kind` cannot express:
 *  - `subagent` arrives with kind `think` (its inner loop) but is a delegation → `task`;
 *  - `todowrite` is the plan tool → `plan`;
 *  - `shell` is its bash/execute tool.
 */
function opencodeToolKind(name: string): ToolKind | undefined {
  if (name === 'subagent') return 'task';
  if (name === 'todowrite') return 'plan';
  if (name === 'shell') return 'execute';
  return undefined;
}

/**
 * A readable title: the wire `title` is the bare tool name ("read", "shell"), so the card would
 * read "read" instead of "Read package.json". Derive the display title from the arguments — but
 * only when the update carries them, so a `completed` update (which OpenCode sends without
 * `rawInput`) keeps the title the earlier update built.
 */
function opencodeToolTitle(update: Record<string, unknown>, name: string): string | undefined {
  if (!isRecord(update.rawInput)) return undefined;
  // `subagent` carries its prompt under `description`/`prompt`; map it through the task display.
  const displayName = name === 'subagent' ? 'task' : name;
  const display = toolDisplay(displayName, update.rawInput);
  return display.title !== displayName ? display.title : undefined;
}

/** A `todowrite` call's `rawInput.todos` → plan entries. Statuses OpenCode emits are ACP-shaped
 *  (`pending`/`in_progress`/`completed`); anything else falls back to `pending`, and a malformed
 *  `todos` yields no plan at all rather than a fabricated one. */
export function opencodePlanFromToolCall(name: string, update: Record<string, unknown>): PlanEntry[] | undefined {
  if (name !== 'todowrite' || !isRecord(update.rawInput) || !Array.isArray(update.rawInput.todos)) return undefined;
  const entries: PlanEntry[] = [];
  for (const todo of update.rawInput.todos) {
    if (!isRecord(todo)) continue;
    const content = typeof todo.content === 'string' && todo.content.trim() !== '' ? todo.content : undefined;
    if (!content) continue;
    const status: PlanEntry['status'] =
      todo.status === 'in_progress' || todo.status === 'completed' || todo.status === 'cancelled' ? todo.status : 'pending';
    const priority =
      todo.priority === 'high' || todo.priority === 'medium' || todo.priority === 'low' ? todo.priority : undefined;
    entries.push({ content, status, ...(priority ? { priority } : {}) });
  }
  return entries;
}

export const opencodeDialect: AcpDialect = {
  backend: 'opencode',
  toolNameOf: opencodeToolName,
  toolKindOf: opencodeToolKind,
  toolTitleOf: opencodeToolTitle,
  planFromToolCall: opencodePlanFromToolCall,
  // Per-turn counts need no dialect hook: OpenCode answers `session/prompt` with a top-level
  // `usage` in exactly the ACP shape the shared mapper's `standardUsage` reads
  // (`{inputTokens, outputTokens, totalTokens, thoughtTokens?, cachedReadTokens?}`). Its separate
  // `usage_update` frame is a context-window gauge (`{used, size, cost}`), not token counts, and is
  // not mapped.
  errorMessage: (error) => {
    const text = `${typeof error.message === 'string' ? error.message : ''} ${JSON.stringify(error.data ?? '')}`;
    return isOpencodeAuthFailure(text) ? OPENCODE_AUTH_FAILURE_MESSAGE : undefined;
  },
};

export type OpencodeUiMapperState = AcpUiMapperState;

export function createOpencodeUiState(): OpencodeUiMapperState {
  return createAcpUiState();
}

export function mapOpencodeFrame(frame: unknown, state: OpencodeUiMapperState): AcpUiMapping {
  return mapAcpFrame(frame, state, opencodeDialect);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
