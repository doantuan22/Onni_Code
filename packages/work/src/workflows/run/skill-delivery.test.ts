import { describe, expect, it, vi } from 'vitest';
import { deliverMessage, drainSkillDeliveries } from './messages.ts';
import { expandRegistrySlashSkill, leadingSlashSkillName } from './check-steps.ts';
import type { MessageActiveRun, MessageContext } from './internal-types.ts';
import type { ContentBlock } from '../../core/agent-runner.ts';

function fixture() {
  let ready!: () => void;
  const gate = new Promise<void>(resolve => { ready = resolve; });
  const skill = { name: 'live-skill', body: 'old instructions', source: 'onni' as const, path: '/skills/live-skill/SKILL.md' };
  const send = vi.fn(() => true);
  const state: MessageActiveRun = { cancelled: false, currentStepId: 'task', session: { open: true, sendMessage: send }, skills: [skill] };
  const appendEvent = vi.fn();
  const context = {
    active: new Map([['run', state]]), lifecycle: { isBlocked: () => false }, waiting: new Set(),
    store: { appendEvent, updateRun: vi.fn(), updateStep: vi.fn() },
    softAskFor: vi.fn(), persistPastedAttachments: () => [],
    leadingSlashSkillName, expandRegistrySlashSkill,
    provisionTaskSkills: vi.fn(async () => { await gate; state.skills = [{ ...skill, body: 'new instructions' }]; return [skill.name]; }),
    enqueueMessage: vi.fn(() => ({ id: 'queued' })), deferMessage: vi.fn(() => false),
    clearPendingAsk: vi.fn(), clearSoftAsk: vi.fn(), clearIdleTimer: vi.fn(),
    clearMonitoringWakeTimer: vi.fn(), leaveMonitoring: vi.fn(), recordManagerDeliveryTransition: vi.fn(),
  } as unknown as MessageContext;
  return { state, send, context, ready, appendEvent };
}
const text = (value: string): ContentBlock[] => [{ type: 'text', text: value }];

describe('live skill delivery', () => {
  it('accepts immediately, waits for files, refreshes the body, and preserves message order and transcript', async () => {
    const { state, send, context, ready, appendEvent } = fixture();
    expect(deliverMessage(context, 'run', text('/live-skill check files'), true)).toBe(true);
    expect(deliverMessage(context, 'run', text('then explain'), true)).toBe(true);
    expect(send).not.toHaveBeenCalled();
    expect(appendEvent.mock.calls.map(call => call[1].text)).toEqual(['/live-skill check files', 'then explain']);
    ready();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(JSON.stringify(send.mock.calls[0])).toContain('new instructions');
    expect(JSON.stringify(send.mock.calls[0])).not.toContain('old instructions');
    expect(send.mock.calls[1]).toEqual([text('then explain')]);
    expect(appendEvent).toHaveBeenCalledTimes(2);
    expect(state.skills?.[0]?.body).toBe('new instructions');
  });

  it('never delivers after cancellation during provisioning', async () => {
    const { state, send, context, ready } = fixture();
    expect(deliverMessage(context, 'run', text('/live-skill check'), true)).toBe(true);
    await vi.waitFor(() => expect(context.provisionTaskSkills).toHaveBeenCalledOnce());
    state.cancelled = true;
    ready();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(send).not.toHaveBeenCalled();
    expect(context.enqueueMessage).not.toHaveBeenCalled();
  });

  it('keeps an accepted instruction for continuation if the session closes while preparing', async () => {
    const { state, send, context, ready } = fixture();
    const content = text('/live-skill check');
    deliverMessage(context, 'run', content, true);
    let settled = false;
    const settlement = drainSkillDeliveries(state).then(() => { settled = true; });
    state.session = undefined;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    ready();
    await vi.waitFor(() => expect(context.enqueueMessage).toHaveBeenCalledWith('run', content, undefined));
    await settlement;
    expect(settled).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps ordinary manager delivery and its receipt synchronous', () => {
    const { state, context, send } = fixture();
    const receipt = vi.fn((_blocks: ContentBlock[], callback: (receipt: { state: 'acknowledged' }) => void) => {
      callback({ state: 'acknowledged' }); return true;
    });
    state.session = { open: true, sendMessage: send, sendMessageWithReceipt: receipt };
    expect(deliverMessage(context, 'run', text('report'), false, undefined, undefined, 'delivery')).toBe(true);
    expect(receipt).toHaveBeenCalledOnce();
    expect(context.recordManagerDeliveryTransition).toHaveBeenCalledWith('run', 'delivery', 'delivered');
    expect(context.recordManagerDeliveryTransition).toHaveBeenCalledWith('run', 'delivery', 'acknowledged', undefined);
  });
});
