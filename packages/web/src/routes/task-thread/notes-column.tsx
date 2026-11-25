import { useRunHandoff } from '@/api/queries'
import { useI18n } from '@/lib/i18n'

import { Markdown } from './markdown'

/**
 * The Notes view — the handoff journal (spec 007): what the agent did and what's left. A workspace
 * view like Chat or Changes, so it docks, splits and deep-links (`/tasks/:id/notes`) the same way.
 */
export function NotesColumn({ runId }: { runId: string }) {
  const { t } = useI18n()
  const handoff = useRunHandoff(runId)
  return (
    <div data-slot="notes-panel" className="h-full min-h-0 overflow-y-auto px-3 py-3 md:px-6 md:py-5">
      {handoff.isPending ? (
        <p className="text-xs text-soft-foreground">{t('Loading notes…')}</p>
      ) : handoff.isError ? (
        <p className="text-xs text-danger">{handoff.error.message}</p>
      ) : handoff.data.trim().length > 0 ? (
        <Markdown>{handoff.data}</Markdown>
      ) : (
        <p className="text-xs text-soft-foreground">
          {t('No notes yet — the handoff file is seeded when the task starts.')}
        </p>
      )}
    </div>
  )
}
