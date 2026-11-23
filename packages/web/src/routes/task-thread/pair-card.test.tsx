import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { PairMessage } from '@onni/api-client'

import { pairSnapshot } from './__fixtures__/pair'
import { PairCard } from './pair-card'

afterEach(cleanup)

describe('PairCard', () => {
  it('renders authoritative pair state, orders, messages, proposals and decisions verbatim', () => {
    const snapshot = pairSnapshot()
    render(<PairCard snapshot={snapshot} />)

    const card = document.querySelector('[data-slot="pair-card"]')
    expect(card?.getAttribute('data-pair-id')).toBe('pair-1')
    expect(card?.getAttribute('data-phase')).toBe('manager_review')
    expect(card?.textContent).toContain('Active: Worker')
    expect(card?.textContent).toContain('Order 2')
    expect(card?.querySelector('[data-order-status="reported"]')?.textContent).toBe('Reported')
    for (const value of [
      '/repos/onni',
      'onni/pair-1',
      'abcdef123456',
      '123456abcdef0',
      'Cover the pair status UI with focused tests.',
      'Added client, query, event and rendering coverage.',
      'The implementation and tests are ready.',
      'Which verification should run first?',
      'Focused web tests',
      'Keep the feedback loop short.',
    ]) {
      expect(within(card as HTMLElement).getByText(value)).not.toBeNull()
    }

    fireEvent.click(screen.getByRole('button', { name: 'Order details' }))
    expect(screen.getByText('packages/web only')).not.toBeNull()
    expect(screen.getByText('Focused tests pass.')).not.toBeNull()
    expect(screen.getByText('Vitest output')).not.toBeNull()
    expect(card?.querySelector('time')).toBeNull()
  })

  it('keeps a long collection out of the DOM until opened and then renders only its latest 50 items', async () => {
    const messages: PairMessage[] = Array.from({ length: 5_000 }, (_, index) => ({
      id: `message-${index}`,
      pairId: 'pair-1',
      from: index % 2 === 0 ? 'manager' : 'worker',
      to: index % 2 === 0 ? 'worker' : 'manager',
      kind: 'note',
      text: `Message ${index}`,
      createdAt: '2026-11-18T10:00:00.000Z',
    }))
    render(<PairCard snapshot={pairSnapshot({}, { messages })} />)

    expect(document.querySelectorAll('[data-slot="pair-message"]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /Messages/ }))
    await waitFor(() => expect(document.querySelectorAll('[data-slot="pair-message"]')).toHaveLength(50))
    expect(document.querySelector('[data-message-id="message-0"]')).toBeNull()
    expect(document.querySelector('[data-message-id="message-4950"]')).not.toBeNull()
    expect(document.querySelector('[data-message-id="message-4999"]')).not.toBeNull()
    expect(screen.getByText('Showing the latest 50 of 5000.')).not.toBeNull()
  })

  it('previews long server-authored text and expands it through the shared collapsible', async () => {
    const text = `BEGIN${'x'.repeat(400)}END`
    const message = pairSnapshot().messages[0]!
    render(<PairCard snapshot={pairSnapshot({}, { messages: [{ ...message, text }] })} />)

    expect(screen.queryByText(text)).toBeNull()
    const article = document.querySelector('[data-slot="pair-message"]') as HTMLElement
    expect(article.textContent).toContain(`${text.slice(0, 280).trimEnd()}…`)
    fireEvent.click(within(article).getByRole('button', { name: 'Show more' }))
    await waitFor(() => expect(within(article).getByText(text)).not.toBeNull())
    fireEvent.click(within(article).getByRole('button', { name: 'Show less' }))
    await waitFor(() => expect(within(article).queryByText(text)).toBeNull())
  })
})
