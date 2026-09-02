"use client";

import Link from "next/link";
import { Cookie, FileText, Shield, ArrowRight, SlidersHorizontal, ChevronRight } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { LEGAL_DOCS, type LegalDocKey, type LegalDocument } from "@/config/legal";
import {
  privacyPath,
  salesAgreementPath,
  termsPath,
} from "@/lib/routes";
import { reopenConsentPreferences } from "@/components/analytics/ConsentBanner";

interface SubDocumentSection {
  id: string;
  subTitle: string;
  doc: LegalDocument;
  isCookie?: boolean;
}

interface ConsolidatedGroup {
  groupKey: "sales" | "privacy" | "terms";
  title: string;
  badge: string;
  version: string;
  lastUpdated: string;
  intro: string;
  sections: SubDocumentSection[];
}

export function LegalPage({ kind }: { kind: LegalDocKey }) {
  const locale = useLocale();
  const isTr = locale === "tr";
  const allDocs = LEGAL_DOCS[locale];

  // Map requested kind into one of 3 canonical consolidated groups
  let group: ConsolidatedGroup;

  if (kind === "salesAgreement" || kind === "refundPolicy" || kind === "preInformation") {
    group = {
      groupKey: "sales",
      title: isTr ? "Satış, İptal ve İade Koşulları" : "Sales, Cancellation & Refund Terms",
      badge: isTr ? "Tüketici Hakları & Satış Koşulları" : "Consumer Rights & Sales Terms",
      version: allDocs.salesAgreement.version,
      lastUpdated: allDocs.salesAgreement.lastUpdated,
      intro: isTr
        ? "Oriens Academy üzerinden sunulan tüm akademik danışmanlık, sınav hazırlık ve eğitim paketlerinin mesafeli satış sözleşmesi, ön bilgilendirme şartları ile iptal ve iade koşulları aşağıda tek bir yasal çerçeve altında toplanmıştır."
        : "The distance sales agreement, pre-information terms, and cancellation and refund policies for all academic consultancy, exam preparation, and tutoring packages provided by Oriens Academy are consolidated below under a single legal framework.",
      sections: [
        {
          id: "mesafeli-satis",
          subTitle: isTr ? "1. Mesafeli Satış Sözleşmesi" : "1. Distance Sales Agreement",
          doc: allDocs.salesAgreement,
        },
        {
          id: "iptal-ve-iade",
          subTitle: isTr ? "2. İptal ve İade Koşulları" : "2. Cancellation & Refund Policy",
          doc: allDocs.refundPolicy,
        },
        {
          id: "on-bilgilendirme",
          subTitle: isTr ? "3. Ön Bilgilendirme Formu" : "3. Pre-Information Form",
          doc: allDocs.preInformation,
        },
      ],
    };
  } else if (kind === "privacy" || kind === "kvkk") {
    group = {
      groupKey: "privacy",
      title: isTr ? "Gizlilik Politikası & KVKK Aydınlatma Metni" : "Privacy Policy & Personal Data (KVKK) Notice",
      badge: isTr ? "Veri Güvenliği & KVKK" : "Data Protection & Privacy",
      version: allDocs.privacy.version,
      lastUpdated: allDocs.privacy.lastUpdated,
      intro: isTr
        ? "Oriens Academy olarak kişisel verilerinizin güvenliğine ve gizliliğine azami önem veriyoruz. 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve uluslararası veri koruma standartları uyarınca uyguladığımız gizlilik ve aydınlatma hükümleri aşağıda sunulmuştur."
        : "At Oriens Academy, we place the utmost importance on the security and confidentiality of your personal data. Below are our comprehensive privacy terms and statutory personal data protection disclosures.",
      sections: [
        {
          id: "gizlilik-politikasi",
          subTitle: isTr ? "1. Gizlilik Politikası" : "1. Privacy Policy",
          doc: allDocs.privacy,
        },
        {
          id: "kvkk-aydinlatma",
          subTitle: isTr ? "2. KVKK Aydınlatma Metni" : "2. Personal Data (KVKK) Notice",
          doc: allDocs.kvkk,
        },
      ],
    };
  } else {
    // terms or cookie
    group = {
      groupKey: "terms",
      title: isTr ? "Kullanım & Çerez Koşulları" : "Terms of Service & Cookie Policy",
      badge: isTr ? "Site Kuralları & Çerezler" : "Site Terms & Cookies",
      version: allDocs.terms.version,
      lastUpdated: allDocs.terms.lastUpdated,
      intro: isTr
        ? "Oriens Academy web platformunun, öğrenci portalının ve dijital hizmetlerinin kullanım şartları ile internet sitesinde kullanılan çerezlere ilişkin politikalar aşağıda detaylandırılmıştır."
        : "The terms governing the use of the Oriens Academy web platform, student portal, and digital services, alongside our cookie policies, are detailed below.",
      sections: [
        {
          id: "kullanim-kosullari",
          subTitle: isTr ? "1. Kullanım Koşulları" : "1. Terms of Service",
          doc: allDocs.terms,
        },
        {
          id: "cerez-politikasi",
          subTitle: isTr ? "2. Çerez Politikası & Tercih Yönetimi" : "2. Cookie Policy & Preferences",
          doc: allDocs.cookie,
          isCookie: true,
        },
      ],
    };
  }

  const otherCanonicalLinks = [
    {
      label: isTr ? "Gizlilik & KVKK" : "Privacy & Data",
      href: privacyPath(locale),
      groupKey: "privacy",
    },
    {
      label: isTr ? "Satış, İptal ve İade Koşulları" : "Sales & Refund Terms",
      href: salesAgreementPath(locale),
      groupKey: "sales",
    },
    {
      label: isTr ? "Kullanım & Çerez Koşulları" : "Terms & Cookies",
      href: termsPath(locale),
      groupKey: "terms",
    },
  ].filter((item) => item.groupKey !== group.groupKey);

  return (
    <section className="pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-[900px] px-6 md:px-12">
        {/* Header Badge & Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <Shield className="size-3.5" />
            <span>{group.badge}</span>
            <span className="text-primary/40">·</span>
            <span>v{group.version}</span>
          </div>

          <h1 className="font-heading text-[clamp(2.2rem,5.5vw,4.2rem)] font-normal leading-[1.08] tracking-[-0.025em] text-ink">
            {group.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
            <span>{isTr ? "Son Güncelleme:" : "Last Updated:"} {group.lastUpdated}</span>
            <span>·</span>
            <span>Oriens Academy</span>
          </div>
        </div>

        {/* Intro */}
        <p className="mt-8 max-w-[72ch] text-base md:text-lg leading-relaxed text-ink/75">
          {group.intro}
        </p>

        {/* Table of Contents Quick Links */}
        <div className="mt-8 rounded-2xl border border-border bg-surface-muted/40 p-4 sm:p-5">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
            {isTr ? "Bu Sayfadaki Bölümler" : "Sections on this Page"}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.sections.map((sub) => (
              <a
                key={sub.id}
                href={`#${sub.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-primary hover:text-primary transition-colors"
              >
                <span>{sub.subTitle}</span>
                <ChevronRight className="size-3 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>

        {/* Consolidated Sections */}
        <div className="mt-12 space-y-16">
          {group.sections.map((sub, sIdx) => (
            <div
              key={sub.id}
              id={sub.id}
              className="scroll-mt-32 pt-6 first:pt-0 border-t border-border first:border-t-0"
            >
              {/* Section Header */}
              <div className="mb-8">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
                  {isTr ? "BÖLÜM" : "SECTION"} {sIdx + 1}
                </div>
                <h2 className="font-heading text-2xl md:text-3xl font-semibold text-ink">
                  {sub.subTitle}
                </h2>
                {sub.doc.intro && sub.doc.intro !== group.intro && (
                  <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed">
                    {sub.doc.intro}
                  </p>
                )}
              </div>

              {/* Interactive Cookie Settings Trigger */}
              {sub.isCookie && (
                <div className="mb-8 rounded-2xl border border-border bg-surface-muted/60 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

              {/* Document Clauses */}
              <div className="divide-y divide-border/60">
                {sub.doc.sections.map((section, idx) => (
                  <section key={idx} className="py-6 space-y-3">
                    <h3 className="font-heading text-lg md:text-xl text-ink font-semibold">
                      {section.heading}
                    </h3>
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
            </div>
          ))}
        </div>

        {/* Bottom Navigation to other 2 canonical groups */}
        <div className="mt-16 rounded-3xl border border-border bg-surface p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
            <FileText className="size-4" />
            <span>{isTr ? "Diğer Yasal Dokümanlar" : "Other Legal Policies"}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {otherCanonicalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-xl border border-border/80 bg-surface-muted/40 p-4 text-xs text-ink hover:border-primary hover:bg-surface-muted transition-colors"
              >
                <span className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {item.label}
                </span>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
