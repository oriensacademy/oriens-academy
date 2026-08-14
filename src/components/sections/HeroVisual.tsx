"use client";

import { motion, useReducedMotion } from "motion/react";
import { AcademicIcon } from "@/components/academic/AcademicIcon";
import { useLoaderReveal } from "@/components/brand/loader-context";
import { cn } from "@/lib/utils";

export function HeroVisual({ className }: { className?: string }) {
  const revealed = useLoaderReveal();
  const reducedMotion = Boolean(useReducedMotion());
  const show = reducedMotion || revealed;

  return (
    <div className={cn("relative aspect-square w-full max-w-[480px] overflow-hidden rounded-[2rem] border border-[#DCE5DD] bg-[#FCFBF7] p-8", className)} aria-hidden="true">
      <div className="absolute -right-20 -top-20 size-64 rounded-full border border-[#DCE5DD]" />
      <div className="absolute -bottom-16 -left-16 size-56 rounded-full border border-[#D6B56D]/40" />
      <motion.div
        initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 12 }}
        animate={{ opacity: show ? 1 : 0, y: show ? 0 : 12 }}
        transition={{ duration: reducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-full flex-col"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8FA294]">Oriens Academy</p>
        <div className="my-auto grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-[#10271B]">
          <span className="flex aspect-square items-center justify-center rounded-3xl border border-[#DCE5DD] bg-white"><AcademicIcon type="assessment" size="48%" /></span>
          <span className="h-px w-8 bg-[#D6B56D]" />
          <span className="flex aspect-square items-center justify-center rounded-3xl border border-[#DCE5DD] bg-[#EEF2EC]"><AcademicIcon type="target" size="48%" /></span>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-[#DCE5DD] pt-5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#667085]">
          <span>Assess</span><span className="text-center">Plan</span><span className="text-right">Progress</span>
        </div>
      </motion.div>
    </div>
  );
}
