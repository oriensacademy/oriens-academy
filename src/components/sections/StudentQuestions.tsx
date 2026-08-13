"use client";

import { Reveal } from "@/components/motion/Reveal";
import { MarketingBadges } from "@/components/marketing-badges";
import { ButtonLink } from "@/components/ui/button";
import { useLocale } from "@/content/locale-context";
import { ArrowRight, MessageSquare } from "lucide-react";
import { localizedPath } from "@/lib/routes";

export function StudentQuestions() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const bookingHref = `${localizedPath("home", locale)}#consultation-form`;

  return (
    <section id="student-questions" className="section-offset bg-surface-muted py-20 md:py-28 border-b border-border overflow-hidden">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-10">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-primary uppercase font-ui">
              {isTr ? "Aklınızdaki Sorular" : "Questions You May Have"}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 text-[clamp(1.85rem,2.8vw+1rem,3rem)] leading-[1.12] font-serif font-semibold text-ink">
              {isTr ? "Nereden başlayacağınızı bilmiyor musunuz?" : "Not sure where to begin?"}
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-muted-foreground font-sans">
              {isTr
                ? "Süreçle ilgili sorularınızı birlikte netleştirebiliriz."
                : "We can help you clarify the questions around your next steps."}
            </p>
          </Reveal>
        </div>

        {/* Marketing Badges Interactive Area */}
        <Reveal delay={0.2} className="my-8">
          <MarketingBadges />
        </Reveal>

        {/* Action CTA */}
        <Reveal delay={0.28} className="flex justify-center mt-10">
          <ButtonLink href={bookingHref} directional size="lg" className="h-12 px-7 text-sm">
            <MessageSquare className="size-4 mr-2" />
            {isTr ? "Görüşme Planla" : "Schedule a Meeting"}
            <ArrowRight data-directional-arrow className="size-4 ml-1" />
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

export default StudentQuestions;
