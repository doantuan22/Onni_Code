import * as React from 'react'

import type { SceneId, SceneMode, ScenePreferences, SceneTime, SceneTimeSource } from '@/lib/appearance'

type SceneContextValue = {
  scene: ScenePreferences
  setScene: (scene: ScenePreferences) => void
  setSceneOn: (on: boolean) => void
  setSceneId: (id: SceneId) => void
  setVisibility: (visibility: number) => void
  setSpeed: (speed: number) => void
  setTime: (time: SceneTime) => void
  setTimeSource: (timeSource: SceneTimeSource) => void
  setMotion: (motion: boolean) => void
  setSurfaces: (surfaces: ScenePreferences['surfaces']) => void
  setMode: (mode: ScenePreferences['mode']) => void
}

const SceneContext = React.createContext<SceneContextValue | null>(null)

/** UI-only scene preferences; scene rendering and engine code stay outside this provider. */
export function SceneProvider({
  scene,
  onChange,
  children,
}: {
  scene: ScenePreferences
  onChange: (scene: ScenePreferences) => void
  children: React.ReactNode
}) {
  const value = React.useMemo<SceneContextValue>(
    () => ({
      scene,
      setScene: onChange,
      setSceneOn: (on) => onChange({ ...scene, on }),
      setSceneId: (id) => onChange({ ...scene, id }),
      setVisibility: (visibility) => onChange({ ...scene, visibility }),
      setSpeed: (speed) => onChange({ ...scene, speed }),
      setTime: (time) => onChange({ ...scene, time, timeSource: time === 'auto' ? 'clock' : 'fixed' }),
      setTimeSource: (timeSource) => onChange({ ...scene, timeSource, time: timeSource === 'fixed' && scene.time === 'auto' ? 'day' : timeSource === 'fixed' ? scene.time : 'auto' }),
      setMotion: (motion) => onChange({ ...scene, motion }),
      setSurfaces: (surfaces) => onChange({ ...scene, surfaces }),
      setMode: (mode) => onChange({ ...scene, mode }),
    }),
    [scene, onChange],
  )

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
}

export function useScene(): SceneContextValue {
  const context = React.useContext(SceneContext)
  if (!context) throw new Error('onni: useScene() must be called inside <SceneProvider>')
  return context
}
