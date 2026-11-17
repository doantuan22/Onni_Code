import { join } from 'node:path';

import { readHandoff } from '../handoff.ts';
import type { RunEvent, RunRecord } from '../runs/store.ts';

/** Keep a backend hand-off useful without turning an old, very long thread into an unbounded
 * opening prompt. The original task and current run state live outside this allowance. */
const CONVERSATION_CONTEXT_CHARS = 60_000;

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value
    .replace(/^ONNI:(?:PR=\d+|ISSUE=\d+|TITLE=.+)\s*$/gm, '')
    .replace(/\s*ONNI:(?:DONE|MONITORING)\s*$/g, '')
    .replace(/\s*ONNI:ASK[ \t]+\{[\s\S]*\}\s*$/g, '')
    .trim();
  return text || undefined;
}

/** Pasted attachments live as files, so a new provider can only see them through their paths. */
function attachmentLines(urls: unknown, attachmentsDir: string): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.flatMap((url) => {
    const name = typeof url === 'string' ? url.split('/').pop() : undefined;
    if (!name || name.includes('..') || name.includes('\\')) return [];
    return [`- ${join(attachmentsDir, name)}`];
  });
}

function withAttachments(text: string | undefined, lines: string[]): string | undefined {
  if (!lines.length) return text;
  return [text, 'Attached files:', ...lines].filter(Boolean).join('\n');
}

interface ConversationMessage { seq: number; role: 'User' | 'Assistant'; text: string }

/**
 * The conversation messages a hand-off can carry, in transcript order. `user-message` is Onni's
 * authoritative user transcript — some normalized protocols also echo user messages as items,
 * so accepting both would duplicate the instruction at hand-off. Assistant output prefers the
 * normalized v2 `item.completed` messages, falling back to v1 `text` for old runs, so a new
 * provider never receives every answer twice.
 */
function conversationMessages(events: readonly RunEvent[], attachmentsDir: string): ConversationMessage[] {
  const v2: ConversationMessage[] = events.flatMap((event) => {
    if (event.type !== 'item.completed' || typeof event.item !== 'object' || event.item === null) return [];
    const item = event.item as { kind?: unknown; role?: unknown; text?: unknown };
    if (item.kind !== 'message' || item.role === 'user') return [];
    const text = cleanText(item.text);
    if (!text) return [];
    return [{ seq: event.seq, role: 'Assistant', text }];
  });
  const assistant: ConversationMessage[] = v2.length > 0
    ? v2
    : events.flatMap((event) => {
        if (event.type !== 'text') return [];
        const text = cleanText(event.text);
        return text ? [{ seq: event.seq, role: 'Assistant', text }] : [];
      });
  const user: ConversationMessage[] = events.flatMap((event) => {
    if (event.type !== 'user-message') return [];
    const text = withAttachments(cleanText(event.text), attachmentLines(event.images, attachmentsDir));
    return text ? [{ seq: event.seq, role: 'User', text }] : [];
  });
  return [...user, ...assistant].sort((a, b) => a.seq - b.seq);
}

/**
 * Reconstruct the portable part of a task when a continuation switches runner/account and the
 * provider-owned session id therefore cannot be resumed. Events are already secret-redacted by
 * RunStore; only conversation messages are copied, never tool inputs/results or reasoning.
 * Pasted attachments travel as absolute paths under `attachmentsDir`, or the new session is
 * asked about a screenshot it was never shown.
 */
