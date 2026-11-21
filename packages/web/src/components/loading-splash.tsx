import { BrandMark } from '@/components/brand-mark'
import { cn } from '@/lib/utils'

/**
 * The cockpit's loading surface, in the Codex app's splash grammar. Full-page (`wordmark`), it is the mark alone, breathing:
 * nothing else. In-page (`wordmark={false}`) it keeps the action in progress and a hairline violet sweep —
 * a loader is a moment, not a screen (no icon tile, no twinkle backdrop).
 *
 * `title` is the heading on full-page fallbacks: routes.test pins each lazy route's h1 to its
 * "Loading …" title, so it renders as the only text inside the heading. `wordmark` is off where
 * the page already carries its own header (Skills, Automations) and the mark would be a second
 * masthead.
 */
export function LoadingSplash({
  title,
  detail,
  as: Heading = 'h1',
  wordmark = true,
  className,
}: {
  title: string
  detail?: string
  as?: 'h1' | 'span'
  wordmark?: boolean
  className?: string
}) {
  if (wordmark) {
    // Full-page boot/route fallback: the mark alone, breathing — no wordmark, status line or track.
    // The title stays as screen-reader text because routes pin each lazy route's h1 to it.
    return (
      <div
        data-slot="loading-splash"
        data-variant="mark"
        className={cn('flex flex-1 flex-col items-center justify-center px-6 py-12 text-center', className)}
      >
        <div role="status" className="flex flex-col items-center">
          <span className="loading-mark">
            <BrandMark height={56} />
          </span>
          <Heading data-slot="loading-title" className="sr-only">
            {title}
          </Heading>
          {detail ? <p className="mt-4 text-[11.5px] leading-[1.55] text-soft-foreground">{detail}</p> : null}
        </div>
      </div>
    )
  }
  return (
    <div
      data-slot="loading-splash"
      className={cn('flex flex-1 flex-col items-center justify-center px-6 py-12 text-center', className)}
    >
      <div role="status" className="flex w-full max-w-[320px] flex-col items-center">
        <BrandMark height={40} />
        <Heading
          data-slot="loading-title"
          className="shimmer mt-3.5 block max-w-full text-[12px] font-medium break-words"
        >
          {title}
        </Heading>
        <div
          data-slot="loading-track"
          role="progressbar"
          aria-label={title}
          className="mt-4 h-[2px] w-40 overflow-hidden rounded-full bg-border"
        >
          <span className="loading-sweep block h-full w-2/5 rounded-full bg-violet" />
        </div>
        {detail ? (
          <p className="mt-3 text-[11.5px] leading-[1.55] text-soft-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  )
}
