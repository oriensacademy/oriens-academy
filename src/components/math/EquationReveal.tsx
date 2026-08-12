"use client";

import { useMemo } from "react";
import katex from "katex";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type EquationRevealProps = {
  /** LaTeX source, e.g. "f(x) = ax^2 + bx + c". */
  latex: string;
  className?: string;
  delay?: number;
};

/**
 * Renders real mathematical notation via KaTeX and reveals it with a
 * short fade — used for credential/subject callouts (e.g. calculus,
 * physics). MASTER.md §11.
 */
export function EquationReveal({ latex, className, delay = 0 }: EquationRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;

  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
      }),
    [latex]
  );

  return (
    <motion.span
      className={cn("text-ink [&_.katex]:text-[1em]", className)}
      initial={{ opacity: skip ? 1 : 0, y: skip ? 0 : 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: skip ? 0 : 0.45, delay: skip ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
