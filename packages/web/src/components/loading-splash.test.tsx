import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LoadingSplash } from '@/components/loading-splash'

describe('LoadingSplash', () => {
  it('shows only the mark on the full-page form, keeping the title for screen readers', () => {
    const { container } = render(<LoadingSplash title="Loading the cockpit…" />)
    const splash = container.querySelector('[data-slot="loading-splash"]')
    expect(splash?.getAttribute('data-variant')).toBe('mark')
    expect(container.querySelector('[data-slot="loading-wordmark"]')).toBeNull()
    expect(container.querySelector('[data-slot="loading-track"]')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Loading the cockpit…' }).className).toContain('sr-only')
  })

  it('keeps the in-page loader with its track when the page has its own header', () => {
    const { container } = render(<LoadingSplash as="span" wordmark={false} title="Loading skills…" />)
    expect(container.querySelector('[data-slot="loading-track"]')).not.toBeNull()
  })
})
