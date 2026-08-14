"use client";

import { Reveal } from "@/components/motion/Reveal";
import { AcademicIcon } from "@/components/academic/AcademicIcon";
import { GradientCard } from "@/components/gradient-card";
import { useHomeContent, useLocale } from "@/content/locale-context";

export function UniversitySupport() {
  const { universitySupport } = useHomeContent();
  const locale = useLocale();
  return (
    <section id="university-support" className="section-offset py-20 md:py-28">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-14 px-6 md:px-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <div>
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">
              {universitySupport.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 max-w-lg text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
              {universitySupport.headline}
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {universitySupport.areas.map((area, i) => {
              const gradients: Array<"navy" | "blue" | "indigo" | "gold"> = ["navy", "blue", "indigo", "gold"];
              const gradient = gradients[i % gradients.length];
              const isTr = locale === "tr";
              const ctaText = isTr ? "Detayları İncele" : "View Details";
              const ctaHref = isTr ? "/tr/universite-destegi" : "/en/university-support";

              return (
                <Reveal key={area.n} delay={0.06 * i} y={10}>
                  <GradientCard
                    gradient={gradient}
                    badgeText={`Ders ${area.n}`}
                    title={area.title}
                    description={area.copy}
                    ctaText={ctaText}
                    ctaHref={ctaHref}
                  />
                </Reveal>
              );
            })}
          </div>
        </div>

        <Reveal delay={0.15} className="flex items-center">
          <div className="flex w-full flex-col items-center border border-border bg-surface p-8 text-[#10271B]">
            <AcademicIcon type="university" size={150} />
            <p className="mt-4 text-sm text-muted-foreground">{universitySupport.visualCaption}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
