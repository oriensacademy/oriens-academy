"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CompassMark } from "@/components/brand/CompassMark";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/button";
import {
  examCategoryOrder,
  examRecords,
  examsInPrimaryCategory,
} from "@/content/exams";
import { useExamsContent, useLocale } from "@/content/locale-context";
import { examDetailPath } from "@/lib/routes";

function ExamRouteVisual({ label }: { label: string }) {
  const reducedMotion = useReducedMotion();
  const duration = reducedMotion ? 0 : 1.1;

  return (
    <svg
      viewBox="0 0 560 360"
      role="img"
      aria-label={label}
      className="h-auto w-full"
      fill="none"
    >
      <title>{label}</title>
      <g stroke="var(--border)" strokeWidth="1">
        {[80, 160, 240, 320, 400, 480].map((x) => <line key={`x-${x}`} x1={x} y1="24" x2={x} y2="336" />)}
        {[60, 120, 180, 240, 300].map((y) => <line key={`y-${y}`} x1="24" y1={y} x2="536" y2={y} />)}
      </g>
      <line x1="24" y1="300" x2="536" y2="300" stroke="var(--secondary)" strokeWidth="1.25" />
      <line x1="80" y1="336" x2="80" y2="24" stroke="var(--secondary)" strokeWidth="1.25" />
      <motion.path
        d="M80 300 C150 284 166 220 236 218 S340 150 388 158 S452 112 500 64"
        stroke="var(--secondary)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: reducedMotion ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration, ease: [0.22, 1, 0.36, 1], delay: reducedMotion ? 0 : 0.15 }}
      />
      {[
        { x: 80, y: 300, text: "O" },
        { x: 236, y: 218, text: "01" },
        { x: 388, y: 158, text: "06" },
      ].map((point, index) => (
        <motion.g
          key={point.text}
          initial={{ opacity: reducedMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reducedMotion ? 0 : 0.35 + index * 0.18 }}
        >
          <circle cx={point.x} cy={point.y} r="4" fill="var(--background)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x={point.x + 10} y={point.y - 10} fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-inter)">{point.text}</text>
        </motion.g>
      ))}
      <motion.g
        initial={{ opacity: reducedMotion ? 1 : 0, scale: reducedMotion ? 1 : 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : 1 }}
        style={{ transformOrigin: "500px 64px" }}
      >
        <circle cx="500" cy="64" r="10" fill="var(--background)" stroke="var(--brand-accent)" strokeWidth="2" />
        <circle cx="500" cy="64" r="3" fill="var(--brand-accent)" />
      </motion.g>
      <text x="96" y="326" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-inter)">x</text>
      <text x="61" y="42" fill="var(--muted-foreground)" fontSize="10" fontFamily="var(--font-inter)">y</text>
      <text x="390" y="91" fill="var(--brand-accent)" fontSize="11" fontWeight="600" fontFamily="var(--font-inter)" letterSpacing="1.6">DESTINATION</text>
    </svg>
  );
}

