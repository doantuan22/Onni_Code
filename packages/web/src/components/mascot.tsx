import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Manifest, StateName } from '../../public/brand/mascot-v2/anim/player-contract.mjs'
import type { createMascotPlayer as CreatePlayer } from '../../public/brand/mascot-v2/anim/player-runtime.mjs'

export type MascotProps = {
  state?: StateName
  size?: number
  animated?: boolean
  loop?: boolean
  className?: string
  onError?: (error: Error) => void
  onComplete?: (state: StateName) => void
} & ({ decorative?: true; label?: never } | { decorative: false; label: string })

const media = '(prefers-reduced-motion: reduce)'
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(media)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
type Library = { manifest: Manifest; createPlayer: typeof CreatePlayer; baseUrl: string }
let library: Promise<Library> | undefined
function loadLibrary(): Promise<Library> {
  library ??= (async () => {
    const baseUrl = new URL(`${import.meta.env.BASE_URL}brand/mascot-v2/anim/`, window.location.href).href
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Mascot assets timed out')) }, 10000)
    })
    try {
      // Public modules stay separate local assets; Vite must not bundle public/ paths.
      const runtimeUrl = new URL('player-runtime.mjs', baseUrl).href
      const contractUrl = new URL('player-contract.mjs', baseUrl).href
      const [runtime, contract, response] = await Promise.race([Promise.all([
        import(/* @vite-ignore */ runtimeUrl) as Promise<{ createMascotPlayer: typeof CreatePlayer }>,
        import(/* @vite-ignore */ contractUrl) as Promise<{ validateManifest: (value: unknown) => Manifest }>,
        fetch(new URL('animations.json', baseUrl), { signal: controller.signal }),
      ]), deadline])
      if (!response.ok) throw new Error(`Mascot manifest HTTP ${response.status}`)
      return { manifest: contract.validateManifest(await response.json()), createPlayer: runtime.createMascotPlayer, baseUrl }
    } finally { clearTimeout(timer) }
  })().catch((error: unknown) => { library = undefined; throw error })
  return library
}

/** Opt-in illustration. Native stepped images; all frame/effect/lifecycle data comes from v2. */
export function Mascot({ state = 'idle', size = 96, animated = state === 'loading', loop = state === 'loading' || state === 'working', decorative = true, label, className, onError, onComplete }: MascotProps) {
  const root = useRef<HTMLSpanElement>(null)
  const player = useRef<ReturnType<typeof CreatePlayer> | null>(null)
  const reducedMotion = useSyncExternalStore(subscribe, () => window.matchMedia(media).matches, () => true)
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const latest = useRef({ state, animated, loop, reducedMotion, onError, onComplete })
  latest.current = { state, animated, loop, reducedMotion, onError, onComplete }
  useEffect(() => {
    let cancelled = false
    void loadLibrary().then(({ manifest: value, createPlayer, baseUrl }) => {
      if (cancelled || !root.current) return
      setManifest(value)
      player.current = createPlayer(root.current, value, { baseUrl,
        onError: error => latest.current.onError?.(error),
        onComplete: name => latest.current.onComplete?.(name),
      })
      player.current.setState(latest.current)
    }).catch((error: unknown) => { if (!cancelled) latest.current.onError?.(error instanceof Error ? error : new Error(String(error))) })
    return () => { cancelled = true; player.current?.destroy(); player.current = null }
  }, [])
  useEffect(() => { player.current?.setState({ state, animated, loop, reducedMotion }) }, [state, animated, loop, reducedMotion])
  const pixels = Number.isFinite(size) && size > 0 && (!manifest || manifest.sizes.includes(size)) ? size : 96
  return <span ref={root} data-slot="mascot" className={className} role={decorative ? undefined : 'img'} aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : label}
    style={{ display: 'inline-block', position: 'relative', flexShrink: 0, width: pixels, height: pixels, imageRendering: 'pixelated' }} />
}
