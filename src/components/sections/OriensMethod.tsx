"use client";

import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/motion/Reveal";
import { useHomeContent } from "@/content/locale-context";

export function OriensMethod() {
  const { oriensMethod } = useHomeContent();
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;

  return (
    <section id="method" className="section-offset py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <div className="max-w-2xl">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">
              {oriensMethod.eyebrow}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
              {oriensMethod.headline}
            </h2>
          </Reveal>
        </div>

        <div className="relative mt-16">
          <motion.div
            aria-hidden="true"
            className="absolute top-[7px] right-0 left-0 hidden h-px origin-left bg-border lg:block"
            initial={{ scaleX: skip ? 1 : 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: skip ? 0 : 1, ease: [0.22, 1, 0.36, 1] }}
          />

          <ol className="grid grid-cols-1 gap-x-8 gap-y-10 border-l border-border sm:grid-cols-2 sm:border-l-0 lg:grid-cols-6">
            {oriensMethod.stages.map((stage, i) => (
              <Reveal key={stage.n} delay={0.06 * i} y={10}>
                <li className="relative -ml-px border-l border-transparent pl-6 sm:ml-0 sm:border-l-0 sm:pl-0">
                  <span
                    aria-hidden="true"
                    className="absolute top-[3px] -left-[5px] size-2.5 rounded-full bg-brand-accent sm:static sm:mb-4 sm:block"
                  />
                  <span className="font-sans text-xs font-medium text-muted-foreground tabular-nums">
                    {stage.n}
                  </span>
                  <h3 className="mt-1 font-heading text-xl text-ink">{stage.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/70">{stage.copy}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
