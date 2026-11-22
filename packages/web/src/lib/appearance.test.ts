import { afterEach, describe, expect, it } from 'vitest'

import {
  ACCENT_STORAGE_KEY,
  DENSITY_STORAGE_KEY,
  DEFAULT_SCENE_PREFERENCES,
  SCENE_STORAGE_KEY,
  SCENE_IDS,
  WIDTH_STORAGE_KEY,
  applyAppearance,
  normalizeAccent,
  normalizeAppearance,
  normalizeScenePreferences,
  normalizeDensity,
  normalizeWidth,
  readStoredAppearance,
  writeStoredAppearance,
} from './appearance'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.accent
  delete document.documentElement.dataset.density
  delete document.documentElement.dataset.width
  delete document.documentElement.dataset.scene
})

describe('normalize', () => {
  it('accepts the known values and defaults everything else', () => {
    expect(normalizeAccent('violet')).toBe('violet')
    // Historical records continue to parse, but the old selector now resolves to fixed violet.
    expect(normalizeAccent('lime')).toBe('violet')
    // Unknown/garbage inputs — localStorage and ui-state.json both outlive this code's vocabulary.
    for (const raw of [null, undefined, 'magenta', 42, {}]) {
      expect(normalizeAccent(raw)).toBe('violet')
      expect(normalizeDensity(raw)).toBe('comfortable')
      expect(normalizeWidth(raw)).toBe('wide')
    }
    expect(normalizeDensity('compact')).toBe('compact')
    expect(normalizeDensity('ultra')).toBe('ultra')
    expect(normalizeWidth('wide')).toBe('wide')
    expect(normalizeWidth('narrow')).toBe('narrow')
  })

  it('migrates stored lime appearance without breaking its other preferences', () => {
    expect(normalizeAppearance({ accent: 'lime', density: 'compact', width: 'narrow' })).toEqual({
      accent: 'violet',
      density: 'compact',
      width: 'narrow',
      scene: DEFAULT_SCENE_PREFERENCES,
    })
  })

  it('normalizes a missing or invalid accent to violet', () => {
    expect(normalizeAppearance(undefined)).toEqual({
      accent: 'violet',
      density: 'comfortable',
      width: 'wide',
      scene: DEFAULT_SCENE_PREFERENCES,
    })
    expect(normalizeAppearance('not-an-object')).toEqual({
      accent: 'violet',
      density: 'comfortable',
      width: 'wide',
      scene: DEFAULT_SCENE_PREFERENCES,
    })
    expect(normalizeAppearance({ accent: 'violet' })).toEqual({
      accent: 'violet',
      density: 'comfortable',
      width: 'wide',
      scene: DEFAULT_SCENE_PREFERENCES,
    })
    expect(normalizeAppearance({ accent: 'nope', density: 'compact', width: 'wide' })).toEqual({
      accent: 'violet',
      density: 'compact',
      width: 'wide',
      scene: DEFAULT_SCENE_PREFERENCES,
    })
  })

  it('migrates v1 times, preserves explicit visibility, and disables unknown scene ids', () => {
    expect(normalizeScenePreferences({
      on: true,
      id: SCENE_IDS[0],
      visibility: 3,
      speed: 0,
      time: 'day',
      motion: false,
      surfaces: { new: false, chat: true },
      mode: { new: 'horizon' },
    })).toEqual({
      on: true,
      id: SCENE_IDS[0],
      visibility: 1,
      speed: 0.25,
      time: 'day',
      timeSource: 'fixed',
      motion: false,
      surfaces: { new: false, chat: true, other: false },
      mode: { new: 'horizon', chat: 'full' },
    })
    expect(normalizeScenePreferences({ on: true, id: 'future-scene' })).toEqual({
      ...DEFAULT_SCENE_PREFERENCES,
      on: false,
      id: 'future-scene',
    })
    expect(normalizeScenePreferences({ time: 'auto', visibility: 0.7 })).toMatchObject({
      time: 'auto',
      timeSource: 'clock',
      visibility: 0.7,
    })
    expect(normalizeScenePreferences({ time: 'night' })).toMatchObject({
      time: 'night',
      timeSource: 'fixed',
    })
    expect(normalizeScenePreferences({})).toMatchObject({
      time: 'auto',
      timeSource: 'theme',
      visibility: 0.9,
    })
    expect(normalizeScenePreferences({ timeSource: 'fixed' })).toMatchObject({
      time: 'auto',
      timeSource: 'theme',
    })
    expect(normalizeScenePreferences({ visibility: Number.NaN, speed: Infinity }).visibility).toBe(0.9)
  })
})

describe('the localStorage mirror', () => {
  it('round-trips through the same keys the index.html pre-paint script reads', () => {
    writeStoredAppearance({
      accent: 'violet',
      density: 'compact',
      width: 'wide',
      scene: DEFAULT_SCENE_PREFERENCES,
    })
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('violet')
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact')
    expect(localStorage.getItem(WIDTH_STORAGE_KEY)).toBe('wide')
    expect(JSON.parse(localStorage.getItem(SCENE_STORAGE_KEY) ?? 'null')).toEqual({ on: false })
    expect(readStoredAppearance()).toEqual({
      accent: 'violet',
      density: 'compact',
      width: 'wide',
      scene: DEFAULT_SCENE_PREFERENCES,
    })
  })

  it('mirrors only scene enabled state and id for pre-paint', () => {
    const appearance = {
      accent: 'violet' as const,
      density: 'comfortable' as const,
      width: 'wide' as const,
      scene: { ...DEFAULT_SCENE_PREFERENCES, on: true, id: SCENE_IDS[0], visibility: 0.2, motion: false },
    }
    writeStoredAppearance(appearance)
    expect(localStorage.getItem(SCENE_STORAGE_KEY)).toBe(JSON.stringify({ on: true, id: SCENE_IDS[0] }))
    expect(readStoredAppearance().scene).toEqual({ ...DEFAULT_SCENE_PREFERENCES, on: true, id: SCENE_IDS[0] })
  })

  it('defaults when the mirror is empty', () => {
    expect(readStoredAppearance()).toEqual({
      accent: 'violet',
      density: 'comfortable',
      width: 'wide',
      scene: DEFAULT_SCENE_PREFERENCES,
    })
  })
})

describe('applyAppearance', () => {
  it('clears a historical accent stamp while preserving the independent preferences', () => {
    const root = document.documentElement
    root.dataset.accent = 'lime'
    applyAppearance(root, {
      accent: 'violet',
      density: 'compact',
      width: 'narrow',
      scene: { ...DEFAULT_SCENE_PREFERENCES, id: SCENE_IDS[0], on: true },
    })
    expect(root.hasAttribute('data-accent')).toBe(false)
    expect(root.dataset.density).toBe('compact')
    expect(root.dataset.width).toBe('narrow')
    expect(root.dataset.scene).toBe('on')

    // Back to defaults: independent preference attributes still come off as before.
    applyAppearance(root, { accent: 'violet', density: 'comfortable', width: 'wide', scene: DEFAULT_SCENE_PREFERENCES })
    expect(root.hasAttribute('data-accent')).toBe(false)
    expect(root.hasAttribute('data-density')).toBe(false)
    expect(root.hasAttribute('data-width')).toBe(false)
    expect(root.dataset.scene).toBe('off')
  })
})
