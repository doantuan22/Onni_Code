import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createQueryClient } from '@/api/query-client'
import type { ApiRun } from '@onni/api-client'

import { pairSnapshot } from './__fixtures__/pair'
import { PairColumn } from './pair-column'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const snapshot = pairSnapshot()
const RUN = {
  id: 'manager-r1',
  status: 'waiting',
  steps: [],
  dispatch: { rootRunId: 'manager-r1', pair: snapshot.state },
} as unknown as ApiRun

describe('the One & One view', () => {
  it('renders the pair status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200, headers: { 'content-type': 'application/json' } })),
    )
    render(
      <QueryClientProvider client={createQueryClient()}>
        <PairColumn run={RUN} />
      </QueryClientProvider>,
    )
    await screen.findByLabelText('One & One status')
    expect(document.querySelector('[data-slot="pair-card"]')?.getAttribute('data-phase')).toBe('manager_review')
  })
})
