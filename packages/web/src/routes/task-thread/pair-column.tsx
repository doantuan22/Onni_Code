import { useRunPair } from '@/api/queries'
import type { ApiRun } from '@onni/api-client'
import { useI18n } from '@/lib/i18n'

import { PairCard } from './pair-card'

/** The One & One view — the pair's authoritative status, a workspace view like Notes. */
export function PairColumn({ run }: { run: ApiRun }) {
  const { t } = useI18n()
  const pairId = run.dispatch?.pair?.pairId ?? run.dispatch?.pairMember?.pairId ?? ''
  const pair = useRunPair(run.id, pairId)
  return (
    <div data-slot="pair-panel" className="h-full min-h-0 overflow-y-auto px-3 py-3 md:px-6 md:py-5">
      {pairId === '' ? (
        <p className="text-xs text-soft-foreground">{t('This task is not a One & One pair.')}</p>
      ) : pair.isPending ? (
        <p className="text-xs text-soft-foreground">{t('Loading One & One…')}</p>
      ) : pair.isError ? (
        <p className="text-xs text-danger">{pair.error.message}</p>
      ) : (
        <PairCard snapshot={pair.data} />
      )}
    </div>
  )
}
