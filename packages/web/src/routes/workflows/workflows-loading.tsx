import { LoadingSplash } from '@/components/loading-splash'
import { useI18n } from '@/lib/i18n'

/**
 * The Workflows builder's loading state, in its own module ON PURPOSE (same rule as
 * GithubLoading): it is both the route's fetch-pending state and the `Suspense` fallback for
 * the lazily-loaded workflows chunk (routes.tsx) — and the fallback must not import anything
 * from that chunk, or the split that keeps React Flow off the main bundle quietly disappears.
 */
export function WorkflowsLoading() {
  const { t } = useI18n()
  return (
    <div data-route="workflows" className="flex min-h-full flex-col">
      <LoadingSplash
        title={t('Loading workflows…')}
        detail={t('Fetching the saved workflows and the node catalog.')}
      />
    </div>
  )
}
