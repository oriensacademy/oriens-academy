"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bookmark, Check, CheckCircle2, ShieldCheck } from "lucide-react";
import { Fraunces, Public_Sans } from "next/font/google";
import { useCart } from "@/lib/cart/cart-context";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import { localizedPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import styles from "./oriens-creative-pricing.module.css";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export interface PricingTier {
  id: string;
  name: string;
  icon: ReactNode;
  price: number;
  currency?: "TRY" | "EUR";
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

type CardTheme = "plain" | "bronze" | "platinum" | "gold" | "silver";

const THEME_BY_PACKAGE: Record<string, CardTheme> = {
  single: "plain",
  package5: "bronze",
  package10: "platinum",
  package20: "gold",
  package30: "silver",
};

function formatAmount(value: number, currency: "TRY" | "EUR", locale: "tr" | "en") {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", {
    minimumFractionDigits: currency === "EUR" ? 2 : 0,
    maximumFractionDigits: currency === "EUR" ? 2 : 0,
  }).format(value);
}

function currencyLabel(currency: "TRY" | "EUR", locale: "tr" | "en") {
  if (currency === "EUR") return "EUR";
  return locale === "tr" ? "TL" : "TRY";
}

function packageLabelFor(tier: PricingTier, locale: "tr" | "en") {
  if (locale === "en") {
    if (!tier.discount) return "Standard Price";
    if (tier.id === "package5") return "BRONZE PACKAGE";
    if (tier.id === "package10") return "SILVER PACKAGE";
    if (tier.id === "package20") return "GOLD PACKAGE";
    return "PLATINUM PACKAGE";
  }
  if (!tier.discount) return "İNDİRİMSİZ";
  if (tier.id === "package5") return "BRONZ PAKET";
  if (tier.id === "package10") return "GÜMÜŞ PAKET";
  if (tier.id === "package20") return "ALTIN PAKET";
  return "PLATİN PAKET";
}

