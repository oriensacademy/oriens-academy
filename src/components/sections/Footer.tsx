"use client";

import { MessageSquare, Phone, Mail, MapPin } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { useLocale } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";
import { CONTACT } from "@/config/contact";
import { FooterSection } from "@/components/ui/footer-section";

import { usePublicSettings } from "@/lib/settings/public-settings-context";

export function Footer() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const { showPricing } = usePublicSettings();

  const navigationItems = (isTr
    ? [
        { label: "Sınav Hazırlığı", href: "/tr/sinavlar/" },
        { label: "Metot", href: "/tr#method" },
        { label: "Üniversite Desteği", href: "/tr/universite-destegi/" },
        { label: "Hakkımızda", href: "/tr/hakkimizda/" },
        ...(showPricing ? [{ label: "Ücretler", href: "/tr/ucretler/" }] : []),
      ]
    : [
        { label: "Exam Preparation", href: "/en/exams/" },
        { label: "Method", href: "/en#method" },
        { label: "University Support", href: "/en/university-support/" },
        { label: "About Us", href: "/en/about/" },
        ...(showPricing ? [{ label: "Pricing", href: "/en/pricing/" }] : []),
      ]);

  const contacts = [
    { label: "WhatsApp", value: "+90 544 293 90 40", href: "https://wa.me/905442939040", icon: MessageSquare, external: true },
    { label: isTr ? "Telefon" : "Phone", value: "+90 544 293 90 40", href: "tel:+905442939040", icon: Phone, external: false },
    { label: isTr ? "E-posta" : "Email", value: "info@oriens-academy.com", href: "mailto:info@oriens-academy.com", icon: Mail, external: false },
    { label: "Instagram", value: "@oriens.academy", href: "https://instagram.com/oriens.academy", icon: FaInstagram, external: true },
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
              {isTr ? "Güvenli ödeme" : "Secure payment"}
            </span>
            <div className="mt-1 flex items-center">
              <Image
                src="/images/payment-methods.png"
                alt="Visa & Mastercard"
                width={1224}
                height={307}
                className="h-5 w-auto max-w-[115px] object-contain opacity-85 hover:opacity-100 transition-opacity"
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
        <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px]">
            &copy; 2026 Oriens Academy. {isTr ? "Tüm hakları saklıdır." : "All rights reserved."}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href={localizedPath("privacy", locale)} className="text-[11px] hover:text-foreground transition-colors">
              {isTr ? "Gizlilik Politikası" : "Privacy Policy"}
            </Link>
            <span className="text-border">·</span>
            <Link href={localizedPath("terms", locale)} className="text-[11px] hover:text-foreground transition-colors">
              {isTr ? "Kullanım Koşulları" : "Terms of Service"}
            </Link>
            <span className="text-border hidden sm:inline">·</span>
            <ThemeSelector locale={locale} />
          </div>
        </div>
      }
    />
  );
}