export function freshContinuationContext(
  run: RunRecord,
  events: readonly RunEvent[],
  attachmentsDir: string,
): string {
  const messages = conversationMessages(events, attachmentsDir).map(({ role, text }) => `${role}:\n${text}`);

  let conversation = messages.join('\n\n');
  let truncated = false;
  if (conversation.length > CONVERSATION_CONTEXT_CHARS) {
    conversation = conversation.slice(-CONVERSATION_CONTEXT_CHARS);
    const firstBoundary = conversation.indexOf('\n\n');
    if (firstBoundary >= 0) conversation = conversation.slice(firstBoundary + 2);
    truncated = true;
  }

  const steps = run.steps.map((step) =>
    `- ${step.id} (${step.kind}): ${step.status}${step.error ? ` — ${step.error}` : ''}`,
  );
  return [
    'You are continuing an existing Onni task in a fresh provider session. The previous provider session cannot be resumed. Use this persisted Onni state and conversation as the hand-off; inspect the existing worktree before changing anything.',
    '',
    '## Original task',
    withAttachments(run.task.trim() || '(given as attachments only)', attachmentLines(run.taskImages, attachmentsDir)),
    '',
    '## Onni task state before this continuation',
    // A queued/running status is this continuation's own bookkeeping, not where the task stood;
    // the steps below carry that.
    ...(run.status === 'queued' || run.status === 'running' ? [] : [`Status: ${run.status}`]),
    ...(run.error ? [`Error: ${run.error}`] : []),
    ...(run.branch ? [`Branch: ${run.branch}`] : []),
    ...(run.worktreePath ? [`Worktree: ${run.worktreePath}`] : []),
    ...(steps.length ? ['Steps:', ...steps] : []),
    '',
    `## Conversation history${truncated ? ' (oldest messages truncated)' : ''}`,
    conversation || '(No persisted conversation messages.)',
  ].join('\n');
}

/**
 * Compact a task whose conversation outgrew what its model accepts in one request (the
 * `context_too_large` failure). Deterministic — the engine has no model of its own to summarize
 * with, and the model is out of budget exactly when this is needed — so it leans on the agent's
 * own handoff journal (spec 007) instead: goal, task state, the handoff journal and every user
 * instruction are kept, and only the assistant transcript is trimmed from its oldest end.
 */
export function compactContinuationContext(
  run: RunRecord,
  events: readonly RunEvent[],
  attachmentsDir: string,
  dataDir: string,
): string {
  const handoff = readHandoff(dataDir, run.id);
  const messages = conversationMessages(events, attachmentsDir);
  const userBlock = messages.filter((m) => m.role === 'User').map((m) => `User:\n${m.text}`).join('\n\n');
  const assistantBlock = messages.filter((m) => m.role === 'Assistant').map((m) => `Assistant:\n${m.text}`).join('\n\n');

  const steps = run.steps.map((step) =>
    `- ${step.id} (${step.kind}): ${step.status}${step.error ? ` — ${step.error}` : ''}`,
  );
  const preamble = [
    'You are continuing an existing Onni task after its conversation grew past what the model accepts in one request. Use the persisted state, handoff journal and conversation below as the hand-off; inspect the existing worktree before changing anything.',
    '',
    '## Original task',
    withAttachments(run.task.trim() || '(given as attachments only)', attachmentLines(run.taskImages, attachmentsDir)),
    '',
    '## Onni task state before this continuation',
    ...(run.status === 'queued' || run.status === 'running' ? [] : [`Status: ${run.status}`]),
    ...(run.error ? [`Error: ${run.error}`] : []),
    ...(run.branch ? [`Branch: ${run.branch}`] : []),
    ...(run.worktreePath ? [`Worktree: ${run.worktreePath}`] : []),
    ...(steps.length ? ['Steps:', ...steps] : []),
  ].join('\n');

  const handoffBlock = handoff ? `## Handoff journal\n${handoff}` : undefined;
  const userSection = userBlock ? `## User instructions\n${userBlock}` : undefined;
  const fixed = [preamble, handoffBlock, userSection]
    .filter((part): part is string => part !== undefined)
    .join('\n\n');

  let assistant = assistantBlock;
  let truncated = false;
  const remaining = CONVERSATION_CONTEXT_CHARS - fixed.length;
  if (remaining <= 0) {
    assistant = '';
    truncated = assistantBlock.length > 0;
  } else if (assistant.length > remaining) {
    assistant = assistant.slice(-remaining);
    const firstBoundary = assistant.indexOf('\n\n');
    if (firstBoundary >= 0) assistant = assistant.slice(firstBoundary + 2);
    truncated = true;
  }

  const assistantSection = assistant
    ? `## Assistant messages${truncated ? ' (oldest messages truncated)' : ''}\n${assistant}`
    : undefined;

  return [fixed, assistantSection].filter((part): part is string => part !== undefined).join('\n\n');
}

/**
 * Whether a `context_too_large` stop should auto-compact and continue on the same model instead of
 * just advising the user. Opt-in and off by default: it re-runs the task on the same login (spends
 * tokens) and needs auto-resume on (Settings → Resources → Auto-resume) to matter at all. An exact
 * `'1'` opts in — the house spelling.
 */
export function compactionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ONNI_CONTEXT_COMPACTION === '1';
}
