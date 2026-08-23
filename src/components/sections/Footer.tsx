"use client";

import { FaEnvelope, FaInstagram, FaWhatsapp } from "react-icons/fa6";
import { MapPin, Phone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitch } from "./LanguageSwitch";
import { useCommonContent, useLocale } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";
import { CONTACT } from "@/config/contact";
import { FooterSection } from "@/components/ui/footer-section";

export function Footer() {
  const { footer } = useCommonContent();
  const locale = useLocale();
  const isTr = locale === "tr";

  const navigationItems = isTr
    ? [
        { label: "Sınav Hazırlığı", href: "/tr/sinavlar/" },
        { label: "Metot", href: "/tr/hakkimizda/#method" },
        { label: "Üniversite Ders Desteği", href: "/tr/universite-destegi/" },
        { label: "Hakkımızda", href: "/tr/hakkimizda/" },
      ]
    : [
        { label: "Exam Preparation", href: "/en/exams/" },
        { label: "Method", href: "/en/about/#method" },
        { label: "University Course Support", href: "/en/university-support/" },
        { label: "About Us", href: "/en/about/" },
      ];

  const contacts = [
    { label: "WhatsApp", value: CONTACT.phoneDisplay, href: CONTACT.whatsappHref, icon: FaWhatsapp, external: true },
    { label: isTr ? "Telefon" : "Phone", value: CONTACT.phoneDisplay, href: CONTACT.phoneHref, icon: Phone, external: false },
    { label: isTr ? "E-posta" : "Email", value: CONTACT.email, href: CONTACT.emailHref, icon: FaEnvelope, external: false },
    { label: "Instagram", value: "@oriens.academy", href: CONTACT.instagramHref, icon: FaInstagram, external: true },
  ];

  return (
    <FooterSection
      brand={
        <div className="space-y-4">
          <Link href={localizedPath("home", locale)} className="relative z-10 inline-flex items-center" aria-label="Oriens Academy, ana sayfa">
            <Image
              src="/brand/oriens-logo-v2.png"
              alt="Oriens Academy"
              width={217}
              height={80}
              className="h-10 w-auto object-contain md:h-11"
            />
          </Link>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{footer.tagline}</p>
          <div className="pt-1">
            <span className="block text-[11px] font-bold tracking-[0.16em] text-ink uppercase">
              {isTr ? "Güvenli Ödeme" : "Secure Payment"}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <Image
                src="/images/payment-methods.png"
                alt={isTr ? "Ödeme Yöntemleri - Visa ve Mastercard" : "Payment Methods - Visa and Mastercard"}
                width={1224}
                height={307}
                className="h-6 w-auto max-w-[120px] object-contain opacity-90 transition-opacity hover:opacity-100"
              />
            </div>
          </div>
        </div>
      }
      navigation={
        <div>
          <span className="block text-xs font-bold tracking-[0.18em] text-ink uppercase">
            {isTr ? "Kurumsal & Eğitim" : "Academic & Company"}
          </span>
          <nav aria-label={isTr ? "Alt menü" : "Footer navigation"} className="mt-3.5 flex flex-col space-y-2">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs text-ink/75 transition-colors duration-200 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      }
      contact={
        <div>
          <h2>
            <Link
              href={localizedPath("contact", locale)}
              className="text-xs font-bold tracking-[0.18em] text-ink uppercase transition-colors hover:text-primary"
            >
              {isTr ? "İletişim" : "Contact"}
            </Link>
          </h2>
          <ul className="mt-3.5 space-y-2">
            {contacts.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  className="group flex min-w-0 items-center gap-2 rounded-lg text-xs text-ink/75 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-accent"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[#D6DED6] bg-[#EFF3EE] text-[#10271B] transition-colors duration-200 group-hover:bg-[#10271B] group-hover:text-white">
                    <item.icon className="size-3" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 truncate">
                    <span className="mr-1 text-[10px] font-semibold text-muted-foreground uppercase">{item.label}:</span>
                    <span>{item.value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      }
      address={
        <div>
          <span className="block text-xs font-bold tracking-[0.18em] text-ink uppercase">
            {isTr ? "Adres" : "Address"}
          </span>
          <div className="mt-2.5 flex min-w-0 items-start gap-2 text-xs text-ink/75">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[#D6DED6] bg-[#EFF3EE] text-[#10271B]">
              <MapPin className="size-3" aria-hidden="true" />
            </span>
            <address className="not-italic text-[11px] leading-relaxed text-muted-foreground">
              {CONTACT.businessAddress[locale]}
            </address>
          </div>
        </div>
      }
      language={
        <div className="flex flex-col items-start gap-2">
          <span className="text-xs font-bold tracking-[0.18em] text-ink uppercase">{isTr ? "Dil" : "Language"}</span>
          <LanguageSwitch />
        </div>
      }
      legal={
        <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Oriens Academy. {footer.copyright}
          </p>
          <div className="flex flex-wrap gap-5 items-center">
            <Link href={localizedPath("privacy", locale)} className="transition-colors duration-200 hover:text-ink">
              {isTr ? "Gizlilik Politikası" : "Privacy Policy"}
            </Link>
            <Link href={localizedPath("terms", locale)} className="transition-colors duration-200 hover:text-ink">
              {isTr ? "Kullanım Koşulları" : "Terms of Service"}
            </Link>
          </div>
        </div>
      }
    />
  );
}

