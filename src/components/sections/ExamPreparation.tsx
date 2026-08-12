"use client";

import { Reveal } from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { AnimatedParabola } from "@/components/math/AnimatedParabola";
import { useHomeContent } from "@/content/locale-context";

/**
 * Deliberately not twelve identical cards — an editorial index instead,
 * grouped by academic stage, each exam a typographic entry rather than a
 * boxed tile.
 */
export function ExamPreparation() {
  const { examPreparation } = useHomeContent();
  return (
    <section id="exam-preparation" className="section-offset bg-surface-muted py-20 md:py-28">
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

          <Reveal delay={0.2} className="hidden w-full max-w-[220px] shrink-0 lg:block">
            <AnimatedParabola
              domain={{ xMin: -4, xMax: 4, yMin: -3, yMax: 5, width: 220, height: 200, padding: 16 }}
              showVertex
            />
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-12 md:grid-cols-3">
          {examPreparation.categories.map((category, categoryIndex) => (
            <Reveal key={category.label} delay={0.1 + categoryIndex * 0.08}>
              <h3 className="text-sm font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {category.label}
              </h3>
              <StaggerGroup className="mt-5 flex flex-wrap gap-x-3 gap-y-2">
                {category.exams.map((exam) => (
                  <StaggerItem key={exam}>
                    <span className="inline-block border-b border-transparent font-heading text-2xl text-ink transition-colors duration-200 hover:border-brand-accent md:text-3xl">
                      {exam}
                    </span>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
