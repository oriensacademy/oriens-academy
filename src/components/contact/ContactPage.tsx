"use client";

import { CompassMark } from "@/components/brand/CompassMark";
import { ButtonLink } from "@/components/ui/button";
import { useLocale } from "@/content/locale-context";
import { ContactForm } from "./ContactForm";
import { Calendar } from "lucide-react";

export function ContactPage() {
  const locale = useLocale();
  const isTr = locale === "tr";

  return (
    <section className="mx-auto max-w-4xl px-6 py-12 md:py-20">
      {/* Header */}
      <div className="mb-12 text-center">
        <CompassMark size={36} className="mx-auto mb-4" />
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-ink font-heading">
          {isTr ? "İletişime Geçin" : "Contact Us"}
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
          {isTr
            ? "Akademik hedefleriniz, sınav hazırlık süreçleriniz veya üniversite ders desteği hakkında sorularınızı bize iletin."
            : "Reach out to us regarding your academic goals, exam preparation strategies, or university coursework support."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        {/* Contact Form */}
        <div>
          <ContactForm />
        </div>

        {/* Booking Alternative CTA Sidebar */}
        <aside className="space-y-6">
          <div className="border border-border bg-surface-muted p-6 text-left">
            <Calendar className="size-8 text-brand-accent mb-3" />
            <h3 className="font-heading font-medium text-lg text-ink">
              {isTr ? "İlk Görüşmenizi Planlayın" : "Schedule a Consultation"}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {isTr
                ? "Doğrudan çevrimiçi randevu takvimimiz üzerinden uygun bir saat seçerek ücretsiz akademik ilk görüşmenizi kurgulayabilirsiniz."
                : "Select an available appointment time directly on our online booking calendar for a complimentary diagnostic consultation."}
            </p>
            <ButtonLink
              href={isTr ? "/tr/randevu" : "/en/booking"}
              className="mt-5 w-full justify-center text-xs"
            >
              {isTr ? "Çevrimiçi Randevu Takvimi" : "Online Booking Calendar"}
            </ButtonLink>
          </div>
        </aside>
      </div>
    </section>
  );
}
