import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasTerminated,
  isSignalTerminationExit,
  prependSystemPrompt,
  trackChildExit,
  type AgentBackend,
  type AgentEvent,
  type AgentRunResult,
  type AgentRunSpec,
  type AgentRunner,
  type AgentSession,
  type AgentToolCallRecord,
  type ContentBlock,
  type SessionOptions,
} from './agent-runner.ts';
import { buildChildEnv } from './agent-env.ts';
import { AcpClient, type AcpContentBlock, type AcpMessage, type AcpRequestAnswer } from './acp-client.ts';
import { opencodeConfigContent } from './private-mcp.ts';
import { abortAcpTurn, endAcpReplay, mapAcpFrame, type AcpUiMapperState } from './acp-ui-mapper.ts';
import { EOF_KILL_GRACE_MS, EOF_TERM_GRACE_MS } from './claude-cli-runner.ts';
import {
  OPENCODE_AUTH_FAILURE_MESSAGE,
  createOpencodeUiState,
  isOpencodeAuthFailure,
  opencodeDialect,
} from './opencode-ui-mapper.ts';
import type { UiEvent } from './ui-events.ts';
import { spawnableCommand } from './windows-shim.ts';
import { spawnTaskProcess } from './task-process-spawn.ts';
import { armInactivityDeadline, inactivityTimeoutMessage, type InactivityDeadline } from './inactivity-deadline.ts';

const DEFAULT_TIMEOUT_MS = 30 * 60_000;
/** `initialize` / `session/new` / `session/load` are handshakes: bounded, unlike a prompt. */
const HANDSHAKE_TIMEOUT_MS = 90_000;
/**
 * How long to wait for the end of a `session/load` replay (`available_commands_update`) before
 * prompting anyway. OpenCode advertises `loadSession` and replays the loaded session's history;
 * this is a bound, not an expectation: an agent that never sends the marker costs one 5s wait on
 * resume.
 */
const REPLAY_WAIT_MS = 5_000;
const AUTO_END_DELAY_MS = 250;

export interface OpencodeAcpRunnerOptions {
  /** Override the binary; defaults to `opencode` on PATH (`ONNI_OPENCODE_BIN`). */
  bin?: string;
  /** Inactivity timeout for a run (ms); per-spec `timeoutMs` still wins. */
  timeoutMs?: number;
}

/**
 * OpenCode over the Agent Client Protocol: one long-lived `opencode acp` child and one ACP session
 * per onni session. Follow-ups are further `session/prompt` calls on the same process; Continue
 * resumes with `session/load`.
 *
 * This replaces the 1.x HTTP server API (`opencode serve` + SSE), which changed shape going 1.x →
 * 2.x. ACP is the version-stable seam OpenCode ships for editors, so a future 3.x keeps working as
 * long as it speaks the protocol.
 *
 * The wire was captured live against OpenCode 2.3.0 (`opencode acp` probe, recorded 2026-11-17 —
 * see `opencode-ui-mapper.ts` and `__fixtures__/opencode/README.md`). Two things OpenCode does not
 * speak in ACP, so the runner falls back to the version-stable config file:
 *
 * - `session/set_model` answers `-32601`, so the model goes through `OPENCODE_CONFIG_CONTENT`
 *   (`{model: "provider/model"}`), which the probe proved wins;
 * - private MCP servers go through `OPENCODE_CONFIG_CONTENT`'s `mcp` key (the path the 1.x runner
 *   used), not ACP `mcpServers` — OpenCode advertises `mcpCapabilities` but the config file is the
 *   one channel proven on both major versions.
 *
 * OpenCode has no permission flag for ACP, so a `session/request_permission` is auto-approved with
 * a note (`allow_once` first, so no standing rule is written) — otherwise a run would park on a
 * question nothing in the cockpit can answer. That makes this a full-shell backend, like Codex and
 * Copilot: it is not a sandbox, and a roster may use it as a worker only.
 */
export class OpencodeAcpRunner implements AgentRunner {
  readonly backend = 'opencode' as const;
  private readonly bin: string;
  private readonly timeoutMs: number;
  private lastSession: AgentSession | null = null;

