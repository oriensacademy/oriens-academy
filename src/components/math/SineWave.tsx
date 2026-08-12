"use client";

import { motion, useReducedMotion } from "motion/react";
import { CoordinateSystem } from "./CoordinateSystem";
import { plotPath, type PlotDomain } from "./utils";
import { cn } from "@/lib/utils";

export type SineWaveProps = {
  amplitude?: number;
  frequency?: number;
  phase?: number;
  domain?: PlotDomain;
  strokeColor?: string;
  className?: string;
};

const DEFAULT_WAVE_DOMAIN: PlotDomain = {
  xMin: -6.5,
  xMax: 6.5,
  yMin: -2.2,
  yMax: 2.2,
  width: 320,
  height: 180,
  padding: 16,
};

/**
 * A real sine curve y = A·sin(f·x + φ) — the rhythm/consistency motif for
 * study routines and steady progress. MASTER.md §11.
 */
export function SineWave({
  amplitude = 1.5,
  frequency = 0.75,
  phase = 0,
  domain = DEFAULT_WAVE_DOMAIN,
  strokeColor = "var(--secondary)",
  className,
}: SineWaveProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;
  const fn = (x: number) => amplitude * Math.sin(frequency * x + phase);
  const d = plotPath(fn, domain, 140);

  return (
    <CoordinateSystem domain={domain} showGrid={false} showArrows={false} className={cn(className)}>
      <motion.path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.75}
        strokeLinecap="round"
        initial={{ pathLength: skip ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: skip ? 0 : 1.1, delay: skip ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
      />
    </CoordinateSystem>
  );
}
