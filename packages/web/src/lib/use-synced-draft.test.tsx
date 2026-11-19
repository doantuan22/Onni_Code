import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useSyncedDraft } from './use-synced-draft'

describe('useSyncedDraft', () => {
  it('follows remote changes when clean and preserves unsaved typing until it is saved', () => {
    const { result, rerender } = renderHook(({ value }) => useSyncedDraft(value), { initialProps: { value: 'first' } })
    rerender({ value: 'remote' })
    expect(result.current[0]).toBe('remote')
    act(() => result.current[1]('typing'))
    rerender({ value: 'another remote edit' })
    expect(result.current[0]).toBe('typing')
    rerender({ value: 'typing' })
    rerender({ value: 'after save' })
    expect(result.current[0]).toBe('after save')
  })

  it('compares JSON settings by value and supports functional edits', () => {
    const { result, rerender } = renderHook(({ value }) => useSyncedDraft(value), { initialProps: { value: { limit: 2 } } })
    act(() => result.current[1]((previous) => ({ limit: previous.limit + 1 })))
    rerender({ value: { limit: 2 } })
    expect(result.current[0]).toEqual({ limit: 3 })
    rerender({ value: { limit: 3 } })
    rerender({ value: { limit: 4 } })
    expect(result.current[0]).toEqual({ limit: 4 })
  })
})
