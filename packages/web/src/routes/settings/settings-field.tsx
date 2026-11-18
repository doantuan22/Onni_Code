import type { ReactNode } from 'react'

/**
 * One labelled settings row: the name on the left, the hint and control(s) on the right.
 *
 * Extracted when step 3.5 split Resources into a global pane (parallel + memory) and a project
 * pane (worktrees): both halves are the same rhythm, and two private copies of it would be two
 * things to keep in step. Settings reads as ONE surface across the project/global boundary
 * precisely because every section renders through the same chassis.
 *
 * A container query, not a viewport one: the same row appears in the page column, in a narrow
 * dialog and in the project index, and each must stack on its own width. The hairline under the
 * row is what turns a column of fields into a settings table — the frame owns the page width,
 * this owns the rhythm.
 */
export function SettingsField({
  title,
  hint,
  labelFor,
  children,
}: {
  title: string
  hint: string
  /** When the control sits in the right column, the title still labels it by id. */
  labelFor?: string
  children: ReactNode
}) {
  return (
    <section data-slot="settings-field" className="@container">
      <div className="flex flex-col gap-2 border-b border-border pb-5 @xl:grid @xl:grid-cols-[180px_minmax(0,1fr)] @xl:items-start @xl:gap-8">
        <h2 className="text-[12.5px] font-semibold text-foreground @xl:pt-0.5">
          {labelFor ? <label htmlFor={labelFor}>{title}</label> : title}
        </h2>
        <div className="flex min-w-0 flex-col gap-2.5">
          <p className="text-[12px] leading-[1.55] text-muted-foreground">{hint}</p>
          {children}
        </div>
      </div>
    </section>
  )
}

/** A titled card that groups related SettingsFields (two-column pages such as Resources). */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section data-slot="settings-group" className="flex flex-col gap-5 rounded-md border border-border bg-card p-4">
      <header>
        <h2 className="text-[13.5px] font-semibold text-foreground">{title}</h2>
        <p className="text-[12.5px] text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  )
}
