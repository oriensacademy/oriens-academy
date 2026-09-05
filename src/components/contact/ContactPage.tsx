"use client";

import { FaInstagram } from "react-icons/fa6";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { CONTACT } from "@/config/contact";
import { ContactForm } from "./ContactForm";

export function ContactPage() {
  const locale = useLocale();
  const isTr = locale === "tr";

  return (
    <section className="min-h-screen bg-[#F6F8F3] px-4 pt-28 pb-16 sm:px-6 md:pt-36 md:pb-24">
      <div className="mx-auto grid max-w-[1150px] overflow-hidden rounded-[28px] border border-[#D9E0D8] bg-white shadow-[0_24px_70px_rgba(16,40,30,.09)] lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col justify-between bg-gradient-to-br from-[#1B3B2B] via-[#10271B] to-[#0A1A12] p-7 text-white sm:p-10 lg:p-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-[#C2D1C3]">
              {isTr ? "İLETİŞİM & DANIŞMANLIK" : "CONTACT & CONSULTANCY"}
            </p>
            <h1 className="mt-4 font-heading text-4xl font-normal leading-[1.05] tracking-[-.02em] sm:text-5xl text-white">
              {isTr
                ? "Bir sonraki adımınızı konuşalım."
                : "Let's talk about your next step."}
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              {isTr
                ? "Hedeflediğiniz sınavı, üniversiteyi veya hazırlık sürecinizi birlikte değerlendirelim. İlk tanışma görüşmesi ücretsizdir."
                : "Tell us about your exam, university or academic goals. Your introductory consultation is free."}
            </p>

            <div className="mt-8 space-y-3">
              <a
                href={CONTACT.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <MessageCircle className="size-5 shrink-0 text-[#71C285]" aria-hidden="true" />
                <span>WhatsApp · {CONTACT.whatsappDisplay}</span>
              </a>
              <a
                href={CONTACT.landlineHref}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Phone className="size-5 shrink-0 text-[#C2D1C3]" aria-hidden="true" />
                <span>{isTr ? "Telefon" : "Phone"} · {CONTACT.landlineDisplay}</span>
              </a>
              <a
                href={CONTACT.emailHref}
                className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Mail className="size-5 shrink-0 text-[#C2D1C3]" aria-hidden="true" />
                <span className="min-w-0 break-all">{isTr ? "E-posta" : "Email"} · {CONTACT.email}</span>
              </a>
              <a
                href={CONTACT.instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <FaInstagram className="size-5 shrink-0 text-[#E1306C]" aria-hidden="true" />
                <span>Instagram · @oriens.academy</span>
              </a>
            </div>
          </div>

          <div className="mt-10 border-t border-white/15 pt-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#C2D1C3]">
              {isTr ? "Merkez Ofis Adresi" : "Headquarters Address"}
            </h2>
            <address className="mt-2.5 flex items-start gap-2.5 text-xs not-italic leading-relaxed text-white/80">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[#C2D1C3]" aria-hidden="true" />
              <span>{CONTACT.businessAddress[locale]}</span>
            </address>
          </div>
        </div>

        <div className="bg-white">
          <ContactForm embedded />
        </div>
      </div>
    </section>
  );
}

export default ContactPage;
