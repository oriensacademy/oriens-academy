"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Compass, GraduationCap, Mail, Target } from "lucide-react";
import { CompassMark } from "@/components/brand/CompassMark";
import { Reveal } from "@/components/motion/Reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ButtonLink } from "@/components/ui/button";
import { CreativePricing, type PricingTier } from "@/components/ui/creative-pricing";
import { useLocale, usePricingContent } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";
import { getPublicPricingPackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { CONTACT } from "@/config/contact";

function indexOf(position: number) {
  return String(position + 1).padStart(2, "0");
}

export function PricingPage() {
  const locale = useLocale();
  const content = usePricingContent();
  const [dbPackages, setDbPackages] = useState<PublicPricingPackage[]>([]);
  const [pricingLoaded, setPricingLoaded] = useState(false);
  const bookingHref = `${localizedPath("home", locale)}#consultation-form`;

  useEffect(() => {
    getPublicPricingPackages().then((rows) => setDbPackages(rows)).finally(() => setPricingLoaded(true));
  }, []);

  const ownerPackageIds = new Set(["single", "package5", "package10", "package20", "package30"]);
  const activePackages = dbPackages
    .filter((row) => ownerPackageIds.has(row.id) && row.active)
    .sort((a, b) => a.display_order - b.display_order);

  function getItemContent(id: string) {
    const fallback = (content.packages.items as Record<string, { title?: string; description?: string; features?: string[]; unitPrice?: string; totalPrice?: string; originalPrice?: string; discount?: string | null; badge?: string }>)[id] ?? {
        title: id,
        description: "",
        features: [],
      };
    const row = activePackages.find((item) => item.id === id);
    if (!row || !row.name_tr) return fallback;
    return {
      ...fallback,
      title: locale === "tr" ? row.name_tr : row.name_en || fallback.title,
      description: locale === "tr" ? row.description_tr || fallback.description : row.description_en || fallback.description,
      badge: locale === "tr" ? row.badge_tr || fallback.badge : row.badge_en || fallback.badge,
    };
  }

  function iconFor(id: string) {
    if (id === "single") return <BookOpen className="size-5" aria-hidden="true" />;
    if (id === "package5") return <CalendarDays className="size-5" aria-hidden="true" />;
    if (id === "package10") return <GraduationCap className="size-5" aria-hidden="true" />;
    if (id === "package20") return <Target className="size-5" aria-hidden="true" />;
    return <Compass className="size-5" aria-hidden="true" />;
  }

  const tiers: PricingTier[] = activePackages.map((item) => {
    const itemContent = getItemContent(item.id);
    return {
      id: item.id,
      name: itemContent.title || item.id,
      icon: iconFor(item.id),
      price: item.current_total ?? item.price_amount ?? 0,
      oldPrice: item.old_total,
      unitPrice: item.unit_price,
      discount: item.discount_percentage,
      description: itemContent.description || "",
      features: itemContent.features || [],
      popular: item.id === "package10" && item.featured,
      badge: itemContent.badge,
      color: item.id === "package10" ? "gold" : item.id === "package30" ? "forest" : item.id === "package20" ? "ivory" : "sage",
      ctaLabel: locale === "tr" ? "Görüşme Planla" : "Book a Consultation",
      ctaHref: `${localizedPath("home", locale)}?package=${encodeURIComponent(item.id)}#consultation-form`,
    };
  });

  return (
    <>
      <section id="packages" className="section-offset relative overflow-hidden border-b border-border bg-[#F6F8F3] pt-24 pb-16 md:pt-28 md:pb-24">
        <div className="relative mx-auto max-w-[1380px] px-6 md:px-8">
          <nav aria-label={content.breadcrumb.ariaLabel}>
            <ol className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <li><Link href={localizedPath("home", locale)} className="inline-flex min-h-11 items-center rounded-sm outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4">{content.breadcrumb.home}</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-ink">{content.breadcrumb.current}</li>
            </ol>
          </nav>
        </div>
        <Reveal y={8}>
          <CreativePricing
            locale={locale}
            tag={content.hero.eyebrow}
            title={content.hero.title}
            description={content.hero.description}
            headingLevel="h1"
            tiers={tiers}
          />
        </Reveal>

        {!pricingLoaded && (
          <div className="mx-auto grid max-w-[1320px] gap-5 px-4 sm:grid-cols-2 lg:grid-cols-5" aria-label={locale === "tr" ? "Paketler yükleniyor" : "Loading packages"}>
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-[510px] animate-pulse rounded-[22px] border border-[#DDE4DC] bg-white/70 motion-reduce:animate-none" />)}
          </div>
        )}

        {pricingLoaded && tiers.length === 0 && (
          <div role="status" className="mx-auto max-w-xl rounded-2xl border border-[#DDE4DC] bg-white p-8 text-center text-sm leading-6 text-[#68756C]">
            {locale === "tr" ? "Aktif ders paketleri şu anda görüntülenemiyor. Görüşme formundan bize ulaşabilirsiniz." : "Active lesson packages are currently unavailable. You can contact us through the consultation form."}
          </div>
        )}

        {tiers.length > 0 && (
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 rounded-[24px] border border-[#DDE4DC] bg-white px-6 py-7 text-center shadow-[0_12px_35px_rgba(16,39,27,.05)] md:px-10">
            <div>
              <h2 className="font-heading text-2xl text-[#10271B] md:text-3xl">{locale === "tr" ? "Hangi paketin sizin için daha uygun olduğundan emin değil misiniz?" : "Not sure which package is right for you?"}</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#68756C] md:text-base">{locale === "tr" ? "Ücretsiz tanışma görüşmesinde hedeflerinizi ve çalışma planınızı birlikte değerlendirebiliriz." : "We can review your goals and study plan together in a complimentary introductory consultation."}</p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <ButtonLink href={bookingHref} size="lg">{locale === "tr" ? "Ücretsiz Görüşme Planla" : "Book a Free Consultation"}</ButtonLink>
              <p className="text-xs leading-5 text-[#7A847E]">{locale === "tr" ? "Program içeriği ve ders planı öğrencinin hedeflerine göre şekillendirilir." : "Programme content and lesson planning are shaped around each student’s goals."}</p>
            </div>
          </div>
        )}
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
          <Reveal className="flex flex-col gap-3 sm:flex-row lg:col-span-3 lg:flex-col" delay={0.1}><ButtonLink href={bookingHref} directional size="lg" className="h-12 px-5">{content.cta.primary}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></ButtonLink><ButtonLink href={CONTACT.emailHref} variant="outline" size="lg" className="h-12 px-5">{content.cta.secondary}<Mail className="size-4" aria-hidden="true" /></ButtonLink></Reveal>
        </div>
      </section>
    </>
  );
}