  constructor(opts: OpencodeAcpRunnerOptions = {}) {
    this.bin =
      opts.bin ?? process.env.ONNI_OPENCODE_BIN ?? (process.env.ONNI_DRY_RUN === '1' ? mockOpencodePath() : 'opencode');
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  run(spec: AgentRunSpec, onEvent?: (event: AgentEvent) => void): Promise<AgentRunResult> {
    return this.startSession(spec, onEvent, { autoEndAfterFirstTurn: true }).result;
  }

  async interrupt(): Promise<void> {
    this.lastSession?.interrupt();
  }

  startSession(spec: AgentRunSpec, onEvent?: (event: AgentEvent) => void, opts: SessionOptions = {}): AgentSession {
    const session = new OpencodeAcpSession(this.bin, this.backend, spec, spec.timeoutMs ?? this.timeoutMs, onEvent, opts);
    this.lastSession = session;
    return session;
  }
}

/**
 * The CLI arguments for one run: only `acp`, which starts the ACP server on stdio (`opencode --help`,
 * 2.3.0). Everything else is left to the ACP session or to `OPENCODE_CONFIG_CONTENT`:
 *
 * - the model goes through `OPENCODE_CONFIG_CONTENT`, not a flag — `session/set_model` answers
 *   `-32601` on 2.3.0, and the config file is the version-stable channel;
 * - private MCP servers go through `OPENCODE_CONFIG_CONTENT` (see `buildOpencodeEnv`);
 * - there is no flag for extra directories, so `spec.additionalDirectories` is not forwarded.
 */
export function buildOpencodeArgs(): string[] {
  return ['acp'];
}

/** Merge `patch` into an `OPENCODE_CONFIG_CONTENT` JSON value, tolerating an unparseable existing
 *  value (the patch still applies) — the same tolerance `opencodeConfigContent` has. */
function mergeOpencodeConfig(existing: string | undefined, patch: Record<string, unknown>): string {
  let base: Record<string, unknown> = {};
  if (existing) {
    try {
      const parsed: unknown = JSON.parse(existing);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed as Record<string, unknown>;
    } catch {
      // an unparseable host value cannot be merged into; the patch still applies
    }
  }
  return JSON.stringify({ ...base, ...patch });
}

/**
 * The per-run environment: `buildChildEnv`'s least-privilege set for this backend, plus the
 * `OPENCODE_CONFIG_CONTENT` carrying the model and the private MCP servers. OpenCode loads that
 * config after its own project config, so both win on a clash.
 */
export function buildOpencodeEnv(spec: AgentRunSpec): NodeJS.ProcessEnv {
  const env = buildChildEnv({ backend: 'opencode', extraEnv: spec.env });
  let config = env.OPENCODE_CONFIG_CONTENT;
  if (spec.mcpServers?.length) config = opencodeConfigContent(spec.mcpServers, config);
  if (spec.model) config = mergeOpencodeConfig(config, { model: spec.model });
  env.OPENCODE_CONFIG_CONTENT = config;
  return env;
}

/**
 * A onni-authored line for an exit outside a prompt.
 *
 * OpenCode's exit codes are **not documented and were not verified**, so this reports the code and
 * the tail of stderr rather than inventing meanings. The one case worth translating is an
 * authentication failure, because that wording is what raises `provider-auth-required`.
 */
export function opencodeExitMessage(exitCode: number | null, stderr: string, midTurn = false): string {
  if (isOpencodeAuthFailure(stderr)) return OPENCODE_AUTH_FAILURE_MESSAGE;
  const detail = stderr.trim().split('\n').slice(-3).join(' | ');
  // Mid-turn, a bare "exited with code 0" reads as success; it is a dropped prompt (telemetry 2e3b122d).
  const head = midTurn
    ? `OpenCode quit mid-turn without answering the prompt (exit code ${exitCode})`
    : `OpenCode exited with code ${exitCode}`;
  return `${head}${detail ? ` — ${truncate(detail, 400)}` : ''}`;
}

class OpencodeAcpSession implements AgentSession {
  readonly result: Promise<AgentRunResult>;
  readonly pid?: number;

