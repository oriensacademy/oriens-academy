"use client";

import { FaEnvelope, FaInstagram, FaWhatsapp } from "react-icons/fa6";
import { MapPin, Phone } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitch } from "./LanguageSwitch";
import { useCommonContent, useLocale } from "@/content/locale-context";
import { localizedPath, primaryNavigationPath } from "@/lib/routes";
import { CONTACT } from "@/config/contact";
import { FooterSection } from "@/components/ui/footer-section";
import { useAccount } from "@/lib/auth/account-context";

import { ThemeSelector } from "@/components/theme/ThemeSelector";

export function Footer() {
  const { nav, footer } = useCommonContent();
  const locale = useLocale();
  const { accountType } = useAccount();
  const isTr = locale === "tr";
  const isStudent = accountType === "student";

  const contacts = [
    { label: "WhatsApp", value: CONTACT.phoneDisplay, href: CONTACT.whatsappHref, icon: FaWhatsapp, external: true },
    { label: isTr ? "Telefon" : "Phone", value: CONTACT.phoneDisplay, href: CONTACT.phoneHref, icon: Phone, external: false },
    { label: isTr ? "E-posta" : "Email", value: CONTACT.email, href: CONTACT.emailHref, icon: FaEnvelope, external: false },
    { label: "Instagram", value: "@oriens.academy", href: CONTACT.instagramHref, icon: FaInstagram, external: true },
  ];

  const visibleNavItems = nav.items.filter((item) => item.href !== "#pricing" || isStudent);

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
          {visibleNavItems.map((item) => (
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
        <div className="space-y-6">
          <div>
            <h2>
              <Link
                href={localizedPath("contact", locale)}
                className="text-xs font-bold tracking-[0.18em] text-ink uppercase transition-colors hover:text-primary"
              >
                {isTr ? "İletişim" : "Contact"}
              </Link>
            </h2>
            <ul className="mt-3.5 space-y-2.5">
              {contacts.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                    className="group flex min-w-0 items-center gap-2.5 rounded-lg text-xs text-ink/75 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-4"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#D6DED6] bg-[#EFF3EE] text-[#10271B] transition-colors duration-200 group-hover:bg-[#10271B] group-hover:text-white">
                      <item.icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="mr-1.5 font-bold tracking-wider text-muted-foreground uppercase text-[9px]">{item.label}:</span>
                      <span className={item.href.startsWith("mailto:") ? "break-all" : undefined}>{item.value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="block text-xs font-bold tracking-[0.18em] text-ink uppercase">
              {isTr ? "Adres" : "Address"}
            </span>
            <div className="mt-2 flex min-w-0 items-start gap-2.5 text-xs text-ink/75">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#D6DED6] bg-[#EFF3EE] text-[#10271B]">
                <MapPin className="size-3.5" aria-hidden="true" />
              </span>
              <address className="not-italic leading-relaxed text-[11px] text-muted-foreground">
                {CONTACT.businessAddress[locale]}
              </address>
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold tracking-[0.18em] text-ink uppercase">
              {isTr ? "Güvenli Ödeme" : "Secure Payment"}
            </span>
            <div className="mt-2.5">
              <Image
                src="/images/payment-methods.png"
                alt={isTr ? "Ödeme Yöntemleri - Visa ve Mastercard" : "Payment Methods - Visa and Mastercard"}
                width={1224}
                height={307}
                className="h-auto w-full max-w-[150px] sm:max-w-[165px] object-contain opacity-95 transition-opacity hover:opacity-100"
              />
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {isTr ? "Ödeme bağlantıları SSL ile korunur." : "Payment connections are SSL protected."}
              </p>
            </div>
          </div>
        </div>
      }
      language={
        <div className="flex flex-col items-start gap-3">
          <span className="text-xs font-bold tracking-[0.18em] text-ink uppercase">{isTr ? "Dil" : "Language"}</span>
          <LanguageSwitch />
        </div>
      }
      themeSelector={<ThemeSelector />}
      legal={
        <div className="flex flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Oriens Academy. {footer.copyright}
          </p>
          <div className="flex flex-wrap gap-6 items-center">
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
