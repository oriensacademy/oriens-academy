"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type SplitFlapDisplayProps = {
  text: string;
  className?: string;
};

/**
 * A restrained, modern interpretation of an airport split-flap board — a
 * single flipping word, not a literal black-panel LED clone. Rotates
 * gently around its own center (light `rotateX` + opacity), never a full
 * mechanical 90° hinge. Under reduced motion this collapses to a plain
 * cross-fade.
 */
export function SplitFlapDisplay({ text, className }: SplitFlapDisplayProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;

  return (
    <span
      className={cn("relative inline-block overflow-hidden align-middle", className)}
      style={{ perspective: skip ? undefined : "420px" }}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className="inline-block"
          style={{ transformOrigin: "center" }}
          initial={{ opacity: 0, rotateX: skip ? 0 : 55 }}
          animate={{ opacity: 1, rotateX: 0 }}
          exit={{ opacity: 0, rotateX: skip ? 0 : -55 }}
          transition={{ duration: skip ? 0.2 : 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
