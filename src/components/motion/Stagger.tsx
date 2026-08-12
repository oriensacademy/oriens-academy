"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

type StaggerGroupProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds between each child's entrance. Kept small per MASTER.md §12 (30–50ms). */
  step?: number;
};

/**
 * Wraps a set of `StaggerItem` children so they enter in a quick cascade
 * when the group scrolls into view. Used for feature grids, program lists,
 * and card rows — capped implicitly by keeping lists short (MASTER.md §12:
 * batch-fade instead beyond ~8 items).
 */
export function StaggerGroup({ children, className, step = 0.045 }: StaggerGroupProps) {
  const prefersReducedMotion = useReducedMotion();
  const container: Variants = {
    hidden: {},
    visible: {
      transition: prefersReducedMotion
        ? { staggerChildren: 0 }
        : { staggerChildren: step, delayChildren: 0.05 },
    },
  };

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={container}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const item: Variants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.div className={cn(className)} variants={item}>
      {children}
    </motion.div>
  );
}
