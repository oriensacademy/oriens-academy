"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Mail, MessageCircle, Phone } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { CompassMark } from "@/components/brand/CompassMark";
import { Button, ButtonLink } from "@/components/ui/button";
import { ExamSelector, type ExamSelectorValue } from "@/components/forms/ExamSelector";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";
import { useHomeContent, useLocale } from "@/content/locale-context";
import { submitContact } from "@/lib/contact/api";

export function BookingCTA() {
  const { bookingCTA } = useHomeContent();
  const locale = useLocale();
  const isTr = locale === "tr";
  const [submitted, setSubmitted] = useState(false);
  const [exam, setExam] = useState<ExamSelectorValue>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
    setErrors((current) => {
      if (!current.turnstile) return current;
      const next = { ...current };
      delete next.turnstile;
      return next;
    });
  }, []);
  const handleTurnstileReset = useCallback(() => setTurnstileToken(""), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const interest = String(data.get("interest") ?? "");
    const message = String(data.get("message") ?? "").trim();
    const nextErrors: Record<string, string> = {};

    if (!name) nextErrors.name = bookingCTA.form.nameRequired;
    if (!email) nextErrors.email = bookingCTA.form.emailRequired;
    else if (!(form.elements.namedItem("email") as HTMLInputElement | null)?.validity.valid) nextErrors.email = bookingCTA.form.emailInvalid;
    if (!privacyConsent) nextErrors.privacy = isTr ? "Gizlilik onayı zorunludur." : "Privacy consent is required.";
    if (!turnstileToken) nextErrors.turnstile = isTr ? "Güvenlik doğrulamasını tamamlayın." : "Complete the security verification.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    const interestLabel = bookingCTA.form.interestOptions.find((option) => option.value === interest)?.label ?? interest;
    const examLabel = exam ? (exam.type === "exam" ? exam.code.toUpperCase() : exam.label) : "";
    const subject = [interestLabel, examLabel].filter(Boolean).join(" · ");

    setIsSubmitting(true);
    const result = await submitContact({
      fullName: name,
      email: email.toLowerCase(),
      phone: phone || undefined,
      subject: subject || undefined,
      message: message || (isTr ? "Tanışma görüşmesi talebi." : "Introductory consultation request."),
      locale,
      privacyConsent,
      turnstileToken,
      source: "consultation",
    });
    setIsSubmitting(false);

    if (result.success) {
      setSubmitted(true);
      return;
    }

    setTurnstileToken("");
    turnstileRef.current?.reset();
    setErrors({ submit: result.message });
  }

  function clearError(field: string) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetForm() {
    formRef.current?.reset();
    setExam(null);
    setPrivacyConsent(false);
    setTurnstileToken("");
    setErrors({});
    setSubmitted(false);
    turnstileRef.current?.reset();
  }

  const fieldClass = "mt-2 min-h-11 w-full border border-border bg-background px-3 text-base outline-none transition-[border-color,box-shadow] duration-200 focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-brand-accent/25 focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";
  const whatsappMessage = isTr
    ? "Merhaba Oriens Academy, tanışma görüşmesi hakkında bilgi almak istiyorum."
    : "Hello Oriens Academy, I would like to get information about an introductory consultation.";

  return (
    <section id="consultation-form" className="section-offset relative overflow-hidden border-t border-border bg-[#F6F8F3] py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(129,149,134,.16),transparent_38%),radial-gradient(circle_at_82%_72%,rgba(197,181,138,.13),transparent_34%)]" aria-hidden="true" />
      <div className="relative mx-auto grid w-[calc(100%-2rem)] max-w-[1100px] overflow-hidden rounded-[28px] border border-[#DDE4DC] bg-white shadow-[0_22px_65px_rgba(16,39,27,.09)] lg:grid-cols-[.82fr_1.18fr]">
        <div className="bg-[linear-gradient(145deg,#A7B7A8,#819586)] p-7 text-[#10271B] sm:p-10 lg:p-12">
          <Reveal><CompassMark size={36} interactive /></Reveal>
          <Reveal delay={0.06}><p className="mt-8 text-xs font-bold tracking-[.22em] uppercase">{isTr ? "BİRLİKTE PLANLAYALIM" : "PLAN YOUR NEXT STEP"}</p></Reveal>
          <Reveal delay={0.1}><h2 className="mt-4 font-heading text-[clamp(2rem,3.5vw,3.25rem)] leading-[1.04]">{isTr ? "Bir sonraki adımınızı konuşalım." : "Let's talk about your next step."}</h2></Reveal>
          <Reveal delay={0.14}><p className="mt-5 max-w-md text-base leading-7 text-[#10271B]/80">{isTr ? "Hedeflediğiniz sınavı, üniversiteyi veya hazırlık sürecinizi birlikte değerlendirelim. İlk tanışma görüşmesi ücretsizdir." : "Tell us about your exam, university or academic goals. Your introductory consultation is free."}</p></Reveal>
          <Reveal delay={0.18} className="mt-9 space-y-3">
            <a href={`https://wa.me/905442939040?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl border border-white/35 bg-white/20 px-4 text-sm font-semibold"><MessageCircle className="size-4" />WhatsApp · +90 544 293 90 40</a>
            <a href="tel:+905442939040" className="flex min-h-12 items-center gap-3 rounded-xl border border-white/35 bg-white/20 px-4 text-sm font-semibold"><Phone className="size-4" />{isTr ? "Telefon" : "Phone"} · +90 544 293 90 40</a>
            <a href="mailto:oriensacademy@gmail.com" className="flex min-h-12 items-center gap-3 rounded-xl border border-white/35 bg-white/20 px-4 text-sm font-semibold"><Mail className="size-4" />oriensacademy@gmail.com</a>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="min-w-0 p-5 sm:p-8 lg:p-10">
          {submitted ? (
            <div aria-live="polite" className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl bg-[#F8FAF7] p-6 text-center sm:p-10">
              <div className="flex size-14 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent"><CheckCircle2 className="size-8" /></div>
              <p className="mt-5 font-heading text-xl text-ink">{isTr ? "Talebiniz alındı." : "Request received."}</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/70">{isTr ? "Bilgilerinizi aldık. Ekibimiz en kısa sürede sizinle iletişime geçecek." : "We have your details. Our team will contact you as soon as possible."}</p>
              <p className="mt-6 font-semibold text-ink">{isTr ? "Beklemeye vaktiniz yok mu?" : "Can’t wait?"}</p>
              <p className="mt-1 text-sm text-ink/65">{isTr ? "WhatsApp üzerinden bize hemen ulaşabilirsiniz." : "You can reach us immediately on WhatsApp."}</p>
              <div className="mt-6 grid w-full max-w-lg gap-3 sm:grid-cols-2">
                <ButtonLink href={`https://wa.me/905442939040?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer" size="lg" className="min-h-12"><MessageCircle className="size-4" />{isTr ? "WhatsApp’tan Yaz" : "Message on WhatsApp"}</ButtonLink>
                <Button type="button" onClick={resetForm} variant="outline" size="lg" className="min-h-12">{isTr ? "Yeni Talep Oluştur" : "Create a New Request"}<ArrowRight className="size-4" /></Button>
                <ButtonLink href="tel:+905442939040" variant="ghost" className="min-h-11 sm:col-span-2"><Phone className="size-4" />{isTr ? "Bizi Ara" : "Call Us"}</ButtonLink>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} noValidate aria-label={bookingCTA.headline} data-form-id="consultation-request" className="min-w-0">
              <div className="mb-7"><p className="text-xs font-bold tracking-[.18em] text-[#819586] uppercase">{isTr ? "ÜCRETSİZ TANIŞMA GÖRÜŞMESİ" : "FREE INTRODUCTORY CONSULTATION"}</p><h3 className="mt-3 font-heading text-2xl text-[#10271B]">{isTr ? "Görüşme talebinizi iletin" : "Send your consultation request"}</h3></div>
              {errors.submit && <div role="alert" className="mb-6 border-l-2 border-destructive bg-destructive/5 p-4 text-sm font-semibold text-destructive">{errors.submit}</div>}
              {Object.keys(errors).some((key) => key !== "submit") && (
                <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-6 border-l-2 border-destructive bg-destructive/5 p-4 outline-none focus-visible:ring-3 focus-visible:ring-destructive/20">
                  <p className="text-sm font-semibold text-destructive">{bookingCTA.form.errorSummary}</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div><label htmlFor="consultation-name" className="text-sm font-medium text-ink">{bookingCTA.form.name} <span className="font-normal text-muted-foreground">({bookingCTA.form.requiredLabel})</span></label><input id="consultation-name" data-locale-field="consultation-name" name="name" type="text" required onInput={() => clearError("name")} autoComplete="name" className={fieldClass} />{errors.name && <p className="mt-2 text-sm text-destructive">{errors.name}</p>}</div>
                <div><label htmlFor="consultation-email" className="text-sm font-medium text-ink">{bookingCTA.form.email} <span className="font-normal text-muted-foreground">({bookingCTA.form.requiredLabel})</span></label><input id="consultation-email" data-locale-field="consultation-email" name="email" type="email" required onInput={() => clearError("email")} autoComplete="email" className={fieldClass} />{errors.email && <p className="mt-2 text-sm text-destructive">{errors.email}</p>}</div>
                <div><label htmlFor="interest" className="text-sm font-medium text-ink">{bookingCTA.form.interestLabel}</label><select id="interest" data-locale-field="consultation-interest" name="interest" defaultValue={bookingCTA.form.interestOptions[0].value} className={fieldClass}>{bookingCTA.form.interestOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                <div><label htmlFor="consultation-phone" className="text-sm font-medium text-ink">{isTr ? "Telefon" : "Phone"} <span className="font-normal text-muted-foreground">({isTr ? "isteğe bağlı" : "optional"})</span></label><input id="consultation-phone" data-locale-field="consultation-phone" name="phone" type="tel" autoComplete="tel" className={fieldClass} /></div>
                <div className="sm:col-span-2"><ExamSelector value={exam} onChange={setExam} /></div>
                <div className="sm:col-span-2"><label htmlFor="consultation-message" className="text-sm font-medium text-ink">{bookingCTA.form.messageLabel} <span className="font-normal text-muted-foreground">{bookingCTA.form.messageOptional}</span></label><textarea id="consultation-message" data-locale-field="consultation-message" name="message" rows={3} className={`${fieldClass} resize-y py-2.5`} /></div>
                <div className="sm:col-span-2 border-t border-border pt-4"><label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink/75"><input type="checkbox" data-locale-field="consultation-privacy" checked={privacyConsent} onChange={(event) => { setPrivacyConsent(event.target.checked); clearError("privacy"); }} className="mt-1 size-4" /><span>{isTr ? "Tanışma görüşmesi talebimin yanıtlanması için iletişim bilgilerimin işlenmesini kabul ediyorum." : "I agree to the processing of my contact details for this consultation request."}</span></label>{errors.privacy && <p className="mt-2 text-sm text-destructive">{errors.privacy}</p>}</div>
                <div className="sm:col-span-2"><TurnstileWidget ref={turnstileRef} action="consultation_submit" locale={locale} onVerify={handleTurnstileVerify} onExpire={handleTurnstileReset} onError={handleTurnstileReset} />{errors.turnstile && <p className="mt-2 text-sm text-destructive">{errors.turnstile}</p>}</div>
              </div>
              <Button type="submit" disabled={isSubmitting} directional size="lg" className="mt-7 h-12 w-full text-base">{isSubmitting ? (isTr ? "Gönderiliyor..." : "Submitting...") : (isTr ? "Görüşme Talebi Gönder" : "Send Consultation Request")}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></Button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
