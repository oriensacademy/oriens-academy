"use client";

import Link from "next/link";
import { Cookie, FileText, Shield, ArrowRight, SlidersHorizontal } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { LEGAL_DOCS, type LegalDocKey } from "@/config/legal";
import {
  cookiePolicyPath,
  kvkkPath,
  localizedPath,
  preInformationPath,
  privacyPath,
  refundPolicyPath,
  salesAgreementPath,
  termsPath,
} from "@/lib/routes";
import { reopenConsentPreferences } from "@/components/analytics/ConsentBanner";

export function LegalPage({ kind }: { kind: LegalDocKey }) {
  const locale = useLocale();
  const isTr = locale === "tr";
  const doc = LEGAL_DOCS[locale][kind] || LEGAL_DOCS[locale].privacy;

  const legalLinks: Array<{ label: string; href: string; key: LegalDocKey }> = isTr
    ? [
        { label: "Mesafeli Satış Sözleşmesi", href: salesAgreementPath(locale), key: "salesAgreement" },
        { label: "Ön Bilgilendirme Formu", href: preInformationPath(locale), key: "preInformation" },
        { label: "İptal ve İade Koşulları", href: refundPolicyPath(locale), key: "refundPolicy" },
        { label: "KVKK Aydınlatma Metni", href: kvkkPath(locale), key: "kvkk" },
        { label: "Çerez Politikası", href: cookiePolicyPath(locale), key: "cookie" },
        { label: "Gizlilik Politikası", href: privacyPath(locale), key: "privacy" },
        { label: "Kullanım Koşulları", href: termsPath(locale), key: "terms" },
      ]
    : [
        { label: "Distance Sales Agreement", href: salesAgreementPath(locale), key: "salesAgreement" },
        { label: "Pre-Information Form", href: preInformationPath(locale), key: "preInformation" },
        { label: "Cancellation & Refund Policy", href: refundPolicyPath(locale), key: "refundPolicy" },
        { label: "Personal Data (KVKK) Notice", href: kvkkPath(locale), key: "kvkk" },
        { label: "Cookie Policy", href: cookiePolicyPath(locale), key: "cookie" },
        { label: "Privacy Policy", href: privacyPath(locale), key: "privacy" },
        { label: "Terms of Service", href: termsPath(locale), key: "terms" },
      ];

  return (
    <section className="pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-[900px] px-6 md:px-12">
        {/* Header Badge & Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <Shield className="size-3.5" />
            <span>{doc.badge}</span>
            <span className="text-primary/40">·</span>
            <span>v{doc.version}</span>
          </div>

          <h1 className="font-heading text-[clamp(2.4rem,6vw,4.5rem)] font-normal leading-[1.05] tracking-[-0.025em] text-ink">
            {doc.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
            <span>{isTr ? "Son Güncelleme:" : "Last Updated:"} {doc.lastUpdated}</span>
            <span>·</span>
            <span>Oriens Academy</span>
          </div>
        </div>

        {/* Intro */}
        <p className="mt-8 max-w-[72ch] text-base md:text-lg leading-relaxed text-ink/75">
          {doc.intro}
        </p>

        {/* Cookie preferences interactive trigger */}
        {kind === "cookie" && (
          <div className="mt-6 rounded-2xl border border-border bg-surface-muted/60 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Cookie className="size-5 text-primary" />
              <div>
                <strong className="block text-xs font-bold text-ink">
                  {isTr ? "Çerez Tercihlerinizi Özelleştirin" : "Customize Your Cookie Preferences"}
                </strong>
                <span className="text-[11px] text-muted-foreground">
                  {isTr
                    ? "İstediğiniz zaman analitik ve pazarlama çerezlerini açıp kapatabilirsiniz."
                    : "You can toggle analytics and advertising cookies at any time."}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={reopenConsentPreferences}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="size-3.5" />
              <span>{isTr ? "Tercihleri Aç" : "Open Preferences"}</span>
            </button>
          </div>
        )}

        {/* Document Sections */}
        <div className="mt-12 divide-y divide-border border-y border-border">
          {doc.sections.map((section, idx) => (
            <section key={idx} className="py-8 space-y-3.5">
              <h2 className="font-heading text-xl md:text-2xl text-ink font-semibold">
                {section.heading}
              </h2>
              {section.paragraphs.map((p, pIdx) => (
                <p
                  key={pIdx}
                  className="max-w-[76ch] text-sm md:text-base leading-[1.8] text-ink/80 whitespace-pre-line"
                >
                  {p}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-3 space-y-2 pl-4 text-sm md:text-base text-ink/80 list-disc">
                  {section.bullets.map((b, bIdx) => (
                    <li key={bIdx} className="leading-relaxed">
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Bottom Legal Navigation */}
        <div className="mt-16 rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
            <FileText className="size-4" />
            <span>{isTr ? "İlgili Yasal Dokümanlar" : "Related Legal Policies"}</span>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {legalLinks
              .filter((item) => item.key !== kind)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between rounded-xl border border-border/80 bg-surface-muted/40 p-3 text-xs text-ink hover:border-primary hover:bg-surface-muted transition-colors"
                >
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {item.label}
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
