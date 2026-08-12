"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";

type CompassNeedleProps = {
  /** Degrees, 0 = due north (up). Pass an array for a keyframe sweep. */
  rotation?: number | number[];
  /** Half-length of the north point, in the 100x100 viewBox's units. */
  size?: number;
  /** Skip animation and jump straight to the resting rotation. */
  instant?: boolean;
  /**
   * When set, the needle animates from this rotation to `rotation` once on
   * mount, instead of appearing directly at rest (the default, used by the
   * static logo mark and the loader's own choreographed sequence). Opt-in
   * only — existing call sites are unaffected.
   */
  revealFrom?: number;
  transition?: Transition;
  className?: string;
};

/**
 * The needle is the one place accent bronze appears as a large fill —
 * MASTER.md §10: "accent bronze reserved for the needle only."
 * North half is accent (the destination); south half is compass-navy
 * (the counterweight) — a real compass needle's asymmetry, not a symbol.
 */
export function CompassNeedle({
  rotation = 0,
  size = 30,
  instant = false,
  revealFrom,
  transition,
  className,
}: CompassNeedleProps) {
  const prefersReducedMotion = useReducedMotion();
  const skipAnimation = instant || prefersReducedMotion;

  const northLength = size;
  const southLength = size * 0.6;
  const width = size * 0.15;
  const pivotRadius = width * 0.95;

  return (
    <motion.g
      className={className}
      style={{ transformOrigin: "50px 50px" }}
      initial={revealFrom !== undefined && !skipAnimation ? { rotate: revealFrom } : false}
      animate={{ rotate: rotation }}
      transition={
        skipAnimation
          ? { duration: 0 }
          : (transition ?? { type: "spring", stiffness: 120, damping: 14 })
      }
    >
      <polygon
        points={`50,${50 - northLength} ${50 - width},50 ${50 + width},50`}
        fill="var(--brand-accent)"
      />
      <polygon
        points={`50,${50 + southLength} ${50 - width * 0.8},50 ${50 + width * 0.8},50`}
        fill="var(--secondary)"
      />
      <circle
        cx="50"
        cy="50"
        r={pivotRadius}
        fill="var(--surface)"
        stroke="var(--ink)"
        strokeWidth={1.25}
      />
    </motion.g>
  );
}
