import { describe, expect, it, vi } from 'vitest';
import { runAgentStep } from './agent-step.ts';
import { createRunner } from '../../core/runner-factory.ts';
import type { AgentStepActiveRun, AgentStepContext } from './internal-types.ts';
import type { Skill } from '../../skills.ts';

vi.mock('../../core/runner-factory.ts', () => ({ createRunner: vi.fn() }));

describe('skill payload at the runner boundary', () => {
  it.each([['step-skill', 1], ['slash-skill', 2]] as const)(
    'preserves the intent and loads the expected bodies for /%s', async (slash, bodyCount) => {
      const skills: Skill[] = [
        { name: 'step-skill', body: 'STEP_BODY', source: 'builtin', path: 'step.md' },
        { name: 'slash-skill', body: 'SLASH_BODY', source: 'builtin', path: 'slash.md' },
      ];
      const startSession = vi.fn(() => { throw new Error('captured payload'); });
      vi.mocked(createRunner).mockReturnValue({ startSession } as unknown as ReturnType<typeof createRunner>);
      const state = { cwd: '/worker', cancelled: false, skills } as AgentStepActiveRun;
      const context = {
        repoRoot: '/project', dataDir: '/project/.ai/onni',
        store: { getRun: () => ({ steps: [] }), updateRun: vi.fn(), updateStep: vi.fn() },
        provisionTaskSkills: vi.fn(async () => []), flushPendingReports: vi.fn(), flushInbox: vi.fn(),
        prepareAttachmentLibrary: vi.fn(), makeUiSink: vi.fn(), configuredModelProvider: vi.fn(),
        agentEnvForStep: vi.fn(async () => ({ profileId: 'default', env: {} })),
        privateMcpForLaunch: vi.fn(), beginUsageInvocation: vi.fn(), agentPermissionSpec: vi.fn(),
      } as unknown as AgentStepContext;
      const error = await runAgentStep(context, 'run', state,
        { id: 'task', skill: 'step-skill' }, { task: `/${slash} fix this race`, generateFollowups: false },
        skills, null, false, vi.fn(), undefined, 'codex', undefined, undefined);
      expect(error).toBe('captured payload');
      expect(startSession).toHaveBeenCalledOnce();
      const payload = (startSession.mock.calls as unknown as Array<[{ systemPrompt: string; userPrompt: string }]>)[0]![0];
      const combined = `${payload.systemPrompt}\n${payload.userPrompt}`;
      expect(combined.match(/(?:STEP|SLASH)_BODY/g)).toHaveLength(bodyCount);
      expect(combined).toContain('fix this race');
      expect(payload.systemPrompt).toContain('STEP_BODY');
      if (slash !== 'step-skill') expect(payload.userPrompt).toContain('SLASH_BODY');
    },
  );
});
