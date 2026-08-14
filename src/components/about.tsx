"use client";

import { BookOpenCheck, BrainCircuit, Clock3, Compass, GraduationCap, Target } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";

const icons = [Target, BrainCircuit, BookOpenCheck, Clock3, Compass, GraduationCap];

export type AboutItem = { title: string; description: string };

export default function About({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: AboutItem[];
}) {
  return (
    <section id="approach" data-owner-component="prebuiltui/about" className="section-offset relative overflow-hidden border-y border-border bg-[#F6F8F3] py-20 md:py-24">
      <div className="pointer-events-none absolute -top-80 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-[#E8EEE8] blur-[180px]" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-6 md:px-12">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold tracking-[.22em] text-brand-accent uppercase">{eyebrow}</p>
          <h2 className="mx-auto mt-4 text-[clamp(2.2rem,4vw,3.8rem)] leading-[1.06] font-medium tracking-[-.025em] text-ink">{title}</h2>
          <p className="mx-auto mt-5 max-w-[66ch] text-base leading-7 text-muted-foreground">{description}</p>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((item, index) => {
            const Icon = icons[index] ?? GraduationCap;
            return (
              <Reveal key={item.title} delay={index * 0.04} y={8}>
                <article className="h-full border-t border-border pt-5">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-[#C9D7C9] bg-[#E8EEE8] text-[#10271B]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
