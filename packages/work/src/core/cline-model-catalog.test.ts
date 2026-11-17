import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discoverClineModels } from './cline-model-catalog.ts';

const mockBin = fileURLToPath(new URL('../../scripts/mock-cline-acp.mjs', import.meta.url));

describe('discoverClineModels', () => {
  it('reads model choices from the ACP session/new models payload and closes the short-lived process', async () => {
    await expect(discoverClineModels({ bin: mockBin, cwd: process.cwd() })).resolves.toEqual([
      { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', description: 'via anthropic' },
      { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol', description: 'via openai' },
    ]);
  }, 15_000);
});
