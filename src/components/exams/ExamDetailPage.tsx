"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ButtonLink } from "@/components/ui/button";
import { CompassMark } from "@/components/brand/CompassMark";
import { Reveal } from "@/components/motion/Reveal";
import { ExamDetailVisual } from "./ExamDetailVisual";
import { ExamOverviewCarouselSection } from "./ExamOverviewCarouselSection";
import type { ExamRecord } from "@/content/exams";
import { useExamsContent, useLocale } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";
import { OriensLottie } from "@/components/ui/OriensLottie";
import { getExamOwnerVisual } from "@/data/exam-visuals";

export function ExamDetailPage({ exam }: { exam: ExamRecord }) {
  const locale = useLocale();
  const { examText, examDetailText, detailPage, categories } = useExamsContent();
  const summary = examText[exam.code];
  const detail = examDetailText[exam.code];
  const ownerVisual = getExamOwnerVisual(exam.code);

  return (
    <>
      <section id="top" className="relative overflow-hidden border-b border-border pt-24 pb-16 md:pt-30 md:pb-24">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <nav aria-label={detailPage.breadcrumbAria}>
            <ol className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li><Link href={localizedPath("home", locale)} className="rounded-sm outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">{detailPage.home}</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href={localizedPath("exams", locale)} className="rounded-sm outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">{detailPage.exams}</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-ink">{exam.code}</li>
            </ol>
          </nav>

          <div className="mt-10 grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="min-w-0 lg:col-span-7">
              <p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{categories[exam.primaryCategory].label}</p>
              <h1 className="mt-3 font-heading text-[clamp(5rem,14vw,11rem)] leading-[0.78] font-medium tracking-[-0.06em] text-ink">{exam.code}</h1>
              <p className="mt-8 max-w-2xl font-heading text-[clamp(1.5rem,2.5vw,2.35rem)] leading-[1.15] text-secondary">{summary.title}</p>
              <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-ink/72">{summary.shortDescription}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={`${localizedPath("home", locale)}#consultation-form`} directional size="lg" className="h-12 px-5">{detailPage.primaryCta}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink>
                <ButtonLink href="#overview" variant="outline" size="lg" className="h-12 px-5">{detailPage.overviewTitle(exam.code)}<ArrowRight className="size-4" aria-hidden="true" /></ButtonLink>
                <ButtonLink href={`${localizedPath("examTest", locale)}#${exam.code}`} variant="outline" size="lg" className="h-12 px-5">{locale === "tr" ? "Kendini Dene" : "Test Yourself"}<ArrowRight className="size-4" aria-hidden="true" /></ButtonLink>
              </div>
            </div>
            <div className="lg:col-span-5">
              {ownerVisual ? (
                <div className="mx-auto w-full max-w-[220px] sm:max-w-[260px] lg:max-w-[300px]">
                  <OriensLottie src={ownerVisual.animation} speed={ownerVisual.speed} ariaLabel={ownerVisual.label[locale]} />
                </div>
              ) : (
                <ExamDetailVisual code={exam.code} variant={exam.visualVariant} label={detailPage.visualLabel(exam.code)} />
              )}
            </div>
          </div>

          <dl className="mt-14 grid border-t border-l border-border bg-surface sm:grid-cols-2">
            {detail.featuredFacts.map((fact) => (
              <div key={fact.label} className="border-r border-b border-border px-5 py-5 md:px-7">
                <dt className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{fact.label}</dt>
                <dd className="mt-2 font-heading text-xl text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="overview" className="section-offset py-20 md:py-28">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-6 md:px-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-7">
            <p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{detailPage.overviewEyebrow}</p>
            <h2 className="mt-4 text-[clamp(2rem,3.5vw,3rem)] leading-tight font-medium text-ink">{detailPage.overviewTitle(exam.code)}</h2>
            <div className="mt-7 space-y-5 text-lg leading-[1.75] text-ink/75">{detail.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          </Reveal>
          <Reveal className="space-y-8 border-t border-ink pt-6 lg:col-span-5" delay={0.08}>
            <div><p className="text-xs font-semibold tracking-[0.1em] text-secondary uppercase">{detailPage.audienceLabel}</p><p className="mt-3 text-base leading-relaxed text-ink/75">{summary.audience}</p></div>
            <div><p className="text-xs font-semibold tracking-[0.1em] text-secondary uppercase">{detailPage.purposeLabel}</p><p className="mt-3 text-base leading-relaxed text-ink/75">{summary.purpose}</p></div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted py-20 md:py-24">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{detailPage.coverageEyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3vw,2.75rem)] leading-tight font-medium text-ink">{detailPage.coverageTitle}</h2></div>
            <ul className="border-t border-ink lg:col-span-7">
              {summary.subjects.map((subject, index) => <li key={subject} className="flex min-h-16 items-center gap-5 border-b border-border py-3"><span className="w-7 text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><span className="font-heading text-xl text-ink md:text-2xl">{subject}</span></li>)}
            </ul>
          </Reveal>
        </div>
      </section>

      <ExamOverviewCarouselSection exam={exam} />

      <section className="border-y border-border bg-surface-muted py-20 md:py-28">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{detailPage.faqEyebrow}</p><h2 className="mt-4 max-w-md text-[clamp(2rem,3vw,2.75rem)] leading-tight font-medium text-ink">{detailPage.faqTitle}</h2></Reveal>
          <Reveal className="lg:col-span-7" delay={0.08}><Accordion className="border-t border-ink">{detail.faqs.map((faq, index) => <AccordionItem key={faq.question} value={`faq-${index}`}><AccordionTrigger className="min-h-16 rounded-none py-5 text-base text-ink md:text-lg">{faq.question}</AccordionTrigger><AccordionContent className="pb-6 pr-8 text-base leading-relaxed text-ink/70"><p>{faq.answer}</p></AccordionContent></AccordionItem>)}</Accordion></Reveal>
        </div>
      </section>

      <section id="consultation" className="section-offset relative overflow-hidden py-20 md:py-28">
        <div className="absolute top-0 right-[14%] h-full border-l border-dashed border-border" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-2"><CompassMark size={64} rotation={28} interactive /></Reveal>
          <Reveal className="lg:col-span-7"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{exam.code} · Oriens Academy</p><h2 className="mt-4 text-[clamp(2rem,4vw,3.5rem)] leading-[1.08] font-medium text-ink">{detail.cta.title}</h2><p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink/70">{detail.cta.body}</p></Reveal>
          <Reveal className="flex flex-col gap-3 sm:flex-row lg:col-span-3 lg:flex-col" delay={0.1}><ButtonLink href={`${localizedPath("home", locale)}#consultation-form`} directional size="lg" className="h-12 px-5">{detail.cta.primary}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink><ButtonLink href={localizedPath("exams", locale)} variant="outline" size="lg" className="h-12 px-5">{detail.cta.secondary}</ButtonLink></Reveal>
        </div>
      </section>
    </>
  );
}
