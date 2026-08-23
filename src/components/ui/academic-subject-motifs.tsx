"use client";

import { motion, useReducedMotion } from "motion/react";
import { Sigma, Atom, FlaskConical, Leaf, ChartNoAxesCombined, ChartColumn } from "lucide-react";
import { useLocale } from "@/content/locale-context";

const subjects = [
  { tr: "Matematik", en: "Mathematics", icon: Sigma },
  { tr: "Fizik", en: "Physics", icon: Atom },
  { tr: "Kimya", en: "Chemistry", icon: FlaskConical },
  { tr: "Biyoloji", en: "Biology", icon: Leaf },
  { tr: "Ekonomi", en: "Economics", icon: ChartNoAxesCombined },
  { tr: "İstatistik", en: "Statistics", icon: ChartColumn },
];

export function AcademicSubjectMotifs() {
  const locale = useLocale();
  const reduced = Boolean(useReducedMotion());

  return (
    <div
      data-subject-panel
      className="grid w-full max-w-[510px] grid-cols-2 gap-3 rounded-[1.75rem] border border-border bg-surface p-3 sm:grid-cols-3 sm:p-4 shadow-xs"
      role="list"
      aria-label={locale === "tr" ? "Akademik ders alanları" : "Academic subject areas"}
    >
      {subjects.map(({ tr, en, icon: IconComponent }, index) => (
        <motion.div
          key={en}
          role="listitem"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={reduced ? undefined : { y: -2, scale: 1.025 }}
          transition={{ duration: reduced ? 0 : 0.26, delay: reduced ? 0 : index * 0.035, ease: [0.22, 1, 0.36, 1] }}
          className="group flex min-h-[116px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-muted px-3 py-4 text-center transition-colors duration-300 hover:border-primary/40 sm:min-h-[124px]"
        >
          <span
            className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-primary shadow-xs transition-all duration-300 group-hover:border-primary group-hover:scale-105 group-hover:shadow-sm"
          >
            <IconComponent className="size-5 text-primary stroke-[1.8] transition-transform duration-300 group-hover:-translate-y-0.5" />
          </span>
          <p className="mt-3 truncate text-[10px] font-bold tracking-[0.12em] text-foreground/85 uppercase sm:text-[11px]">
            {locale === "tr" ? tr : en}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

export default AcademicSubjectMotifs;