function DiscountBurst({ discount, locale }: { discount: number; locale: "tr" | "en" }) {
  return (
    <div
      className={styles.discountBurst}
      data-discount-burst
      aria-label={locale === "tr" ? `%${discount} indirim` : `${discount}% discount`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M 50,1 L 58.5,13 L 71.3,5.9 L 73.7,20.3 L 88.3,19.4 L 84.2,33.5 L 97.8,39.1 L 88,50 L 97.8,60.9 L 84.2,66.5 L 88.3,80.6 L 73.7,79.7 L 71.3,94.1 L 58.5,87 L 50,99 L 41.5,87 L 28.7,94.1 L 26.3,79.7 L 11.7,80.6 L 15.8,66.5 L 2.2,60.9 L 12,50 L 2.2,39.1 L 15.8,33.5 L 11.7,19.4 L 26.3,20.3 L 28.7,5.9 L 41.5,13 Z" />
      </svg>
      <span className={styles.discountValue}>%{discount}</span>
      <span className={styles.discountLabel}>{locale === "tr" ? "İNDİRİM" : "OFF"}</span>
    </div>
  );
}

export function CreativePricing({
  locale = "tr",
  tag = "Esnek Ders Paketleri",
  title = "Hedefinize uygun çalışma planını seçin.",
  description = "Tek ders desteğinden uzun dönemli hazırlık programlarına kadar ihtiyacınıza ve hedeflerinize uygun çalışma modelini birlikte belirleyebilirsiniz.",
  headingLevel = "h2",
  tiers,
}: CreativePricingProps) {
  const Heading = headingLevel;
  const { addToCart, isInCart } = useCart();
  const { showPricing } = usePublicSettings();

  return (
    <section data-creative-pricing data-locale={locale} className="relative w-full overflow-hidden py-12 md:py-16">
      <div className="mx-auto w-full max-w-[1380px] px-4 sm:px-6 lg:px-8">
        <header className="mb-14 text-center md:mb-16">
          <div className="mb-4 font-ui text-sm font-semibold uppercase tracking-[0.18em] text-[#819586]">
            {tag}
          </div>
          <Heading className="mx-auto max-w-4xl font-heading text-[clamp(2.55rem,5vw,4.9rem)] leading-[1.02] tracking-[-0.025em] text-[#10271B]">
            {title}
          </Heading>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-[#68756C] md:text-lg">
            {description}
          </p>
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
        </header>

        <div className={cn(styles.cards, publicSans.className)}>
          {tiers.map((tier) => {
            const theme = THEME_BY_PACKAGE[tier.id] ?? "plain";
            const isDark = theme === "bronze" || theme === "gold" || theme === "silver";
            const currency = tier.currency ?? "TRY";
            const currencyText = currencyLabel(currency, locale);
            const packageLabel = packageLabelFor(tier, locale);
            const ribbon = tier.id === "package10"
              ? (locale === "tr" ? "EN POPÜLER" : "MOST POPULAR")
              : tier.id === "package30"
                ? (locale === "tr" ? "EN AVANTAJLI" : "BEST VALUE")
                : null;

            return (
              <article
                key={tier.id}
                data-package-id={tier.id}
                data-pricing-card
                data-theme={theme}
                className={cn(styles.card, styles[theme], theme === "silver" && styles.elevated)}
              >
                {ribbon ? <div className={cn(styles.ribbon, styles[`ribbon-${theme}`])}>{ribbon}</div> : null}

                <div className={styles.topRow} data-pricing-slot="package-label">
                  <div className={styles.iconCircle}>{tier.icon}</div>
                  {tier.id !== "single" ? <div className={styles.badge}>{packageLabel}</div> : null}
                </div>

                <div className={styles.titleBlock}>
                  <h3 className={fraunces.className}>{tier.name}</h3>
                  <p>{tier.description}</p>
                </div>

                <div className={styles.divider} />

                <div className={styles.priceBlock}>
                  {tier.oldPrice ? (
                    <div className={styles.oldPrice}>
                      {locale === "tr" ? "İndirimsiz Fiyat: " : "List price: "}
                      {formatAmount(tier.oldPrice, currency, locale)} {currencyText}
                    </div>
                  ) : (
                    <div aria-hidden="true" className={cn(styles.oldPrice, styles.oldPricePlaceholder)}>
                      {locale === "tr" ? "İndirimsiz Fiyat:" : "List price:"}
                    </div>
                  )}
                  <div className={styles.priceRow}>
                    <div className={cn(styles.price, fraunces.className)}>
                      {formatAmount(tier.price, currency, locale)} <span>{currencyText}</span>
                    </div>
                    {tier.discount ? <DiscountBurst discount={tier.discount} locale={locale} /> : <span className={styles.burstPlaceholder} aria-hidden="true" />}
                  </div>
                  {tier.unitPrice ? (
                    <div className={styles.unitPrice}>
                      {locale === "tr" ? "Birim ders ücreti: " : "Unit lesson price: "}
                      {formatAmount(tier.unitPrice, currency, locale)} {currencyText}
                    </div>
                  ) : <div className={styles.unitPrice} aria-hidden="true">&nbsp;</div>}
                </div>

                <ul className={styles.features}>
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <Check aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className={styles.spacer} />

                <div className={styles.actions}>
                  {showPricing && tier.purchaseHref && tier.purchaseLabel ? (
                    <Link data-pricing-action="purchase" href={tier.purchaseHref} className={styles.primaryButton}>
                      {tier.purchaseLabel}
                    </Link>
                  ) : null}

                  {showPricing ? (
                    isInCart(tier.id) ? (
                      <Link
                        data-pricing-action="cart"
                        href={localizedPath("cart", locale)}
                        className={cn(styles.secondaryButton, isDark ? styles.secondaryDark : styles.secondaryLight)}
                      >
                        <CheckCircle2 aria-hidden="true" />
                        <span>{locale === "tr" ? "Sepette (Sepete Git)" : "In Cart (View Cart)"}</span>
                      </Link>
                    ) : (
                      <button
                        data-pricing-action="cart"
                        type="button"
                        onClick={() => addToCart(tier.id)}
                        className={cn(styles.secondaryButton, isDark ? styles.secondaryDark : styles.secondaryLight)}
                      >
                        <Bookmark aria-hidden="true" />
                        <span>{locale === "tr" ? "Sepete Ekle" : "Add to Cart"}</span>
                      </button>
                    )
                  ) : null}

                  <Link data-pricing-action="consultation" href={tier.ctaHref} className={styles.consultationLink}>
                    {tier.ctaLabel}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default CreativePricing;
