"use client";

import type { ExamRecord } from "@/content/exams";
import { useExamsContent, useLocale } from "@/content/locale-context";
import { Reveal } from "@/components/motion/Reveal";
import { ThreeDExamCarousel, type ExamOverviewCard } from "@/components/ui/three-d-exam-carousel";

export function ExamOverviewCarouselSection({ exam }: { exam: ExamRecord }) {
  const locale = useLocale();
  const { examDetailText, detailPage } = useExamsContent();
  const detail = examDetailText[exam.code];
  const isTr = locale === "tr";

  const cards: ExamOverviewCard[] = [
    ...detail.preparationAreas.map((area, index) => ({
      id: `preparation-${index}`,
      eyebrow: isTr ? `Hazırlık alanı 0${index + 1}` : `Preparation area 0${index + 1}`,
      title: area.title,
      description: area.description,
      visual: "preparation" as const,
      accent: index === 1 ? "secondary" as const : "muted" as const,
    })),
    {
      id: "roadmap",
      eyebrow: isTr ? "Oriens yaklaşımı" : "Oriens approach",
      title: isTr ? "Hazırlık Rotası" : "Preparation Roadmap",
      description: detail.oriensSupport,
      bullets: detail.preparationAreas.map((area) => area.title),
      visual: "preparation",
      accent: "primary",
    },
  ];

  return (
    <section id="exam-overview-gallery" className="overflow-x-clip border-y border-border bg-surface-muted py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal className="grid gap-5 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-accent">{detailPage.preparationEyebrow}</p>
            <h2 className="mt-4 font-heading text-[clamp(2.3rem,4vw,3.8rem)] font-normal leading-[1.04] tracking-[-0.025em] text-ink">{detailPage.preparationTitle}</h2>
          </div>
          <p className="max-w-[62ch] text-base leading-[1.75] text-ink/70 lg:col-span-6">{isTr ? "Hazırlık alanlarını ve Oriens çalışma rotasını incelemek için kartları seçin." : "Select a card to explore the preparation areas and Oriens study roadmap."}</p>
        </Reveal>
      </div>

      <div className="relative left-1/2 mt-10 w-screen -translate-x-1/2">
        <ThreeDExamCarousel examCode={exam.code} cards={cards} locale={locale} />
      </div>

      <div className="mx-auto mt-7 max-w-[1280px] px-6 md:px-12">
        <p className="max-w-[80ch] border-l-2 border-brand-accent pl-4 text-xs leading-relaxed text-muted-foreground">{detailPage.officialNote}</p>
      </div>
    </section>
  );
}
