"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Mail } from "lucide-react";
import { CompassMark } from "@/components/brand/CompassMark";
import { Reveal } from "@/components/motion/Reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ButtonLink } from "@/components/ui/button";
import { useLocale, useUniversitySupportContent } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";
import { CONTACT } from "@/config/contact";
import { OriensLottie } from "@/components/ui/OriensLottie";

const number = (index: number) => String(index + 1).padStart(2, "0");

export function UniversitySupportPage() {
  const locale = useLocale();
  const content = useUniversitySupportContent();
  const sortedAreas = [...content.areas.items].sort((a, b) => a.order - b.order);
  const featured = sortedAreas.find((area) => area.featured) ?? sortedAreas[0];
  const indexedAreas = sortedAreas.filter((area) => area.id !== featured.id);
  const bookingHref = `${localizedPath("home", locale)}#consultation-form`;

  return (
    <>
      <section id="top" className="relative overflow-hidden border-b border-border pt-24 pb-16 md:pt-30 md:pb-24">
        <div className="absolute inset-y-0 right-[9%] hidden border-l border-dashed border-border lg:block" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1280px] px-6 md:px-12">
          <nav aria-label={content.breadcrumb.ariaLabel}>
            <ol className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li>
                <Link href={localizedPath("home", locale)} className="inline-flex min-h-11 items-center rounded-sm outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">
                  {content.breadcrumb.home}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-ink">{content.breadcrumb.current}</li>
            </ol>
          </nav>

          <div className="mt-9 grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
            <div className="min-w-0 max-w-[760px]">
              <Reveal y={10}>
                <h1 className="max-w-[720px] text-[clamp(50px,5.8vw,86px)] leading-[0.98] font-medium tracking-[-0.035em] text-ink">
                  {content.hero.title}
                </h1>
                <p className="mt-7 max-w-[60ch] text-lg leading-[1.75] text-ink/72">{content.hero.description}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href={bookingHref} directional size="lg" className="h-12 px-5">{content.hero.primaryCta}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink>
                  <ButtonLink href="#support-areas" variant="outline" size="lg" className="h-12 px-5">
                    {content.hero.secondaryCta}<ArrowDown className="size-4" aria-hidden="true" />
                  </ButtonLink>
                </div>
              </Reveal>
            </div>
            <Reveal y={10} delay={0.08} className="mx-auto w-full max-w-[470px]">
              <OriensLottie
                src="/animations/learning.lottie"
                aspectRatio="learning"
                speed={0.9}
                ariaLabel={locale === "tr" ? "Üniversite ders desteği ve öğrenme animasyonu" : "University learning and academic support animation"}
              />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.audience.eyebrow}</p>
              <h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.audience.title}</h2>
              <p className="mt-6 max-w-[50ch] text-base leading-[1.75] text-ink/70">{content.audience.intro}</p>
            </div>
            <ol className="border-t border-ink lg:col-span-7">
              {content.audience.items.map((item, index) => (
                <li key={item.title} className="grid gap-2 border-b border-border py-6 sm:grid-cols-[3rem_1fr] sm:gap-5">
                  <span className="text-xs tabular-nums text-muted-foreground">{number(index)}</span>
                  <div><h3 className="font-heading text-xl text-ink md:text-2xl">{item.title}</h3><p className="mt-2 max-w-[60ch] text-sm leading-[1.7] text-ink/70">{item.description}</p></div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section id="support-areas" className="section-offset border-y border-border bg-surface-muted py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.areas.eyebrow}</p>
              <h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.areas.title}</h2>
            </div>
            <p className="max-w-[58ch] self-end text-base leading-[1.75] text-ink/70 lg:col-span-6">{content.areas.intro}</p>
          </Reveal>

          <div className="mt-12 grid gap-8 lg:grid-cols-12">
            <Reveal className="border-t-2 border-secondary bg-surface p-6 sm:p-8 lg:col-span-7" y={8}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium tracking-[0.14em] text-brand-accent uppercase">{content.areas.categoryLabels[featured.category]}</span>
                <span className="text-xs tabular-nums text-muted-foreground">01 / {String(sortedAreas.length).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-10 max-w-xl text-[clamp(2rem,4vw,3.4rem)] leading-[1.05] font-medium text-ink">{featured.title}</h3>
              <p className="mt-5 max-w-[62ch] text-base leading-[1.75] text-ink/70">{featured.shortDescription}</p>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-5">
                {featured.topics.map((topic) => <li key={topic} className="flex min-h-11 items-center gap-2 text-sm text-secondary"><Check className="size-4 text-brand-accent" aria-hidden="true" />{topic}</li>)}
              </ul>
            </Reveal>

            <Reveal className="lg:col-span-5" delay={0.08} y={8}>
              <p className="border-b border-ink pb-4 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{content.areas.indexLabel}</p>
              <ol>
                {indexedAreas.map((area) => (
                  <li key={area.id} className="border-b border-border py-5">
                    <div className="flex items-start gap-4"><span className="mt-1 w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{String(area.order).padStart(2, "0")}</span><div><p className="text-[10px] font-medium tracking-[0.12em] text-brand-accent uppercase">{content.areas.categoryLabels[area.category]}</p><h3 className="mt-1 font-heading text-xl text-ink">{area.title}</h3><p className="mt-2 text-sm leading-[1.65] text-ink/68">{area.shortDescription}</p></div></div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
          <Reveal className="mt-8 border-l-2 border-brand-accent py-1 pl-5"><p className="max-w-[82ch] text-sm leading-relaxed text-muted-foreground">{content.areas.scopeNote}</p></Reveal>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="max-w-3xl">
            <p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.method.eyebrow}</p>
            <h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.method.title}</h2>
            <p className="mt-5 text-base leading-[1.75] text-ink/70">{content.method.intro}</p>
          </Reveal>
          <ol className="relative mt-14 grid border-l border-border sm:grid-cols-2 sm:border-t sm:border-l-0 lg:grid-cols-4">
            {content.method.steps.map((step, index) => (
              <Reveal key={step.id} className="relative border-b border-border py-7 pl-6 sm:border-r sm:px-6" delay={index * 0.05} y={8}>
                <span aria-hidden="true" className="absolute top-8 -left-[5px] size-2.5 rounded-full bg-brand-accent sm:top-[-5px] sm:left-6" />
                <span className="text-xs tabular-nums text-muted-foreground">{number(index)}</span>
                <h3 className="mt-5 font-heading text-2xl text-ink">{step.title}</h3>
                <p className="mt-3 text-sm leading-[1.7] text-ink/70">{step.description}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.approach.eyebrow}</p><h2 className="mt-4 max-w-2xl text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.approach.title}</h2></Reveal>
          <div className="mt-12 grid border-t border-l border-border md:grid-cols-3">
            {content.approach.items.map((item, index) => (
              <Reveal key={item.title} className="border-r border-b border-border p-6 md:p-8" delay={index * 0.06} y={8}>
                <span className="text-xs tabular-nums text-muted-foreground">{number(index)}</span>
                <h3 className="mt-10 text-2xl font-medium text-ink">{item.title}</h3>
                <p className="mt-4 text-sm leading-[1.75] text-ink/70">{item.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-6 lg:grid-cols-12"><div className="lg:col-span-6"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.journey.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.journey.title}</h2></div><p className="self-end text-base leading-[1.75] text-ink/70 lg:col-span-6">{content.journey.intro}</p></Reveal>
          <ol className="mt-12 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
            {content.journey.steps.map((step, index) => (
              <Reveal key={step.id} delay={index * 0.05} y={8}>
                <li className="border-t border-ink pt-5"><span className="text-xs tabular-nums text-brand-accent">{number(index)}</span><h3 className="mt-5 font-heading text-xl text-ink">{step.title}</h3><p className="mt-3 text-sm leading-[1.7] text-ink/70">{step.description}</p></li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-7"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.individual.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.individual.title}</h2><p className="mt-7 max-w-[65ch] text-lg leading-[1.8] text-ink/72">{content.individual.body}</p></Reveal>
          <Reveal className="border-t border-ink lg:col-span-5" delay={0.08}>
            <ul>{content.individual.points.map((point) => <li key={point} className="flex min-h-16 items-center gap-3 border-b border-border py-3 text-sm text-secondary"><Check className="size-4 shrink-0 text-brand-accent" aria-hidden="true" />{point}</li>)}</ul>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted py-20 md:py-28">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.faq.eyebrow}</p><h2 className="mt-4 max-w-md text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.faq.title}</h2></Reveal>
          <Reveal className="lg:col-span-7" delay={0.08}>
            <Accordion className="border-t border-ink">{content.faq.items.map((item, index) => <AccordionItem key={item.question} value={`university-faq-${index}`}><AccordionTrigger className="min-h-16 rounded-none py-5 text-base text-ink md:text-lg">{item.question}</AccordionTrigger><AccordionContent className="pb-6 pr-8 text-base leading-relaxed text-ink/70"><p>{item.answer}</p></AccordionContent></AccordionItem>)}</Accordion>
          </Reveal>
        </div>
      </section>

      <section id="consultation" className="section-offset relative overflow-hidden py-20 md:py-28">
        <div className="absolute top-0 right-[14%] h-full border-l border-dashed border-border" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-2"><CompassMark size={64} rotation={24} interactive /></Reveal>
          <Reveal className="lg:col-span-7"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.cta.eyebrow}</p><h2 className="mt-4 text-[clamp(2.2rem,4vw,3.7rem)] leading-[1.06] font-medium text-ink">{content.cta.title}</h2><p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink/70">{content.cta.body}</p></Reveal>
          <Reveal className="flex flex-col gap-3 sm:flex-row lg:col-span-3 lg:flex-col" delay={0.1}>
            <ButtonLink href={bookingHref} directional size="lg" className="h-12 px-5">{content.cta.primary}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink>
            <ButtonLink href={CONTACT.emailHref} variant="outline" size="lg" className="h-12 px-5">{content.cta.secondary}<Mail className="size-4" aria-hidden="true" /></ButtonLink>
          </Reveal>
        </div>
      </section>
    </>
  );
}
