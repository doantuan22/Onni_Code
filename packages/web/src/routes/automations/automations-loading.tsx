/**
 * The `/automations` Suspense fallback — the static page header while the lazy automations
 * chunk (editor, week/day calendars, template palette, log) loads. A SEPARATE lightweight
 * module on purpose: importing it must not pull `automations-route.tsx`'s heavier chunk into
 * the main bundle (mirrors skills-loading.tsx / workflows-loading.tsx).
 */
import { LoadingSplash } from '@/components/loading-splash'
import { useI18n } from '@/lib/i18n'

export function AutomationsLoading() {
  const { t } = useI18n()
  return (
    <div data-route="automations" className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 hidden h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:flex">
        <h1 className="text-[14px] font-semibold tracking-tight">{t('Automations')}</h1>
        <p className="text-[12.5px] text-muted-foreground">{t('Scheduled and GitHub-triggered runs.')}</p>
      </header>
      <LoadingSplash as="span" wordmark={false} title={t('Loading automations…')} />
    </div>
  )
}
