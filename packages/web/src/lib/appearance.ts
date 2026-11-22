/* Appearance preferences (density + width + scene): the pure half, mirroring `lib/theme.ts`.
 *
 * The authoritative store is the server's `ui-state.json` (`GET/PUT /api/ui-state`, additive
 * `appearance` key) so the choice follows the repo, not the browser. localStorage keeps a
 * per-browser MIRROR of the last-applied values purely so the pre-paint script in
 * `packages/web/index.html` can stamp its historical `data-accent`/`data-density`/`data-width`/`data-scene` values before first paint — the same
 * no-flash trick the theme uses. When the server answers, its value wins and the mirror is
 * rewritten.
 *
 * IMPORTANT: `packages/web/index.html`'s inline script duplicates `applyAppearance`'s stamping in
 * vanilla JS on purpose — it must run before the bundle exists. Change one, change the other.
 */

export const ACCENT_STORAGE_KEY = 'onni-accent'
export const DENSITY_STORAGE_KEY = 'onni-density'
export const WIDTH_STORAGE_KEY = 'onni-width'
export const SCENE_STORAGE_KEY = 'onni-scene'

export const SCENE_IDS = [
  'vn-halong',
  'vn-mu-cang-chai',
  'vn-fansipan',
  'vn-phu-quoc',
  'world-tromso',
  'world-kyoto',
  'world-matterhorn',
  'world-sahara',
] as const

/**
 * Accent remains in persisted appearance records solely for backwards compatibility. The visual
 * system no longer offers a choice: old values normalize to the one fixed violet accent.
 */
export type Accent = 'violet'

/** Density shrinks Tailwind v4's one spacing token (`--spacing`, default 4px/unit) so every
 *  padding/gap/control height tightens while type stays full-size: `compact` → 3.5px (~12%),
 *  `ultra` ("Compact for real") → 3px (~25%). See the `:root[data-density]` blocks in index.css. */
export type Density = 'comfortable' | 'compact' | 'ultra'

/** Reading width flips the shared `--measure` token (index.css `:root[data-width="narrow"]`):
 *  `wide` is the legacy spelling for the zero-config full-width mode; `narrow` restores the old
 *  820px reading column. Used by task and skill detail views; type size and spacing stay untouched. */
export type Width = 'narrow' | 'wide'

export type SceneId = string
export type SceneTime = 'auto' | 'dawn' | 'day' | 'dusk' | 'night'
export type SceneTimeSource = 'theme' | 'clock' | 'fixed'
export type SceneMode = 'full' | 'horizon'

export interface ScenePreferences {
  on: boolean
  id?: SceneId
  visibility: number
  speed: number
  time: SceneTime
  timeSource: SceneTimeSource
  motion: boolean
  surfaces: { new: boolean; chat: boolean; other: boolean }
  mode: { new: SceneMode; chat: SceneMode }
}

export const DEFAULT_SCENE_PREFERENCES: ScenePreferences = {
  on: false,
  visibility: 0.9,
  speed: 1,
  time: 'auto',
  timeSource: 'theme',
  motion: true,
  surfaces: { new: true, chat: true, other: false },
  mode: { new: 'full', chat: 'full' },
}

export const DEFAULT_ACCENT: Accent = 'violet'
export const DEFAULT_DENSITY: Density = 'comfortable'
export const DEFAULT_WIDTH: Width = 'wide'

