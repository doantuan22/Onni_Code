/**
 * Where a request goes: which API version, and which project's copy of it.
 *
 * Callers name a ROUTE (`/runs/123/diff`), never a URL. This module turns that into the real
 * path — `/api/v1/runs/123/diff`, or `/api/v1/p/<id>/runs/123/diff` when a project scope is
 * active — which is what makes the version a single fact in the codebase rather than a prefix
 * spelled at sixty call sites. A `v2` is one edit here.
 *
 * The module-level functions below serve the cockpit's one routed tree. Consumers that embed
 * multiple cockpits, or keep independent project connections in one runtime, can instead create
 * an isolated `ProjectScope` with `createProjectScope`.
 */

/**
 * The version prefix every request carries.
 *
 * The service used to answer on an unversioned `/api/*` as well; that surface was removed once
 * the whole API was reachable under `/api/v1` (BACKWARD_COMPATIBILITY.md §2). Nothing should
 * reintroduce a bare `/api/...` fetch — it will 404.
 */
export const API_PREFIX = '/api/v1'

export interface ProjectScope {
  setApiBaseUrl(url: string): void
  getApiBaseUrl(): string
  setApiScope(projectId: string | null): void
  getApiScope(): string | null
  apiBase(): string
  queryScope(): string
  apiPath(route: string): string
  resolveApiUrl(url: string): string
}

/**
 * Workspace-level routes — single-mount on the server, never mirrored under `/p/:projectId`, so
 * scoping them would 404. `/workspace/*` (config, ui-state, events), `/projects` (the registry
 * plus `/checkout`), `/fs/*` (the folder picker — one filesystem, not one per project),
 * `/providers/*` and `/models` (host state shared across projects), and `/health`.
 */
const WORKSPACE_LEVEL =
  /^\/(?:health$|models(?:$|[/?])|providers(?:$|[/?])|projects(?:$|[/?])|workspace\/|fs\/)/

/** Matches a cockpit API URL and captures the part after `/api`, scope included. */
const API_URL = /^\/api(?:\/v1)?(\/.*)$/

/**
 * Create isolated API URL and project-scope state for one client integration.
 *
 * The returned methods have the same behavior as the module-level helpers, but do not share
 * their base URL or active project. The module-level API remains the cockpit's default scope.
 */
export function createProjectScope(): ProjectScope {
  /**
   * Where the service lives. Empty is the same-origin cockpit default; an embedding client can
   * set another origin at runtime without coupling this framework-neutral package to build env.
   */
  let baseUrl = ''
  let activeProjectId: string | null = null

  /** Set the service origin. `''` means "same origin as this page". */
  function setApiBaseUrl(url: string): void {
    // A trailing slash would double up against the leading slash of every route.
    baseUrl = url.replace(/\/+$/, '')
  }

  function getApiBaseUrl(): string {
    return baseUrl
  }

  /** The scoped API base — what the context carries and what deep links embed. */
  function apiBase(): string {
    const scoped =
      activeProjectId === null ? '' : `/p/${encodeURIComponent(activeProjectId)}`
    return `${baseUrl}${API_PREFIX}${scoped}`
  }

  /**
   * The leading query-key segment. `'default'` is both the unscoped sentinel and the server's
   * reserved boot-project alias, preventing cache collisions with registered project IDs.
   */
  function queryScope(): string {
    return activeProjectId ?? 'default'
  }

  /**
   * Turn a route into its versioned request path. Server-provided URLs go through
   * `resolveApiUrl` instead, so this always owns the prefixing decision.
   */
  function apiPath(route: string): string {
    return `${baseUrl}${API_PREFIX}${scopeRoute(route)}`
  }

  /** The active project's prefix, or nothing — the one place the scoping rule is spelled. */
  function scopeRoute(route: string): string {
    if (activeProjectId === null || WORKSPACE_LEVEL.test(route)) return route
    return `/p/${encodeURIComponent(activeProjectId)}${route}`
  }

  const resolveApiUrl = (url: string): string => {
    // An absolute URL keeps its own origin — re-basing someone else's host is not ours to do — but
    // it still gets the version upgrade, because a transcript written before `/api/v1` existed can
    // just as easily carry `https://host/api/runs/…` as `/api/runs/…`, and the unversioned spelling
    // 404s either way. Only the PATH is rewritten, and only when it is a cockpit API path.
    const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(url)
    if (scheme) {
      // Opaque schemes (`data:`, `blob:`) have no path to speak of and no origin to preserve.
      const separator = url.indexOf('//', scheme[0].length)
      if (separator !== scheme[0].length) return url
      const pathStart = url.indexOf('/', separator + 2)
      if (pathStart === -1) return url
      const origin = url.slice(0, pathStart)
      const upgraded = upgradeApiPath(url.slice(pathStart), scopeRoute)
      return upgraded === null ? url : `${origin}${upgraded}`
    }
    const withoutBase = baseUrl && url.startsWith(baseUrl) ? url.slice(baseUrl.length) : url
    const upgraded = upgradeApiPath(withoutBase, scopeRoute)
    return upgraded === null ? url : `${baseUrl}${upgraded}`
  }

  return {
    setApiBaseUrl,
    getApiBaseUrl,
    setApiScope(projectId) {
      activeProjectId = projectId === '' ? null : projectId
    },
    getApiScope: () => activeProjectId,
    apiBase,
    queryScope,
    apiPath,
    resolveApiUrl,
  }
}

