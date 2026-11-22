import type { Mask } from './types'

export type Point = Readonly<{ x: number; y: number }>
export type Pixel = (x: number, y: number, index: number) => void

const snap = (value: number): number => Math.round(value)
const visible = (mask: Mask | undefined, x: number, y: number): boolean => !mask || mask.contains(x, y)

/** Even-odd scanline fill with half-open edges prevents seams between adjoining polygons. */
export function fillPolygon(points: readonly Point[], index: number, px: Pixel, mask?: Mask): void {
  if (points.length < 3) return
  const vertices = points.map(({ x, y }) => ({ x: snap(x), y: snap(y) }))
  const top = Math.min(...vertices.map((point) => point.y))
  const bottom = Math.max(...vertices.map((point) => point.y))
  for (let y = top; y < bottom; y++) {
    const intersections: number[] = []
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i]!
      const b = vertices[(i + 1) % vertices.length]!
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y))
    }
    intersections.sort((a, b) => a - b)
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      for (let x = Math.ceil(intersections[i]!); x < Math.ceil(intersections[i + 1]!); x++) if (visible(mask, x, y)) px(x, y, index)
    }
  }
}

/** Samples quadratic (3) or cubic (4) Bézier paths at <= one art pixel before drawing. */
export function strokeCurve(points: readonly Point[], index: number, line: (x0: number, y0: number, x1: number, y1: number, index: number) => void, mask?: Mask): void {
  if (points.length !== 3 && points.length !== 4) throw new RangeError('Curves require three quadratic or four cubic control points')
  const length = points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - points[i]!.x, point.y - points[i]!.y), 0)
  const steps = Math.max(1, Math.ceil(length))
  const sample = (t: number): Point => points.length === 3
    ? { x: (1 - t) ** 2 * points[0]!.x + 2 * (1 - t) * t * points[1]!.x + t ** 2 * points[2]!.x, y: (1 - t) ** 2 * points[0]!.y + 2 * (1 - t) * t * points[1]!.y + t ** 2 * points[2]!.y }
    : { x: (1 - t) ** 3 * points[0]!.x + 3 * (1 - t) ** 2 * t * points[1]!.x + 3 * (1 - t) * t ** 2 * points[2]!.x + t ** 3 * points[3]!.x, y: (1 - t) ** 3 * points[0]!.y + 3 * (1 - t) ** 2 * t * points[1]!.y + 3 * (1 - t) * t ** 2 * points[2]!.y + t ** 3 * points[3]!.y }
  let previous = sample(0)
  for (let i = 1; i <= steps; i++) {
    const next = sample(i / steps)
    if (!mask) line(snap(previous.x), snap(previous.y), snap(next.x), snap(next.y), index)
    else {
      // A masked line stays deterministic while avoiding writes outside water/fog ROIs.
      const dx = Math.abs(snap(next.x) - snap(previous.x)); const dy = Math.abs(snap(next.y) - snap(previous.y))
      const count = Math.max(dx, dy, 1)
      for (let step = 0; step <= count; step++) {
        const x = snap(previous.x + (next.x - previous.x) * step / count); const y = snap(previous.y + (next.y - previous.y) * step / count)
        if (mask.contains(x, y)) line(x, y, x, y, index)
      }
    }
    previous = next
  }
}
