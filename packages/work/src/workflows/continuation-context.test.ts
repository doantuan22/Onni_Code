import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RunEvent, RunRecord } from '../runs/store.ts';
import { compactContinuationContext, freshContinuationContext } from './continuation-context.ts';

const run = (extra: Partial<RunRecord> = {}): RunRecord => ({
  id: 'r1', title: 'Fix it', workflow: 'quick-task', task: 'Fix the checkout bug',
  status: 'failed', error: 'Claude AI usage limit reached', createdAt: '2026-09-04T09:00:00Z',
  tokensUsed: 12, archived: false, branch: 'onni/r1', worktreePath: '/repo/.ai/onni/worktrees/r1',
  steps: [{ id: 'task', name: 'Work', kind: 'agent', status: 'failed', iterations: 1, tokensUsed: 12 }],
  ...extra,
});

const event = (seq: number, type: string, extra: Record<string, unknown>): RunEvent => ({
  seq, type, ts: '2026-09-04T09:00:00Z', ...extra,
});

const DIR = '/repo/.ai/onni/runs/r1-images';
/** The product resolves an attachment URL to a path with the host's `join`. */
const file = (name: string): string => join(DIR, name);

describe('freshContinuationContext', () => {
  it('hands the new provider the paths of screenshots pasted into the old session', () => {
    const context = freshContinuationContext(run({ taskImages: ['/api/v1/runs/r1/images/pasted-1.png'] }), [
      event(1, 'user-message', { text: 'is this true?', images: ['/api/v1/runs/r1/images/pasted-2.png'] }),
      event(2, 'user-message', { text: '', images: ['/api/v1/runs/r1/images/pasted-3.png'] }),
    ], DIR);
    expect(context).toContain(`Fix the checkout bug\nAttached files:\n- ${file('pasted-1.png')}`);
    expect(context).toContain(`User:\nis this true?\nAttached files:\n- ${file('pasted-2.png')}`);
    expect(context).toContain(`User:\nAttached files:\n- ${file('pasted-3.png')}`);
  });

  it('lists the files of a task given as attachments only', () => {
    const context = freshContinuationContext(run({ task: '  ', taskImages: ['/api/v1/runs/r1/images/spec.pdf'] }), [], DIR);
    expect(context).toContain(`## Original task\n(given as attachments only)\nAttached files:\n- ${file('spec.pdf')}`);
  });

  it('carries task state and the persisted conversation without a handoff file', () => {
    const context = freshContinuationContext(run(), [
      event(1, 'user-message', { text: 'Please start with the API.' }),
      event(2, 'item.completed', { item: { id: 'm1', kind: 'message', role: 'assistant', text: 'API is fixed.' } }),
    ], DIR);
    expect(context).toContain('Fix the checkout bug');
    expect(context).toContain('Status: failed');
    expect(context).toContain('Claude AI usage limit reached');
    expect(context).toContain('Worktree: /repo/.ai/onni/worktrees/r1');
    expect(context).toContain('User:\nPlease start with the API.');
    expect(context).toContain('Assistant:\nAPI is fixed.');
  });

  it('prefers normalized v2 messages over their duplicate legacy text events', () => {
    const context = freshContinuationContext(run(), [
      event(1, 'text', { text: 'same answer' }),
      event(2, 'item.completed', { item: { id: 'm1', kind: 'message', role: 'assistant', text: 'same answer' } }),
    ], DIR);
    expect(context.match(/same answer/g)).toHaveLength(1);
  });

  it('omits the status a queued continuation stamped on the run, keeping the step history', () => {
    const context = freshContinuationContext(run({ status: 'queued', error: undefined }), [], DIR);
    expect(context).not.toContain('Status: queued');
    expect(context).toContain('- task (agent): failed');
  });

  it('falls back to legacy assistant text for old task histories', () => {
    const context = freshContinuationContext(run(), [event(1, 'text', { text: 'legacy answer' })], DIR);
    expect(context).toContain('Assistant:\nlegacy answer');
  });
});

describe('compactContinuationContext', () => {
  let dataDir: string;
  beforeEach(() => { dataDir = mkdtempSync(join(tmpdir(), 'onni-compact-')); });
  afterEach(() => { rmSync(dataDir, { recursive: true, force: true }); });

  const writeHandoff = (runId: string, resumeNotes: string): void => {
    const file = join(dataDir, 'runs', `${runId}.handoff.md`);
    mkdirSync(join(dataDir, 'runs'), { recursive: true });
    writeFileSync(file, `# Handoff — Fix it\n\n## Goal\n\nFix the checkout bug\n\n## Progress log\n\n- done\n\n## Resume notes\n\n${resumeNotes}`, 'utf8');
  };

  it('carries the handoff journal verbatim', () => {
    writeHandoff('r1', 'Fixing the checkout; next: add tests.');
    const context = compactContinuationContext(run(), [], DIR, dataDir);
    expect(context).toContain('## Handoff journal');
    expect(context).toContain('Fixing the checkout; next: add tests.');
  });

  it('keeps every user instruction while trimming the oldest assistant messages', () => {
    const context = compactContinuationContext(run(), [
      event(1, 'user-message', { text: 'do A' }),
      event(2, 'item.completed', { item: { id: 'm1', kind: 'message', role: 'assistant', text: 'x'.repeat(70_000) } }),
      event(3, 'user-message', { text: 'now do B' }),
    ], DIR, dataDir);
    expect(context).toContain('User:\ndo A');
    expect(context).toContain('User:\nnow do B');
    expect(context).toContain('(oldest messages truncated)');
  });

  it('degrades to a plain continuation without a handoff file', () => {
    const context = compactContinuationContext(run(), [event(1, 'user-message', { text: 'hi' })], DIR, dataDir);
    expect(context).not.toContain('## Handoff journal');
    expect(context).toContain('User:\nhi');
  });
});
