import { LoadingSplash } from '@/components/loading-splash'
import { useI18n } from '@/lib/i18n'

/**
 * The thread's loading state, in its own module ON PURPOSE: it is both the route's
 * fetch-pending state and the `Suspense` fallback for the lazily-loaded thread chunk
 * (routes.tsx) — and the fallback must not import anything from that chunk, or the split
 * that keeps Streamdown/remark off the main bundle quietly disappears.
 */
export function ThreadLoading() {
  const { t } = useI18n()
  return (
    <div data-route="task-thread" className="flex min-h-full flex-col">
      <LoadingSplash
        title={t('Loading task…')}
        detail={t('Fetching the run and its session transcript.')}
      />
    </div>
  )
}
