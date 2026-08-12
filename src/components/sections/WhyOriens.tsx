"use client";

import { Reveal } from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { SineWave } from "@/components/math/SineWave";
import { useHomeContent } from "@/content/locale-context";

export function WhyOriens() {
  const { whyOriens } = useHomeContent();
  return (
    <section className="section-offset border-t border-border py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <div className="max-w-2xl">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">
              {whyOriens.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
              {whyOriens.headline}
            </h2>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="mt-10 hidden max-w-xs opacity-70 md:block">
          <SineWave domain={{ xMin: -8, xMax: 8, yMin: -2, yMax: 2, width: 260, height: 60, padding: 6 }} />
        </Reveal>

        <StaggerGroup className="mt-8 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {whyOriens.reasons.map((reason) => (
            <StaggerItem key={reason.title}>
              <reason.icon className="size-6 text-secondary" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="mt-5 font-heading text-lg text-ink">{reason.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{reason.copy}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
