import { Button } from '@/components/ui/button'
import { IconTooltip } from '@/components/ui/icon-tooltip'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

import { LayoutMenu, suggestName, TabIcon, VIEW_DRAG_TYPE } from './layout-cards'
import { viewLabel, type SavedLayout, type ViewId, type WorkspaceLayout } from './layout-state'
import { stripTabs, type StripTab } from './strip'
import { VIEW_ICONS } from './view-picker'

/**
 * The desktop view rail (spec `2026-10-07-task-workspace` §5.2): the same fixed views the
 * header strip carries, as one narrow icon column to the RIGHT of the workspace — Claude Code's
 * layout — so the chat owns the full width the old tab row used to sit above. Icons only, the name
 * on hover; ⌥-click opens a view beside what shows, and a tab still drags onto the stage to split.
 * The Layout menu is the rail's last button. The icons keep the strip's own `data-*` hooks so the
 * two spellings of the same tabs cannot disagree for a browser-level spec or a keyboard shortcut.
 */
export function ViewRail({
  layouts,
  active,
  onSelect,
  onClose,
  saved,
  onApplySaved,
  onSaveCurrent,
  onDeleteSaved,
  fixedViews,
  fixedActive,
  onViews,
  onSelectFixed,
  onViewDragStart,
  onViewDragEnd,
  onOpenBeside,
  keyHints,
  showKeyHints,
}: {
  layouts: readonly WorkspaceLayout[]
  active: string
  /** The views that get an icon, in strip order. */
  fixedViews: readonly ViewId[]
  /** The view tab that is showing; no saved layout is active while one is. */
  fixedActive: ViewId | null
  /** Tabs whose view is live without being the one that shows (the terminal drawer) — lit, not selected. */
  onViews: readonly ViewId[]
  onSelectFixed: (view: ViewId) => void
  onSelect: (name: string) => void
  onClose: (name: string) => void
  saved: readonly SavedLayout[]
  onApplySaved?: (layout: SavedLayout) => void
  onSaveCurrent?: (name: string) => void
  onDeleteSaved?: (name: string) => void
  onViewDragStart?: (view: ViewId) => void
  onViewDragEnd?: () => void
  /** ⌥-click on a view icon. */
  onOpenBeside?: (view: ViewId) => void
  keyHints: ReadonlyMap<string, string>
  showKeyHints: boolean
}) {
  const { t } = useI18n()
  const items: StripTab[] = stripTabs(fixedViews)
  const isActive = (tab: StripTab) => fixedActive === tab

  return (
    <nav
      data-slot="view-rail"
      aria-label={t('Task views')}
      className="flex w-11 shrink-0 flex-col items-center gap-1 overflow-y-auto border-l border-border bg-background/60 py-1.5"
    >
      {items.map((tab) => {
        const Icon = VIEW_ICONS[tab]
        const selected = isActive(tab)
        const on = onViews.includes(tab)
        const label = viewLabel(tab)
        return (
          <IconTooltip key={tab} label={t(label)} side="left">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-slot="layout-card"
              data-fixed={tab}
              data-active={selected ? 'true' : undefined}
              data-on={on ? '' : undefined}
              aria-pressed={selected || on}
              draggable={onViewDragStart !== undefined}
              onClick={(event) => {
                if (event.altKey && onOpenBeside) onOpenBeside(tab)
                else onSelectFixed(tab)
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData(VIEW_DRAG_TYPE, tab)
                event.dataTransfer.effectAllowed = 'copyMove'
                onViewDragStart?.(tab)
              }}
              onDragEnd={() => onViewDragEnd?.()}
              className={cn(
                'relative size-9 text-muted-foreground',
                (selected || on) && 'text-foreground',
                selected && 'bg-muted',
              )}
            >
              <TabIcon hint={showKeyHints ? keyHints.get(`view:${tab}`) : undefined}>
                <Icon aria-hidden="true" className="size-[18px]" />
              </TabIcon>
              <span className="sr-only">{t(label)}</span>
              {on && !selected ? (
                <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
              ) : null}
            </Button>
          </IconTooltip>
        )
      })}
      <div className="mt-auto flex w-full flex-col items-center gap-1 border-t border-border pt-1.5">
        <LayoutMenu
          iconOnly
          layouts={layouts}
          active={fixedActive === null ? active : null}
          saved={saved}
          onSelect={onSelect}
          onClose={onClose}
          onApplySaved={onApplySaved}
          onSaveCurrent={onSaveCurrent}
          onDeleteSaved={onDeleteSaved}
          suggestedName={suggestName(layouts, fixedActive === null ? active : null, fixedActive)}
        />
      </div>
    </nav>
  )
}
