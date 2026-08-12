"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoordinateSystem, DEFAULT_DOMAIN } from "./CoordinateSystem";
import { toPixel, type PlotDomain } from "./utils";
import { cn } from "@/lib/utils";

export type VectorAnimationProps = {
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  domain?: PlotDomain;
  showMagnitude?: boolean;
  className?: string;
};

/**
 * A real vector, drawn with the correct direction and an arrowhead angled
 * to match — the "find your path / direction" motif. MASTER.md §11.
 */
export function VectorAnimation({
  from = { x: 0, y: 0 },
  to = { x: 3.5, y: 2.5 },
  domain = DEFAULT_DOMAIN,
  showMagnitude = true,
  className,
}: VectorAnimationProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;

  const start = toPixel(from.x, from.y, domain);
  const end = toPixel(to.x, to.y, domain);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const arrowLength = 9;
  const arrowSpread = 0.45;

  const arrowP1 = {
    x: end.x - arrowLength * Math.cos(angle - arrowSpread),
    y: end.y - arrowLength * Math.sin(angle - arrowSpread),
  };
  const arrowP2 = {
    x: end.x - arrowLength * Math.cos(angle + arrowSpread),
    y: end.y - arrowLength * Math.sin(angle + arrowSpread),
  };

  const magnitude = Math.hypot(to.x - from.x, to.y - from.y);
  const labelPos = toPixel((from.x + to.x) / 2 + 0.3, (from.y + to.y) / 2 + 0.35, domain);

  return (
    <CoordinateSystem domain={domain} className={cn(className)}>
      <motion.line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="var(--brand-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: skip ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: skip ? 0 : 0.7, delay: skip ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.polygon
        points={`${end.x},${end.y} ${arrowP1.x},${arrowP1.y} ${arrowP2.x},${arrowP2.y}`}
        fill="var(--brand-accent)"
        initial={{ opacity: skip ? 1 : 0, scale: skip ? 1 : 0.4 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: skip ? 0 : 0.25, delay: skip ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${end.x}px ${end.y}px` }}
      />
      {showMagnitude && (
        <motion.text
          x={labelPos.x}
          y={labelPos.y}
          fontSize={10}
          fill="var(--muted-foreground)"
          initial={{ opacity: skip ? 1 : 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: skip ? 0 : 0.3, delay: skip ? 0 : 1.05 }}
        >
          {`|v| = ${magnitude.toFixed(1)}`}
        </motion.text>
      )}
    </CoordinateSystem>
  );
}
