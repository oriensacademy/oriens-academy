"use client";

import { motion, useReducedMotion } from "motion/react";
import { AcademicIcon, type AcademicIconType } from "@/components/academic/AcademicIcon";
import type { ExamCode, ExamVisualVariant } from "@/content/exams";
import { useLocale } from "@/content/locale-context";

const examVisuals: Record<ExamCode, { type: AcademicIconType; tr: string; en: string }> = {
  IB: { type: "global-study", tr: "Küresel müfredat", en: "Global curriculum" },
  AP: { type: "assessment", tr: "Ders ve sınav stratejisi", en: "Course and exam strategy" },
  IGCSE: { type: "reading", tr: "Ders temelli hazırlık", en: "Subject-based preparation" },
  "A-Level": { type: "critical-reasoning", tr: "İleri modüler müfredat", en: "Advanced modular curriculum" },
  SAT: { type: "assessment", tr: "Okuma, yazma ve matematik", en: "Reading, writing and mathematics" },
  ACT: { type: "target", tr: "Hızlı problem çözme ve fen", en: "Speed reasoning and science" },
  ESAT: { type: "physics", tr: "Mühendislik ve fen değerlendirmesi", en: "Engineering and science assessment" },
  TMUA: { type: "critical-reasoning", tr: "Matematiksel düşünme ve mantık", en: "Mathematical thinking and logic" },
  TARA: { type: "planning", tr: "Mekânsal algı ve mimarlık", en: "Spatial reasoning and architecture" },
  UCAT: { type: "biology", tr: "Klinik muhakeme ve hız", en: "Clinical aptitude and speed" },
  LNAT: { type: "writing", tr: "Eleştirel okuma ve hukuk essay", en: "Critical reading and law essay" },
  IMAT: { type: "biology", tr: "Tıp ve bilim hazırlığı", en: "Medicine and science preparation" },
  GAMSAT: { type: "chemistry", tr: "Lisansüstü tıp değerlendirmesi", en: "Graduate medical assessment" },
  MCAT: { type: "biology", tr: "Kapsamlı tıp kabul sınavı", en: "Comprehensive medical admission" },
  LSAT: { type: "critical-reasoning", tr: "Formal mantık ve analitik okuma", en: "Formal logic and analytical reading" },
  GRE: { type: "analysis", tr: "Lisansüstü genel değerlendirme", en: "Graduate general assessment" },
  GMAT: { type: "planning", tr: "İşletme okulu ve MBA hazırlığı", en: "Business school and MBA preparation" },
  OMPT: { type: "analysis", tr: "Programa özel matematik yerleştirme", en: "Programme-specific mathematics placement" },
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
