"use client";

import { useRef } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Compass,
  GraduationCap,
  Sparkles,
  Target,
} from "lucide-react";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import { CompassMark } from "@/components/brand/CompassMark";
import type { AboutContent } from "@/content/about";
import { ButtonLink } from "@/components/ui/button";

type AboutUsSectionProps = {
  content: AboutContent;
  bookingHref: string;
};

const icons = [Target, BrainCircuit, BookOpenCheck, Clock3, Compass];

export default function AboutUsSection({ content, bookingHref }: AboutUsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.08 });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const upperAccentY = useTransform(scrollYProgress, [0, 1], [12, -42]);
  const lowerAccentY = useTransform(scrollYProgress, [0, 1], [-10, 38]);
  const founder = content.team.members[0];
  const services = [
    ...content.principles.items.map((item, index) => ({
      icon: icons[index] ?? CheckCircle2,
      title: item.title,
      description: item.description,
    })),
    {
      icon: GraduationCap,
      title: content.team.title,
      description: founder?.bio ?? founder?.shortBio ?? content.team.fallbackBody,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.08 },
    },
  };
  const itemVariants = {
    hidden: { y: 18, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.52, ease: "easeOut" as const },
    },
  };

  return (
    <section
      id="approach"
      ref={sectionRef}
      data-owner-component="uniquesonu/about-us-section"
      className="section-offset relative w-full overflow-hidden border-y border-border bg-gradient-to-b from-[#F6F8F3] to-[#EFF3EE] px-6 py-20 text-ink md:px-12 md:py-28"
    >
      <motion.div
        aria-hidden="true"
        className="absolute top-16 left-[8%] size-56 rounded-full bg-[#D6B56D]/10 blur-3xl"
        style={{ y: upperAccentY }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute right-[8%] bottom-12 size-64 rounded-full bg-[#819586]/10 blur-3xl"
        style={{ y: lowerAccentY }}
      />

      <motion.div
        className="relative z-10 mx-auto max-w-[1280px]"
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={containerVariants}
      >
        <motion.div className="mx-auto mb-14 max-w-3xl text-center" variants={itemVariants}>
          <p className="flex items-center justify-center gap-2 text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">
            <Sparkles className="size-4" aria-hidden="true" />
            {content.story.eyebrow}
          </p>
          <h2 className="mt-4 text-[clamp(2.1rem,4vw,3.8rem)] leading-[1.06] font-medium tracking-[-0.025em] text-ink">
            {content.story.title}
          </h2>
          <p className="mx-auto mt-6 max-w-[66ch] text-base leading-[1.8] text-ink/70">
            {content.story.paragraphs[0]}
          </p>
        </motion.div>

        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.82fr)_minmax(0,1fr)] md:gap-7 lg:gap-12">
          <div className="space-y-7 md:space-y-10">
            {services.slice(0, 3).map((service, index) => (
              <ServiceItem key={service.title} {...service} variants={itemVariants} delay={index * 0.08} direction="left" />
            ))}
          </div>

          <motion.div className="order-first flex justify-center md:order-none" variants={itemVariants}>
            <motion.div
              className="relative flex aspect-[4/5] w-full max-w-[18rem] flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-[#D6DED6] bg-white/75 p-7 text-center shadow-[0_24px_70px_rgba(16,39,27,0.1)] backdrop-blur-sm"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.72, delay: 0.16 }}
              whileHover={{ y: -4, scale: 1.01 }}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-brand-accent" aria-hidden="true" />
              <CompassMark size={92} rotation={18} animated />
              <p className="mt-8 text-xs font-medium tracking-[0.2em] text-brand-accent uppercase">{content.team.eyebrow}</p>
              <h3 className="mt-3 font-heading text-3xl text-ink">{founder?.name ?? content.team.fallbackTitle}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{founder?.role ?? content.team.intro}</p>
              <div className="mt-6 w-full border-t border-border pt-5 text-sm leading-relaxed text-ink/70">
                {content.team.intro}
              </div>
            </motion.div>
          </motion.div>

          <div className="space-y-7 md:space-y-10">
            {services.slice(3, 6).map((service, index) => (
              <ServiceItem key={service.title} {...service} variants={itemVariants} delay={index * 0.08} direction="right" />
            ))}
          </div>
        </div>

        <motion.div
          className="mt-16 grid gap-7 rounded-2xl bg-[#10271B] p-7 text-white md:grid-cols-[1fr_auto] md:items-center md:p-9"
          variants={itemVariants}
        >
          <div>
            <h3 className="text-2xl font-medium">{content.cta.title}</h3>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-white/72">{content.cta.body}</p>
          </div>
          <ButtonLink href={bookingHref} variant="secondary" size="lg" className="h-12 bg-white px-5 text-ink hover:bg-[#EFF3EE]">
            {content.cta.primary}
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </motion.div>
      </motion.div>
    </section>
  );
}

type ServiceItemProps = {
  icon: typeof Target;
  title: string;
  description: string;
  variants: {
    hidden: { opacity: number; y: number };
    visible: { opacity: number; y: number; transition: { duration: number; ease: "easeOut" } };
  };
  delay: number;
  direction: "left" | "right";
};

function ServiceItem({ icon: Icon, title, description, variants, delay, direction }: ServiceItemProps) {
  return (
    <motion.article
      className="group min-w-0 rounded-xl border border-transparent p-4 transition-colors duration-300 hover:border-[#D6DED6] hover:bg-white/65"
      variants={variants}
      transition={{ delay }}
      whileHover={{ y: -3 }}
    >
      <div className={`flex items-center gap-3 ${direction === "right" ? "md:flex-row-reverse md:text-right" : ""}`}>
        <motion.div
          className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#10271B]/7 text-[#10271B] group-hover:bg-[#10271B] group-hover:text-white"
          whileHover={{ rotate: [0, -5, 5, 0], scale: 1.04 }}
          transition={{ duration: 0.32 }}
        >
          <Icon className="size-5" aria-hidden="true" />
        </motion.div>
        <h3 className="font-heading text-xl text-ink">{title}</h3>
      </div>
      <p className={`mt-3 text-sm leading-[1.7] text-ink/68 ${direction === "right" ? "md:text-right" : ""}`}>
        {description}
      </p>
    </motion.article>
  );
}
