"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCommonContent } from "@/content/locale-context";
import { cn } from "@/lib/utils";

type OriensWordmarkProps = {
  animated?: boolean;
  layout?: "inline" | "stacked";
  size?: "sm" | "md" | "lg";
  className?: string;
  delay?: number;
};

const primarySizes = { sm: "text-base", md: "text-lg", lg: "text-xl" } as const;
const secondarySizes = { sm: "text-[9px]", md: "text-[10px]", lg: "text-[10px]" } as const;

/** Shared stable/animated ORIENS Academy lockup for navigation and transition moments. */
export function OriensWordmark({
  animated = false,
  layout = "inline",
  size = "md",
  className,
  delay = 0,
}: OriensWordmarkProps) {
  const { nav } = useCommonContent();
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animated && !reducedMotion;

  return (
    <span
      className={cn(
        "flex",
        layout === "stacked" ? "flex-col items-center gap-1.5" : "items-baseline gap-2",
        className
      )}
    >
      <motion.span
        className={cn("font-heading font-medium text-ink", primarySizes[size])}
        initial={shouldAnimate ? { opacity: 0, x: -4, letterSpacing: "0.2em" } : false}
        animate={{ opacity: 1, x: 0, letterSpacing: "0.1em" }}
        transition={{ duration: shouldAnimate ? 0.24 : 0, delay: shouldAnimate ? delay : 0, ease: [0.22, 1, 0.36, 1] }}
      >
        {nav.wordmark}
      </motion.span>
      <motion.span
        className={cn(
          "font-sans font-medium tracking-[0.26em] text-muted-foreground uppercase",
          secondarySizes[size],
          layout === "inline" && "hidden sm:inline"
        )}
        initial={shouldAnimate ? { opacity: 0, y: 3 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldAnimate ? 0.22 : 0, delay: shouldAnimate ? delay + 0.1 : 0, ease: [0.22, 1, 0.36, 1] }}
      >
        {nav.wordmarkSub}
      </motion.span>
    </span>
  );
}
