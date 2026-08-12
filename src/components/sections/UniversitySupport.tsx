"use client";

import { Reveal } from "@/components/motion/Reveal";
import { VectorAnimation } from "@/components/math/VectorAnimation";
import { useHomeContent } from "@/content/locale-context";

export function UniversitySupport() {
  const { universitySupport } = useHomeContent();
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

          <dl className="mt-12 divide-y divide-border border-t border-border">
            {universitySupport.areas.map((area, i) => (
              <Reveal key={area.n} delay={0.06 * i} y={10}>
                <div className="flex flex-col gap-2 py-6 sm:flex-row sm:gap-8">
                  <span aria-hidden="true" className="font-heading text-2xl text-brand-accent sm:w-12 sm:shrink-0">
                    {area.n}
                  </span>
                  <div>
                    <dt className="font-heading text-xl text-ink">{area.title}</dt>
                    <dd className="mt-1.5 max-w-md text-sm leading-relaxed text-ink/70">
                      {area.copy}
                    </dd>
                  </div>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>

        <Reveal delay={0.15} className="flex items-center">
          <div className="w-full border border-border bg-surface p-6">
            <VectorAnimation
              from={{ x: -0.5, y: -0.5 }}
              to={{ x: 4.2, y: 3.6 }}
              domain={{ xMin: -1, xMax: 5, yMin: -1, yMax: 5, width: 340, height: 300, padding: 28 }}
              showMagnitude={false}
            />
            <p className="mt-4 text-sm text-muted-foreground">{universitySupport.visualCaption}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
