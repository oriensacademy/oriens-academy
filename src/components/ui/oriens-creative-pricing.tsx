"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Check, ShoppingBag, CheckCircle2, ShieldCheck } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import { localizedPath } from "@/lib/routes";
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
  const { addToCart, isInCart } = useCart();
  const { showPricing } = usePublicSettings();
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

          {/* Subtle premium trust marker */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#D0DBD0] bg-white/80 px-4 py-1.5 shadow-[0_2px_8px_rgba(16,40,30,0.04)] backdrop-blur-xs">
            <ShieldCheck className="size-4 text-[#43644E]" aria-hidden="true" />
            <span className="text-xs font-semibold text-[#1F382B]">
              {locale === "tr" ? "Şeffaf Fiyatlandırma" : "Transparent Pricing"}
            </span>
            <span className="text-xs text-[#607065]" aria-hidden="true">·</span>
            <span className="text-xs text-[#526458]">
              {locale === "tr" ? "Her öğrenci için aynı standart ücretler." : "The same standard rates for every student."}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-7 md:grid-cols-2 lg:grid-cols-6 xl:grid-cols-5 xl:gap-5">
          {tiers.map((tier, index) => {
            const isInverted = tier.color === "forest";

            return <div
              key={tier.id}
              data-package-id={tier.id}
              data-popular={tier.popular ? "true" : "false"}
              className={cn(
                "group relative min-w-0 transition-transform duration-300 motion-reduce:transform-none motion-reduce:transition-none lg:col-span-2 xl:col-span-1",
                index === 3 && "lg:col-start-2 xl:col-start-auto",
                index === 4 && "lg:col-span-2 lg:col-start-4 xl:col-span-1 xl:col-start-auto"
              )}
            >
              <article
                data-pricing-card
                className={cn(
                  "relative flex h-full flex-col overflow-hidden rounded-[26px] border p-6 text-ink sm:p-7",
                  tier.color === "gold" && "border-[#C9A452]/40 bg-[#FCF9EE] shadow-[0_16px_40px_rgba(201,164,82,0.12)]",
                  isInverted && "border-forest bg-forest text-primary-foreground shadow-[0_20px_48px_rgba(16,39,27,0.18)]",
                  tier.color === "ivory" && "border-[#CAD5CB] bg-[#FBFDFB]",
                  tier.color === "sage" && "border-[#CAD5CB] bg-white",
                  !tier.color && "border-[#CAD5CB] bg-white"
                )}
              >
                <div data-pricing-slot="badge" className="mb-4 flex min-h-7 items-start">
                  {tier.badge ? (
                    <div className={cn(
                      "inline-flex rounded-full border px-3 py-1 font-ui text-[11px] font-bold uppercase tracking-[0.14em]",
                      isInverted
                        ? "border-warm-accent/60 bg-warm-accent text-forest"
                        : "border-[#C9A452]/40 bg-[#FAF4DF] text-[#7A5B18]"
                    )}>
                      {tier.badge}
                    </div>
                  ) : <span aria-hidden="true" className="block h-7" />}
                </div>

                <div data-pricing-slot="icon" className="mb-5 flex items-center justify-between gap-3">
                  <div className={cn(
                    "flex size-11 items-center justify-center rounded-2xl border",
                    isInverted
                      ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
                      : "border-[#CAD5CB] bg-[#F4F7F4] text-[#10271B]"
                  )}>
                    {tier.icon}
                  </div>

                  {tier.discount ? (
                    <span className={cn(
                      "rounded-full border px-2.5 py-1 font-ui text-xs font-bold",
                      isInverted
                        ? "border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground"
                        : "border-transparent bg-[#E5ECE5] text-[#10271B]"
                    )}>
                      %{tier.discount} {locale === "tr" ? "İndirim" : "Discount"}
                    </span>
                  ) : (
                    <span className={cn(
                      "rounded-full border px-2.5 py-1 font-ui text-xs font-semibold",
                      isInverted
                        ? "border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground/80"
                        : "border-transparent bg-[#EFF4EE] text-[#55675A]"
                    )}>
                      {locale === "tr" ? "İndirimsiz" : "Standard Price"}
                    </span>
                  )}
                </div>

                <h3 data-pricing-slot="title" className={cn(
                  "min-h-14 font-heading text-xl font-bold tracking-tight",
                  isInverted ? "text-primary-foreground" : "text-[#10271B]"
                )}>
                  {tier.name}
                </h3>

                <p data-pricing-slot="description" className={cn(
                  "mt-2 min-h-[60px] text-xs leading-5",
                  isInverted ? "text-primary-foreground/80" : "text-[#68756C]"
                )}>
                  {tier.description}
                </p>

                <div data-pricing-slot="price" className={cn(
                  "my-6 min-h-[164px] border-y py-4",
                  isInverted ? "border-primary-foreground/25" : "border-[#CAD5CB]/60"
                )}>
                  {tier.oldPrice ? (
                    <div className={cn("min-h-5 text-xs", isInverted ? "text-primary-foreground/75" : "text-[#8A968E]")}>
                      <span>{locale === "tr" ? "Eski fiyat: " : "List price: "}</span>
                      <span data-pricing-old-price className="line-through">{money(tier.oldPrice)}</span>
                    </div>
                  ) : (
                    <div aria-hidden="true" className="min-h-5 text-xs invisible">
                      {locale === "tr" ? "Eski fiyat: " : "List price: "}{money(tier.price)}
                    </div>
                  )}

                  <div className="mt-1 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
                    <span data-pricing-current-price className={cn(
                      "min-w-0 text-[clamp(2rem,2.45vw,2.5rem)] font-bold tracking-[-0.04em] tabular-nums",
                      isInverted ? "text-primary-foreground" : "text-[#10271B]"
                    )}>
                      {money(tier.price)}
                    </span>
                  </div>

                  <div data-pricing-total className={cn(
                    "mt-1 text-xs font-medium",
                    isInverted ? "text-primary-foreground/80" : "text-[#68756C]"
                  )}>
                    {locale === "tr" ? "toplam" : "total"}
                  </div>

                  {tier.unitPrice ? (
                    <div data-pricing-unit-price className={cn(
                      "mt-3 min-h-5 text-xs",
                      isInverted ? "text-primary-foreground/85" : "text-[#68756C]"
                    )}>
                      <span>{locale === "tr" ? "Birim Ders Ücreti: " : "Unit Lesson Price: "}</span>
                      <strong className={isInverted ? "text-primary-foreground" : "text-[#10271B]"}>{money(tier.unitPrice)}</strong>
                    </div>
                  ) : <div aria-hidden="true" className="mt-3 min-h-5 text-xs invisible">—</div>}
                </div>

                <ul data-pricing-slot="features" className="mb-7 flex-1 space-y-3 xl:min-h-36">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                        isInverted
                          ? "border-primary-foreground/30 bg-primary-foreground/10"
                          : "border-[#AEBCAF] bg-[#EFF4EE]"
                      )} aria-hidden="true">
                        <Check className={cn("size-3", isInverted ? "text-warm-accent" : "text-[#536B59]")} />
                      </span>
                      <span data-pricing-feature className={cn(
                        "text-sm leading-6",
                        isInverted ? "text-primary-foreground/85" : "text-[#34483D]"
                      )}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div data-pricing-slot="actions" className="mt-auto space-y-2">
                  {showPricing ? (
                    <>
                      {tier.purchaseHref && tier.purchaseLabel ? (
                        <Link
                          data-pricing-action="purchase"
                          href={tier.purchaseHref}
                          className={cn(
                            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-center font-ui text-sm font-semibold shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2",
                            isInverted
                              ? "border-primary-foreground bg-primary-foreground text-forest hover:bg-sage-soft focus-visible:ring-warm-accent focus-visible:ring-offset-forest"
                              : "border-[#10271B] bg-[#10271B] text-white hover:bg-[#203D2D] focus-visible:ring-primary"
                          )}
                        >
                          {tier.purchaseLabel}
                        </Link>
                      ) : null}

                      {isInCart(tier.id) ? (
                        <Link
                          data-pricing-action="cart"
                          href={localizedPath("cart", locale)}
                          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-3 text-center font-ui text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          <span>{locale === "tr" ? "Sepette (Sepete Git)" : "In Cart (View Cart)"}</span>
                        </Link>
                      ) : (
                        <button
                          data-pricing-action="cart"
                          type="button"
                          onClick={() => addToCart(tier.id)}
                          className={cn(
                            "inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border bg-white px-3 text-center font-ui text-xs font-semibold text-[#10271B] transition-colors hover:bg-[#EFF3EE] focus-visible:ring-2",
                            isInverted ? "border-primary-foreground focus-visible:ring-warm-accent" : "border-[#CAD5CB] focus-visible:ring-[#819586]"
                          )}
                        >
                          <ShoppingBag className="size-3.5 text-[#819586]" />
                          <span>{locale === "tr" ? "Sepete Ekle" : "Add to Cart"}</span>
                        </button>
                      )}

                      <Link
                        data-pricing-action="consultation"
                        href={tier.ctaHref}
                        className={cn(
                          "inline-flex h-9 w-full items-center justify-center rounded-lg px-3 text-center font-ui text-[11px] font-medium transition-colors hover:underline",
                          isInverted
                            ? "text-primary-foreground/85 hover:text-primary-foreground"
                            : "text-[#68756C] hover:text-[#10271B]"
                        )}
                      >
                        {tier.ctaLabel}
                      </Link>
                    </>
                  ) : (
                    <Link
                      data-pricing-action="consultation"
                      href={tier.ctaHref}
                      className={cn(
                        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-center font-ui text-sm font-semibold shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2",
                        isInverted
                          ? "border-primary-foreground bg-primary-foreground text-forest hover:bg-sage-soft focus-visible:ring-warm-accent focus-visible:ring-offset-forest"
                          : "border-[#10271B] bg-[#10271B] text-white hover:bg-[#203D2D] focus-visible:ring-primary"
                      )}
                    >
                      {tier.ctaLabel}
                    </Link>
                  )}
                </div>
              </article>
            </div>
          })}
        </div>
      </div>
    </section>
  );
}

export default CreativePricing;
