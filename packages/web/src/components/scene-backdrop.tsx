import * as React from 'react'
import { matchPath, useLocation } from 'react-router'

import type { SceneMode, ScenePreferences } from '@/lib/appearance'
import { stripProjectPrefix } from '@/lib/project-router'
import type { SceneHost } from '@/lib/scenery/engine/host'
import type { HostOptions } from '@/lib/scenery/engine/host-types'
import type { SceneDef } from '@/lib/scenery/engine/types'
import { useScene } from './scene-provider'
import { useTheme } from './theme-provider'

const DESKTOP_QUERY = '(min-width: 768px)'

function sceneSurface(pathname: string): keyof ScenePreferences['surfaces'] {
  const path = stripProjectPrefix(pathname)
  if (matchPath('/new', path)) return 'new'
  if (matchPath('/tasks/:id', path)) return 'chat'
  return 'other'
}

export function SceneBackdrop() {
  const { pathname } = useLocation()
  const { scene } = useScene()
  const surface = sceneSurface(pathname)
  if (!scene.on || !scene.id || !scene.surfaces[surface]) return null
  return <LoadScene key={scene.id} id={scene.id} scene={scene} surface={surface} />
}

type SceneSurface = ReturnType<typeof sceneSurface>
type Engine = typeof import('@/lib/scenery/engine')
type LoadedScene = {
  definition: SceneDef
  engine: Engine
  createHost: typeof import('@/lib/scenery/engine/host').createSceneHost
}

function LoadScene({ id, scene, surface }: { id: string; scene: ScenePreferences; surface: SceneSurface }) {
  const [loaded, setLoaded] = React.useState<LoadedScene>()
  React.useEffect(() => {
    let cancelled = false
    void Promise.all([
      import('@/lib/scenery/engine/host'),
      import('@/lib/scenery/engine'),
    ]).then(async ([{ createSceneHost }, engine]) => {
      if (cancelled) return
      const definition = await engine.sceneRegistry.load(id)
      if (!cancelled && definition) setLoaded({ definition, engine, createHost: createSceneHost })
    }).catch(() => {
      // A failed chunk leaves the normal cockpit background in place.
    })
    return () => { cancelled = true }
  }, [id])

  return loaded ? <SceneCanvas loaded={loaded} scene={scene} surface={surface} /> : null
}

function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = React.useState(() => window.matchMedia?.(DESKTOP_QUERY)?.matches === false)
  React.useLayoutEffect(() => {
    const query = window.matchMedia?.(DESKTOP_QUERY)
    if (!query) return
    const update = () => setNarrow(!query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return narrow
}

function readBackground() {
  const tokens = getComputedStyle(document.documentElement)
  const value = tokens.getPropertyValue('--background').trim()
  return /^#[\da-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : undefined
}

function SceneCanvas({ loaded, scene, surface }: { loaded: LoadedScene; scene: ScenePreferences; surface: SceneSurface }) {
  const { resolvedTheme } = useTheme()
  const narrow = useNarrowViewport()
  const mode: SceneMode = surface === 'other' ? 'horizon' : scene.mode[surface]
  const layer = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const hostRef = React.useRef<SceneHost | null>(null)
  const [size, setSize] = React.useState<{ width: number; height: number }>()
  const [background, setBackground] = React.useState<number>()
  const [ready, setReady] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  React.useLayoutEffect(() => {
    const element = layer.current
    if (!element) return
    const measure = () => {
      if (!element.clientWidth || !element.clientHeight) return
      const next = loaded.engine.bufferSize(element.clientWidth, element.clientHeight, narrow)
      setSize((previous) => previous?.width === next.width && previous.height === next.height ? previous : next)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [loaded, mode, narrow, failed])

  const { time, visibility, speed, motion } = scene
  React.useLayoutEffect(() => {
    setBackground(readBackground())
  }, [resolvedTheme])

  React.useEffect(() => () => {
    hostRef.current?.dispose()
    hostRef.current = null
  }, [])

  React.useEffect(() => {
    if (failed || background === undefined || !size || !canvas.current) {
      if (hostRef.current) {
        hostRef.current.dispose()
        hostRef.current = null
        setReady(false)
      }
      return
    }
    const options: HostOptions = {
      ...size,
      sceneId: loaded.definition.id,
      background,
      // Visibility is mixed once by the renderer. Reading surfaces protect text locally.
      visibility,
      time,
      speed,
      motion: narrow ? false : motion,
      onError: () => setFailed(true),
    }
    if (hostRef.current) {
      void hostRef.current.update(options).catch(options.onError)
      return
    }
    try {
      // The host owns visibilitychange and prefers-reduced-motion in both rendering paths.
      const host = loaded.createHost(canvas.current, options)
      hostRef.current = host
      void host.ready.then(() => {
        if (hostRef.current === host) setReady(true)
      }).catch(options.onError)
    } catch {
      setFailed(true)
    }
  }, [loaded, size, background, time, visibility, speed, motion, narrow, failed])

  if (failed) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      data-slot="scene-backdrop"
      data-surface={surface}
      data-mode={mode}
      data-narrow={narrow ? '' : undefined}
      data-ready={ready && background !== undefined ? '' : undefined}
    >
      <div ref={layer} data-slot="scene-layer">
        <canvas ref={canvas} className="block size-full [image-rendering:pixelated]" />
      </div>
    </div>
  )
}
