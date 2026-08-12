"use client";

import { Reveal } from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { FunctionPlot } from "@/components/math/FunctionPlot";
import { useHomeContent } from "@/content/locale-context";

export function ResultsTestimonials() {
  const { resultsTestimonials } = useHomeContent();
  if (resultsTestimonials.testimonials.length === 0) return null;

  return (
    <section id="results" className="section-offset bg-surface-muted py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Reveal>
              <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">
                {resultsTestimonials.eyebrow}
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-4 text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
                {resultsTestimonials.headline}
              </h2>
            </Reveal>
          </div>

          <Reveal delay={0.2} className="hidden w-full max-w-[220px] shrink-0 lg:block">
            <FunctionPlot />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {resultsTestimonials.functionPlotCaption}
            </p>
          </Reveal>
        </div>

        <StaggerGroup className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {resultsTestimonials.testimonials.map((t) => (
            <StaggerItem key={t.quote}>
              <figure className="h-full rounded-lg border border-border bg-surface p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-accent hover:shadow-md">
                <blockquote className="font-heading text-lg leading-relaxed text-ink italic">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
                  {t.name} &middot; {t.context}
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
