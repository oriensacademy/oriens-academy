"use client";

import { useCallback, useEffect, useState, useRef, useTransition, type FormEvent } from "react";
import { CheckCircle2, ArrowRight, MessageCircle, Phone } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useLocale } from "@/content/locale-context";
import { submitContact } from "@/lib/contact/api";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";
import Link from "next/link";
import { Wave } from "@/components/ui/wave";
import { useAccount } from "@/lib/auth/account-context";
import { getStudentPortalData } from "@/lib/student/data";

export function ContactForm({ embedded = false }: { embedded?: boolean }) {
  const locale = useLocale();
  const isTr = locale === "tr";
  const { user, accountType } = useAccount();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Prefill for authenticated student
  useEffect(() => {
    if (user) {
      if (user.user_metadata?.full_name) setFullName(user.user_metadata.full_name);
      if (user.email) setEmail(user.email);
      if (user.user_metadata?.phone) setPhone(user.user_metadata.phone);

      if (accountType === "student") {
        getStudentPortalData(user.id).then((res) => {
          if (res.data?.profile) {
            if (res.data.profile.full_name) setFullName(res.data.profile.full_name);
            if (res.data.profile.email) setEmail(res.data.profile.email);
            if (res.data.profile.phone) setPhone(res.data.profile.phone);
          }
        });
      }
    }
  }, [user, accountType]);

  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.turnstile;
      delete copy.submit;
      return copy;
    });
  }, []);
  const handleTurnstileReset = useCallback(() => setTurnstileToken(""), []);

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      nextErrors.fullName = isTr ? "Ad soyad alanı zorunludur." : "Full name is required.";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = isTr ? "Geçerli bir e-posta adresi girin." : "Enter a valid email address.";
    }
    if (!phone.trim() || phone.trim().length < 5) {
      nextErrors.phone = isTr ? "Telefon alanı zorunludur." : "Phone is required.";
    }
    if (!message.trim() || message.trim().length < 5) {
      nextErrors.message = isTr ? "Mesaj alanı en az 5 karakter olmalıdır." : "Message must be at least 5 characters.";
    }
    if (!privacyConsent) {
      nextErrors.privacyConsent = isTr
        ? "İletişim kurulabilmesi için gizlilik onayını kabul etmelisiniz."
        : "You must accept the privacy consent to proceed.";
    }
    if (!turnstileToken) {
      nextErrors.turnstile = isTr
        ? "Lütfen mesajınızı göndermeden önce güvenlik doğrulamasını (Turnstile) tamamlayın."
        : "Please complete the security verification (Turnstile) before submitting.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    startTransition(async () => {
      const res = await submitContact({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
        locale: locale as "tr" | "en",
        privacyConsent,
        turnstileToken,
        source: "contact_form",
      });

      if (res.success) {
        setSubmissionMessage(res.message);
        setSubmitted(true);
      } else {
        // Reset Turnstile widget so user can re-verify and retry
        setTurnstileToken("");
        turnstileRef.current?.reset();
        setErrors({ submit: res.message });
      }
    });
  }

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setSubject("");
    setMessage("");
    setPrivacyConsent(false);
    setTurnstileToken("");
    setErrors({});
    setSubmitted(false);
    setSubmissionMessage("");
    turnstileRef.current?.reset();
  }

  if (submitted) {
    const whatsappMessage = isTr
      ? "Merhaba Oriens Academy, tanışma görüşmesi hakkında bilgi almak istiyorum."
      : "Hello Oriens Academy, I would like to get information about an introductory consultation.";
    const whatsappHref = `https://wa.me/905442939040?text=${encodeURIComponent(whatsappMessage)}`;

    return (
      <div aria-live="polite" className={`${embedded ? "bg-[#F7F8F4]" : "border border-border bg-surface shadow-sm"} rounded-2xl p-7 text-center sm:p-12`}>
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
          <CheckCircle2 className="size-8" />
        </div>
        <h2 className="mt-6 text-2xl font-medium text-ink font-heading">
          {isTr ? "Talebiniz alındı." : "Request received."}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          {submissionMessage || (isTr
            ? "Bilgilerinizi aldık. Ekibimiz en kısa sürede sizinle iletişime geçecek."
            : "We have your details. Our team will contact you as soon as possible.")}
        </p>
        <p className="mt-6 font-semibold text-ink">{isTr ? "Beklemeye vaktiniz yok mu?" : "Can’t wait?"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{isTr ? "WhatsApp üzerinden bize hemen ulaşabilirsiniz." : "You can reach us immediately on WhatsApp."}</p>
        <div className="mx-auto mt-7 grid max-w-lg gap-3 sm:grid-cols-2">
          <ButtonLink href={whatsappHref} target="_blank" rel="noreferrer" size="lg" className="min-h-12">
            <MessageCircle className="size-4" aria-hidden="true" />
            {isTr ? "WhatsApp’tan Yaz" : "Message on WhatsApp"}
          </ButtonLink>
          <Button type="button" onClick={resetForm} variant="outline" size="lg" className="min-h-12">
            {isTr ? "Yeni Talep Oluştur" : "Create a New Request"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          <ButtonLink href="tel:+905442939040" variant="ghost" className="min-h-11 sm:col-span-2">
            <Phone className="size-4" aria-hidden="true" />
            {isTr ? "Bizi Ara" : "Call Us"}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={`${embedded ? "bg-transparent" : "border border-border bg-surface shadow-sm"} p-6 sm:p-10`}>
      {errors.submit && (
        <div role="alert" className="mb-6 border-l-4 border-destructive bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {errors.submit}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="fullName" className="block text-sm font-medium text-ink">
            {isTr ? "Ad Soyad" : "Full Name"} <span className="text-destructive">*</span>
          </label>
          <input
            id="fullName"
            data-locale-field="contact-full-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-2 w-full border border-border bg-background p-3 text-base sm:text-sm outline-none transition-colors focus:border-ink"
          />
          {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>}
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            {isTr ? "E-posta Adresi" : "Email Address"} <span className="text-destructive">*</span>
          </label>
          <input
            id="email"
            data-locale-field="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full border border-border bg-background p-3 text-base sm:text-sm outline-none transition-colors focus:border-ink"
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="phone" className="block text-sm font-medium text-ink">
            {isTr ? "Telefon (zorunlu)" : "Phone (required)"} <span className="text-destructive">*</span>
          </label>
          <input
            id="phone"
            data-locale-field="contact-phone"
            type="tel"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 w-full border border-border bg-background p-3 text-base sm:text-sm outline-none transition-colors focus:border-ink"
          />
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="subject" className="block text-sm font-medium text-ink">
            {isTr ? "Konu" : "Subject"} <span className="font-normal text-muted-foreground">({isTr ? "isteğe bağlı" : "optional"})</span>
          </label>
          <input
            id="subject"
            data-locale-field="contact-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-2 w-full border border-border bg-background p-3 text-base sm:text-sm outline-none transition-colors focus:border-ink"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className="block text-sm font-medium text-ink">
            {isTr ? "Mesajınız" : "Message"} <span className="text-destructive">*</span>
          </label>
          <textarea
            id="message"
            data-locale-field="contact-message"
            rows={5}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isTr ? "Sormak istediğiniz soruları veya destek almak istediğiniz konuları yazabilirsiniz..." : "Share details about your academic inquiries or goals..."}
            className="mt-2 w-full border border-border bg-background p-3 text-base sm:text-sm outline-none transition-colors focus:border-ink resize-y"
          />
          {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
        </div>

        <div className="sm:col-span-2 pt-2 border-t border-border">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              data-locale-field="contact-privacy"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
              className="mt-1 size-4 rounded border-border text-brand-accent focus:ring-brand-accent"
            />
            <span className="text-xs text-ink/80 leading-normal">
              {isTr
                ? "İletişim talebimin yanıtlanması amacıyla kişisel verilerimin işlenmesini kabul ediyorum."
                : "I agree to the processing of my contact information for resolving this inquiry."}{" "}
              <Link href={`/${locale}/privacy`} className="ml-1 font-semibold underline underline-offset-2">
                {isTr ? "Gizlilik Politikası" : "Privacy Policy"}
              </Link>{" "}
              <span className="text-destructive">*</span>
            </span>
          </label>
          {errors.privacyConsent && <p className="mt-1 text-xs text-destructive">{errors.privacyConsent}</p>}
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <TurnstileWidget
          ref={turnstileRef}
          action="contact_submit"
          locale={locale as "tr" | "en"}
          onVerify={handleTurnstileVerify}
          onExpire={handleTurnstileReset}
          onError={handleTurnstileReset}
        />
        {errors.turnstile && (
          <p className="mt-1 text-xs font-medium text-destructive">{errors.turnstile}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        directional
        size="lg"
        className="mt-6 w-full sm:w-auto px-8 h-12 text-base"
      >
        {isPending ? <><Wave className="h-4 w-8 text-current" aria-label={isTr ? "Gönderiliyor" : "Sending"} /><span>{isTr ? "Gönderiliyor" : "Sending"}</span></> : <>{isTr ? "Görüşme Talebi Gönder" : "Send Consultation Request"}<ArrowRight data-directional-arrow className="size-4 ml-2" /></>}
      </Button>
    </form>
  );
}
