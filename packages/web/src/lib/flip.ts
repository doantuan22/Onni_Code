import { useLayoutEffect, useRef, type RefObject } from 'react'

/** A viewport-relative box. `getBoundingClientRect` is the source of truth. */
export interface FlipRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * The Invert step of FLIP (First-Last-Invert-Play), as pure math so it is testable without a
 * browser. Returns the transform that would put an element currently at `last` back at `first`
 * (translate + scale about its top-left corner), or null when the two boxes already coincide.
 */
export function computeFlip(
  first: FlipRect,
  last: FlipRect,
): { dx: number; dy: number; sx: number; sy: number } | null {
  const dx = first.left - last.left
  const dy = first.top - last.top
  const sx = last.width > 0 ? first.width / last.width : 1
  const sy = last.height > 0 ? first.height / last.height : 1
  if (dx === 0 && dy === 0 && sx === 1 && sy === 1) return null
  return { dx, dy, sx, sy }
}

/**
 * Play a FLIP on one element: animate from the inverted (First) transform to identity (Last).
 * Transform-only — the compositor does the work, no layout thrash. `transform-origin` is pinned
 * to the top-left for the run because `scale(sx, sy)` must grow about the corner the translate
 * was measured from. No-op when the element is unmoved, in a test env without WAAPI, or already
 * at rest.
 */
export function flipElement(
  el: HTMLElement,
  first: FlipRect,
  last: FlipRect,
  duration = 260,
  easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
): void {
  const delta = computeFlip(first, last)
  if (!delta || typeof el.animate !== 'function') return
  const { dx, dy, sx, sy } = delta
  const prevOrigin = el.style.transformOrigin
  el.style.transformOrigin = 'top left'
  const animation = el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transform: 'translate(0px, 0px) scale(1, 1)' },
    ],
    { duration, easing },
  )
  animation.addEventListener(
    'finish',
    () => {
      el.style.transformOrigin = prevOrigin
      animation.cancel()
    },
    { once: true },
  )
}

export interface FlipGroupOptions {
  /** False (e.g. prefers-reduced-motion) turns the effect into a snapshot-only pass. */
  enabled?: boolean
  /** Which descendants to track; callers pin it to a real, unique slot (never a bare data-pane-id). */
  selector?: string
  /** Attribute on each tracked element identifying it across renders. */
  keyAttribute?: string
  duration?: number
  easing?: string
}

/**
 * FLIP on a container's children across renders. A layout effect snapshots every child's box
 * after each commit, then animates the delta on the next one — so a pane that survives a
 * 1-up → 2-up split glides from full width to half while the new pane simply appears. The
 * snapshot updates even when `enabled` is false, so toggling motion back on never replays a
 * stale delta.
 */
export function useFlipGroup(
  containerRef: RefObject<HTMLElement | null>,
  {
    enabled = true,
    selector = '[data-flip-key]',
    keyAttribute = 'data-flip-key',
    duration = 260,
    easing,
  }: FlipGroupOptions = {},
): void {
  const prevRects = useRef<Map<string, FlipRect> | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      prevRects.current = null
      return
    }
    const els = new Map<string, HTMLElement>()
    for (const el of Array.from(container.querySelectorAll<HTMLElement>(selector))) {
      const key = el.getAttribute(keyAttribute)
      if (key !== null) els.set(key, el)
    }
    const previous = prevRects.current
    if (enabled && previous) {
      for (const [key, el] of els) {
        const first = previous.get(key)
        if (first) flipElement(el, first, rectOf(el), duration, easing)
      }
    }
    const next = new Map<string, FlipRect>()
    for (const [key, el] of els) next.set(key, rectOf(el))
    prevRects.current = next
  })
}

function rectOf(el: Element): FlipRect {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}
