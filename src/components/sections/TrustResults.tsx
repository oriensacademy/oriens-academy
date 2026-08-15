"use client";

import { Reveal } from "@/components/motion/Reveal";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { useHomeContent } from "@/content/locale-context";
import { BookOpen, Library, Languages, Receipt } from "lucide-react";

const SUPPORT_ICONS = [BookOpen, Library, Languages, Receipt];

export function TrustResults() {
  const { trustResults } = useHomeContent();
  return (
    <section id="trust" className="section-offset border-t border-border pt-16 pb-8 md:pt-20 md:pb-10">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal>
          <p className="text-center text-xs font-medium tracking-[0.24em] text-muted-foreground uppercase">
            {trustResults.eyebrow}
          </p>
        </Reveal>

        <StaggerGroup className="mt-10 grid grid-cols-1 divide-y divide-border border border-border sm:grid-cols-2 sm:divide-x sm:[&>*:nth-child(3)]:border-l-0 lg:grid-cols-4 lg:divide-y-0 lg:[&>*:nth-child(3)]:border-l">
          {trustResults.items.map((item, index) => {
            const Icon = SUPPORT_ICONS[index] || BookOpen;
            return (
            <StaggerItem key={item.title} className="px-6 py-8 text-left">
              <Icon className="size-6 text-[#819586]" strokeWidth={1.5} aria-hidden="true" />
              <h2 className="mt-4 font-heading text-xl text-ink">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </StaggerItem>
          );})}
        </StaggerGroup>
      </div>
    </section>
  );
}
