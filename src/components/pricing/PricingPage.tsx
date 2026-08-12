"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Mail } from "lucide-react";
import { CompassMark } from "@/components/brand/CompassMark";
import { Reveal } from "@/components/motion/Reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ButtonLink } from "@/components/ui/button";
import { pricingPackages, type PricingPackage } from "@/content/pricing";
import { useLocale, usePricingContent } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";

function indexOf(position: number) {
  return String(position + 1).padStart(2, "0");
}

export function PricingPage() {
  const locale = useLocale();
  const content = usePricingContent();
  const activePackages = [...pricingPackages].filter((item) => item.active).sort((a, b) => a.order - b.order);
  const featured = activePackages.find((item) => item.featured) ?? activePackages[0];
  const remaining = activePackages.filter((item) => item.id !== featured.id);
  const bookingHref = `${localizedPath("home", locale)}#booking`;

  function priceFor(item: PricingPackage) {
    return item.priceAmount === null ? content.packages.customPrice : content.packages.formatStartingPrice(item.priceAmount);
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-border pt-24 pb-16 md:pt-30 md:pb-24">
        <div className="absolute inset-y-0 right-[12%] hidden border-l border-dashed border-border lg:block" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1280px] px-6 md:px-12">
          <nav aria-label={content.breadcrumb.ariaLabel}>
            <ol className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li><Link href={localizedPath("home", locale)} className="inline-flex min-h-11 items-center rounded-sm outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">{content.breadcrumb.home}</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-ink">{content.breadcrumb.current}</li>
            </ol>
          </nav>

          <div className="mt-10 grid min-w-0 gap-12 lg:grid-cols-12 lg:items-end lg:gap-16">
            <Reveal className="lg:col-span-7" y={10}>
              <p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.hero.eyebrow}</p>
              <h1 className="mt-5 max-w-[14ch] text-[clamp(3rem,6vw,5.7rem)] leading-[0.98] font-medium tracking-[-0.035em] text-ink">{content.hero.title}</h1>
              <p className="mt-7 max-w-[64ch] text-lg leading-[1.75] text-ink/72">{content.hero.description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="#packages" size="lg" className="h-12 px-5">{content.hero.primaryCta}<ArrowDown className="size-4" aria-hidden="true" /></ButtonLink>
                <ButtonLink href={bookingHref} variant="outline" size="lg" className="h-12 px-5">{content.hero.secondaryCta}</ButtonLink>
              </div>
            </Reveal>

            <Reveal className="min-w-0 border-t border-ink lg:col-span-5" delay={0.1}>
              <div className="flex min-h-16 items-center justify-between border-b border-border">
                <span className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{content.hero.indexLabel}</span>
                <CompassMark size={28} rotation={18} />
              </div>
              <ol>
                {activePackages.map((item, index) => (
                  <li key={item.id} className="grid grid-cols-[2.2rem_1fr_auto] items-center gap-3 border-b border-border py-4">
                    <span className="text-xs tabular-nums text-muted-foreground">{indexOf(index)}</span>
                    <span className="font-heading text-lg text-ink">{content.packages.items[item.id].title}</span>
                    <span className="text-right text-sm font-semibold tabular-nums text-secondary">{priceFor(item)}</span>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="packages" className="section-offset py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.packages.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.3rem)] leading-[1.08] font-medium text-ink">{content.packages.title}</h2></div>
            <p className="max-w-[58ch] self-end text-base leading-[1.75] text-ink/70 lg:col-span-6">{content.packages.intro}</p>
          </Reveal>

          <Reveal className="mt-12 border-t-2 border-brand-accent bg-surface" y={8}>
            <article aria-label={`${content.packages.items[featured.id].title}, ${content.packages.featuredLabel}`} className="grid min-w-0 lg:grid-cols-12">
              <div className="border-b border-border p-6 sm:p-8 lg:col-span-7 lg:border-r lg:border-b-0 lg:p-10">
                <div className="flex flex-wrap items-center gap-3"><span className="border border-brand-accent px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-brand-accent uppercase">{content.packages.featuredLabel}</span><span className="text-xs text-muted-foreground">{content.packages.activeLabel}</span></div>
                <h3 className="mt-9 text-[clamp(2.5rem,5vw,4.5rem)] leading-none font-medium text-ink">{content.packages.items[featured.id].title}</h3>
                <p className="mt-5 max-w-[58ch] text-base leading-[1.75] text-ink/70">{content.packages.items[featured.id].description}</p>
                <div className="mt-9 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-heading text-[clamp(2.4rem,4vw,3.8rem)] leading-none text-ink tabular-nums">{priceFor(featured)}</span><span className="text-sm text-muted-foreground">{content.packages.billingLabels[featured.billingBasis]}</span></div>
              </div>
              <div className="flex flex-col p-6 sm:p-8 lg:col-span-5 lg:p-10">
                <ul className="flex-1 border-t border-ink">
                  {content.packages.items[featured.id].features.map((feature) => <li key={feature} className="flex min-h-14 items-center gap-3 border-b border-border py-3 text-sm text-secondary"><Check className="size-4 shrink-0 text-brand-accent" aria-hidden="true" />{feature}</li>)}
                </ul>
                <ButtonLink href={bookingHref} directional size="lg" className="mt-7 h-12 w-full px-5">{content.packages.ctaLabel}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink>
              </div>
            </article>
          </Reveal>

          <div className="border-t border-ink">
            {remaining.map((item, index) => {
              const itemContent = content.packages.items[item.id];
              return (
                <Reveal key={item.id} delay={index * 0.05} y={8}>
                  <article className="grid min-w-0 gap-6 border-b border-border py-8 lg:grid-cols-12 lg:items-start lg:gap-8">
                    <div className="lg:col-span-4"><span className="text-xs tabular-nums text-muted-foreground">{String(item.order).padStart(2, "0")}</span><h3 className="mt-4 text-3xl font-medium text-ink md:text-4xl">{itemContent.title}</h3><p className="mt-3 text-sm leading-[1.7] text-ink/70">{itemContent.description}</p></div>
                    <div className="lg:col-span-3"><p className="font-heading text-3xl text-ink tabular-nums">{priceFor(item)}</p><p className="mt-2 text-sm text-muted-foreground">{content.packages.billingLabels[item.billingBasis]}</p></div>
                    <ul className="border-t border-border lg:col-span-3">{itemContent.features.map((feature) => <li key={feature} className="flex min-h-12 items-center gap-2.5 border-b border-border py-2 text-sm text-secondary"><Check className="size-3.5 shrink-0 text-brand-accent" aria-hidden="true" />{feature}</li>)}</ul>
                    <div className="lg:col-span-2 lg:text-right"><ButtonLink href={bookingHref} variant="outline" size="lg" className="h-12 w-full px-4 lg:w-auto">{content.packages.ctaLabel}</ButtonLink></div>
                  </article>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-8 border-l-2 border-brand-accent py-1 pl-5"><p className="max-w-[82ch] text-sm leading-relaxed text-muted-foreground">{content.packages.priceSourceNote}</p></Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="max-w-3xl"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.included.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.3rem)] leading-[1.08] font-medium text-ink">{content.included.title}</h2><p className="mt-5 text-base leading-[1.75] text-ink/70">{content.included.intro}</p></Reveal>
          <dl className="mt-12 grid border-t border-l border-border md:grid-cols-2">
            {content.included.items.map((item, index) => <Reveal key={item.title} className="border-r border-b border-border p-6 md:p-8" delay={index * 0.04} y={8}><dt className="flex items-center gap-4"><span className="text-xs tabular-nums text-brand-accent">{indexOf(index)}</span><span className="font-heading text-xl text-ink md:text-2xl">{item.title}</span></dt><dd className="mt-4 max-w-[56ch] text-sm leading-[1.75] text-ink/70">{item.description}</dd></Reveal>)}
          </dl>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-6 lg:grid-cols-12"><div className="lg:col-span-6"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.explanation.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.3rem)] leading-[1.08] font-medium text-ink">{content.explanation.title}</h2></div><p className="self-end text-base leading-[1.75] text-ink/70 lg:col-span-6">{content.explanation.intro}</p></Reveal>
          <ol className="relative mt-14 grid border-l border-border md:grid-cols-3 md:border-t md:border-l-0">
            {content.explanation.steps.map((step, index) => <Reveal key={step.id} className="relative border-b border-border py-7 pl-6 md:border-r md:px-7" delay={index * 0.06} y={8}><span aria-hidden="true" className="absolute top-8 -left-[5px] size-2.5 rounded-full bg-brand-accent md:top-[-5px] md:left-7" /><span className="text-xs tabular-nums text-muted-foreground">{indexOf(index)}</span><h3 className="mt-5 font-heading text-2xl text-ink">{step.title}</h3><p className="mt-3 text-sm leading-[1.7] text-ink/70">{step.description}</p></Reveal>)}
          </ol>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted py-20 md:py-28">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.faq.eyebrow}</p><h2 className="mt-4 max-w-md text-[clamp(2rem,3.6vw,3.3rem)] leading-[1.08] font-medium text-ink">{content.faq.title}</h2></Reveal>
          <Reveal className="lg:col-span-7" delay={0.08}><Accordion className="border-t border-ink">{content.faq.items.map((item, index) => <AccordionItem key={item.question} value={`pricing-faq-${index}`}><AccordionTrigger className="min-h-16 rounded-none py-5 text-base text-ink md:text-lg">{item.question}</AccordionTrigger><AccordionContent className="pb-6 pr-8 text-base leading-relaxed text-ink/70"><p>{item.answer}</p></AccordionContent></AccordionItem>)}</Accordion></Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute top-0 right-[14%] h-full border-l border-dashed border-border" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-2"><CompassMark size={64} rotation={26} interactive /></Reveal>
          <Reveal className="lg:col-span-7"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.cta.eyebrow}</p><h2 className="mt-4 text-[clamp(2.2rem,4vw,3.7rem)] leading-[1.06] font-medium text-ink">{content.cta.title}</h2><p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink/70">{content.cta.body}</p></Reveal>
          <Reveal className="flex flex-col gap-3 sm:flex-row lg:col-span-3 lg:flex-col" delay={0.1}><ButtonLink href={bookingHref} directional size="lg" className="h-12 px-5">{content.cta.primary}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink><ButtonLink href="mailto:hello@oriens.academy" variant="outline" size="lg" className="h-12 px-5">{content.cta.secondary}<Mail className="size-4" aria-hidden="true" /></ButtonLink></Reveal>
        </div>
      </section>
    </>
  );
}
