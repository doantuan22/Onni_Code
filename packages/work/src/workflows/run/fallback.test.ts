import { describe, expect, it } from 'vitest';

import type { RunnerId } from '../../core/agent-runner.ts';
import { chooseFallbackTarget, fallbacksEnabled } from './fallback.ts';

const usable = (...runners: RunnerId[]): ReadonlySet<RunnerId> => new Set(runners);
const held = (...keys: string[]): ReadonlySet<string> => new Set(keys);

describe('chooseFallbackTarget', () => {
  it('returns the first usable, unheld provider that is not the current one', () => {
    expect(chooseFallbackTarget('claude', usable('codex', 'opencode'), held())).toBe('codex');
  });

  it('skips the current provider even when it is usable', () => {
    expect(chooseFallbackTarget('codex', usable('codex', 'pi'), held())).toBe('pi');
  });

  it('skips a provider whose default account is held for its own usage window', () => {
    expect(chooseFallbackTarget('claude', usable('codex', 'pi'), held('codex:default'))).toBe('pi');
  });

  it('skips providers that are not usable (no connected CLI)', () => {
    expect(chooseFallbackTarget('claude', usable('pi'), held())).toBe('pi');
  });

  it('returns undefined when no other provider qualifies', () => {
    expect(chooseFallbackTarget('claude', usable('claude'), held())).toBeUndefined();
    expect(chooseFallbackTarget('claude', usable('codex'), held('codex:default'))).toBeUndefined();
    expect(chooseFallbackTarget('claude', usable(), held())).toBeUndefined();
  });

  it('treats an absent current runner as claude-shaped (nothing else to exclude)', () => {
    expect(chooseFallbackTarget(undefined, usable('claude', 'codex'), held())).toBe('claude');
  });
});

describe('fallbacksEnabled', () => {
  it('is off unless the exact opt-in spelling is set', () => {
    expect(fallbacksEnabled({})).toBe(false);
    expect(fallbacksEnabled({ ONNI_FAILOVER: '0' })).toBe(false);
    expect(fallbacksEnabled({ ONNI_FAILOVER: 'true' })).toBe(false);
    expect(fallbacksEnabled({ ONNI_FAILOVER: '1' })).toBe(true);
  });
});
