import { mulberry32 } from './rng'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  age: number
  index: number
  active: boolean
}

/** Fixed-capacity pool: no frame-time allocation, splice, or unbounded weather effects. */
export class ParticlePool {
  readonly particles: Particle[]
  private readonly random: () => number

  constructor(capacity = 64, seed = 1) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 160) throw new RangeError('Particle pools require 1–160 particles')
    this.random = mulberry32(seed)
    this.particles = Array.from({ length: capacity }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, age: 0, index: 0, active: false }))
  }

  spawn(particle: Omit<Particle, 'age' | 'active'>): boolean {
    const slot = this.particles.find((candidate) => !candidate.active)
    if (!slot) return false
    Object.assign(slot, particle, { age: 0, active: true })
    return true
  }

  /** Seeded helper for schedule-driven effects. */
  chance(probability: number): boolean { return this.random() < Math.max(0, Math.min(1, probability)) }
  advance(dt: number): void {
    for (const particle of this.particles) {
      if (!particle.active) continue
      particle.age += Math.max(0, Math.min(0.2, dt))
      particle.x += particle.vx * dt; particle.y += particle.vy * dt
      if (particle.age >= particle.life) particle.active = false
    }
  }
}
