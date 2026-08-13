"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { CONTACT } from "@/config/contact";
import { ContactForm } from "./ContactForm";

export function ContactPage() {
  const locale = useLocale();
  const isTr = locale === "tr";

  return (
    <section className="bg-[#F6F8F3] px-4 py-10 sm:px-6 md:py-16">
      <div className="mx-auto grid max-w-[1100px] overflow-hidden rounded-[28px] border border-[#D9E0D8] bg-white shadow-[0_24px_70px_rgba(16,40,30,.09)] lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]">
        <div className="bg-gradient-to-br from-[#A7B7A8] to-[#819586] p-7 text-white sm:p-10 lg:p-12">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-white/70">
            {isTr ? "BİRLİKTE PLANLAYALIM" : "PLAN YOUR NEXT STEP"}
          </p>
          <h1 className="mt-4 font-heading text-4xl font-normal leading-[1.02] tracking-[-.02em] sm:text-5xl">
            {isTr
              ? "Bir sonraki adımınızı konuşalım."
              : "Let's talk about your next step."}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            {isTr
              ? "Hedeflediğiniz sınavı, üniversiteyi veya hazırlık sürecinizi birlikte değerlendirelim. İlk tanışma görüşmesi ücretsizdir."
              : "Tell us about your exam, university or academic goals. Your introductory consultation is free."}
          </p>

          <div className="mt-9 grid gap-3">
            <a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold transition-colors hover:bg-white/15">
              <MessageCircle className="size-5" aria-hidden="true" /> WhatsApp · +90 544 293 90 40
            </a>
            <a href={CONTACT.phoneHref} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold transition-colors hover:bg-white/15">
              <Phone className="size-5" aria-hidden="true" /> {isTr ? "Telefon" : "Phone"} · {CONTACT.phoneDisplay}
            </a>
            <a href={CONTACT.emailHref} className="flex min-h-12 items-center gap-3 break-all rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold transition-colors hover:bg-white/15">
              <Mail className="size-5 shrink-0" aria-hidden="true" /> {isTr ? "E-posta" : "Email"} · {CONTACT.email}
            </a>
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
