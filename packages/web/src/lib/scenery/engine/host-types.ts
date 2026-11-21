import type { FrameRate, LoopOptions } from './loop'
import type { RenderOptions } from './renderer'
import type { TimeOfDay } from './types'

export interface HostOptions extends Omit<RenderOptions, 'time'>, LoopOptions {
  sceneId: string
  time?: TimeOfDay | number | 'auto'
  onBrake?: (rate: FrameRate) => void
  onError?: (error: unknown) => void
}

export type WorkerOptions = Omit<HostOptions, 'onBrake' | 'onError'>
export type HostMessage = { type: 'init'; options: WorkerOptions } | { type: 'update'; options: WorkerOptions } | { type: 'presented' } | { type: 'dispose' }
export type WorkerMessage = { type: 'ready' } | { type: 'frame'; bitmap: ImageBitmap } | { type: 'brake'; fps: FrameRate } | { type: 'error'; message: string }

export function serializableOptions(options: HostOptions): WorkerOptions {
  const { onBrake: _brake, onError: _error, ...data } = options
  return data
}
