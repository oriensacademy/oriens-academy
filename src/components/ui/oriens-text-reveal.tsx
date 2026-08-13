"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type TextRevealProps = {
  text: string;
  className?: string;
  preset?: "fade-in-blur" | "slide";
  per?: "word" | "character";
  delay?: number;
  speedReveal?: number;
  speedSegment?: number;
  play?: boolean;
};

export function TextReveal({ text, className, preset = "fade-in-blur", per = "word", delay = .08, speedReveal = 1.4, speedSegment = 1.2, play = true }: TextRevealProps) {
  const reducedMotion = useReducedMotion();
  const segments = per === "character" ? Array.from(text) : text.split(" ");
  const duration = Math.max(.18, .42 / speedSegment);
  const stagger = Math.max(.018, .055 / speedReveal);

  return <span className={cn("inline", className)} aria-label={text}>
    {segments.map((segment, index) => <motion.span
      key={`${segment}-${index}`}
      aria-hidden="true"
      className="inline-block"
      initial={reducedMotion ? false : preset === "slide" ? { opacity: 0, y: "70%" } : { opacity: 0, y: 8, filter: "blur(6px)" }}
      animate={play || reducedMotion ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
      transition={{ duration: reducedMotion ? 0 : duration, delay: reducedMotion ? 0 : delay + index * stagger, ease: [0.22, 1, 0.36, 1] }}
    >{segment}{per === "word" && index < segments.length - 1 ? "\u00a0" : null}</motion.span>)}
  </span>;
}

export default TextReveal;