  private readonly child: ChildProcessWithoutNullStreams;
  private readonly client: AcpClient;
  private readonly hasExited: () => boolean;
  private ui: AcpUiMapperState = createOpencodeUiState();
  private acpSessionId: string | undefined;
  private loadSupported = false;
  private imagesSupported = false;

  private isOpen = true;
  private turnInFlight = false;
  private turnsCompleted = 0;
  private readonly queue: AcpContentBlock[][] = [];
  private terminatedByOnni = false;
  /** `end()` closed stdin: a turn the CLI then drops on EOF was onni's call, not a failure. */
  private endedByOnni = false;
  private timedOut = false;
  private deadline: InactivityDeadline = armInactivityDeadline(0, () => {});
  private failed: string | null = null;
  private replayDone: (() => void) | null = null;

  private readonly textChunks: string[] = [];
  private readonly toolCalls: AgentToolCallRecord[] = [];
  private tokensUsed = 0;
  private readonly stderr: string[] = [];
  private spawnError: Error | null = null;
  private autoEndTimer: NodeJS.Timeout | undefined;
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    bin: string,
    backend: AgentBackend,
    private readonly spec: AgentRunSpec,
    private readonly limitMs: number,
    private readonly onEvent: ((event: AgentEvent) => void) | undefined,
    private readonly opts: SessionOptions,
  ) {
    const [file, argv] = spawnableCommand(bin, buildOpencodeArgs());
    this.child = spawnTaskProcess(file, argv, { cwd: spec.cwd, env: buildOpencodeEnv(spec) });
    this.pid = this.child.pid;
    this.hasExited = trackChildExit(this.child);
    // EPIPE from a write racing the child's exit arrives as an async 'error' (acfb01e4).
    this.child.stdin.on('error', () => {});
    this.child.on('error', (error: NodeJS.ErrnoException) => {
      this.spawnError =
        error.code === 'ENOENT'
          ? new Error(`\`${bin}\` not found on PATH — install OpenCode and run \`opencode auth login\``)
          : error;
    });
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => this.stderr.push(chunk));
    this.client = new AcpClient(this.child.stdin, this.child.stdout, {
      onFrame: (dir, frame) => this.onFrame(dir, frame),
      onRequest: (request) => this.onRequest(request),
      onUnparseable: (line) => this.emit({ type: 'note', message: `opencode: skipped unparseable ACP line: ${truncate(line, 200)}` }),
    });

