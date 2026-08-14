"use client";

import { motion, useReducedMotion } from "motion/react";
import { AcademicIcon } from "@/components/academic/AcademicIcon";

type AcademicDepthVisualProps = {
  ariaLabel: string;
  labels: { function: string; tangent: string; point: string };
  note?: string;
  compact?: boolean;
};

export function AcademicDepthVisual({ ariaLabel, labels, note, compact = false }: AcademicDepthVisualProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const stages = [labels.function, labels.tangent, labels.point];

  return (
    <div role="img" aria-label={ariaLabel} className="relative w-full min-w-0 max-w-full overflow-hidden border border-border bg-surface p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <span className="font-heading text-sm text-secondary">Oriens academic support</span>
        {note && <span className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">{note}</span>}
      </div>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: reducedMotion ? 0 : 0.45 }}
        className={compact ? "grid min-h-64 place-items-center" : "grid min-h-80 place-items-center"}
      >
        <AcademicIcon type="university" size={compact ? 120 : 160} className="text-[#10271B]" />
      </motion.div>
      <ol className="grid grid-cols-3 border-t border-border pt-4 text-xs text-muted-foreground">
        {stages.map((stage, index) => <li key={stage} className={index === 1 ? "text-center" : index === 2 ? "text-right" : undefined}>{stage}</li>)}
      </ol>
    </div>
  );
}
