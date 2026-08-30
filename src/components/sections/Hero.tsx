"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useLoaderReveal } from "@/components/brand/loader-context";
import { useHomeContent } from "@/content/locale-context";
import PhoneMockupBasic from "@/components/ui/phone-mockups-1";
import GooeySearchBar from "@/components/ui/gooey-search";
import { TextReveal } from "@/components/text-reveal";
import { TextRotate } from "@/components/ui/text-rotate";
import { useLocale } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";
import { canonicalExamCodes } from "@/content/canonical-exams";

const rise = (skip: boolean): Variants => ({
  hidden: { opacity: skip ? 1 : 0, y: skip ? 0 : 18 },
  visible: { opacity: 1, y: 0 },
});

export function Hero() {
  const { hero } = useHomeContent();
  const locale = useLocale();
  const revealed = useLoaderReveal();
  const prefersReducedMotion = useReducedMotion();
  const skip = !!prefersReducedMotion;
  const state = skip || revealed ? "visible" : "hidden";
  const item = rise(skip);

  return (
    <section
      id="top"
      className="section-offset relative flex min-h-[760px] items-center overflow-hidden pt-28 pb-20 md:pt-32 md:pb-24"
    >
      {/* Delicate background ambient texture */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/3 size-96 rounded-full bg-[#819586] blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-80 rounded-full bg-[#C5B58A] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-14 px-6 md:px-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:items-start lg:gap-8 xl:gap-12">
        <div className="min-w-0 max-w-[760px] lg:pt-6">
          <motion.div
            initial="hidden"
            animate={state}
            variants={item}
            transition={{ duration: skip ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-7 flex-wrap items-center gap-x-2 text-[12px] font-semibold tracking-[0.18em] text-[#68756C] uppercase font-ui"
          >
            <span>{hero.eyebrow}</span><span aria-hidden="true">·</span><span className="inline-flex items-center whitespace-nowrap">{locale === "tr" ? "Şimdi sırada" : "Prepare for"} <TextRotate texts={[...canonicalExamCodes]} rotationInterval={2500} splitBy="characters" mainClassName="ml-1 inline-flex min-w-[6.5ch] overflow-hidden text-[#819586]" /></span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate={state}
            variants={item}
            transition={{ duration: skip ? 0 : 0.45, delay: skip ? 0 : 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 max-w-[740px] text-balance font-heading text-[clamp(2.8rem,12vw,4rem)] leading-[1.04] font-normal tracking-[-0.02em] text-foreground md:text-[clamp(3rem,6.5vw,3.75rem)] md:leading-[1.02] lg:text-[clamp(3.4rem,4.3vw,5.1rem)] lg:leading-[1.01]"
          >
            <TextReveal preset="fade-in-blur" per="word" delay={.05} speedReveal={1.5} speedSegment={1.2} trigger={state === "visible"}>{hero.headline}</TextReveal>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate={state}
            variants={item}
            transition={{ duration: skip ? 0 : 0.45, delay: skip ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-[620px] text-[1.0625rem] leading-[1.7] text-[#455249] font-body md:text-lg"
          >
            {hero.body}
          </motion.p>

          <motion.div
            initial="hidden"
            animate={state}
            variants={item}
            transition={{ duration: skip ? 0 : 0.45, delay: skip ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7"
          >
            <GooeySearchBar />
          </motion.div>

          <motion.div
            initial="hidden"
            animate={state}
            variants={item}
            transition={{ duration: skip ? 0 : 0.45, delay: skip ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3"
          >
            <ButtonLink
              href="#consultation-form"
              directional
              size="lg"
              className="h-12 px-7 text-base font-ui"
            >
              {hero.ctaPrimary}
              <ArrowRight data-directional-arrow className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink
              href={localizedPath("exams", locale)}
              variant="outline"
              size="lg"
              className="h-12 px-6 text-base font-ui"
            >
              {hero.ctaSecondary}
            </ButtonLink>
          </motion.div>
        </div>

        <motion.div
          initial="hidden"
          animate={state}
          variants={item}
          transition={{ duration: skip ? 0 : 0.5, delay: skip ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[380px] lg:max-w-[420px]"
        >
          <PhoneMockupBasic />
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;
