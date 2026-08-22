"use client";

import { FaEnvelope, FaInstagram, FaWhatsapp } from "react-icons/fa6";
import { LockKeyhole, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitch } from "./LanguageSwitch";
import { useCommonContent, useLocale } from "@/content/locale-context";
import { localizedPath, primaryNavigationPath } from "@/lib/routes";
import { CONTACT } from "@/config/contact";
import { FooterSection } from "@/components/ui/footer-section";

export function Footer() {
  const { nav, footer } = useCommonContent();
  const locale = useLocale();
  const isTr = locale === "tr";
  const contacts = [
    { label: "WhatsApp", value: CONTACT.phoneDisplay, href: CONTACT.whatsappHref, icon: FaWhatsapp, external: true },
    { label: isTr ? "Telefon" : "Phone", value: CONTACT.phoneDisplay, href: CONTACT.phoneHref, icon: Phone, external: false },
    { label: isTr ? "E-posta" : "Email", value: CONTACT.email, href: CONTACT.emailHref, icon: FaEnvelope, external: false },
    { label: "Instagram", value: "@oriens.academy", href: CONTACT.instagramHref, icon: FaInstagram, external: true },
  ];

  return (
    <FooterSection
      brand={
        <>
            <Link href={localizedPath("home", locale)} className="relative z-10 flex items-center" aria-label={nav.homeAriaLabel}>
              <Image
                src="/brand/oriens-logo-v2.png"
                alt="Oriens Academy"
                width={217}
                height={80}
                className="h-14 w-auto object-contain"
              />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{footer.tagline}</p>
        </>
      }
      navigation={
        <nav aria-label={nav.footerAriaLabel} className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-1">
            {nav.items.map((item) => (
              <Link
                key={item.href}
                href={primaryNavigationPath(item.href, locale)}
                className="text-sm text-ink/75 transition-colors duration-200 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
        </nav>
      }
      contact={
        <>
            <h2 className="text-xs font-bold tracking-[0.18em] text-ink uppercase">{isTr ? "İletişim" : "Contact"}</h2>
            <ul className="mt-4 space-y-3">
              {contacts.map((item) => <li key={item.label}>
                <a href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined} className="group flex min-w-0 items-center gap-3 rounded-lg text-sm text-ink/75 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#D6DED6] bg-[#EFF3EE] text-[#10271B] transition-colors duration-200 group-hover:bg-[#10271B] group-hover:text-white"><item.icon className="size-[18px]" aria-hidden="true" /></span>
                  <span className="min-w-0"><span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{item.label}</span><span className={item.href.startsWith("mailto:") ? "block break-all" : undefined}>{item.value}</span></span>
                </a>
              </li>)}
            </ul>
        </>
      }
      security={
        <>
          <h2 className="text-xs font-bold tracking-[0.18em] text-ink uppercase">{isTr ? "Adres ve Güvenlik" : "Address & Security"}</h2>
          <address className="mt-4 flex items-start gap-2 text-sm not-italic leading-relaxed text-ink/75">
            <MapPin className="mt-0.5 size-4 shrink-0 text-brand-accent" aria-hidden="true" />
            <span>{CONTACT.businessAddress[locale]}</span>
          </address>
          <div className="mt-4 rounded-xl border border-border bg-surface-muted p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-ink"><LockKeyhole className="size-4 text-brand-accent" aria-hidden="true" />{isTr ? "Güvenli Ödeme" : "Secure Payment"}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {isTr
                ? "Bağlantılar SSL ile korunur. Kartlı ödeme etkinleştirildiğinde, desteklenen işlemlerde bankanın barındırdığı doğrulama ve 3D Secure akışı kullanılır."
                : "Connections are protected by SSL. Once card payment is enabled, eligible transactions use bank-hosted verification and 3D Secure flows."}
            </p>
          </div>
        </>
      }
      language={
        <div className="flex flex-col items-start gap-3">
            <span className="text-xs font-bold tracking-[0.18em] text-ink uppercase">{isTr ? "Dil" : "Language"}</span>
            <LanguageSwitch />
        </div>
      }
      legal={
        <div className="flex flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Oriens Academy. {footer.copyright}
          </p>
          <div className="flex flex-wrap gap-6 items-center">
            {footer.legal.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="transition-colors duration-200 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      }
    />
  );
}
