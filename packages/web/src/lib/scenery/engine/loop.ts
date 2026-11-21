export type FrameRate = 12 | 6 | 0
export interface Scheduler {
  now(): number
  schedule(callback: () => void, delayMs: number): unknown
  cancel(handle: unknown): void
}
export interface LoopOptions {
  hidden?: boolean
  reducedMotion?: boolean
  motion?: boolean
  speed?: number
}

/** Shared by both browser hosts; no timers or DOM globals are required by the core. */
export class FrameLoop {
  private handle: unknown
  private scheduled = false
  private disposed = false
  private started = false
  private elapsed = 0
  private samples = 0
  private cost = 0
  private options: LoopOptions
  private rate: FrameRate = 12
  private lastStart: number | undefined

  constructor(private readonly draw: (t: number, dt: number) => void, private readonly scheduler: Scheduler, options: LoopOptions = {}, private readonly onBrake?: (rate: FrameRate) => void) {
    this.options = options
  }

  get fps(): FrameRate { return this.rate }
  private get animated(): boolean { return this.rate !== 0 && this.options.motion !== false && !this.options.reducedMotion }

  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    this.invalidate()
  }

  configure(options: LoopOptions): void {
    this.options = { ...this.options, ...options }
    this.cancel()
    this.lastStart = undefined
    if (this.started) this.invalidate()
  }

  invalidate(): void {
    if (!this.started || this.disposed || this.options.hidden) return
    this.cancel()
    this.tick()
  }

  private cancel(): void {
    if (this.scheduled) this.scheduler.cancel(this.handle)
    this.scheduled = false
  }

  private tick = (): void => {
    this.scheduled = false
    if (this.disposed || this.options.hidden) return
    const start = this.scheduler.now()
    const delta = this.animated && this.lastStart !== undefined ? Math.max(0, Math.min(0.25, (start - this.lastStart) / 1000)) * (this.options.speed ?? 1) : 0
    this.elapsed += delta
    this.lastStart = start
    this.draw(this.elapsed, delta)
    this.cost += Math.max(0, this.scheduler.now() - start)
    this.samples++
    if (this.samples === 30) {
      if (this.cost / 30 > 8 && this.rate !== 0) {
        this.rate = this.rate === 12 ? 6 : 0
        this.onBrake?.(this.rate)
      }
      this.samples = 0
      this.cost = 0
    }
    if (this.animated && !this.disposed && !this.options.hidden) {
      const duration = this.scheduler.now() - start
      this.handle = this.scheduler.schedule(this.tick, Math.max(0, 1000 / this.rate - duration))
      this.scheduled = true
    }
  }

  dispose(): void {
    this.disposed = true
    this.cancel()
  }
}
