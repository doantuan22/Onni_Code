import { LoadingSplash } from '@/components/loading-splash'
import { useI18n } from '@/lib/i18n'

/** The repo view's loading surface — also the route's `Suspense` fallback (routes.tsx), so it
 *  lives outside the lazy chunk it stands in for, same reason as git-tab-loading.tsx. */
export function RepoGitLoading() {
  const { t } = useI18n()
  return (
    <div data-route="repo-git" className="flex min-h-full flex-col">
      <LoadingSplash title={t('Loading repository…')} detail={t("Fetching the repo's git state.")} />
    </div>
  )
}
