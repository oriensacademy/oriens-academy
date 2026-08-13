"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type TextRotateProps = {
  texts: string[];
  className?: string;
  rotationInterval?: number;
};

export function TextRotate({ texts, className, rotationInterval = 2500 }: TextRotateProps) {
  const [index, setIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || texts.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % texts.length), rotationInterval);
    return () => window.clearInterval(timer);
  }, [reducedMotion, rotationInterval, texts.length]);

  return <span className={cn("relative inline-grid min-h-[1.35em] min-w-[6.5ch] overflow-hidden align-middle", className)} aria-live="polite">
    <span className="invisible col-start-1 row-start-1" aria-hidden="true">IGCSE</span>
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={texts[index]} className="col-start-1 row-start-1" initial={reducedMotion ? false : { opacity: 0, y: "80%" }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: "-80%" }} transition={{ duration: reducedMotion ? 0 : .3, ease: [0.22, 1, 0.36, 1] }}>{texts[index]}</motion.span>
    </AnimatePresence>
  </span>;
}

export default TextRotate;
