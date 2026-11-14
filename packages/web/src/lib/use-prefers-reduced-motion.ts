import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  // No matchMedia (jsdom) counts as no reduced motion, same convention as use-desktop.ts.
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * True when the user asked the OS to reduce motion — the single gate JS-driven animation reads.
 *
 * `useSyncExternalStore` (not a `useEffect` + `useState` pair) so the value is correct on the
 * first render: a FLIP or WAAPI effect reading it in a layout effect must not animate one frame
 * and then snap. `matchMedia` `change` events are the subscription; the snapshot is the current
 * preference.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
