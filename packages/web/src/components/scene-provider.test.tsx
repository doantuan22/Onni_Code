import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { DEFAULT_SCENE_PREFERENCES, SCENE_IDS } from '@/lib/appearance'
import { SceneProvider, useScene } from './scene-provider'

function SceneControls() {
  const { scene, setSceneOn, setSceneId, setVisibility } = useScene()
  return (
    <div>
      <output>{`${scene.on}:${scene.id ?? 'none'}:${scene.visibility}`}</output>
      <button onClick={() => setSceneId(SCENE_IDS[0])}>select</button>
      <button onClick={() => setSceneOn(true)}>enable</button>
      <button onClick={() => setVisibility(0.8)}>visibility</button>
    </div>
  )
}

function SceneHarness() {
  const [scene, setScene] = useState(DEFAULT_SCENE_PREFERENCES)
  return (
    <SceneProvider scene={scene} onChange={setScene}>
      <SceneControls />
    </SceneProvider>
  )
}

describe('SceneProvider', () => {
  it('exposes preferences and persists updates through its setter callbacks', () => {
    render(<SceneHarness />)
    expect(screen.getByText('false:none:0.7')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'select' }))
    expect(screen.getByText(`false:${SCENE_IDS[0]}:0.7`)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'enable' }))
    expect(screen.getByText(`true:${SCENE_IDS[0]}:0.7`)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'visibility' }))
    expect(screen.getByText(`true:${SCENE_IDS[0]}:0.8`)).toBeDefined()
  })

  it('requires the context provider', () => {
    function InvalidConsumer() {
      useScene()
      return null
    }
    expect(() => render(<InvalidConsumer />)).toThrow('useScene() must be called inside <SceneProvider>')
  })
})
