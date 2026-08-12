"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CompassNeedle } from "./CompassNeedle";
import { cn } from "@/lib/utils";

type CompassMarkProps = {
  /** Pixel size of the rendered mark (square). */
  size?: number;
  /** Resting rotation in degrees. 0 = north. */
  rotation?: number;
  /** Rotate the needle slightly toward the accent on hover/focus. */
  interactive?: boolean;
  className?: string;
  /** Provide only when the mark stands alone (not beside the wordmark). */
  title?: string;
  /** Draw the drafting geometry and search/settle the needle once. */
  animated?: boolean;
  needleSequence?: number[];
  animationDelay?: number;
};

/**
 * The Oriens brand mark — thin drafting/cartographic geometry, never a
 * generic downloaded compass icon. See MASTER.md §10 and DESIGN.md §7.
 */
export function CompassMark({
  size = 32,
  rotation = 0,
  interactive = false,
  className,
  title,
  animated = false,
  needleSequence = [0, -32, 20, -7, 0],
  animationDelay = 0,
}: CompassMarkProps) {
  const [active, setActive] = useState(false);
  const reducedMotion = useReducedMotion();
  const draw = animated && !reducedMotion;
  const effectiveRotation = interactive && active ? rotation + 12 : rotation;
  const structuralStroke = size <= 20 ? 1.4 : size <= 40 ? 1.5 : 1.7;
  const showMinorTicks = size >= 28;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={cn(interactive && "cursor-pointer", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      onMouseEnter={() => interactive && setActive(true)}
      onMouseLeave={() => interactive && setActive(false)}
      onFocus={() => interactive && setActive(true)}
      onBlur={() => interactive && setActive(false)}
    >
      <motion.circle
        cx="50"
        cy="50"
        r="39"
        stroke="var(--ink)"
        strokeWidth={structuralStroke}
        vectorEffect="non-scaling-stroke"
        initial={draw ? { pathLength: 0, opacity: 0.35 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: draw ? 0.3 : 0, delay: animationDelay, ease: [0.22, 1, 0.36, 1] }}
      />

      <motion.path
        d="M50 18 A32 32 0 0 1 82 50 M50 82 A32 32 0 0 1 18 50"
        stroke="var(--secondary)"
        strokeWidth={structuralStroke * 0.62}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={draw ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 0.72 }}
        transition={{ duration: draw ? 0.32 : 0, delay: animationDelay + 0.06, ease: [0.22, 1, 0.36, 1] }}
      />

      {[0, 90, 180, 270].map((deg, index) => (
        <motion.line
          key={deg}
          x1="50"
          y1="7"
          x2="50"
          y2={deg === 0 ? "18" : "15"}
          stroke="var(--ink)"
          strokeWidth={deg === 0 ? structuralStroke * 1.12 : structuralStroke * 0.82}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ transformOrigin: "50px 50px", rotate: `${deg}deg` }}
          initial={draw ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: draw ? 0.16 : 0, delay: animationDelay + 0.08 + index * 0.025 }}
        />
      ))}

      {showMinorTicks &&
        [45, 135, 225, 315].map((deg, index) => (
          <motion.line
            key={deg}
            x1="50"
            y1="10"
            x2="50"
            y2="14"
            stroke="var(--secondary)"
            strokeWidth={structuralStroke * 0.55}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ transformOrigin: "50px 50px", rotate: `${deg}deg` }}
            initial={draw ? { opacity: 0 } : false}
            animate={{ opacity: 0.8 }}
            transition={{ duration: draw ? 0.14 : 0, delay: animationDelay + 0.15 + index * 0.02 }}
          />
        ))}

      <CompassNeedle
        rotation={draw ? needleSequence : effectiveRotation}
        size={size <= 20 ? 24 : 27}
        instant={!interactive && !draw}
        transition={draw ? { duration: 0.46, delay: animationDelay + 0.16, times: [0, 0.3, 0.62, 0.82, 1], ease: "easeInOut" } : undefined}
      />
    </svg>
  );
}
