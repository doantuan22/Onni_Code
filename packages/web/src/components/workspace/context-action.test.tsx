import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ContextActionButton, WorkspaceContextAction } from './context-action'

afterEach(cleanup)

it('keeps context views reachable from the run header without another title bar', () => {
  const open = vi.fn()
  const activatePane = vi.fn()
  render(<div onPointerDown={activatePane}><WorkspaceContextAction.Provider value={open}><ContextActionButton /></WorkspaceContextAction.Provider></div>)
  const button = screen.getByRole('button', { name: 'Context views' })
  fireEvent.pointerDown(button)
  fireEvent.click(button)
  expect(activatePane).not.toHaveBeenCalled()
  expect(open).toHaveBeenCalledOnce()
})

it('adds no action outside a narrow workspace host', () => {
  const { container } = render(<ContextActionButton />)
  expect(container.childElementCount).toBe(0)
})
