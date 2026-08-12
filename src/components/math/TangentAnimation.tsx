"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoordinateSystem, DEFAULT_DOMAIN } from "./CoordinateSystem";
import { derivative, plotPath, toPixel, type PlotDomain } from "./utils";
import { cn } from "@/lib/utils";

export type TangentAnimationProps = {
  fn?: (x: number) => number;
  /** The x-coordinate where the tangent line is evaluated. */
  at?: number;
  domain?: PlotDomain;
  className?: string;
};

/**
 * A curve with its true tangent line at a point — slope computed from a
 * real numerical derivative, not an approximated decoration. Represents
 * precision / instant feedback. MASTER.md §11.
 */
export function TangentAnimation({
  fn = (x: number) => 0.18 * x * x * x - 0.4 * x + 0.6,
  at = 1.4,
  domain = DEFAULT_DOMAIN,
  className,
}: TangentAnimationProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;

  const curvePath = plotPath(fn, domain, 120);
  const slope = derivative(fn, at);
  const y0 = fn(at);

  const { xMin, xMax } = domain;
  const tangentX1 = Math.max(xMin, at - 2.2);
  const tangentX2 = Math.min(xMax, at + 2.2);
  const tangentP1 = toPixel(tangentX1, y0 + slope * (tangentX1 - at), domain);
  const tangentP2 = toPixel(tangentX2, y0 + slope * (tangentX2 - at), domain);
  const point = toPixel(at, y0, domain);

  return (
    <CoordinateSystem domain={domain} className={cn(className)}>
      <motion.path
        d={curvePath}
        fill="none"
        stroke="var(--secondary)"
        strokeWidth={1.75}
        strokeLinecap="round"
        initial={{ pathLength: skip ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: skip ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.line
        x1={tangentP1.x}
        y1={tangentP1.y}
        x2={tangentP2.x}
        y2={tangentP2.y}
        stroke="var(--brand-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: skip ? 1 : 0, opacity: skip ? 1 : 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: skip ? 0 : 0.5, delay: skip ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx={point.x}
        cy={point.y}
        r={3.5}
        fill="var(--brand-accent)"
        initial={{ opacity: skip ? 1 : 0, scale: skip ? 1 : 0.4 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: skip ? 0 : 0.25, delay: skip ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
      />
    </CoordinateSystem>
  );
}
