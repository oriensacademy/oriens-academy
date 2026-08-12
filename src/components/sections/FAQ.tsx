"use client";

import { Reveal } from "@/components/motion/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useHomeContent } from "@/content/locale-context";

export function FAQSection() {
  const { faq } = useHomeContent();
  return (
    <section className="section-offset py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6 md:px-12">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">
            {faq.eyebrow}
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="mt-4 text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
            {faq.headline}
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <Accordion defaultValue={[faq.items[0].id]} className="mt-12">
            {faq.items.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger className="font-heading text-lg text-ink no-underline hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-base text-ink/70">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
