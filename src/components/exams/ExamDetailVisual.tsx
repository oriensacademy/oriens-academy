"use client";

import { motion, useReducedMotion } from "motion/react";
import { AcademicIcon, type AcademicIconType } from "@/components/academic/AcademicIcon";
import type { ExamCode, ExamVisualVariant } from "@/content/exams";
import { useLocale } from "@/content/locale-context";

const examVisuals: Record<ExamCode, { type: AcademicIconType; tr: string; en: string }> = {
  IB: { type: "global-study", tr: "Küresel müfredat", en: "Global curriculum" },
  AP: { type: "assessment", tr: "Ders ve sınav stratejisi", en: "Course and exam strategy" },
  SAT: { type: "assessment", tr: "Okuma, yazma ve matematik", en: "Reading, writing and mathematics" },
  ESAT: { type: "physics", tr: "Bilimsel akıl yürütme", en: "Scientific reasoning" },
  TARA: { type: "critical-reasoning", tr: "Akademik akıl yürütme", en: "Academic reasoning" },
  TMUA: { type: "critical-reasoning", tr: "Matematiksel düşünme", en: "Mathematical thinking" },
  IGCSE: { type: "reading", tr: "Ders temelli hazırlık", en: "Subject-based preparation" },
  GRE: { type: "analysis", tr: "Lisansüstü değerlendirme", en: "Graduate assessment" },
  GMAT: { type: "planning", tr: "İşletme okulu hazırlığı", en: "Business school preparation" },
  UKCAT: { type: "critical-reasoning", tr: "Karar verme ve muhakeme", en: "Decision making and reasoning" },
  IMAT: { type: "biology", tr: "Tıp ve bilim hazırlığı", en: "Medicine and science preparation" },
  OMPT: { type: "analysis", tr: "Programa özel matematik", en: "Programme-specific mathematics" },
};

export function ExamDetailVisual({ label, code }: { variant: ExamVisualVariant; label: string; code: ExamCode }) {
  const reducedMotion = Boolean(useReducedMotion());
  const locale = useLocale();
  const visual = examVisuals[code];

  return (
    <div role="img" aria-label={label} className="relative mx-auto w-full max-w-[560px] px-2 py-4 sm:px-5">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="flex items-start justify-between gap-5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8FA294]">Oriens Academy</span>
          <span className="font-heading text-3xl text-[#10271B]">{code}</span>
        </div>
        <div className="mt-8 flex min-h-48 items-center justify-center text-[#10271B] sm:min-h-56">
          <AcademicIcon type={visual.type} size="42%" className="max-h-36 min-h-24 text-[#10271B]" />
        </div>
        <div className="mt-6 grid grid-cols-[1fr_auto] items-end gap-5 border-t border-[#DCE5DD] pt-5">
          <p className="font-heading text-xl leading-tight text-[#172033]">{visual[locale]}</p>
          <p className="max-w-32 text-right text-[10px] uppercase tracking-[0.14em] text-[#8FA294]">
            {locale === "tr" ? "Akademik odak" : "Academic focus"}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
