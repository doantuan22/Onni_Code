import { describe, expect, it } from 'vitest'

import { computeFlip } from './flip'

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height })

describe('computeFlip', () => {
  it('returns null when the boxes already coincide', () => {
    const box = rect(0, 0, 100, 50)
    expect(computeFlip(box, box)).toBeNull()
  })

  it('inverts a pure translation', () => {
    expect(computeFlip(rect(100, 40, 100, 50), rect(200, 40, 100, 50))).toEqual({
      dx: -100,
      dy: 0,
      sx: 1,
      sy: 1,
    })
  })

  it('inverts a pure resize about the top-left corner', () => {
    expect(computeFlip(rect(0, 0, 100, 50), rect(0, 0, 50, 50))).toEqual({
      dx: 0,
      dy: 0,
      sx: 2,
      sy: 1,
    })
  })

  it('combines translation and scale (full-width pane shrinking to half beside a new pane)', () => {
    expect(computeFlip(rect(0, 0, 1000, 800), rect(0, 0, 500, 800))).toEqual({
      dx: 0,
      dy: 0,
      sx: 2,
      sy: 1,
    })
    expect(computeFlip(rect(0, 0, 1000, 800), rect(500, 0, 500, 800))).toEqual({
      dx: -500,
      dy: 0,
      sx: 2,
      sy: 1,
    })
  })

  it('guards a zero-size last box from dividing by zero', () => {
    expect(computeFlip(rect(0, 0, 100, 50), rect(10, 20, 0, 0))).toEqual({
      dx: -10,
      dy: -20,
      sx: 1,
      sy: 1,
    })
    expect(computeFlip(rect(0, 0, 100, 50), rect(0, 0, 0, 0))).toBeNull()
  })
})
