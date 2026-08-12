"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoordinateSystem, DEFAULT_DOMAIN } from "./CoordinateSystem";
import { plotPath, toPixel, type PlotDomain } from "./utils";
import { cn } from "@/lib/utils";

export type AnimatedParabolaProps = {
  /** y = a·x² + c — defaults describe a real upward parabola with roots at ±√(c/-a). */
  a?: number;
  c?: number;
  domain?: PlotDomain;
  showVertex?: boolean;
  className?: string;
};

/**
 * A genuine quadratic curve (SAT/AP/IB exam-math territory) — used to
 * represent exam preparation and the Oriens Method. MASTER.md §11.
 */
export function AnimatedParabola({
  a = 0.55,
  c = -2.2,
  domain = DEFAULT_DOMAIN,
  showVertex = true,
  className,
}: AnimatedParabolaProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;
  const fn = (x: number) => a * x * x + c;
  const d = plotPath(fn, domain);
  const vertex = toPixel(0, c, domain);

  return (
    <CoordinateSystem domain={domain} className={cn(className)}>
      <motion.path
        d={d}
        fill="none"
        stroke="var(--brand-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: skip ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: skip ? 0 : 0.9, delay: skip ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      />
      {showVertex && (
        <motion.circle
          cx={vertex.x}
          cy={vertex.y}
          r={3.5}
          fill="var(--surface)"
          stroke="var(--brand-accent)"
          strokeWidth={2}
          initial={{ opacity: skip ? 1 : 0, scale: skip ? 1 : 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: skip ? 0 : 0.3, delay: skip ? 0 : 1.05, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </CoordinateSystem>
  );
}
