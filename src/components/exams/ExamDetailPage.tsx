"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ButtonLink } from "@/components/ui/button";
import { CompassMark } from "@/components/brand/CompassMark";
import { Reveal } from "@/components/motion/Reveal";
import { ExamDetailVisual } from "./ExamDetailVisual";
import { ExamOverviewCarouselSection } from "./ExamOverviewCarouselSection";
import { examRecords, type ExamRecord } from "@/content/exams";
import { useExamsContent, useLocale } from "@/content/locale-context";
import { examDetailPath, localizedPath } from "@/lib/routes";
import { OriensLottie } from "@/components/ui/OriensLottie";
import { getExamOwnerVisual } from "@/data/exam-visuals";

export function ExamDetailPage({ exam }: { exam: ExamRecord }) {
  const locale = useLocale();
  const { examText, examDetailText, detailPage, categories } = useExamsContent();
  const summary = examText[exam.code];
  const detail = examDetailText[exam.code];
  const related = exam.relatedExams.map((code) => examRecords.find((candidate) => candidate.code === code)).filter((candidate): candidate is ExamRecord => !!candidate);
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
              </div>
            </div>
            <div className="lg:col-span-5">
              {ownerVisual ? (
                <div className="mx-auto w-full max-w-[220px] rounded-[2rem] border border-border bg-[#F6F8F3] p-3 sm:max-w-[260px] lg:max-w-[300px]">
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

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-4"><CompassMark size={42} rotation={18} interactive /><p className="mt-6 text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{detailPage.supportEyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3vw,2.75rem)] leading-tight font-medium text-ink">{detailPage.supportTitle}</h2></div>
            <div className="border-t border-ink pt-6 lg:col-span-8"><p className="max-w-[68ch] text-xl leading-[1.7] text-ink/75">{detail.oriensSupport}</p><ul className="mt-8 grid gap-3 sm:grid-cols-2">{[summary.audience, summary.purpose].map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-ink/70"><Check className="mt-0.5 size-4 shrink-0 text-brand-accent" aria-hidden="true" />{item}</li>)}</ul></div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-surface py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{detailPage.preparationEyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3vw,2.75rem)] leading-tight font-medium text-ink">{detailPage.preparationTitle}</h2></Reveal>
          <div className="mt-12 grid border-t border-l border-border md:grid-cols-3">{detail.preparationAreas.map((area, index) => <Reveal key={area.title} className="border-r border-b border-border p-6 md:p-8" delay={index * 0.06} y={8}><span className="text-xs tabular-nums text-muted-foreground">0{index + 1}</span><h3 className="mt-8 text-2xl font-medium text-ink">{area.title}</h3><p className="mt-4 text-sm leading-[1.7] text-ink/70">{area.description}</p></Reveal>)}</div>
          <Reveal className="mt-8 border-l-2 border-brand-accent py-2 pl-5"><p className="max-w-[75ch] text-sm leading-relaxed text-muted-foreground">{detailPage.officialNote}</p></Reveal>
        </div>
      </section>

      <section className="overflow-hidden bg-surface-muted py-20 md:py-28">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-6 md:px-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{detailPage.factsLabel}</p><h2 className="mt-4 text-[clamp(2rem,3vw,2.75rem)] leading-tight font-medium text-ink">{exam.code} · {summary.title}</h2><p className="mt-5 max-w-[50ch] text-base leading-relaxed text-ink/70">{summary.shortDescription}</p></Reveal>
          <Reveal className="lg:col-span-7" delay={0.08}><ExamDetailVisual code={exam.code} variant={exam.visualVariant} label={detailPage.visualLabel(exam.code)} /></Reveal>
        </div>
      </section>

      <ExamOverviewCarouselSection exam={exam} />

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{detailPage.relatedEyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3vw,2.75rem)] leading-tight font-medium text-ink">{detailPage.relatedTitle}</h2></Reveal>
          <div className="mt-10 border-t border-ink">{related.map((relatedExam, index) => { const text = examText[relatedExam.code]; return <Reveal key={relatedExam.code} delay={index * 0.05} y={8}><Link href={examDetailPath(locale, relatedExam.slug)} className="group grid min-h-24 items-center gap-3 border-b border-border py-5 outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset sm:grid-cols-[5rem_1fr_auto] sm:px-4"><span className="font-heading text-3xl text-ink">{relatedExam.code}</span><span><span className="block font-heading text-lg text-secondary">{text.title}</span><span className="mt-1 block text-sm text-muted-foreground">{categories[relatedExam.primaryCategory].label}</span></span><ArrowUpRight className="size-5 text-brand-accent transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></Link></Reveal>; })}</div>
        </div>
      </section>

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
