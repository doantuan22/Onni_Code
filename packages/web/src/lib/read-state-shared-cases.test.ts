import { describe, expect, it } from 'vitest'
import { unreadCases } from '../../../api-client/src/fixtures/unread-cases.ts'
import { isUnread } from './read-state'

describe('isUnread shared timestamp cases (survey Part A §3.5)', () => {
  it.each(unreadCases)('$name', ({ run, unread }) => {
    expect(isUnread(run)).toBe(unread)
  })
})
