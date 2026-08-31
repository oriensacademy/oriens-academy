"use client";

import { MessageSquare, Phone, Mail, MapPin, ChevronUp } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { useLocale } from "@/content/locale-context";
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
import { CONTACT } from "@/config/contact";
import { FooterSection } from "@/components/ui/footer-section";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import { publicNavigation } from "@/lib/public-navigation";

function LegalGroup({
  label,
  items,
}: {
  label: string;
  items: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer text-[11px] font-medium"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronUp className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 z-50 min-w-[200px] rounded-xl border border-border bg-surface p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex flex-col space-y-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2.5 py-1.5 text-xs text-foreground/80 hover:bg-surface-muted hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Footer() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const { showPricing } = usePublicSettings();

  const navigationItems = publicNavigation(locale, showPricing)
    .filter((item) => !["home", "contact"].includes(item.id));

  const legalGroups = isTr
    ? [
        {
          id: "privacy",
          label: "Gizlilik & KVKK",
          items: [
            { label: "Gizlilik Politikası", href: privacyPath(locale) },
            { label: "KVKK Aydınlatma Metni", href: kvkkPath(locale) },
          ],
        },
        {
          id: "sales",
          label: "Satış Koşulları",
          items: [
            { label: "Mesafeli Satış Sözleşmesi", href: salesAgreementPath(locale) },
            { label: "Ön Bilgilendirme Formu", href: preInformationPath(locale) },
          ],
        },
      ]
    : [
        {
          id: "privacy",
          label: "Privacy & Data",
          items: [
            { label: "Privacy Policy", href: privacyPath(locale) },
            { label: "KVKK Notice", href: kvkkPath(locale) },
          ],
        },
        {
          id: "sales",
          label: "Sales Terms",
          items: [
            { label: "Distance Sales Agreement", href: salesAgreementPath(locale) },
            { label: "Pre-Information Form", href: preInformationPath(locale) },
          ],
        },
      ];

  const singleLegalItems = isTr
    ? [
        { label: "İptal ve İade Koşulları", href: refundPolicyPath(locale) },
        { label: "Kullanım Koşulları", href: termsPath(locale) },
        { label: "Çerez Politikası", href: cookiePolicyPath(locale) },
      ]
    : [
        { label: "Cancellation & Refund", href: refundPolicyPath(locale) },
        { label: "Terms of Service", href: termsPath(locale) },
        { label: "Cookie Policy", href: cookiePolicyPath(locale) },
      ];

  const contacts = [
    {
      label: "WhatsApp",
      value: CONTACT.whatsappDisplay,
      href: CONTACT.whatsappHref,
      icon: MessageSquare,
      external: true,
    },
    {
      label: isTr ? "Telefon" : "Phone",
      value: CONTACT.phoneDisplay,
      href: CONTACT.phoneHref,
      icon: Phone,
      external: false,
    },
    {
      label: isTr ? "E-posta" : "Email",
      value: CONTACT.email,
      href: CONTACT.emailHref,
      icon: Mail,
      external: false,
    },
    {
      label: "Instagram",
      value: "@oriens.academy",
      href: CONTACT.instagramHref,
      icon: FaInstagram,
      external: true,
    },
  ];

  return (
    <FooterSection
      brand={
        <div className="space-y-3">
          <Link href={localizedPath("home", locale)} className="inline-flex items-center" aria-label="Oriens Academy">
            <Image
              src="/brand/oriens-logo-v2.png"
              alt="Oriens Academy"
              width={200}
              height={70}
              className="h-9 w-auto object-contain"
            />
          </Link>
          <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">
            {isTr
              ? "Premium uluslararası eğitim danışmanlığı — sınav hazırlığı, özel ders ve üniversite desteği."
              : "Premium international academic consultancy — exam preparation, tutoring & university support."}
          </p>
          <div className="pt-1">
            <span className="block text-[10px] font-medium text-muted-foreground">
              {isTr ? "256-Bit SSL & 3D Secure Güvenli Ödeme" : "256-Bit SSL & 3D Secure Payment"}
            </span>
            <div className="mt-1 flex items-center">
              <Image
                src="/images/payment/odeme_altyapi.png"
                alt={isTr ? "PayTR destekli güvenli kart ödeme altyapısı" : "Secure card payment infrastructure powered by PayTR"}
                width={1996}
                height={191}
                className="h-auto w-full max-w-[270px] object-contain opacity-90 transition-opacity hover:opacity-100 sm:max-w-[320px]"
              />
            </div>
          </div>
        </div>
      }
      navigation={
        <div>
          <span className="block text-xs font-bold tracking-[0.16em] text-foreground uppercase">
            {isTr ? "Eğitim & Programlar" : "Programs & Navigation"}
          </span>
          <nav aria-label={isTr ? "Alt menü" : "Footer navigation"} className="mt-3 flex flex-col space-y-1.5">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs text-foreground/75 hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      }
      contact={
        <div>
          <span className="block text-xs font-bold tracking-[0.16em] text-foreground uppercase">
            {isTr ? "İletişim" : "Contact"}
          </span>
          <ul className="mt-3 space-y-2">
            {contacts.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  className="group flex items-center gap-2 text-xs text-foreground/75 hover:text-foreground transition-colors"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-primary group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <item.icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 truncate">
                    <span className="mr-1 text-[10px] text-muted-foreground">{item.label}:</span>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      }
      info={
        <div className="space-y-4">
          <div>
            <span className="block text-xs font-bold tracking-[0.16em] text-foreground uppercase">
              {isTr ? "Konum" : "Location"}
            </span>
            <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-primary">
                <MapPin className="size-3.5" aria-hidden="true" />
              </span>
              <address className="not-italic text-[11px] leading-relaxed text-muted-foreground">
                {CONTACT.businessAddressLines[locale].map((line, idx) => (
                  <span key={idx} className="block">{line}</span>
                ))}
              </address>
            </div>
          </div>
          <div>
            <span className="block text-[10px] font-bold tracking-[0.16em] text-foreground uppercase mb-1.5">
              {isTr ? "Dil / Language" : "Language"}
            </span>
            <LanguageSwitch />
          </div>
        </div>
      }
      legal={
        <div className="space-y-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
            {legalGroups.map((group) => (
              <span key={group.id} className="inline-flex items-center gap-3">
                <LegalGroup label={group.label} items={group.items} />
                <span className="text-border">·</span>
              </span>
            ))}
            {singleLegalItems.map((item, idx) => (
              <span key={item.href} className="inline-flex items-center gap-3">
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
                {idx < singleLegalItems.length - 1 && <span className="text-border">·</span>}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-2 border-t border-border/50 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px]">
              &copy; 2026 Oriens Academy. {isTr ? "Tüm hakları saklıdır." : "All rights reserved."}
            </p>
            <div className="flex items-center gap-3">
              <ThemeSelector locale={locale} />
            </div>
          </div>
        </div>
      }
    />
  );
}
