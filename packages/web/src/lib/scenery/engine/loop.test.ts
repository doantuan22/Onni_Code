import { describe, expect, it, vi } from 'vitest'
import { FrameLoop } from './loop'
import type { Scheduler } from './loop'

function clock() {
  let now = 0
  let next = 0
  const pending = new Map<number, { callback: () => void; at: number }>()
  const scheduler: Scheduler = {
    now: () => now,
    schedule(callback, delay) { const id = ++next; pending.set(id, { callback, at: now + delay }); return id },
    cancel(handle) { pending.delete(handle as number) },
  }
  return {
    scheduler, pending,
    work(ms: number) { now += ms },
    step() {
      const [id, job] = [...pending.entries()][0]!
      pending.delete(id)
      now = job.at
      job.callback()
    },
  }
}

describe('frame lifecycle and performance brake', () => {
  it('runs at 12fps and accounts for drawing cost in the interval', () => {
    const c = clock()
    const draw = vi.fn(() => c.work(2))
    const loop = new FrameLoop(draw, c.scheduler)
    loop.start()
    c.step()
    expect(draw.mock.calls).toHaveLength(2)
    expect(c.scheduler.now()).toBeCloseTo(1000 / 12 + 2)
    loop.dispose()
    expect(c.pending.size).toBe(0)
  })

  it('brakes on 30-frame averages: 12 → 6 → static, without a leaking timer', () => {
    const c = clock()
    const brake = vi.fn()
    const draw = vi.fn(() => c.work(9))
    const loop = new FrameLoop(draw, c.scheduler, {}, brake)
    loop.start()
    for (let i = 1; i < 30; i++) c.step()
    expect(loop.fps).toBe(6)
    for (let i = 0; i < 30; i++) c.step()
    expect(loop.fps).toBe(0)
    expect(brake.mock.calls).toEqual([[6], [0]])
    expect(draw).toHaveBeenCalledTimes(60)
    expect(c.pending.size).toBe(0)
  })

  it('does not brake at 8ms and gives the slower tier a fresh measurement window', () => {
    const c = clock()
    let cost = 9
    const loop = new FrameLoop(() => c.work(cost), c.scheduler)
    loop.start()
    for (let i = 1; i < 30; i++) c.step()
    cost = 8
    for (let i = 0; i < 60; i++) c.step()
    expect(loop.fps).toBe(6)
    loop.dispose()
  })

  it('cancels on hidden and resumes without a large time jump', () => {
    const c = clock()
    const draw = vi.fn()
    const loop = new FrameLoop(draw, c.scheduler)
    loop.start()
    loop.configure({ hidden: true })
    expect(c.pending.size).toBe(0)
    c.work(60000)
    loop.configure({ hidden: false })
    expect(draw.mock.calls[1]).toEqual([0, 0])
    c.step()
    expect(draw.mock.calls[2]![1]).toBeCloseTo(1 / 12)
    loop.dispose()
    loop.configure({ hidden: false })
    expect(c.pending.size).toBe(0)
  })

  it.each([{ reducedMotion: true }, { motion: false }])('renders a single static frame for %s', (options) => {
    const c = clock()
    const draw = vi.fn()
    const loop = new FrameLoop(draw, c.scheduler, options)
    loop.start()
    expect(draw).toHaveBeenCalledExactlyOnceWith(0, 0)
    expect(c.pending.size).toBe(0)
    loop.dispose()
  })

  it('starts hidden with no frame or timer, and resumes after reduced-motion changes', () => {
    const c = clock()
    const draw = vi.fn()
    const loop = new FrameLoop(draw, c.scheduler, { hidden: true })
    loop.start()
    expect(draw).not.toHaveBeenCalled()
    loop.configure({ hidden: false, reducedMotion: true })
    expect(draw).toHaveBeenCalledTimes(1)
    expect(c.pending.size).toBe(0)
    loop.configure({ reducedMotion: false })
    expect(c.pending.size).toBe(1)
    loop.dispose()
  })
})