    this.deadline = armInactivityDeadline(this.limitMs, () => {
      this.timedOut = true;
      this.interrupt();
    });
    this.result = this.lifecycle();
  }

  get open(): boolean {
    return this.isOpen;
  }

  sendMessage(content: ContentBlock[]): boolean {
    if (!this.isOpen || this.client.closed) return false;
    if (this.autoEndTimer) {
      clearTimeout(this.autoEndTimer);
      this.autoEndTimer = undefined;
    }
    // ACP has no steering: a message sent mid-turn waits for the turn to end, in order.
    this.queue.push(this.toAcp(content));
    this.pump();
    return true;
  }

  end(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.endedByOnni = true;
    this.terminate(false);
  }

  interrupt(): void {
    if (this.acpSessionId && this.turnInFlight) this.client.cancel(this.acpSessionId);
    this.isOpen = false;
    this.terminate(true);
  }

  // ---- lifecycle ------------------------------------------------------------------------

  private async lifecycle(): Promise<AgentRunResult> {
    const reading = this.client.run();
    const exited = waitForExit(this.child);
    try {
      await this.bootstrap();
    } catch (error) {
      // An agent that went away mid-handshake is explained by its exit, read below — not by the
      // transport's "closed" rejection.
      if (!this.spawnError && !this.client.closed) this.fail(error instanceof Error ? error.message : String(error));
      this.terminate(false);
    }

    await reading;
    const exitCode = await exited;
    this.deadline.clear();
    for (const timer of this.timers) clearTimeout(timer);
    if (this.autoEndTimer) clearTimeout(this.autoEndTimer);
    this.isOpen = false;

    if (this.spawnError) throw this.spawnError;
    if (this.turnInFlight) {
      // The agent died with a prompt unanswered: the transport rejected it, the wire never will.
      this.turnInFlight = false;
      if (this.timedOut) this.applyUi(abortAcpTurn(this.ui, opencodeDialect, 'timeout'));
      else if (this.terminatedByOnni || this.endedByOnni) this.applyUi(abortAcpTurn(this.ui, opencodeDialect, 'cancelled'));
      else {
        const reason = opencodeExitMessage(exitCode, this.stderrText(), true);
        this.applyUi(abortAcpTurn(this.ui, opencodeDialect, 'error', reason));
        this.fail(reason);
      }
    }
    const summary = (): AgentRunResult => ({
      text: this.textChunks.join('').trim(),
      toolCalls: this.toolCalls,
      tokensUsed: this.tokensUsed,
      ...(this.acpSessionId ? { sessionId: this.acpSessionId } : {}),
    });

    if (this.timedOut) {
      this.emit({ type: 'error', message: inactivityTimeoutMessage('OpenCode', this.limitMs, this.deadline.expiredBy) });
      this.emit({ type: 'done' });
      return summary();
    }
    if (this.failed) {
      this.opts.onUiEvent?.({ type: 'session.ended', reason: 'error' });
      this.emit({ type: 'done' });
      return summary();
    }
    if (!this.acpSessionId && !this.terminatedByOnni && (exitCode === 0 || exitCode === null)) {
      this.fail('OpenCode exited before it started a session');
      this.opts.onUiEvent?.({ type: 'session.ended', reason: 'error' });
      this.emit({ type: 'done' });
      return summary();
    }
    if (exitCode !== 0 && exitCode !== null) {
      if (this.terminatedByOnni && (isSignalTerminationExit(exitCode) || exitCode === 1)) {
        this.emit({ type: 'note', message: `OpenCode exited ${exitCode} after onni stopped it` });
      } else if (!this.terminatedByOnni) {
        const message = opencodeExitMessage(exitCode, this.stderrText());
        this.emit({ type: 'error', message });
        throw new Error(message);
      }
    }
    if (this.tokensUsed === 0 && this.turnsCompleted > 0) {
      this.emit({ type: 'note', message: 'token usage not reported by OpenCode' });
    }
    this.opts.onUiEvent?.({ type: 'session.ended', reason: this.terminatedByOnni && this.turnsCompleted === 0 ? 'cancelled' : 'end_turn' });
    this.emit({ type: 'done' });
    return summary();
  }

  private async bootstrap(): Promise<void> {
    const init = await this.client.initialize(HANDSHAKE_TIMEOUT_MS);
    const caps = isRecord(init.agentCapabilities) ? init.agentCapabilities : {};
    this.loadSupported = caps.loadSession === true;
    this.imagesSupported = isRecord(caps.promptCapabilities) && caps.promptCapabilities.image === true;

    let resumed = false;
    if (this.spec.resume && this.spec.sessionId) {
      if (this.loadSupported) {
        const replayEnded = new Promise<void>((resolve) => {
          this.replayDone = resolve;
        });
        try {
          await this.client.loadSession(this.spec.sessionId, this.spec.cwd, HANDSHAKE_TIMEOUT_MS);
          this.acpSessionId = this.spec.sessionId;
          resumed = true;
          await Promise.race([replayEnded, delay(REPLAY_WAIT_MS)]);
          this.ui = endAcpReplay(this.ui);
        } catch (error) {
          this.replayDone = null;
          this.ui = endAcpReplay(this.ui);
          this.emit({
            type: 'note',
            message: `OpenCode could not resume session ${this.spec.sessionId} (${error instanceof Error ? error.message : String(error)}) — starting a fresh session`,
          });
        }
      } else {
        this.emit({ type: 'note', message: 'OpenCode does not advertise session/load — starting a fresh session' });
      }
    }
    if (!this.acpSessionId) {
      const created = await this.client.newSession(this.spec.cwd, HANDSHAKE_TIMEOUT_MS).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          isOpencodeAuthFailure(`${message}\n${this.stderrText()}`)
            ? OPENCODE_AUTH_FAILURE_MESSAGE
            : `OpenCode could not start a session: ${message}`,
        );
      });
      const id = typeof created.sessionId === 'string' ? created.sessionId : undefined;
      if (!id) throw new Error('OpenCode answered session/new without a sessionId');
      this.acpSessionId = id;
    }
    this.emit({ type: 'session', sessionId: this.acpSessionId });

    const first: ContentBlock[] = [
      ...(this.spec.images ?? []),
      { type: 'text', text: prependSystemPrompt(this.spec.systemPrompt, this.spec.userPrompt) },
    ];
    this.queue.unshift(this.toAcp(first));
    this.pump();
  }

  /** Send the next queued prompt when no turn is running. */
  private pump(): void {
    if (this.turnInFlight || !this.acpSessionId || this.queue.length === 0 || this.client.closed) return;
    const prompt = this.queue.shift()!;
    this.turnInFlight = true;
    this.client.prompt(this.acpSessionId, prompt).then(
      () => this.turnEnded(),
      // An error ANSWER ends the turn (the mapper already settled it); a lost transport does not —
      // the lifecycle settles that one once it knows why the agent went away.
      () => {
        if (!this.client.closed) this.turnEnded();
      },
    );
  }

  private turnEnded(): void {
    if (!this.turnInFlight) return;
    this.turnInFlight = false;
    this.turnsCompleted += 1;
    this.emit({ type: 'turn-end' });
    if (this.queue.length > 0) {
      this.pump();
      return;
    }
    if (this.opts.autoEndAfterFirstTurn && this.isOpen && !this.autoEndTimer) {
      this.autoEndTimer = setTimeout(() => this.end(), AUTO_END_DELAY_MS);
      this.autoEndTimer.unref?.();
    }
  }

  // ---- wire → events --------------------------------------------------------------------

  private onFrame(dir: 'in' | 'out', frame: AcpMessage): void {
    if (dir === 'in') this.deadline.touch();
    if (
      dir === 'in'
      && this.replayDone
      && isRecord(frame.params)
      && isRecord(frame.params.update)
      && frame.params.update.sessionUpdate === 'available_commands_update'
    ) {
      const done = this.replayDone;
      this.replayDone = null;
      // Let the mapper see the marker first, then release the prompt.
      queueMicrotask(done);
    }
    this.applyUi(mapAcpFrame({ dir, frame }, this.ui, opencodeDialect));
  }

  private applyUi(mapped: { events: UiEvent[]; state: AcpUiMapperState }): void {
    this.ui = mapped.state;
    for (const event of mapped.events) {
      this.opts.onUiEvent?.(event);
      this.v1FromUi(event);
    }
  }

  /** v1 derived from v2 (AGENT_PROTOCOL.md §2: every v1 event stays derivable from the v2 stream). */
  private v1FromUi(event: UiEvent): void {
    switch (event.type) {
      case 'item.delta':
        if (event.field === 'text') {
          this.textChunks.push(event.delta);
          this.emit({ type: 'text', text: event.delta });
        }
        return;
      case 'item.started':
        if (event.item.kind === 'tool') {
          const input = event.item.input ?? { title: event.item.title };
          this.toolCalls.push({ id: event.item.id, name: event.item.name, input });
          this.emit({ type: 'tool-call', id: event.item.id, tool: event.item.name, input });
        }
        return;
      case 'item.completed':
        if (event.item.kind === 'tool') {
          const failed = event.item.status === 'failed' || event.item.status === 'declined';
          this.emit({
            type: 'tool-result',
            toolCallId: event.item.id,
            result: (failed ? event.item.error : event.item.output) ?? '',
            isError: failed,
          });
        }
        return;
      case 'image':
        this.emit({ type: 'image', mediaType: event.mediaType, data: event.data });
        return;
      case 'usage.updated':
        this.tokensUsed = event.usage.total;
        this.emit({ type: 'token-usage', tokensUsed: this.tokensUsed });
        return;
      case 'session.error':
        // A failed prompt or session is the step's failure. A failed resume is not (the bootstrap
        // notes it and starts a fresh session).
        if (event.fatal || this.turnInFlight) this.fail(event.message);
        return;
      default:
        return;
    }
  }

  private onRequest(request: AcpMessage): AcpRequestAnswer {
    if (request.method !== 'session/request_permission' || !isRecord(request.params)) {
      return { error: { code: -32601, message: `Method not found: ${String(request.method)}` } };
    }
    const options = Array.isArray(request.params.options) ? request.params.options.filter(isRecord) : [];
    // `allow_once` first: `allow_always` would write a standing rule into the user's own OpenCode config.
    const choice =
      options.find((o) => o.kind === 'allow_once') ?? options.find((o) => o.kind === 'allow_always') ?? options[0];
    const title =
      isRecord(request.params.toolCall) && typeof request.params.toolCall.title === 'string'
        ? request.params.toolCall.title
        : 'a tool call';
    if (!choice || typeof choice.optionId !== 'string') {
      this.emit({ type: 'note', message: `OpenCode asked permission for ${title} with no option onni could pick; cancelled` });
      return { result: { outcome: { outcome: 'cancelled' } } };
    }
    this.emit({
      type: 'note',
      message: `OpenCode asked permission for ${title}; auto-approved (${String(choice.kind ?? choice.optionId)}) — onni runs OpenCode in auto mode`,
    });
    return { result: { outcome: { outcome: 'selected', optionId: choice.optionId } } };
  }

  // ---- helpers --------------------------------------------------------------------------

  private toAcp(content: ContentBlock[]): AcpContentBlock[] {
    const blocks: AcpContentBlock[] = [];
    let droppedImages = 0;
    for (const block of content) {
      if (block.type === 'text') blocks.push({ type: 'text', text: block.text });
      else if (this.imagesSupported || !this.acpSessionId) {
        blocks.push({ type: 'image', data: block.source.data, mimeType: block.source.media_type });
      } else droppedImages += 1;
    }
    if (droppedImages > 0) this.emit({ type: 'note', message: `OpenCode does not accept images; dropped ${droppedImages}` });
    return blocks;
  }

  private fail(message: string): void {
    if (this.failed) return;
    this.failed = message;
    this.emit({ type: 'error', message });
  }

  private emit(event: AgentEvent): void {
    this.onEvent?.(event);
  }

  private stderrText(): string {
    return this.stderr.join('');
  }

  /** Close stdin, then SIGTERM→SIGKILL for a CLI that ignores EOF (#703, #844). `hard` skips the
   *  EOF grace: cancel means now. */
  private terminate(hard: boolean): void {
    try {
      this.child.stdin.end();
    } catch {
      // already gone
    }
    const signal = (sig: NodeJS.Signals): void => {
      if (this.hasExited()) return;
      this.terminatedByOnni = true;
      this.child.kill(sig);
    };
    if (hard) {
      this.terminatedByOnni = true;
      signal('SIGTERM');
      const kill = setTimeout(() => signal('SIGKILL'), EOF_KILL_GRACE_MS);
      kill.unref?.();
      this.timers.push(kill);
      return;
    }
    const term = setTimeout(() => {
      signal('SIGTERM');
      const kill = setTimeout(() => signal('SIGKILL'), EOF_KILL_GRACE_MS);
      kill.unref?.();
      this.timers.push(kill);
    }, EOF_TERM_GRACE_MS);
    term.unref?.();
    this.timers.push(term);
  }
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<number | null> {
  if (hasTerminated(child)) return Promise.resolve(child.exitCode);
  return new Promise((resolve) => {
    child.once('close', (code) => resolve(code));
    child.once('error', () => resolve(child.exitCode ?? null));
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

/** Path to the bundled mock (`scripts/mock-opencode-acp.mjs`), for ONNI_DRY_RUN=1. */
function mockOpencodePath(): string {
  // Resolved like `mockPiPath`: `new URL().pathname` yields `/C:/…` on Windows, which spawn rejects.
  const here = dirname(fileURLToPath(import.meta.url));
  // here = <pkg>/dist/core (built) or <pkg>/src/core (tsx dev).
  return resolvePath(here, '..', '..', 'scripts', 'mock-opencode-acp.mjs');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
