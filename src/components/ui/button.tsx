import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-ui text-sm font-semibold whitespace-nowrap transition-all duration-200 ease-out outline-none select-none cursor-pointer active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* Primary CTA — Muted Sage Fill (Requirement 15) */
        default:
          "bg-[#819586] text-white hover:bg-[#718678] hover:-translate-y-0.5 shadow-[0_5px_14px_rgba(16,39,27,0.10)] focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-2",
        /* Secondary CTA — Ivory/Sage Outline (Requirement 16) */
        outline:
          "border border-[#DDE4DC] bg-white text-[#10271B] hover:bg-[#E8EEE8]/60 hover:border-[#819586] focus-visible:ring-2 focus-visible:ring-[#819586]",
        /* Strong Forest Fill — Accent variant */
        secondary:
          "bg-[#10271B] text-white hover:bg-[#0D2A1C] hover:-translate-y-0.5 shadow-sm focus-visible:ring-2 focus-visible:ring-[#10271B]",
        /* Ghost / Text Link */
        ghost:
          "text-[#10271B] hover:bg-[#E8EEE8]/50 hover:text-[#0D2A1C]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-destructive/20",
        link: "text-[#10271B] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 py-2.5",
        xs: "h-7 gap-1 rounded-md px-2.5 text-xs",
        sm: "h-8.5 gap-1.5 rounded-md px-3 text-xs",
        lg: "h-11.5 gap-2 px-5 py-3 text-sm",
        icon: "size-9 rounded-md",
        "icon-xs": "size-7 rounded-md",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10 rounded-md",
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
);

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
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

/** Link semantics with shared button appearance */
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
  );
}

export { Button, ButtonLink, buttonVariants };
