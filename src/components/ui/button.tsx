import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all duration-200 ease-out outline-none select-none cursor-pointer active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* Primary CTA — accent fill (MASTER.md §14) */
        default:
          "bg-brand-accent text-brand-accent-foreground hover:bg-[#8a5406] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent focus-visible:outline-offset-2",
        /* Secondary CTA — ink outline (MASTER.md §14) */
        outline:
          "border-ink/80 bg-transparent text-ink hover:bg-surface-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
        /* Navy fill — for select accents (e.g. on dark/photographic surfaces) */
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[#233049] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
        /* Tertiary — editorial text link, underline on hover (MASTER.md §14) */
        ghost:
          "text-ink underline decoration-border decoration-1 underline-offset-4 hover:decoration-brand-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
      directional: {
        true: "[&_[data-directional-arrow]]:transition-transform [&_[data-directional-arrow]]:duration-200 hover:[&_[data-directional-arrow]]:translate-x-0.5 focus-visible:[&_[data-directional-arrow]]:translate-x-0.5 motion-reduce:[&_[data-directional-arrow]]:transform-none motion-reduce:[&_[data-directional-arrow]]:transition-none",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      directional: false,
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  directional = false,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, directional, className }))}
      {...props}
    />
  )
}

type ButtonLinkProps = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>

/** Link semantics with the shared button appearance. Base UI Button is only used for actions. */
function ButtonLink({
  className,
  variant = "default",
  size = "default",
  directional = false,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-slot="button-link"
      className={cn(buttonVariants({ variant, size, directional, className }))}
      {...props}
    />
  )
}

export { Button, ButtonLink, buttonVariants }
