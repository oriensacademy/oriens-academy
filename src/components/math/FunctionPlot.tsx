"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoordinateSystem } from "./CoordinateSystem";
import { plotPath, type PlotDomain } from "./utils";
import { cn } from "@/lib/utils";

export type FunctionPlotProps = {
  fn?: (x: number) => number;
  domain?: PlotDomain;
  strokeColor?: string;
  className?: string;
};

/** A monotonically improving curve — the natural shape of measured progress. */
const DEFAULT_PROGRESS_DOMAIN: PlotDomain = {
  xMin: 0,
  xMax: 10,
  yMin: 0,
  yMax: 5,
  width: 320,
  height: 220,
  padding: 20,
};

/**
 * A general-purpose real function plot — used wherever the story is
 * "results improving over time" (MASTER.md §11: FunctionPlot → data-driven
 * results, "track your progress"). Default curve is f(x) = 1.7·ln(x + 1),
 * a genuine logarithmic growth function, not a decorative squiggle.
 */
export function FunctionPlot({
  fn = (x: number) => 1.7 * Math.log(x + 1),
  domain = DEFAULT_PROGRESS_DOMAIN,
  strokeColor = "var(--brand-accent)",
  className,
}: FunctionPlotProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;
  const d = plotPath(fn, domain);

  return (
    <CoordinateSystem domain={domain} className={cn(className)}>
      <motion.path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: skip ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: skip ? 0 : 0.9, delay: skip ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </CoordinateSystem>
  );
}
