import { createContext, useContext } from 'react'
import { PanelRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

/** The run header owns the narrow-screen context action, avoiding a second task title bar. */
export const WorkspaceContextAction = createContext<(() => void) | null>(null)

export function ContextActionButton() {
  const open = useContext(WorkspaceContextAction)
  const { t } = useI18n()
  if (!open) return null
  return (
    <Button variant="ghost" size="icon-sm" aria-label={t('Context views')}
      data-slot="open-context-button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={open}>
      <PanelRightIcon aria-hidden="true" />
    </Button>
  )
}
