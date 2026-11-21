export type StateName = 'idle' | 'working' | 'thinking' | 'success' | 'error' | 'sleep' | 'wake' | 'loading' | 'celebrate' | 'idle-to-working' | 'working-to-idle';
export interface Point { x: number; y: number }
export interface Anchor extends Point { baseline: number }
export interface Frame { src: string; durationMs: number; anchor: Anchor }
export interface Effect { name: string; src: string; width: number; height: number; origin: Point; behind?: boolean; cues: { frame: number; attach: Point }[] }
export interface Variation { intervalMs: [number, number]; choices: { frames: number[]; weight: number }[] }
export interface AnimationState { frames: Frame[]; playback: 'loop' | 'once' | 'pingpong'; onComplete: 'hold-last'; staticFrame: number; effects: Effect[]; sequence?: number[]; idleVariations?: Variation }
export interface Manifest { version: 2; canvas: { width: number; height: number }; anchor: Anchor; sizes: number[]; fallbackState: StateName; palette: Record<string, string>; states: Record<StateName, AnimationState>; transitions: Partial<Record<`${StateName}->${StateName}`, StateName>>; transitionPolicy: { unsupported: 'snap-to-static'; reducedMotion: 'destination-static'; interrupt: 'destination-static'; sameState: 'continue' } }
export const STATE_NAMES: readonly StateName[];
/** Throws a field-specific Error on invalid input, including cross-field bounds. */
export function validateManifest(value: unknown): Manifest;
export function playbackOrder(state: AnimationState): number[];
export function chooseVariation(variation: Variation, random?: number): number[];
export function resolveChange(manifest: Manifest, from: string, requested: string, reducedMotion?: boolean, interrupted?: boolean): { state: StateName; thenState?: StateName; initialFrame?: number; continue?: boolean };
