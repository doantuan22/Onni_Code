import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  clampDrawerHeight,
  defaultDrawerState,
  drawerStorageKey,
  DEFAULT_DRAWER_HEIGHT,
  MAX_DRAWER_HEIGHT,
  MIN_DRAWER_HEIGHT,
  readDrawerState,
  resetPageLoadForTest,
  writeDrawerState,
} from './drawer-state'

beforeEach(() => {
  localStorage.clear()
  resetPageLoadForTest()
})

afterEach(() => {
  localStorage.clear()
})

describe('clampDrawerHeight', () => {
  it('holds the bounds', () => {
    expect(clampDrawerHeight(10)).toBe(MIN_DRAWER_HEIGHT)
    expect(clampDrawerHeight(9_000)).toBe(MAX_DRAWER_HEIGHT)
    expect(clampDrawerHeight(300)).toBe(300)
  })

  it('falls back to the default for anything unparseable, not to a bound', () => {
    // "Unparseable" is not the same claim as "too small".
    for (const junk of [Number.NaN, undefined, null, 'tall', {}]) {
      expect(clampDrawerHeight(junk)).toBe(DEFAULT_DRAWER_HEIGHT)
    }
  })
})

describe('readDrawerState', () => {
  it('starts hidden for a task with nothing saved', () => {
    expect(readDrawerState('run-1')).toEqual(defaultDrawerState())
  })

  it('never restores an open drawer — not on a refresh, not on a navigation', () => {
    writeDrawerState('run-1', { open: true, height: 320 })
    expect(readDrawerState('run-1')).toEqual({ open: false, height: 320 })
    resetPageLoadForTest() // the page reloaded
    expect(readDrawerState('run-1')).toEqual({ open: false, height: 320 })
  })

  it('recovers from junk rather than throwing', () => {
    localStorage.setItem(drawerStorageKey('run-1'), 'not json')
    expect(readDrawerState('run-1')).toEqual(defaultDrawerState())
  })

  it('repairs an impossible stored height', () => {
    localStorage.setItem(drawerStorageKey('run-1'), JSON.stringify({ open: true, height: -5 }))
    expect(readDrawerState('run-1')).toEqual({ open: false, height: MIN_DRAWER_HEIGHT })
  })

  it('keeps two tasks apart', () => {
    writeDrawerState('run-1', { open: true, height: 300 })
    expect(readDrawerState('run-2')).toEqual(defaultDrawerState())
  })
})

describe('writeDrawerState', () => {
  it('round-trips through storage', () => {
    writeDrawerState('run-1', { open: true, height: 400 })
    expect(readDrawerState('run-1')).toEqual({ open: false, height: 400 })
  })

  it('never writes a height the drawer could not paint', () => {
    writeDrawerState('run-1', { open: true, height: 9_000 })
    expect(JSON.parse(localStorage.getItem(drawerStorageKey('run-1'))!).height).toBe(MAX_DRAWER_HEIGHT)
  })
})