export function ExamHub() {
  const locale = useLocale();
  const { page, categories, examText } = useExamsContent();
  const featured = examRecords.filter((exam) => exam.featured);
  const primaryFeature = featured[0];
  const secondaryFeatures = featured.slice(1);

  return (
    <>
      <section id="top" className="relative overflow-hidden border-b border-border pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-12 px-6 md:px-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">{page.eyebrow}</p>
            <h1 className="mt-5 max-w-[720px] text-[clamp(2.75rem,5.6vw,5rem)] leading-[1.02] font-medium text-ink">
              {page.title}
            </h1>
            <p className="mt-7 max-w-[62ch] text-lg leading-[1.7] text-ink/75 md:text-xl">{page.lead}</p>
            <div className="mt-9 flex items-center gap-4 border-l-2 border-brand-accent pl-4 text-xs font-medium tracking-[0.16em] text-secondary uppercase">
              <CompassMark size={24} interactive />
              <span>{page.heroNote}</span>
            </div>
          </div>
          <div className="relative lg:col-span-5">
            <div className="absolute inset-y-8 left-0 border-l border-border" aria-hidden="true" />
            <ExamRouteVisual label={locale === "tr" ? "Hedefe ilerleyen koordinat rotası" : "A coordinate route progressing towards a destination"} />
          </div>
        </div>
      </section>

      <nav aria-label={page.indexLabel} className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-12 md:py-10">
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
            <h2 className="font-sans text-sm font-semibold tracking-[0.12em] text-ink uppercase">{page.indexLabel}</h2>
            <p className="text-sm text-muted-foreground">{page.indexHint}</p>
          </div>
          <ol className="mt-6 grid grid-cols-3 border-t border-l border-border sm:grid-cols-4 lg:grid-cols-6">
            {examRecords.map((exam, index) => (
              <li key={exam.code}>
                <Link
                  href={examDetailPath(locale, exam.slug)}
                  className="group flex min-h-16 items-center justify-between gap-2 border-r border-b border-border px-3 py-3 outline-none transition-colors duration-200 hover:bg-surface-muted focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset md:px-4"
                  aria-label={examText[exam.code].ctaLabel}
                >
                  <span className="font-heading text-xl text-ink md:text-2xl">{exam.code}</span>
                  <span className="self-start text-[10px] tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">{page.featuredEyebrow}</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-2 lg:items-end">
              <h2 className="max-w-xl text-[clamp(2rem,3vw,2.75rem)] leading-[1.12] font-medium text-ink">{page.featuredTitle}</h2>
              <p className="max-w-[58ch] text-base leading-relaxed text-ink/70 lg:justify-self-end">{page.featuredBody}</p>
            </div>
          </Reveal>

          <div className="mt-14 grid border-t border-border lg:grid-cols-12">
            <Reveal className="border-b border-border py-9 lg:col-span-7 lg:border-r lg:px-8 lg:py-12" y={10}>
              <span className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">01 / {categories[primaryFeature.primaryCategory].label}</span>
              <div className="mt-8 flex items-start justify-between gap-5">
                <div>
                  <p className="font-heading text-[clamp(3.5rem,8vw,7rem)] leading-none text-ink">{primaryFeature.code}</p>
                  <h3 className="mt-4 max-w-xl font-heading text-2xl leading-tight text-secondary">{examText[primaryFeature.code].title}</h3>
                </div>
                <CompassMark size={42} rotation={34} interactive className="shrink-0" />
              </div>
              <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-ink/75">{examText[primaryFeature.code].shortDescription}</p>
              <Link href={examDetailPath(locale, primaryFeature.slug)} className="mt-8 inline-flex min-h-11 items-center gap-2 font-semibold text-ink underline decoration-brand-accent underline-offset-8 outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">
                {examText[primaryFeature.code].ctaLabel}<ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </Reveal>

            <div className="lg:col-span-5">
              {secondaryFeatures.map((exam, index) => (
                <Reveal key={exam.code} className="border-b border-border py-9 lg:px-8 lg:py-10" delay={0.08 + index * 0.06} y={10}>
                  <div className="flex items-start gap-6">
                    <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">0{index + 2}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-4xl text-ink">{exam.code}</p>
                      <p className="mt-2 text-sm leading-relaxed text-ink/70">{examText[exam.code].shortDescription}</p>
                      <Link href={examDetailPath(locale, exam.slug)} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink outline-none hover:text-brand-accent focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">
                        {examText[exam.code].ctaLabel}<ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">{page.groupsEyebrow}</p>
            <h2 className="mt-4 text-[clamp(2rem,3vw,2.75rem)] leading-[1.12] font-medium text-ink">{page.groupsTitle}</h2>
          </Reveal>

          <div className="mt-14 space-y-16 md:space-y-20">
            {examCategoryOrder.map((categoryId, categoryIndex) => {
              const categoryExams = examsInPrimaryCategory(categoryId);
              return (
                <section key={categoryId} id={categoryId} aria-labelledby={`${categoryId}-title`}>
                  <Reveal className="grid gap-4 border-t border-ink pt-5 md:grid-cols-12">
                    <div className="md:col-span-1 text-xs tabular-nums text-muted-foreground">0{categoryIndex + 1}</div>
                    <div className="md:col-span-5">
                      <h3 id={`${categoryId}-title`} className="text-2xl font-medium text-ink md:text-3xl">{categories[categoryId].label}</h3>
                    </div>
                    <p className="max-w-[55ch] text-sm leading-relaxed text-ink/70 md:col-span-6">{categories[categoryId].description}</p>
                  </Reveal>

                  <div className="mt-7 border-t border-border">
                    {categoryExams.map((exam, examIndex) => {
                      const text = examText[exam.code];
                      const secondaryCategories = exam.categories.filter((category) => category !== exam.primaryCategory);
                      return (
                        <Reveal key={exam.code} delay={Math.min(examIndex * 0.04, 0.16)} y={8}>
                          <article className="group grid gap-5 border-b border-border py-7 md:grid-cols-12 md:gap-6 md:py-9">
                            <div className="flex items-start justify-between md:col-span-3">
                              <div>
                                <p className="font-heading text-4xl text-ink md:text-5xl">{exam.code}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text.title}</p>
                              </div>
                              <span className="text-[10px] tabular-nums text-muted-foreground md:hidden">{String(exam.order + 1).padStart(2, "0")}</span>
                            </div>
                            <div className="md:col-span-4">
                              <p className="text-xs font-semibold tracking-[0.08em] text-secondary uppercase">{page.supportLabel}</p>
                              <p className="mt-2 text-sm leading-relaxed text-ink/75">{text.shortDescription}</p>
                            </div>
                            <div className="md:col-span-3">
                              <p className="text-xs font-semibold tracking-[0.08em] text-secondary uppercase">{page.purposeLabel}</p>
                              <p className="mt-2 text-sm leading-relaxed text-ink/75">{text.purpose}</p>
                              <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
                                {text.subjects.slice(0, 3).map((subject) => <span key={subject} className="text-xs text-muted-foreground">{subject}</span>)}
                              </div>
                              {secondaryCategories.length > 0 && (
                                <p className="mt-3 text-[11px] text-muted-foreground">{page.categoryAlso}: {secondaryCategories.map((id) => categories[id].label).join(", ")}</p>
                              )}
                            </div>
                            <div className="flex items-end md:col-span-2 md:justify-end">
                              <Link href={examDetailPath(locale, exam.slug)} aria-label={text.ctaLabel} className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-ink py-2 text-sm font-semibold text-ink outline-none transition-colors duration-200 group-hover:border-brand-accent group-hover:text-brand-accent focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 md:w-auto md:min-w-36">
                                <span>{text.ctaLabel}</span><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                              </Link>
                            </div>
                          </article>
                        </Reveal>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      <section id="consultation" className="section-offset relative overflow-hidden py-20 md:py-28">
        <div className="absolute top-0 right-[12%] h-full border-l border-dashed border-border" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-2">
            <CompassMark size={64} rotation={18} interactive />
          </Reveal>
          <div className="lg:col-span-7">
            <Reveal>
              <p className="text-xs font-medium tracking-[0.24em] text-brand-accent uppercase">{page.cta.eyebrow}</p>
              <h2 className="mt-4 max-w-3xl text-[clamp(2rem,4vw,3.5rem)] leading-[1.08] font-medium text-ink">{page.cta.title}</h2>
              <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink/70">{page.cta.body}</p>
            </Reveal>
          </div>
          <Reveal className="flex flex-col gap-3 sm:flex-row lg:col-span-3 lg:flex-col" delay={0.1}>
            <ButtonLink href={`/${locale}#booking`} directional size="lg" className="h-12 px-5 text-sm">{page.cta.primary}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink>
            <ButtonLink href="mailto:hello@oriens.academy" variant="outline" size="lg" className="h-12 px-5 text-sm">{page.cta.secondary}</ButtonLink>
          </Reveal>
        </div>
      </section>
    </>
  );
}
