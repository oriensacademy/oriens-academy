"use client";

import { motion, useReducedMotion } from "motion/react";
import { CompassMark } from "@/components/brand/CompassMark";
import { EquationReveal } from "@/components/math/EquationReveal";
import { plotPath, toPixel, type PlotDomain } from "@/components/math/utils";
import { useLoaderReveal } from "@/components/brand/loader-context";
import { cn } from "@/lib/utils";

const SIZE = 480;

const domain: PlotDomain = {
  xMin: -6,
  xMax: 6,
  yMin: -1.5,
  yMax: 7.5,
  width: SIZE,
  height: SIZE,
  padding: 44,
};

const fn = (x: number) => 0.32 * x * x - 0.3;

const routeStart = { x: -4.7, y: 0.4 };
const routeEnd = { x: 4.5, y: 6.6 };

/**
 * The hero's signature visual: one coordinate frame carrying a real
 * function curve, a drawn route from a starting point to the compass
 * marking the destination, and an equation annotation — a single
 * composition, not a collage. DESIGN.md §9.
 */
export function HeroVisual({ className }: { className?: string }) {
  const revealed = useLoaderReveal();
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;
  const show = skip || revealed;

  const curvePath = plotPath(fn, domain, 100);
  const startPx = toPixel(routeStart.x, routeStart.y, domain);
  const endPx = toPixel(routeEnd.x, routeEnd.y, domain);
  const controlPx = {
    x: (startPx.x + endPx.x) / 2,
    y: Math.min(startPx.y, endPx.y) - 46,
  };
  const routePath = `M${startPx.x.toFixed(1)},${startPx.y.toFixed(1)} Q${controlPx.x.toFixed(1)},${controlPx.y.toFixed(1)} ${endPx.x.toFixed(1)},${endPx.y.toFixed(1)}`;

  const originAxis = toPixel(0, 0, domain);
  const xAxisStart = toPixel(domain.xMin, 0, domain);
  const xAxisEnd = toPixel(domain.xMax, 0, domain);
  const yAxisStart = toPixel(0, domain.yMin, domain);
  const yAxisEnd = toPixel(0, domain.yMax, domain);

  const compassLeft = (endPx.x / SIZE) * 100;
  const compassTop = (endPx.y / SIZE) * 100;

  return (
    <div className={cn("relative aspect-square w-full max-w-[480px]", className)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <line
          x1={xAxisStart.x}
          y1={xAxisStart.y}
          x2={xAxisEnd.x}
          y2={xAxisEnd.y}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <line
          x1={yAxisStart.x}
          y1={yAxisStart.y}
          x2={yAxisEnd.x}
          y2={yAxisEnd.y}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <circle cx={originAxis.x} cy={originAxis.y} r={2} fill="var(--secondary)" />

        <motion.path
          d={curvePath}
          fill="none"
          stroke="var(--secondary)"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: skip ? 1 : 0 }}
          animate={{ pathLength: show ? 1 : 0 }}
          transition={{ duration: skip ? 0 : 0.9, delay: skip ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
        />

        <motion.path
          d={routePath}
          fill="none"
          stroke="var(--brand-accent)"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeDasharray="3 6"
          initial={{ pathLength: skip ? 1 : 0, opacity: skip ? 1 : 0 }}
          animate={{ pathLength: show ? 1 : 0, opacity: show ? 1 : 0 }}
          transition={{ duration: skip ? 0 : 0.9, delay: skip ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.circle
          cx={startPx.x}
          cy={startPx.y}
          r={3}
          fill="var(--ink)"
          initial={{ opacity: skip ? 1 : 0 }}
          animate={{ opacity: show ? 1 : 0 }}
          transition={{ duration: skip ? 0 : 0.25, delay: skip ? 0 : 0.55 }}
        />
      </svg>

      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${compassLeft}%`, top: `${compassTop}%` }}
        initial={{ opacity: skip ? 1 : 0, scale: skip ? 1 : 0.6 }}
        animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.6 }}
        transition={{ duration: skip ? 0 : 0.4, delay: skip ? 0 : 1.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <CompassMark size={52} />
      </motion.div>

      <motion.div
        className="absolute top-[6%] left-[6%] hidden max-w-[11rem] md:block"
        initial={{ opacity: skip ? 1 : 0 }}
        animate={{ opacity: show ? 1 : 0 }}
        transition={{ duration: skip ? 0 : 0.4, delay: skip ? 0 : 1.1 }}
      >
        <EquationReveal
          latex="f(x) = 0.32x^{2} - 0.3"
          className="text-xs text-muted-foreground"
          delay={0}
        />
      </motion.div>
    </div>
  );
}
