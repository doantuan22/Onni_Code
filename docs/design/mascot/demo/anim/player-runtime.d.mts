import type { Manifest, StateName } from './player-contract.mjs';
export interface PlaybackOptions { state: string; animated: boolean; loop?: boolean; reducedMotion: boolean }
export interface Timeline { durationMs: number; layers: { src: string; width: number; height: number; x: number; y: number; keyframes: Keyframe[] }[] }
export function buildTimeline(manifest: Manifest, name: StateName, order?: number[]): Timeline;
export function createMascotPlayer(root: HTMLElement, manifest: unknown, options: { baseUrl: string; onError?: (error: Error) => void; onComplete?: (state: StateName) => void }): { setState(options: PlaybackOptions): void; destroy(): void };
