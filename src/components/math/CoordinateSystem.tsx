"use client";

import { motion, useReducedMotion } from "motion/react";
import { toPixel, type PlotDomain } from "./utils";
import { cn } from "@/lib/utils";

export type CoordinateSystemProps = {
  domain?: PlotDomain;
  /** Draw faint gridlines at each integer step. */
  showGrid?: boolean;
  /** Draw small tick marks on the axes. */
  showTicks?: boolean;
  /** Draw arrowheads at the positive ends of both axes. */
  showArrows?: boolean;
  className?: string;
  strokeColor?: string;
  gridColor?: string;
  /** When false, renders instantly with no draw-in animation (e.g. inside MathBackground). */
  animate?: boolean;
  children?: React.ReactNode;
};

const DEFAULT_DOMAIN: PlotDomain = {
  xMin: -5,
  xMax: 5,
  yMin: -3,
  yMax: 5,
  width: 320,
  height: 220,
  padding: 20,
};

/**
 * The shared axes primitive for the mathematical visual system. Draws a
 * real Cartesian grid — origin, integer gridlines and ticks — that every
 * other math component (parabola, vector, sine wave, tangent) composes
 * with. MASTER.md §11 / DESIGN.md §8: precise, annotated, never decorative.
 */
export function CoordinateSystem({
  domain = DEFAULT_DOMAIN,
  showGrid = true,
  showTicks = true,
  showArrows = true,
  className,
  strokeColor = "var(--secondary)",
  gridColor = "var(--border)",
  animate = true,
  children,
}: CoordinateSystemProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !animate || !!prefersReducedMotion;
  const { xMin, xMax, yMin, yMax, width, height } = domain;

  const origin = toPixel(0, 0, domain);
  const xAxisStart = toPixel(xMin, 0, domain);
  const xAxisEnd = toPixel(xMax, 0, domain);
  const yAxisStart = toPixel(0, yMin, domain);
  const yAxisEnd = toPixel(0, yMax, domain);

  const xTicks = Array.from(
    { length: Math.floor(xMax) - Math.ceil(xMin) + 1 },
    (_, i) => Math.ceil(xMin) + i
  ).filter((v) => v !== 0);
  const yTicks = Array.from(
    { length: Math.floor(yMax) - Math.ceil(yMin) + 1 },
    (_, i) => Math.ceil(yMin) + i
  ).filter((v) => v !== 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("h-auto w-full", className)}
      aria-hidden="true"
    >
      {showGrid &&
        xTicks.map((x) => {
          const top = toPixel(x, yMax, domain);
          const bottom = toPixel(x, yMin, domain);
          return (
            <line
              key={`grid-x-${x}`}
              x1={top.x}
              y1={top.y}
              x2={bottom.x}
              y2={bottom.y}
              stroke={gridColor}
              strokeWidth={1}
            />
          );
        })}
      {showGrid &&
        yTicks.map((y) => {
          const left = toPixel(xMin, y, domain);
          const right = toPixel(xMax, y, domain);
          return (
            <line
              key={`grid-y-${y}`}
              x1={left.x}
              y1={left.y}
              x2={right.x}
              y2={right.y}
              stroke={gridColor}
              strokeWidth={1}
            />
          );
        })}

      <motion.line
        x1={xAxisStart.x}
        y1={xAxisStart.y}
        x2={xAxisEnd.x}
        y2={xAxisEnd.y}
        stroke={strokeColor}
        strokeWidth={1.5}
        initial={{ pathLength: skip ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: skip ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.line
        x1={yAxisStart.x}
        y1={yAxisStart.y}
        x2={yAxisEnd.x}
        y2={yAxisEnd.y}
        stroke={strokeColor}
        strokeWidth={1.5}
        initial={{ pathLength: skip ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: skip ? 0 : 0.5, delay: skip ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
      />

      {showArrows && (
        <>
          <polygon
            points={`${xAxisEnd.x},${xAxisEnd.y} ${xAxisEnd.x - 6},${xAxisEnd.y - 3.5} ${xAxisEnd.x - 6},${xAxisEnd.y + 3.5}`}
            fill={strokeColor}
          />
          <polygon
            points={`${yAxisEnd.x},${yAxisEnd.y} ${yAxisEnd.x - 3.5},${yAxisEnd.y + 6} ${yAxisEnd.x + 3.5},${yAxisEnd.y + 6}`}
            fill={strokeColor}
          />
        </>
      )}

      {showTicks &&
        xTicks.map((x) => {
          const p = toPixel(x, 0, domain);
          return (
            <line
              key={`tick-x-${x}`}
              x1={p.x}
              y1={p.y - 3}
              x2={p.x}
              y2={p.y + 3}
              stroke={strokeColor}
              strokeWidth={1}
            />
          );
        })}
      {showTicks &&
        yTicks.map((y) => {
          const p = toPixel(0, y, domain);
          return (
            <line
              key={`tick-y-${y}`}
              x1={p.x - 3}
              y1={p.y}
              x2={p.x + 3}
              y2={p.y}
              stroke={strokeColor}
              strokeWidth={1}
            />
          );
        })}

      <circle cx={origin.x} cy={origin.y} r={2} fill={strokeColor} />

      {children}
    </svg>
  );
}

export { DEFAULT_DOMAIN };
