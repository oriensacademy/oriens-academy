"use client";

import type { ExamRecord } from "@/content/exams";
import { useExamsContent, useLocale } from "@/content/locale-context";
import { Reveal } from "@/components/motion/Reveal";
import { ThreeDExamCarousel, type ExamOverviewCard } from "@/components/ui/three-d-exam-carousel";

export function ExamOverviewCarouselSection({ exam }: { exam: ExamRecord }) {
  const locale = useLocale();
  const { examText, examDetailText, detailPage } = useExamsContent();
  const summary = examText[exam.code];
  const detail = examDetailText[exam.code];
  const isTr = locale === "tr";

  const cards: ExamOverviewCard[] = [
    {
      id: "overview",
      eyebrow: isTr ? "Genel bakış" : "Overview",
      title: summary.title,
      description: detail.overview[0],
      bullets: summary.subjects.slice(0, 3),
      visual: "overview",
      accent: "primary",
    },
    ...detail.featuredFacts.map((fact, index) => ({
      id: `fact-${index}`,
      eyebrow: isTr ? "Doğrulanmış bilgi" : "Verified fact",
      title: fact.label,
      value: fact.value,
      description: summary.shortDescription,
      visual: "facts" as const,
      accent: index === 0 ? "accent" as const : "secondary" as const,
    })),
    {
      id: "content",
      eyebrow: isTr ? "Akademik kapsam" : "Academic scope",
      title: isTr ? "Çalışma Alanları" : "Focus Areas",
      description: isTr ? "Mevcut proje içeriğinde bu sınav için doğrulanmış çalışma başlıkları." : "Focus areas verified in the current project content for this exam.",
      bullets: summary.subjects,
      visual: "content",
      accent: "muted",
    },
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
    {
      id: "audience",
      eyebrow: isTr ? "Öğrenci profili" : "Student context",
      title: isTr ? "Kimler İçin?" : "Who Is It For?",
      value: summary.audience,
      description: summary.shortDescription,
      visual: "audience",
      accent: "accent",
    },
    {
      id: "context",
      eyebrow: isTr ? "Akademik bağlam" : "Academic context",
      title: isTr ? `${exam.code} Kullanım Bağlamı` : `${exam.code} Use in Context`,
      description: `${summary.purpose}. ${detail.overview[1] ?? ""}`.trim(),
      visual: "context",
      accent: "secondary",
    },
  ];

  return (
    <section id="exam-overview-gallery" className="overflow-x-clip border-y border-border bg-surface-muted py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal className="grid gap-5 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-accent">{isTr ? "Sınavı Tanıyın" : "Know the Exam"}</p>
            <h2 className="mt-4 font-heading text-[clamp(2.3rem,4vw,3.8rem)] font-normal leading-[1.04] tracking-[-0.025em] text-ink">{isTr ? `${exam.code} Hakkında` : `${exam.code} Overview`}</h2>
          </div>
          <p className="max-w-[62ch] text-base leading-[1.75] text-ink/70 lg:col-span-6">{isTr ? "Sınavın kapsamını, kullanım bağlamını ve Oriens hazırlık sürecini kısa başlıklarla keşfedin." : "Explore the exam scope, application context and Oriens preparation process at a glance."}</p>
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

