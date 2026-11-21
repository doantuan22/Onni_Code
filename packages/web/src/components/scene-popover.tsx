import { ChevronLeftIcon, ChevronRightIcon, MountainSnowIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useScene } from './scene-provider'
import { Segmented } from './segmented'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Switch } from './ui/switch'
import { SCENE_IDS } from '@/lib/appearance'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// P6 ships before the rendering registry (P4); IDs remain authoritative in appearance.ts.
const SCENE_NAMES: Record<string, string> = {
  'vn-halong': 'Ha Long Bay', 'vn-mu-cang-chai': 'Mu Cang Chai',
  'vn-fansipan': 'Fansipan', 'vn-phu-quoc': 'Phu Quoc',
  'world-tromso': 'Tromsø aurora', 'world-santorini': 'Santorini',
  'world-matterhorn': 'Matterhorn', 'world-sahara': 'Sahara',
}

export function adjacentSceneId(id: string | undefined, direction: 1 | -1): string {
  const index = SCENE_IDS.findIndex((candidate) => candidate === id)
  return SCENE_IDS[index < 0 ? (direction === 1 ? 0 : SCENE_IDS.length - 1) : (index + direction + SCENE_IDS.length) % SCENE_IDS.length]!
}

export function useSceneControls() {
  const controls = useScene()
  return {
    ...controls,
    toggle: () => controls.setScene({ ...controls.scene, on: !controls.scene.on, id: SCENE_IDS.find((id) => id === controls.scene.id) ?? SCENE_IDS[0] }),
    next: () => controls.setSceneId(adjacentSceneId(controls.scene.id, 1)),
    previous: () => controls.setSceneId(adjacentSceneId(controls.scene.id, -1)),
  }
}

export function SceneLibrary() {
  const { scene, setSceneId } = useScene()
  const { t } = useI18n()
  const [region, setRegion] = useState<'vn' | 'world'>(scene.id?.startsWith('world-') ? 'world' : 'vn')
  return <div className="space-y-2">
    <Segmented slot="scene-region" label={t('Scene region')} value={region} onChange={setRegion}
      options={[{ value: 'vn', label: t('Vietnam') }, { value: 'world', label: t('World') }]} />
    <div className="grid grid-cols-2 gap-2" aria-label={t('Scene library')}>
      {SCENE_IDS.filter((id) => id.startsWith(`${region}-`)).map((id) => <button key={id} type="button" aria-pressed={scene.id === id}
        data-scene-id={id} onClick={() => setSceneId(id)}
        className={cn('overflow-hidden rounded-md border border-border bg-card text-left text-xs focus-visible:outline-2 focus-visible:outline-ring', scene.id === id && 'border-primary text-primary')}>
        <span aria-hidden="true" className="flex aspect-video items-end justify-center bg-muted p-2 text-muted-foreground"><MountainSnowIcon className="size-8" /></span>
        <span className="block px-2 py-1.5">{t(SCENE_NAMES[id] ?? id)}</span>
      </button>)}
    </div>
    <p className="text-xs text-muted-foreground">{t('Scene previews are placeholders.')}</p>
  </div>
}

export function SceneVisibility() {
  const { scene, setVisibility } = useScene()
  const { t } = useI18n()
  return <label className="flex flex-col gap-2 text-xs">
    <span className="flex justify-between">{t('Visibility')}<span>{Math.round(scene.visibility * 100)}%</span></span>
    <input type="range" aria-label={t('Visibility')} min={0} max={1} step={0.01} value={scene.visibility}
      onChange={(event) => setVisibility(Number(event.currentTarget.value))} className="w-full accent-primary" />
  </label>
}

export function ScenePopover({ chip = false }: { chip?: boolean }) {
  const { scene, toggle, next, previous } = useSceneControls()
  const { t } = useI18n()
  if (chip && (!scene.on || !scene.surfaces.new)) return null
  return <div data-slot={chip ? 'new-scene-chip' : 'scene-control'} className={chip ? 'absolute right-3 bottom-3 flex items-center gap-1 rounded-md border border-border bg-background p-1' : 'shrink-0'}>
    {chip ? <Button type="button" variant="ghost" size="icon" aria-label={t('Previous background scene')} onClick={previous}><ChevronLeftIcon aria-hidden="true" className="size-4" /></Button> : null}
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size={chip ? 'sm' : 'icon-sm'} aria-label={t('Background scenes')} title={t('Background scenes')}
          data-slot="scene-toggle" className={cn('shrink-0', scene.on && 'text-primary')}>
          <MountainSnowIcon aria-hidden="true" className="size-4" />
          {chip ? t(SCENE_NAMES[scene.id ?? ''] ?? 'Background scenes') : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="max-h-[var(--radix-popover-content-available-height)] space-y-4 overflow-y-auto">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">{t('Background scenes')}<Switch aria-label={t('Enable background scenes')} checked={scene.on} onCheckedChange={toggle} /></label>
        <SceneLibrary />
        <SceneVisibility />
        <Link to="/settings/global/appearance" className="block text-xs text-primary underline">{t('Background scene settings…')}</Link>
      </PopoverContent>
    </Popover>
    {chip ? <Button type="button" variant="ghost" size="icon" aria-label={t('Next background scene')} onClick={next}><ChevronRightIcon aria-hidden="true" className="size-4" /></Button> : null}
  </div>
}
