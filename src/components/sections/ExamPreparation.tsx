"use client";

import { Reveal } from "@/components/motion/Reveal";
import { AcademicSubjectMotifs } from "@/components/ui/academic-subject-motifs";
import { GradientCard } from "@/components/gradient-card";
import { useHomeContent, useLocale } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";

/**
 * Deliberately not twelve identical cards — an editorial index instead,
 * grouped by academic stage, each exam a typographic entry rather than a
 * boxed tile.
 */
export function ExamPreparation() {
  const { examPreparation } = useHomeContent();
  const locale = useLocale();
  return (
    <section id="exam-preparation" className="section-offset bg-surface-muted pt-10 pb-20 md:pt-14 md:pb-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Reveal>
              <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">
                {examPreparation.eyebrow}
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-4 text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
                {examPreparation.headline}
              </h2>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="mt-5 text-lg leading-relaxed text-ink/75">{examPreparation.body}</p>
            </Reveal>
          </div>

          <Reveal delay={0.2} className="w-full max-w-[520px] shrink-0 lg:max-w-[440px]">
            <AcademicSubjectMotifs />
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {examPreparation.categories.map((category, categoryIndex) => (
            <Reveal key={category.label} delay={0.1 + categoryIndex * 0.08}>
              <GradientCard
                gradient={categoryIndex === 0 ? "navy" : "gold"}
                badgeText={category.label}
                title={category.exams.join(" · ")}
                description={examPreparation.body}
                ctaText={locale === "tr" ? "Sınavları incele" : "Explore exams"}
                ctaHref={localizedPath("exams", locale)}
                className="min-h-[300px]"
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
