"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PricingTier {
  id: string;
  name: string;
  icon: ReactNode;
  price: number;
  oldPrice?: number | null;
  unitPrice?: number | null;
  discount?: number | null;
  description: string;
  features: string[];
  popular?: boolean;
  badge?: string | null;
  color?: "sage" | "forest" | "gold" | "ivory";
  ctaLabel: string;
  ctaHref: string;
  purchaseLabel?: string;
  purchaseHref?: string;
}

interface CreativePricingProps {
  locale?: "tr" | "en";
  tag?: string;
  title?: string;
  description?: string;
  headingLevel?: "h1" | "h2";
  tiers: PricingTier[];
}

export function CreativePricing({
  locale = "tr",
  tag = "Esnek Paketler",
  title = "Hedefinize uygun çalışma planını seçin",
  description = "İhtiyacınıza göre tek ders veya uzun dönemli paketlerden yararlanabilirsiniz.",
  headingLevel = "h2",
  tiers,
}: CreativePricingProps) {
  const Heading = headingLevel;
  const money = (value: number) => new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    style: "currency",
    currency: "TRY",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <section data-creative-pricing className="relative w-full overflow-hidden py-12 md:py-16">
      <div className="mx-auto w-full max-w-[1380px] px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center md:mb-16">
          <div className="mb-4 font-ui text-sm font-semibold uppercase tracking-[0.18em] text-[#819586]">
            {tag}
          </div>

          <Heading className="mx-auto max-w-4xl font-heading text-[clamp(2.55rem,5vw,4.9rem)] leading-[1.02] tracking-[-0.025em] text-[#10271B]">
            {title}
          </Heading>

          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-[#68756C] md:text-lg">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-7 md:grid-cols-2 lg:grid-cols-6 xl:grid-cols-5 xl:gap-5">
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              data-package-id={tier.id}
              data-popular={tier.popular ? "true" : "false"}
              className={cn(
                "group relative min-w-0 transition-transform duration-300 motion-reduce:transform-none motion-reduce:transition-none lg:col-span-2 xl:col-span-1",
                index === 3 && "lg:col-start-2 xl:col-start-auto",
                index % 3 === 0 && "xl:-rotate-[1deg]",
                index % 3 === 1 && "xl:rotate-[1deg]",
                index % 3 === 2 && "xl:-rotate-[0.5deg]",
              )}
            >
              <div
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 rounded-[22px] border border-[#CAD5CB] bg-white shadow-[5px_6px_0_0_#A8B7AA] transition-all duration-300 motion-reduce:transition-none",
                  "group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:shadow-[8px_9px_0_0_#8FA291]",
                  tier.popular && "border-[#A99457] shadow-[5px_6px_0_0_#D7C58D] group-hover:shadow-[8px_9px_0_0_#C9B572]",
                )}
              />

              <article className="relative flex h-full min-h-[510px] flex-col p-6">
                {tier.badge && (
                  <div
                    className={cn(
                      "absolute -top-3 right-4 max-w-[calc(100%-2rem)] rounded-full border px-3 py-1 text-center font-ui text-[10px] font-bold uppercase tracking-[0.1em]",
                      tier.popular
                        ? "border-[#A99457] bg-[#D6B56D] text-[#10271B]"
                        : "border-[#B8C5B9] bg-[#E8EFE7] text-[#496052]",
                    )}
                  >
                    {tier.badge}
                  </div>
                )}

                <div className="mb-6">
                  <div
                    className={cn(
                      "mb-5 flex size-12 items-center justify-center rounded-full border",
                      tier.color === "gold"
                        ? "border-[#D6B56D] bg-[#FAF5E8] text-[#9A7933]"
                        : tier.color === "forest"
                          ? "border-[#76917C] bg-[#E4ECE4] text-[#10271B]"
                          : tier.color === "ivory"
                            ? "border-[#D8D2C0] bg-[#FAF8F2] text-[#776A49]"
                            : "border-[#B9C7BA] bg-[#F1F5F0] text-[#819586]",
                    )}
                  >
                    {tier.icon}
                  </div>

                  <h3 className="font-heading text-2xl leading-tight text-[#10271B]">{tier.name}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-[#68756C]">{tier.description}</p>
                </div>

                <div className="mb-6 border-y border-[#E1E6E0] py-5">
                  {tier.discount ? (
                    <div className="mb-2 text-sm font-semibold text-[#607867]">
                      {locale === "tr" ? `%${tier.discount} indirim` : `${tier.discount}% OFF`}
                    </div>
                  ) : null}

                  {tier.oldPrice ? (
                    <div className="text-sm tabular-nums text-[#8A948C] line-through">{money(tier.oldPrice)}</div>
                  ) : null}

                  <div className="mt-1 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
                    <span className="min-w-0 text-[clamp(2rem,2.45vw,2.5rem)] font-bold tracking-[-0.04em] text-[#10271B] tabular-nums">
                      {money(tier.price)}
                    </span>
                    <span className="pb-1 text-sm text-[#68756C]">{locale === "tr" ? "toplam" : "total"}</span>
                  </div>

                  {tier.unitPrice ? (
                    <div className="mt-2 text-sm text-[#68756C]">
                      {locale === "tr" ? "Ders başı" : "Per lesson"} <span className="font-semibold tabular-nums text-[#34483D]">{money(tier.unitPrice)}</span>
                    </div>
                  ) : null}
                </div>

                <ul className="mb-7 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[#AEBCAF] bg-[#EFF4EE]" aria-hidden="true">
                        <Check className="size-3 text-[#536B59]" />
                      </span>
                      <span className="text-sm leading-6 text-[#34483D]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2"><Link
                  href={tier.ctaHref}
                  className={cn(
                    "inline-flex h-12 w-full items-center justify-center rounded-xl border px-4 text-center font-ui text-sm font-semibold outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-2 motion-reduce:transition-none",
                    tier.popular
                      ? "border-[#819586] bg-[#819586] text-white hover:bg-[#718678]"
                      : "border-[#CAD5CB] bg-[#F7F9F6] text-[#10271B] hover:bg-[#EDF2EC]",
                  )}
                >
                  {tier.ctaLabel}
                </Link>{tier.purchaseHref && tier.purchaseLabel ? <Link href={tier.purchaseHref} className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-ink bg-ink px-4 text-center font-ui text-sm font-semibold text-white outline-none transition-colors hover:bg-forest focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{tier.purchaseLabel}</Link> : null}</div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CreativePricing;
