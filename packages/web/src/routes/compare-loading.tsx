import { LoadingSplash } from '@/components/loading-splash'
import { useI18n } from '@/lib/i18n'

/**
 * The compare view's loading state — like thread-loading.tsx, in its own module ON PURPOSE:
 * it is both the route's fetch-pending state and the `Suspense` fallback for the lazily-loaded
 * compare chunk (routes.tsx), and the fallback must not import anything from that chunk or the
 * split (Streamdown for the Progress excerpts, Shiki for the diffs) quietly disappears.
 */
export function CompareLoading() {
  const { t } = useI18n()
  return (
    <div data-route="compare" className="flex min-h-full flex-col">
      <LoadingSplash
        title={t('Loading variants…')}
        detail={t("Fetching every variant's status, spend and diff summary.")}
      />
    </div>
  )
}
