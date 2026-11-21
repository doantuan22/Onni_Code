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

function readContrastColors() {
  const tokens = getComputedStyle(document.documentElement)
  const rgb = (token: string) => {
    const value = tokens.getPropertyValue(token).trim()
    return /^#[\da-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : undefined
  }
  const background = rgb('--background')
  const foreground = rgb('--foreground')
  const muted = rgb('--muted-foreground')
  if (background === undefined || foreground === undefined || muted === undefined) return
  return { background, foregrounds: [foreground, muted] }
}

function visibilityCeiling(
  loaded: LoadedScene,
  colors: NonNullable<ReturnType<typeof readContrastColors>>,
  time: ScenePreferences['time'],
  visibility: number,
) {
  const { engine, definition } = loaded
  let palette = definition.palettes[time === 'auto' ? definition.defaultTime : time]
  if (time === 'auto') {
    // Bound every interpolated auto-time color, including the darker reflection bank.
    const colors = Object.values(definition.palettes).flatMap(engine.expandPalette).map(engine.channels)
    const edge = (pick: typeof Math.min) => [0, 1, 2].reduce(
      (rgb, channel) => (rgb << 8) | pick(...colors.map((color) => color[channel]!)), 0,
    )
    palette = [...Array<number>(16).fill(edge(Math.min)), ...Array<number>(16).fill(edge(Math.max))]
  }
  return engine.contrastCeiling(palette, colors.background, colors.foregrounds, visibility)
}

function SceneCanvas({ loaded, scene, surface }: { loaded: LoadedScene; scene: ScenePreferences; surface: SceneSurface }) {
  const { resolvedTheme } = useTheme()
  const narrow = useNarrowViewport()
  const mode: SceneMode = narrow || surface === 'other' ? 'horizon' : scene.mode[surface]
  const layer = React.useRef<HTMLDivElement>(null)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const hostRef = React.useRef<SceneHost | null>(null)
  const [size, setSize] = React.useState<{ width: number; height: number }>()
  const [colors, setColors] = React.useState<ReturnType<typeof readContrastColors>>()
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
    setColors(readContrastColors())
  }, [resolvedTheme])

  const tone = React.useMemo(() => {
    if (!colors) return
    const ceiling = visibilityCeiling(loaded, colors, time, visibility)
    if (!ceiling.possible) return
    return {
      background: colors.background,
      visibility: Math.min(visibility, ceiling.maxVisibility),
      scrim: ceiling.minScrim,
    }
  }, [loaded, colors, time, visibility])

  React.useEffect(() => () => {
    hostRef.current?.dispose()
    hostRef.current = null
  }, [])

  React.useEffect(() => {
    if (failed || !tone || !size || !canvas.current) {
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
      background: tone.background,
      visibility: tone.visibility,
      time,
      speed,
      motion,
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
  }, [loaded, size, tone, time, speed, motion, failed])

  if (failed) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10"
      data-slot="scene-backdrop"
      data-surface={surface}
      data-mode={mode}
      data-ready={ready && tone ? '' : undefined}
      style={{ '--scene-scrim': `${(tone?.scrim ?? 0) * 100}%` } as React.CSSProperties}
    >
      <div ref={layer} data-slot="scene-layer">
        <canvas ref={canvas} className="block size-full [image-rendering:pixelated]" />
      </div>
      <div data-slot="scene-scrim" />
    </div>
  )
}
