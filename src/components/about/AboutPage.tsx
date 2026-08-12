"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Mail } from "lucide-react";
import { CompassMark } from "@/components/brand/CompassMark";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/button";
import { examRecords } from "@/content/exams";
import { useAboutContent, useLocale } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";
import { GuidanceRouteVisual } from "./GuidanceRouteVisual";

const number = (index: number) => String(index + 1).padStart(2, "0");

export function AboutPage() {
  const locale = useLocale();
  const content = useAboutContent();
  const bookingHref = `${localizedPath("home", locale)}#booking`;
  const team = content.team.members.filter((member) => member.active).sort((a, b) => a.order - b.order);
  const metrics = content.outcomes.metrics.filter((metric) => metric.active).sort((a, b) => a.order - b.order);
  const testimonials = content.testimonials.items
    .filter((item) => item.active && item.verified && item.locale === locale)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      <section className="relative overflow-hidden border-b border-border pt-24 pb-16 md:pt-30 md:pb-24">
        <div className="absolute inset-y-0 right-[10%] hidden border-l border-dashed border-border lg:block" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1280px] px-6 md:px-12">
          <nav aria-label={content.breadcrumb.ariaLabel}>
            <ol className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li><Link href={localizedPath("home", locale)} className="inline-flex min-h-11 items-center rounded-sm outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">{content.breadcrumb.home}</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-ink">{content.breadcrumb.current}</li>
            </ol>
          </nav>

          <div className="mt-9 grid min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-12 lg:gap-14">
            <Reveal className="min-w-0 lg:col-span-7" y={10}>
              <p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.hero.eyebrow}</p>
              <h1 className="mt-5 max-w-[13ch] text-[clamp(2.8rem,6.2vw,5.8rem)] leading-[0.98] font-medium tracking-[-0.035em] text-ink">{content.hero.title}</h1>
              <p className="mt-7 max-w-[62ch] text-lg leading-[1.75] text-ink/72">{content.hero.description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={bookingHref} directional size="lg" className="h-12 px-5">{content.hero.primaryCta}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink>
                <ButtonLink href="#approach" variant="outline" size="lg" className="h-12 px-5">{content.hero.secondaryCta}<ArrowDown className="size-4" aria-hidden="true" /></ButtonLink>
              </div>
            </Reveal>
            <Reveal className="min-w-0 lg:col-span-5" delay={0.12}>
              <GuidanceRouteVisual ariaLabel={content.hero.visualLabel} steps={content.hero.visualSteps} compact />
            </Reveal>
          </div>
        </div>
      </section>

      <section id="approach" className="section-offset py-20 md:py-28">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.story.eyebrow}</p>
            <h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.story.title}</h2>
          </Reveal>
          <Reveal className="lg:col-span-7" delay={0.08}>
            <div className="border-t border-ink pt-6">
              {content.story.paragraphs.map((paragraph) => <p key={paragraph} className="not-first:mt-5 max-w-[68ch] text-base leading-[1.8] text-ink/72">{paragraph}</p>)}
              <p className="mt-7 border-l-2 border-brand-accent pl-4 text-sm leading-[1.7] text-muted-foreground">{content.story.note}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.principles.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.principles.title}</h2></div>
            <p className="max-w-[58ch] self-end text-base leading-[1.75] text-ink/70 lg:col-span-6">{content.principles.intro}</p>
          </Reveal>
          <ol className="mt-12 border-t border-ink">
            {content.principles.items.map((item, index) => (
              <Reveal key={item.id} delay={index * 0.04} y={8}>
                <li className="grid gap-3 border-b border-border py-6 sm:grid-cols-[3rem_minmax(10rem,0.75fr)_1.5fr] sm:items-start sm:gap-6">
                  <span className="text-xs tabular-nums text-brand-accent">{number(index)}</span>
                  <h3 className="font-heading text-2xl text-ink">{item.title}</h3>
                  <p className="max-w-[60ch] text-sm leading-[1.75] text-ink/70">{item.description}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-7 lg:grid-cols-12">
            <div className="lg:col-span-6"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.team.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.team.title}</h2></div>
            <p className="max-w-[58ch] self-end text-base leading-[1.75] text-ink/70 lg:col-span-6">{content.team.intro}</p>
          </Reveal>
          {team.length > 0 ? (
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {team.map((member) => (
                <article key={member.id} className="grid border-t border-ink pt-6 sm:grid-cols-[9rem_1fr] sm:gap-6">
                  {member.photo && <Image src={member.photo.src} alt={member.photo.alt} width={member.photo.width} height={member.photo.height} className="aspect-[4/5] w-full object-cover" />}
                  <div><h3 className="font-heading text-2xl text-ink">{member.name}</h3><p className="mt-1 text-xs font-medium tracking-[0.12em] text-brand-accent uppercase">{member.role}</p><p className="mt-4 text-sm leading-[1.75] text-ink/70">{member.shortBio}</p></div>
                </article>
              ))}
            </div>
          ) : (
            <Reveal className="mt-12 grid overflow-hidden border-y border-border bg-surface lg:grid-cols-12" y={8}>
              <div className="relative min-h-56 border-b border-border p-7 lg:col-span-5 lg:border-r lg:border-b-0 sm:p-9">
                <div className="absolute inset-0 opacity-50" aria-hidden="true"><div className="absolute inset-y-0 left-1/3 border-l border-dashed border-border" /><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" /></div>
                <div className="relative flex h-full items-center justify-center"><CompassMark size={88} rotation={18} animated /></div>
              </div>
              <div className="p-7 lg:col-span-7 sm:p-9"><h3 className="text-[clamp(1.7rem,3vw,2.5rem)] leading-[1.1] font-medium text-ink">{content.team.fallbackTitle}</h3><p className="mt-5 max-w-[62ch] text-sm leading-[1.8] text-ink/70">{content.team.fallbackBody}</p><ul className="mt-7 border-t border-border">{content.team.fallbackPoints.map((point) => <li key={point} className="flex min-h-14 items-center gap-3 border-b border-border py-3 text-sm text-secondary"><Check className="size-4 shrink-0 text-brand-accent" aria-hidden="true" />{point}</li>)}</ul></div>
            </Reveal>
          )}
        </div>
      </section>

      <section className="overflow-hidden border-y border-border bg-surface py-20 md:py-28">
        <div className="mx-auto grid min-w-0 max-w-[1280px] items-center gap-12 px-6 md:px-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.brandMoment.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.brandMoment.title}</h2><p className="mt-6 max-w-[60ch] text-base leading-[1.8] text-ink/70">{content.brandMoment.body}</p></Reveal>
          <Reveal className="min-w-0 lg:col-span-7" delay={0.1}><GuidanceRouteVisual ariaLabel={content.hero.visualLabel} steps={content.brandMoment.steps} /></Reveal>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="grid gap-6 lg:grid-cols-12"><div className="lg:col-span-6"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.outcomes.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.outcomes.title}</h2></div><p className="max-w-[60ch] self-end text-base leading-[1.75] text-ink/70 lg:col-span-6">{content.outcomes.intro}</p></Reveal>
          {metrics.length > 0 && <dl className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{metrics.map((metric) => <div key={metric.id} className="border-t border-ink pt-5"><dt className="text-sm text-ink/70">{metric.label}</dt><dd className="mt-4 font-heading text-4xl text-ink">{metric.value}</dd></div>)}</dl>}
          <ol className="mt-12 grid border-t border-l border-border sm:grid-cols-2 lg:grid-cols-5">
            {content.outcomes.items.map((item, index) => <Reveal key={item.title} className="border-r border-b border-border p-6" delay={index * 0.04} y={8}><li><span className="text-xs tabular-nums text-muted-foreground">{number(index)}</span><h3 className="mt-8 font-heading text-xl text-ink">{item.title}</h3><p className="mt-3 text-sm leading-[1.7] text-ink/70">{item.description}</p></li></Reveal>)}
          </ol>
          <p className="mt-7 max-w-[78ch] border-l-2 border-brand-accent pl-4 text-sm leading-relaxed text-muted-foreground">{content.outcomes.disclaimer}</p>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <Reveal className="max-w-3xl"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.trust.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.trust.title}</h2><p className="mt-5 text-base leading-[1.75] text-ink/70">{content.trust.intro}</p></Reveal>
          <div className="mt-12 grid gap-10 lg:grid-cols-12">
            <Reveal className="border-t border-ink lg:col-span-4"><p className="py-4 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{content.trust.examLabel}</p><p className="border-y border-border py-6 font-heading text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.4] text-ink">{examRecords.map((exam) => exam.code).join(" · ")}</p></Reveal>
            <div className="lg:col-span-8">{content.trust.links.map((item, index) => <Reveal key={item.route} delay={index * 0.05} y={8}><article className="grid gap-3 border-t border-border py-6 sm:grid-cols-[2.25rem_1fr_auto] sm:items-center sm:gap-5"><span className="text-xs tabular-nums text-brand-accent">{number(index)}</span><div><h3 className="font-heading text-xl text-ink">{item.title}</h3><p className="mt-2 max-w-[55ch] text-sm leading-[1.7] text-ink/70">{item.description}</p></div><Link href={localizedPath(item.route, locale)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-secondary underline decoration-border underline-offset-4 hover:decoration-brand-accent">{item.linkLabel}<ArrowRight className="size-4" aria-hidden="true" /></Link></article></Reveal>)}</div>
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-[1280px] px-6 md:px-12"><Reveal><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.testimonials.eyebrow}</p><h2 className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.08] font-medium text-ink">{content.testimonials.title}</h2></Reveal><div className="mt-12 grid gap-8 md:grid-cols-2">{testimonials.map((item) => <blockquote key={item.id} className="border-t border-ink pt-6"><p className="font-heading text-2xl leading-[1.45] text-ink">“{item.quote}”</p><footer className="mt-6 text-sm text-muted-foreground"><cite className="not-italic">{item.name}</cite> · {item.context}</footer></blockquote>)}</div></div>
        </section>
      )}

      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute top-0 right-[14%] h-full border-l border-dashed border-border" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1280px] gap-10 px-6 md:px-12 lg:grid-cols-12 lg:items-center">
          <Reveal className="lg:col-span-2"><CompassMark size={64} rotation={24} interactive /></Reveal>
          <Reveal className="lg:col-span-7"><p className="text-xs font-medium tracking-[0.22em] text-brand-accent uppercase">{content.cta.eyebrow}</p><h2 className="mt-4 text-[clamp(2.2rem,4vw,3.7rem)] leading-[1.06] font-medium text-ink">{content.cta.title}</h2><p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink/70">{content.cta.body}</p></Reveal>
          <Reveal className="flex flex-col gap-3 sm:flex-row lg:col-span-3 lg:flex-col" delay={0.1}><ButtonLink href={bookingHref} directional size="lg" className="h-12 px-5">{content.cta.primary}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink><ButtonLink href="mailto:hello@oriens.academy" variant="outline" size="lg" className="h-12 px-5">{content.cta.secondary}<Mail className="size-4" aria-hidden="true" /></ButtonLink></Reveal>
        </div>
      </section>
    </>
  );
}
