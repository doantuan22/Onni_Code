import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { SceneProvider } from './scene-provider'
import { adjacentSceneId, SceneLibrary, ScenePopover, SceneVisibility, useSceneControls } from './scene-popover'
import { DEFAULT_SCENE_PREFERENCES, SCENE_IDS } from '@/lib/appearance'
import { ThemeProvider } from './theme-provider'

afterEach(cleanup)

function Harness() {
  const [scene, setScene] = useState(DEFAULT_SCENE_PREFERENCES)
  return <MemoryRouter><ThemeProvider><SceneProvider scene={scene} onChange={setScene}>
    <Controls /><SceneLibrary /><SceneVisibility /><ScenePopover chip />
    <output data-testid="preferences">{JSON.stringify(scene)}</output>
  </SceneProvider></ThemeProvider></MemoryRouter>
}
function Controls() {
  const { toggle } = useSceneControls()
  return <button onClick={toggle}>toggle</button>
}
const preferences = () => JSON.parse(screen.getByTestId('preferences').textContent!)

describe('scene controls', () => {
  it('opens the sidebar popover while off and links directly to global appearance settings', async () => {
    render(<MemoryRouter><ThemeProvider><SceneProvider scene={DEFAULT_SCENE_PREFERENCES} onChange={() => {}}><ScenePopover /></SceneProvider></ThemeProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Background scenes' }))
    expect(await screen.findByRole('switch', { name: 'Enable background scenes' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Background scene settings…' }).getAttribute('href')).toBe('/settings/global/appearance')
    expect(screen.getByRole('slider', { name: 'Visibility' })).not.toBeNull()
    expect(document.querySelector('canvas')).toBeNull()
  })
  it('enables a valid default, cycles across regions and hides the new-task chip when off', () => {
    const { container } = render(<Harness />)
    expect(container.querySelector('[data-slot="new-scene-chip"]')).toBeNull()
    fireEvent.click(screen.getByText('toggle'))
    expect(preferences()).toMatchObject({ on: true, id: SCENE_IDS[0] })
    fireEvent.click(screen.getByRole('button', { name: 'Previous background scene' }))
    expect(preferences().id).toBe(SCENE_IDS.at(-1))
    fireEvent.click(screen.getByRole('button', { name: 'Next background scene' }))
    expect(preferences().id).toBe(SCENE_IDS[0])
    fireEvent.click(screen.getByText('toggle'))
    expect(container.querySelector('[data-slot="new-scene-chip"]')).toBeNull()
  })

  it('browses all eight IDs while off without enabling the app background', () => {
    const { container } = render(<Harness />)
    expect(container.querySelectorAll('[data-scene-id]').length).toBe(4)
    expect(container.querySelector<HTMLImageElement>('[data-scene-id="vn-halong"] img')?.getAttribute('src'))
      .toBe('/scenery-thumbs/vn-halong-light.png')
    fireEvent.click(screen.getByRole('button', { name: 'World' }))
    expect(container.querySelectorAll('[data-scene-id]').length).toBe(4)
    fireEvent.click(screen.getByText('Sahara'))
    expect(preferences()).toMatchObject({ id: 'world-sahara', on: false })
    fireEvent.change(screen.getByRole('slider', { name: 'Visibility' }), { target: { value: '0.35' } })
    expect(preferences().visibility).toBe(0.35)
  })

  it('cycles missing and unknown IDs to a valid entry', () => {
    expect(adjacentSceneId(undefined, 1)).toBe(SCENE_IDS[0])
    expect(adjacentSceneId('unknown', -1)).toBe(SCENE_IDS.at(-1))
  })
})
