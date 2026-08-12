"use client";

import { motion, useReducedMotion } from "motion/react";
import { plotPath, type PlotDomain } from "./utils";
import { cn } from "@/lib/utils";

export type MathBackgroundProps = {
  className?: string;
  domain?: PlotDomain;
  /** Final opacity of the whole layer once faded in — keep low, it's a backdrop. */
  opacity?: number;
};

const DEFAULT_BG_DOMAIN: PlotDomain = {
  xMin: -8,
  xMax: 8,
  yMin: -5,
  yMax: 5,
  width: 640,
  height: 480,
  padding: 0,
};

/**
 * Ambient backdrop only — a light coordinate grid and one faint curve,
 * always subordinate to the headline it sits behind. MASTER.md §11: low
 * opacity/contrast, never competes with foreground copy. Not decorative
 * noise: still a real function, just quiet.
 */
export function MathBackground({
  className,
  domain = DEFAULT_BG_DOMAIN,
  opacity = 1,
}: MathBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;
  const { xMin, xMax, width, height } = domain;

  const gridStepX = width / (xMax - xMin);
  const verticalLines = Array.from({ length: xMax - xMin + 1 }, (_, i) => i * gridStepX);
  const gridStepY = height / (domain.yMax - domain.yMin);
  const horizontalLines = Array.from(
    { length: domain.yMax - domain.yMin + 1 },
    (_, i) => i * gridStepY
  );

  const curve = plotPath((x) => 0.9 * Math.sin(0.6 * x) + 0.15 * x, domain, 160);

  return (
    <motion.svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-full w-full", className)}
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity }}
      transition={{ duration: skip ? 0 : 1.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <g opacity={0.16} stroke="var(--secondary)" strokeWidth={1}>
        {verticalLines.map((x, i) => (
          <line key={`v-${i}`} x1={x} y1={0} x2={x} y2={height} />
        ))}
        {horizontalLines.map((y, i) => (
          <line key={`h-${i}`} x1={0} y1={y} x2={width} y2={y} />
        ))}
      </g>
      <path d={curve} fill="none" stroke="var(--brand-accent)" strokeWidth={1.5} opacity={0.2} />
    </motion.svg>
  );
}
