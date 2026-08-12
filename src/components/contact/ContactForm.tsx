"use client";

import { useState, useRef, useTransition, type FormEvent } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/content/locale-context";
import { submitContact } from "@/lib/contact/api";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";

export function ContactForm() {
  const locale = useLocale();
  const isTr = locale === "tr";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      nextErrors.fullName = isTr ? "Ad soyad alanı zorunludur." : "Full name is required.";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = isTr ? "Geçerli bir e-posta adresi girin." : "Enter a valid email address.";
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
        phone: phone.trim() || undefined,
        subject: subject.trim() || undefined,
        message: message.trim(),
        locale: locale as "tr" | "en",
        privacyConsent,
        turnstileToken,
      });

      if (res.success) {
        setSubmitted(true);
      } else {
        // Reset Turnstile widget so user can re-verify and retry
        setTurnstileToken("");
        turnstileRef.current?.reset();
        setErrors({ submit: res.message });
      }
    });
  }

  if (submitted) {
    return (
      <div role="status" className="border border-border bg-surface p-8 sm:p-12 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
          <CheckCircle2 className="size-8" />
        </div>
        <h2 className="mt-6 text-2xl font-medium text-ink font-heading">
          {isTr ? "Mesajınız alındı." : "Your message has been received."}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          {isTr
            ? "Oriens Academy ekibine ulaştığınız için teşekkür ederiz. İletişim bilgileriniz üzerinden kısa süre içinde sizinle iletişime geçilecektir."
            : "Thank you for contacting Oriens Academy. Our team will review your inquiry and get back to you shortly."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="border border-border bg-surface p-6 sm:p-10 shadow-sm">
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
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-2 w-full border border-border bg-background p-3 text-sm outline-none transition-colors focus:border-ink"
          />
          {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>}
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            {isTr ? "E-posta Adresi" : "Email Address"} <span className="text-destructive">*</span>
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full border border-border bg-background p-3 text-sm outline-none transition-colors focus:border-ink"
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="phone" className="block text-sm font-medium text-ink">
            {isTr ? "Telefon Numarası" : "Phone Number"} <span className="font-normal text-muted-foreground">({isTr ? "isteğe bağlı" : "optional"})</span>
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 w-full border border-border bg-background p-3 text-sm outline-none transition-colors focus:border-ink"
          />
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="subject" className="block text-sm font-medium text-ink">
            {isTr ? "Konu" : "Subject"} <span className="font-normal text-muted-foreground">({isTr ? "isteğe bağlı" : "optional"})</span>
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-2 w-full border border-border bg-background p-3 text-sm outline-none transition-colors focus:border-ink"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className="block text-sm font-medium text-ink">
            {isTr ? "Mesajınız" : "Message"} <span className="text-destructive">*</span>
          </label>
          <textarea
            id="message"
            rows={5}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isTr ? "Sormak istediğiniz soruları veya destek almak istediğiniz konuları yazabilirsiniz..." : "Share details about your academic inquiries or goals..."}
            className="mt-2 w-full border border-border bg-background p-3 text-sm outline-none transition-colors focus:border-ink resize-y"
          />
          {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
        </div>

        <div className="sm:col-span-2 pt-2 border-t border-border">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
              className="mt-1 size-4 rounded border-border text-brand-accent focus:ring-brand-accent"
            />
            <span className="text-xs text-ink/80 leading-normal">
              {isTr
                ? "İletişim talebimin yanıtlanması amacıyla kişisel verilerimin işlenmesini kabul ediyorum."
                : "I agree to the processing of my contact information for resolving this inquiry."}{" "}
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
          onVerify={(token) => {
            setTurnstileToken(token);
            setErrors((prev) => {
              const copy = { ...prev };
              delete copy.turnstile;
              delete copy.submit;
              return copy;
            });
          }}
          onExpire={() => setTurnstileToken("")}
          onError={() => setTurnstileToken("")}
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
        {isPending
          ? isTr ? "Gönderiliyor..." : "Submitting..."
          : isTr ? "Mesaj Gönder" : "Send Message"}
        <ArrowRight data-directional-arrow className="size-4 ml-2" />
      </Button>
    </form>
  );
}
