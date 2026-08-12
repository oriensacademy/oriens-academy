"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useLoaderReveal } from "@/components/brand/loader-context";
import { useHomeContent } from "@/content/locale-context";
import { HeroVisual } from "./HeroVisual";

const rise = (skip: boolean): Variants => ({
  hidden: { opacity: skip ? 1 : 0, y: skip ? 0 : 18 },
  visible: { opacity: 1, y: 0 },
});

export function Hero() {
  const { hero } = useHomeContent();
  const revealed = useLoaderReveal();
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;
  const state = skip || revealed ? "visible" : "hidden";
  const item = rise(skip);

  return (
    <section
      id="top"
      className="section-offset relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28"
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-16 px-6 md:px-12 lg:grid-cols-2 lg:gap-12">
        <div className="max-w-xl">
          <motion.p
            initial="hidden"
            animate={state}
            variants={item}
            transition={{ duration: skip ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase"
          >
            {hero.eyebrow}
          </motion.p>

          <motion.h1
            initial="hidden"
            animate={state}
            variants={item}
            transition={{ duration: skip ? 0 : 0.6, delay: skip ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 text-[clamp(2.25rem,4.5vw+1rem,4.75rem)] leading-[1.05] font-medium text-ink"
          >
            {hero.headline}
          </motion.h1>

          <motion.p
            initial="hidden"
            animate={state}
            variants={item}
            transition={{ duration: skip ? 0 : 0.6, delay: skip ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-md text-lg leading-relaxed text-ink/75"
          >
            {hero.body}
          </motion.p>

          <motion.div
            initial="hidden"
            animate={state}
            variants={item}
            transition={{ duration: skip ? 0 : 0.6, delay: skip ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4"
          >
            <ButtonLink
              href="#booking"
              directional
              size="lg"
              className="h-12 px-7 text-base"
            >
              {hero.ctaPrimary}
              <ArrowRight data-directional-arrow className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink
              href="#method"
              variant="ghost"
              size="lg"
              className="h-12 px-0 text-base"
            >
              {hero.ctaSecondary}
            </ButtonLink>
          </motion.div>
        </div>

        <motion.div
          initial="hidden"
          animate={state}
          variants={item}
          transition={{ duration: skip ? 0 : 0.7, delay: skip ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[420px] lg:max-w-none"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}
