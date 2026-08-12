"use client";

import { Reveal } from "@/components/motion/Reveal";
import { CompassMark } from "@/components/brand/CompassMark";
import { TangentAnimation } from "@/components/math/TangentAnimation";
import { useHomeContent } from "@/content/locale-context";

export function InstructorAbout() {
  const { instructorAbout } = useHomeContent();
  return (
    <section className="section-offset py-20 md:py-28">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-14 px-6 md:px-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <Reveal>
          {/* Placeholder frame — ready for real photography, deliberately not a generic stock image. */}
          <div className="relative aspect-[3/4] w-full max-w-sm border border-border bg-surface-muted">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <CompassMark size={40} />
              <span className="text-xs tracking-[0.1em] text-muted-foreground uppercase">
                {instructorAbout.photoPlaceholder}
              </span>
            </div>
          </div>
        </Reveal>

        <div>
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">
              {instructorAbout.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
              {instructorAbout.name}
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/75">{instructorAbout.body}</p>
          </Reveal>

          <Reveal delay={0.2}>
            <ul className="mt-8 flex flex-wrap gap-3">
              {instructorAbout.credentials.map((c) => (
                <li
                  key={c}
                  className="border border-border px-3 py-1.5 text-xs font-medium text-ink/80"
                >
                  {c}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.26} className="mt-10 hidden max-w-[200px] sm:block">
            <TangentAnimation
              domain={{ xMin: -3, xMax: 3, yMin: -2, yMax: 3, width: 200, height: 140, padding: 14 }}
              at={1.1}
            />
            <p className="mt-2 text-xs text-muted-foreground">{instructorAbout.tangentCaption}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
