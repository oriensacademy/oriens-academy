"use client";

import { motion, useReducedMotion } from "motion/react";
import { Atom, Dna, FlaskConical, Globe2, Landmark, Sigma } from "lucide-react";
import { useLocale } from "@/content/locale-context";

const subjects = [
  { tr: "Matematik", en: "Mathematics", Icon: Sigma, accent: "#819586", rotate: -3 },
  { tr: "Fizik", en: "Physics", Icon: Atom, accent: "#D6B56D", rotate: 4 },
  { tr: "Kimya", en: "Chemistry", Icon: FlaskConical, accent: "#819586", rotate: -4 },
  { tr: "Biyoloji", en: "Biology", Icon: Dna, accent: "#D6B56D", rotate: 3 },
  { tr: "Coğrafya", en: "Geography", Icon: Globe2, accent: "#819586", rotate: -3 },
  { tr: "Tarih", en: "History", Icon: Landmark, accent: "#D6B56D", rotate: 3 },
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
      {subjects.map(({ tr, en, Icon, accent, rotate }, index) => (
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
          <motion.span
            animate={reduced ? undefined : { rotate: [0, rotate, 0] }}
            transition={{ duration: 4.8 + index * 0.25, repeat: Infinity, repeatDelay: 1.8, ease: "easeInOut" }}
            className="flex size-12 items-center justify-center rounded-full border border-[#D6DED6] bg-white text-[#10271B] shadow-[0_7px_18px_rgba(16,39,27,.06)] transition-all duration-300 group-hover:border-[#819586] group-hover:shadow-[0_10px_24px_rgba(16,39,27,.11)]"
            style={{ color: accent }}
          >
            <Icon className="size-6 stroke-[1.65] transition-transform duration-300 group-hover:scale-110" aria-hidden="true" />
          </motion.span>
          <p className="mt-3 truncate text-[10px] font-bold tracking-[0.12em] text-[#405249] uppercase sm:text-[11px]">
            {locale === "tr" ? tr : en}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

export default AcademicSubjectMotifs;
