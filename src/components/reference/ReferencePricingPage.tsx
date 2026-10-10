"use client";

import { useEffect, useRef, useState } from "react";
import "./generated/reference-pricing.css";
import { PRICING_AFTER_HTML, PRICING_FOOTER_HTML, PRICING_HEADER_HTML, PRICING_HERO_HTML } from "./generated/markup";
import {
  ReferenceFonts,
  ReferenceHtml,
  fillContact,
  useInternalLinkNavigation,
  useReferenceContact,
  useReferenceHeader,
} from "./reference-shared";
import { CANONICAL_DEFAULT_PACKAGES, getPublicPricingPackages, isBestValueBadge, selectPurchasablePackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { getLocalizedPackageDisplayPrice } from "@/lib/pricing/package-display";
import { localizedPath } from "@/lib/routes";
import { usePublicSettings } from "@/lib/settings/public-settings-context";

/**
 * Row copy exactly as printed in the customer's reference file (oriens-ucretler_17).
 * Paneldeki yeni paketler (ör. 40 derslik) aynı satır yapısıyla ve DB'deki
 * description_tr ile listelenir.
 */
const REFERENCE_DESCRIPTIONS: Record<string, string> = {
  single: "Esnek, tek seferlik birebir ders.",
  package5: "Düzenli çalışmaya başlamak için.",
  package10: "Sınav hazırlığı ve konu takibi bir arada.",
  package20: "Kapsamlı ve istikrarlı hazırlık.",
  package30: "Sezon boyu kesintisiz destek.",
};

function numeric(value: number | string | null | undefined) {
  const parsed = value == null ? null : Number(value);
  return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}

function money(amount: number, currency: "TRY" | "EUR") {
  const hasDecimals = Math.abs(amount - Math.round(amount)) > 0.005;
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount);
  return `${formatted} ${currency === "TRY" ? "TL" : "EUR"}`;
}

function splitMoney(amount: number, currency: "TRY" | "EUR") {
  const formatted = money(amount, currency);
  const separator = formatted.lastIndexOf(" ");
  return { amount: formatted.slice(0, separator), currency: formatted.slice(separator + 1) };
}

function badgeLabel(value: string | null | undefined) {
  const badge = value?.trim();
  if (!badge) return null;
  const normalized = badge.toLocaleLowerCase("tr-TR");
  if (normalized === "en çok tercih edilen") return "En popüler";
  if (normalized === "en avantajlı paket") return "En avantajlı";
  return badge;
}

function PackageRow({ item }: { item: PublicPricingPackage }) {
  const lessons = numeric(item.lesson_count) ?? 1;
  const display = getLocalizedPackageDisplayPrice({ locale: "tr", tryAmount: item.current_total ?? item.price_amount, eurAmount: item.price_eur });
  const current = display.amount ?? 0;
  const discount = numeric(item.discount_percentage);
  const old = numeric(item.old_total);
  const unit = numeric(item.unit_price) ?? current / lessons;
  const savings = old !== null && old > current ? old - current : null;
  const badge = badgeLabel(item.badge_tr);
  const name = item.name_tr?.trim() || item.id;
  const description = REFERENCE_DESCRIPTIONS[item.id] ?? item.description_tr?.trim() ?? "";
  const total = splitMoney(current, display.currency);
  const unitText = money(unit, display.currency);

  return (
    <li className="pr" data-package-id={item.id}>
      {badge ? <span className={isBestValueBadge(item) ? "pr-badge alt" : "pr-badge"}>{badge}</span> : null}
      <span className="pr-n"><b>{lessons}</b><small>ders</small></span>
      <span className="pr-m"><span className="pr-t">{name}</span><span className="pr-d">{description}</span></span>
      <span className="pr-u"><small>Ders başı</small><b>{unitText}</b></span>
      <span className="pr-p">
        <span className="pr-old">
          {old !== null ? <><s>{money(old, display.currency)}</s>{discount ? <em>%{discount}</em> : null}</> : <span className="pr-plain">Paketsiz</span>}
        </span>
        <span className="pr-new">{total.amount}<small>{total.currency}</small></span>
        <span className="pr-um">Ders başı <b>{unitText}</b></span>
        <span className={savings !== null ? "pr-save" : "pr-save muted"}>{savings !== null ? `${money(savings, display.currency)} tasarruf` : "İndirim yok"}</span>
      </span>
      <span className="pr-a">
        <a className="pr-buy" href={`${localizedPath("payment", "tr")}?package=${encodeURIComponent(item.id)}`} data-pricing-action="purchase">
          Satın Al{" "}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </a>
      </span>
    </li>
  );
}

function pickPackages(packages: PublicPricingPackage[]) {
  return selectPurchasablePackages(packages);
}

export function ReferencePricingPage() {
  const scopeRef = useRef<HTMLDivElement>(null);
  useReferenceHeader(scopeRef);
  useInternalLinkNavigation(scopeRef);
  const contact = useReferenceContact();
  const { showPricing, loading: settingsLoading } = usePublicSettings();
  const [packages, setPackages] = useState<PublicPricingPackage[]>(() => pickPackages(CANONICAL_DEFAULT_PACKAGES));

  useEffect(() => {
    let active = true;
    getPublicPricingPackages().then((data) => {
      if (active) setPackages(pickPackages(data));
    });
    return () => {
      active = false;
    };
  }, []);

  const pricingHidden = !settingsLoading && !showPricing;

  return (
    <div ref={scopeRef} className="reference-pricing-page">
      <ReferenceFonts />
      <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#10271B", background: "#F6F8F3", width: "100%", fontSize: 16, lineHeight: 1.65 }}>
        <ReferenceHtml html={PRICING_HEADER_HTML} />
        <main id="main-content" style={{ display: "contents" }}>
          <ReferenceHtml html={PRICING_HERO_HTML} />
          <section className="pk-wrap" aria-label="Ders paketleri">
            {pricingHidden ? (
              <p className="pk-note" role="status">
                Eğitim paketlerimizin içerik ve ücret yapıları şu anda güncellenmektedir. Detaylı bilgi için ücretsiz tanışma görüşmesi planlayabilirsiniz.
              </p>
            ) : packages.length ? (
              <ul className="pr-l">{packages.map((item) => <PackageRow key={item.id} item={item} />)}</ul>
            ) : (
              <p className="pk-note" role="status">Aktif ders paketleri şu anda görüntülenemiyor. Görüşme formundan bize ulaşabilirsiniz.</p>
            )}
            <p className="pk-note">Tüm ödeme süreci vergi mevzuatına uygundur.</p>
          </section>
          <ReferenceHtml html={fillContact(PRICING_AFTER_HTML, contact)} />
        </main>
        <ReferenceHtml html={fillContact(PRICING_FOOTER_HTML, contact)} />
      </div>
    </div>
  );
}
