"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

export function PublicPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={reducedMotion ? false : { opacity: 0.96, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="w-full flex-1"
    >
      {children}
    </motion.div>
  );
}

export default PublicPageTransition;
