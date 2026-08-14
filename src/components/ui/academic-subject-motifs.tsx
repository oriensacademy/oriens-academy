"use client";

import { motion, useReducedMotion } from "motion/react";
import { useLocale } from "@/content/locale-context";
import { AcademicIcon, type AcademicIconType } from "@/components/academic/AcademicIcon";

const subjects: Array<{ tr: string; en: string; type: AcademicIconType; accent: string }> = [
  { tr: "Matematik", en: "Mathematics", type: "analysis", accent: "#819586" },
  { tr: "Fizik", en: "Physics", type: "physics", accent: "#D6B56D" },
  { tr: "Kimya", en: "Chemistry", type: "chemistry", accent: "#819586" },
  { tr: "Biyoloji", en: "Biology", type: "biology", accent: "#D6B56D" },
  { tr: "Coğrafya", en: "Geography", type: "geography", accent: "#819586" },
  { tr: "Tarih", en: "History", type: "history", accent: "#D6B56D" },
];

export function AcademicSubjectMotifs() {
  const locale = useLocale();
  const reduced = Boolean(useReducedMotion());

  return (
    <div
      data-subject-panel
      className="grid w-full max-w-[510px] grid-cols-2 gap-3 rounded-[1.75rem] border border-[#DDE5DC] bg-white p-3 sm:grid-cols-3 sm:p-4"
      role="list"
      aria-label={locale === "tr" ? "Akademik ders alanları" : "Academic subject areas"}
    >
      {subjects.map(({ tr, en, type, accent }, index) => (
        <motion.div
          key={en}
          role="listitem"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={reduced ? undefined : { y: -2, scale: 1.025 }}
          transition={{ duration: reduced ? 0 : 0.26, delay: reduced ? 0 : index * 0.035, ease: [0.22, 1, 0.36, 1] }}
          className="group flex min-h-[116px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#DDE5DC] bg-[#F6F8F3] px-3 py-4 text-center transition-colors duration-300 hover:bg-[#EFF3EE] sm:min-h-[124px]"
        >
          <span
            className="flex size-12 items-center justify-center rounded-full border border-[#D6DED6] bg-white text-[#10271B] shadow-[0_7px_18px_rgba(16,39,27,.06)] transition-all duration-300 group-hover:border-[#819586] group-hover:shadow-[0_10px_24px_rgba(16,39,27,.11)]"
            style={{ color: accent }}
          >
            <AcademicIcon type={type} size={25} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
          </span>
          <p className="mt-3 truncate text-[10px] font-bold tracking-[0.12em] text-[#405249] uppercase sm:text-[11px]">
            {locale === "tr" ? tr : en}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

export default AcademicSubjectMotifs;
