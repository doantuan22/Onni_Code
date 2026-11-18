import * as React from "react"

import { StatusDot, type StatusDotTone } from "@/components/status-dot"
import { cn } from "@/lib/utils"

/* The neutral status chip from the mockups' `.pill` class.
 * The chip itself stays `bg-muted`/`text-muted-foreground` in every state — pass `dot` to express
 * status, because in this design system the color lives in the dot, not in the fill.
 */
function Pill({
  className,
  dot,
  pulse = false,
  children,
  ...props
}: React.ComponentProps<"span"> & {
  /** Render a leading StatusDot in this tone. Omit for a plain chip. */
  dot?: StatusDotTone
  /** Pulse the dot to mark a transitioning state. Ignored without `dot`. */
  pulse?: boolean
}) {
  return (
    <span
      data-slot="pill"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground",
        className
      )}
      {...props}
    >
      {dot ? <StatusDot tone={dot} pulse={pulse} /> : null}
      {children}
    </span>
  )
}

export { Pill }
