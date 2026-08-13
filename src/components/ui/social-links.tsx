"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { FaEnvelope, FaInstagram, FaWhatsapp } from "react-icons/fa6";
import { AnimatePresence, motion } from "motion/react";
import { CONTACT } from "@/config/contact";
import { useLocale } from "@/content/locale-context";

const links = [
  { id: "instagram", label: "Instagram", value: "@oriens.academy", href: CONTACT.instagramHref, Icon: FaInstagram, external: true },
  { id: "whatsapp", label: "WhatsApp", value: CONTACT.phoneDisplay, href: CONTACT.whatsappHref, Icon: FaWhatsapp, external: true },
  { id: "phone", label: "Phone", value: CONTACT.phoneDisplay, href: CONTACT.phoneHref, Icon: Phone, external: false },
  { id: "email", label: "Email", value: CONTACT.email, href: CONTACT.emailHref, Icon: FaEnvelope, external: false },
] as const;

export function SocialLinks() {
  const pathname = usePathname();
  const locale = useLocale();
  const rootRef = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState<(typeof links)[number]["id"] | null>(null);
  const active = links.find((item) => item.id === activeId);
  const isTr = locale === "tr";

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setActiveId(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveId(null);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (pathname?.startsWith("/admin")) return null;

  const actionLabels = {
    instagram: isTr ? "Instagram'da Aç" : "Open Instagram",
    whatsapp: isTr ? "WhatsApp'tan Yaz" : "Message on WhatsApp",
    phone: isTr ? "Ara" : "Call",
    email: isTr ? "E-posta Gönder" : "Send Email",
  };
  const titles = {
    instagram: "Instagram",
    whatsapp: "WhatsApp",
    phone: isTr ? "Telefon" : "Phone",
    email: isTr ? "E-posta" : "Email",
  };

  return (
    <nav ref={rootRef} aria-label={isTr ? "Hızlı iletişim" : "Quick contact"} data-contact-dock className="fixed top-1/2 left-0 z-40 hidden -translate-y-1/2 lg:block">
      <ul className="flex flex-col gap-2.5">
        {links.map(({ id, label, Icon }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => setActiveId((current) => current === id ? null : id)}
              aria-label={label}
              aria-expanded={activeId === id}
              aria-controls="contact-dock-panel"
              className="group flex size-12 items-center justify-center rounded-r-xl border border-l-0 border-[#2C493A] bg-[#10271B] text-white shadow-[0_5px_18px_rgba(16,39,27,.16)] outline-none transition-all duration-300 hover:translate-x-[3px] hover:bg-[#819586] focus-visible:ring-2 focus-visible:ring-[#D6B56D] focus-visible:ring-offset-2"
            >
              <Icon className="size-[18px] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            id="contact-dock-panel"
            key={active.id}
            initial={{ opacity: 0, x: -8, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="absolute top-1/2 left-16 w-64 -translate-y-1/2 rounded-2xl border border-[#DDE4DC] bg-white p-4 shadow-[0_16px_45px_rgba(16,39,27,.16)]"
          >
            <p className="text-xs font-bold tracking-[.14em] text-[#819586] uppercase">{titles[active.id]}</p>
            <p className="mt-2 text-sm font-semibold text-[#10271B]">{active.value}</p>
            <a href={active.href} target={active.external ? "_blank" : undefined} rel={active.external ? "noreferrer" : undefined} className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#10271B] px-4 text-xs font-bold text-white transition-colors hover:bg-[#819586]">
              {actionLabels[active.id]}
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default SocialLinks;