export interface Appearance {
  accent: Accent
  density: Density
  width: Width
  scene: ScenePreferences
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function isSceneId(value: unknown): value is SceneId {
  return typeof value === 'string' && (SCENE_IDS as readonly string[]).includes(value)
}

export function normalizeScenePreferences(raw: unknown): ScenePreferences {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const surfaces = obj.surfaces && typeof obj.surfaces === 'object' ? (obj.surfaces as Record<string, unknown>) : {}
  const mode = obj.mode && typeof obj.mode === 'object' ? (obj.mode as Record<string, unknown>) : {}
  const id = typeof obj.id === 'string' && obj.id.length <= 40 ? obj.id : undefined
  const fixedTime = obj.time === 'dawn' || obj.time === 'day' || obj.time === 'dusk' || obj.time === 'night'
    ? obj.time
    : undefined
  const timeSource: SceneTimeSource =
    obj.timeSource === 'theme' || obj.timeSource === 'clock' || obj.timeSource === 'fixed'
      ? obj.timeSource
      : obj.time === 'auto'
        ? 'clock'
        : fixedTime
          ? 'fixed'
          : 'theme'
  const normalizedTimeSource = timeSource === 'fixed' && !fixedTime ? 'theme' : timeSource

  return {
    on: isSceneId(id) && normalizeBoolean(obj.on, DEFAULT_SCENE_PREFERENCES.on),
    ...(id === undefined ? {} : { id }),
    visibility: boundedNumber(obj.visibility, 0, 1, DEFAULT_SCENE_PREFERENCES.visibility),
    speed: boundedNumber(obj.speed, 0.25, 2, DEFAULT_SCENE_PREFERENCES.speed),
    time: normalizedTimeSource === 'fixed' ? fixedTime! : 'auto',
    timeSource: normalizedTimeSource,
    motion: normalizeBoolean(obj.motion, DEFAULT_SCENE_PREFERENCES.motion),
    surfaces: {
      new: normalizeBoolean(surfaces.new, DEFAULT_SCENE_PREFERENCES.surfaces.new),
      chat: normalizeBoolean(surfaces.chat, DEFAULT_SCENE_PREFERENCES.surfaces.chat),
      other: normalizeBoolean(surfaces.other, DEFAULT_SCENE_PREFERENCES.surfaces.other),
    },
    mode: {
      new: mode.new === 'horizon' ? 'horizon' : 'full',
      chat: mode.chat === 'horizon' ? 'horizon' : 'full',
    },
  }
}

/** Coerce historic accent records to the fixed violet accent without rejecting old ui-state. */
export function normalizeAccent(raw: unknown): Accent {
  void raw
  return DEFAULT_ACCENT
}

export function normalizeDensity(raw: unknown): Density {
  return raw === 'comfortable' || raw === 'compact' || raw === 'ultra' ? raw : DEFAULT_DENSITY
}

export function normalizeWidth(raw: unknown): Width {
  return raw === 'narrow' || raw === 'wide' ? raw : DEFAULT_WIDTH
}

/** The `appearance` key of a ui-state payload, defaults filled in. Defensive about shape —
 *  the server passes unknown keys through, so this can meet anything. */
export function normalizeAppearance(raw: unknown): Appearance {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    accent: normalizeAccent(obj.accent),
    density: normalizeDensity(obj.density),
    width: normalizeWidth(obj.width),
    scene: normalizeScenePreferences(obj.scene),
  }
}

/** The mirrored preference, or the default when storage is empty/unreadable (private mode). */
export function readStoredAppearance(): Appearance {
  try {
    return {
      accent: normalizeAccent(localStorage.getItem(ACCENT_STORAGE_KEY)),
      density: normalizeDensity(localStorage.getItem(DENSITY_STORAGE_KEY)),
      width: normalizeWidth(localStorage.getItem(WIDTH_STORAGE_KEY)),
      scene: normalizeStoredScene(localStorage.getItem(SCENE_STORAGE_KEY)),
    }
  } catch {
    return {
      accent: DEFAULT_ACCENT,
      density: DEFAULT_DENSITY,
      width: DEFAULT_WIDTH,
      scene: DEFAULT_SCENE_PREFERENCES,
    }
  }
}

function normalizeStoredScene(raw: string | null): ScenePreferences {
  if (!raw) return DEFAULT_SCENE_PREFERENCES
  try {
    return normalizeScenePreferences(JSON.parse(raw))
  } catch {
    return DEFAULT_SCENE_PREFERENCES
  }
}

export function writeStoredAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, appearance.accent)
    localStorage.setItem(DENSITY_STORAGE_KEY, appearance.density)
    localStorage.setItem(WIDTH_STORAGE_KEY, appearance.width)
    const scene = normalizeScenePreferences(appearance.scene)
    localStorage.setItem(
      SCENE_STORAGE_KEY,
      JSON.stringify({ on: scene.on, ...(scene.id ? { id: scene.id } : {}) }),
    )
  } catch {
    // Private mode / storage disabled — the appearance still applies for this page.
  }
}

/**
 * The fixed accent never needs a DOM attribute. Removing a historical stamp makes an old mirror
 * converge after startup while the token sheet stays violet even before that effect runs.
 */
export function applyAppearance(root: HTMLElement, appearance: Appearance): void {
  void appearance.accent
  delete root.dataset.accent
  if (appearance.density === DEFAULT_DENSITY) delete root.dataset.density
  else root.dataset.density = appearance.density
  if (appearance.width === DEFAULT_WIDTH) delete root.dataset.width
  else root.dataset.width = appearance.width
  root.dataset.scene = appearance.scene.on && isSceneId(appearance.scene.id) ? 'on' : 'off'
}
