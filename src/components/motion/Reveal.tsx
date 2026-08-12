"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
};

/**
 * The shared scroll-reveal used across every below-the-fold section:
 * fade + small upward drift, plays once, respects reduced motion.
 * MASTER.md §12 content-reveal timing (400–700ms).
 */
export function Reveal({ children, className, delay = 0, y = 16, duration = 0.55 }: RevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: skip ? 1 : 0, y: skip ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: skip ? 0 : duration, delay: skip ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
