import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/* Variant vocabulary comes from the mockups' `.btn-*` classes, not stock shadcn:
 * `primary` (violet) and `contrast` (inverse surface) are the two CTAs, `danger-ghost` is the
 * destructive affordance. There is deliberately no `secondary`/`link` — the design system doesn't use them.
 */
const buttonVariants = cva(
  "inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-[background-color,border-color,opacity,filter] motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:brightness-[0.96]",
        contrast: "bg-contrast text-contrast-foreground hover:brightness-[0.96]",
        outline: "border border-border bg-transparent hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        "danger-ghost": "text-danger hover:bg-danger/10",
      },
      size: {
        default: "h-8 px-3 text-[12.5px]",
        sm: "h-7 rounded-sm px-2 text-xs",
        icon: "size-8",
        "icon-sm": "size-7 rounded-sm",
        xs: "h-6 gap-1 rounded-sm px-1.5 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