const defaultProjectScope = createProjectScope()

/** Set the service origin. `''` (the default) means "same origin as this page". */
export const setApiBaseUrl = defaultProjectScope.setApiBaseUrl
export const getApiBaseUrl = defaultProjectScope.getApiBaseUrl

/** Written by ProjectScopeProvider on mount/param change (and cleared on unmount). Everything
 *  else only reads. */
export const setApiScope = defaultProjectScope.setApiScope
export const getApiScope = defaultProjectScope.getApiScope

/** The scoped API base — what the context carries and what deep links embed. */
export const apiBase = defaultProjectScope.apiBase
export const queryScope = defaultProjectScope.queryScope
export const apiPath = defaultProjectScope.apiPath

/**
 * Resolve a URL the SERVER minted into one this client can fetch today.
 *
 * Run transcripts persist absolute image URLs (`/api/runs/<id>/images/…`) into NDJSON and keep
 * them forever, so the cockpit renders URLs written by every version that ever ran in a repo.
 * Two things therefore have to happen at render time rather than at write time:
 *
 * - **Upgrade.** A URL stored before the API was versioned is rewritten onto `/api/v1`. This is
 *   the migration path for existing transcripts; without it every historical screenshot 404s
 *   the moment the unversioned surface is gone.
 * - **Re-scope.** Transcripts store the unscoped spelling, so the active project's prefix is
 *   applied on use, which keeps one stored URL valid under every project.
 *
 * Anything that is not a cockpit API URL — a `/raw/...` asset, a `https://github.com/...` link,
 * a `data:` URI — is returned untouched. It is not ours to rewrite.
 */
export const resolveApiUrl = defaultProjectScope.resolveApiUrl

/**
 * The path half of {@link resolveApiUrl}: `/api/…` or `/api/v1/…` → the versioned, correctly
 * scoped spelling, WITHOUT the configured base (the caller owns that, since an absolute URL keeps
 * its own origin instead). `null` when the path is not a cockpit API path at all.
 */
function upgradeApiPath(
  path: string,
  scopeRoute: (route: string) => string,
): string | null {
  const match = API_URL.exec(path)
  if (!match) return null
  const route = match[1] as string
  // Already scoped (`/p/<id>/…`) — the stored URL names its own project, so leave it.
  if (route.startsWith('/p/')) return `${API_PREFIX}${route}`
  return `${API_PREFIX}${scopeRoute(route)}`
}
