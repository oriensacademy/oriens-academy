"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

type RouteLineProps = {
  /** SVG path data connecting `start` to `end`. */
  d: string;
  start: Point;
  end: Point;
  viewBox?: string;
  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
  dashed?: boolean;
  showEndpoints?: boolean;
  duration?: number;
  delay?: number;
};

/**
 * A drawn route/trajectory line — the "you are being guided toward a
 * destination" motif (MASTER.md §10, DESIGN.md §7). Draws once when it
 * enters the viewport and stays drawn; never loops.
 */
export function RouteLine({
  d,
  start,
  end,
  viewBox = "0 0 400 200",
  className,
  strokeColor = "var(--secondary)",
  strokeWidth = 1.5,
  dashed = true,
  showEndpoints = true,
  duration = 1.1,
  delay = 0,
}: RouteLineProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;

  return (
    <svg viewBox={viewBox} className={cn(className)} fill="none" aria-hidden="true">
      <motion.path
        d={d}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dashed ? "3 6" : undefined}
        initial={{ pathLength: skip ? 1 : 0, opacity: skip ? 1 : 0.5 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{
          duration: skip ? 0 : duration,
          delay: skip ? 0 : delay,
          ease: [0.22, 1, 0.36, 1],
        }}
      />
      {showEndpoints && (
        <>
          <motion.circle
            cx={start.x}
            cy={start.y}
            r={3}
            fill="var(--ink)"
            initial={{ opacity: skip ? 1 : 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.2, delay: skip ? 0 : delay }}
          />
          <motion.circle
            cx={end.x}
            cy={end.y}
            r={4}
            fill="var(--brand-accent)"
            initial={{ opacity: skip ? 1 : 0, scale: skip ? 1 : 0.4 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{
              duration: skip ? 0 : 0.3,
              delay: skip ? 0 : delay + duration * 0.85,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        </>
      )}
    </svg>
  );
}
