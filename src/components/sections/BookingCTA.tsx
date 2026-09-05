"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Mail, MessageCircle, Phone } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { CompassMark } from "@/components/brand/CompassMark";
import { Button, ButtonLink } from "@/components/ui/button";
import { ExamSelector, type ExamSelectorValue } from "@/components/forms/ExamSelector";
import { useHomeContent, useLocale } from "@/content/locale-context";
import { submitContact } from "@/lib/contact/api";
import { Wave } from "@/components/ui/wave";
import { getPublicPricingPackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { useAccount } from "@/lib/auth/account-context";
import { getStudentPortalData } from "@/lib/student/data";
import { CONTACT } from "@/config/contact";

const CONSULTATION_PACKAGE_IDS = new Set(["single", "package5", "package10", "package20", "package30"]);

export function BookingCTA() {
  const { bookingCTA } = useHomeContent();
  const locale = useLocale();
  const isTr = locale === "tr";
  const { user, accountType } = useAccount();
  const [submitted, setSubmitted] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [exam, setExam] = useState<ExamSelectorValue>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PublicPricingPackage | null>(null);

  // Form field states for controlled prefill
  const [nameVal, setNameVal] = useState(() => user?.user_metadata?.full_name || "");
  const [emailVal, setEmailVal] = useState(() => user?.email || "");

  const summaryRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Prefill for authenticated student
  useEffect(() => {
    if (user && accountType === "student") {
      getStudentPortalData(user.id).then((res) => {
        if (res.data?.profile) {
          if (res.data.profile.full_name) setNameVal(res.data.profile.full_name);
          if (res.data.profile.email) setEmailVal(res.data.profile.email);
          if (res.data.profile.target_exam) {
            setExam({ type: "exam", code: res.data.profile.target_exam.toLowerCase() });
          }
        }
      });
    }
  }, [user, accountType]);

  useEffect(() => {
    const packageId = new URLSearchParams(window.location.search).get("package");
    if (!packageId || !CONSULTATION_PACKAGE_IDS.has(packageId)) return;
    queueMicrotask(() => setSelectedPackageId(packageId));
    getPublicPricingPackages().then((packages) => {
      setSelectedPackage(packages.find((item) => item.id === packageId) || null);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameVal.trim();
    const email = emailVal.trim();
    const form = event.currentTarget;
    const data = new FormData(form);
    const interest = String(data.get("interest") ?? "");
    const message = String(data.get("message") ?? "").trim();
    const nextErrors: Record<string, string> = {};

    if (!name || name.length < 2) nextErrors.name = bookingCTA.form.nameRequired;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = bookingCTA.form.emailRequired;
    if (!privacyConsent) nextErrors.privacy = isTr ? "Gizlilik onayı zorunludur." : "Privacy consent is required.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    const interestLabel = bookingCTA.form.interestOptions.find((option) => option.value === interest)?.label ?? interest;
    const examLabel = exam ? (exam.type === "exam" ? exam.code.toUpperCase() : exam.label) : "";
    const subject = [interestLabel, examLabel].filter(Boolean).join(" · ");

    setIsSubmitting(true);
    try {
      const result = await submitContact({
        fullName: name,
        email: email.toLowerCase(),
        subject: subject || undefined,
        message: message || (isTr ? "Tanışma görüşmesi talebi." : "Introductory consultation request."),
        locale,
        privacyConsent,
        company_website: honeypot.trim() || undefined,
        source: "consultation",
        packageId: selectedPackageId || undefined,
      });

      if (result.success) {
        setSubmissionMessage(result.message);
        setSubmitted(true);
        return;
      }

      setErrors({ submit: result.message });
    } catch {
      setErrors({
        submit: isTr
          ? "İletişim talebi gönderilemedi. Lütfen tekrar deneyin."
          : "Request failed. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
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
    setHoneypot("");
    setErrors({});
    setSubmitted(false);
    setSubmissionMessage("");
  }

  const fieldClass = "mt-2 min-h-11 w-full border border-border bg-background px-3 text-base outline-none transition-[border-color,box-shadow] duration-200 focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-brand-accent/25 focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";
  const whatsappMessage = isTr
    ? "Merhaba Oriens Academy, tanışma görüşmesi hakkında bilgi almak istiyorum."
    : "Hello Oriens Academy, I would like to get information about an introductory consultation.";

  return (
    <section id="consultation-form" className="section-offset relative overflow-hidden border-t border-border bg-[#F6F8F3] py-14 md:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(129,149,134,.16),transparent_38%),radial-gradient(circle_at_82%_72%,rgba(197,181,138,.13),transparent_34%)]" aria-hidden="true" />
      <div className="relative mx-auto grid w-[calc(100%-2rem)] max-w-[1100px] overflow-hidden rounded-[28px] border border-[#DDE4DC] bg-white shadow-[0_22px_65px_rgba(16,39,27,.09)] lg:grid-cols-[.82fr_1.18fr]">
        <div className="bg-[linear-gradient(145deg,#A7B7A8,#819586)] p-7 text-[#10271B] sm:p-8 lg:p-10">
          <Reveal><CompassMark size={36} interactive /></Reveal>
          <Reveal delay={0.06}><p className="mt-6 text-xs font-bold tracking-[.22em] uppercase">{isTr ? "BİRLİKTE PLANLAYALIM" : "PLAN YOUR NEXT STEP"}</p></Reveal>
          <Reveal delay={0.1}><h2 className="mt-3 font-heading text-[clamp(2rem,3.5vw,3.25rem)] leading-[1.04]">{isTr ? "Bir sonraki adımınızı konuşalım." : "Let's talk about your next step."}</h2></Reveal>
          <Reveal delay={0.14}><p className="mt-4 max-w-md text-base leading-7 text-[#10271B]/80">{isTr ? "Hedeflediğiniz sınavı, üniversiteyi veya hazırlık sürecinizi birlikte değerlendirelim. İlk tanışma görüşmesi ücretsizdir." : "Tell us about your exam, university or academic goals. Your introductory consultation is free."}</p></Reveal>
          <Reveal delay={0.18} className="mt-6 space-y-2">
            <a href={`https://wa.me/905442939040?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 rounded-xl border border-white/35 bg-white/20 px-4 text-sm font-semibold"><MessageCircle className="size-4" />WhatsApp · {CONTACT.whatsappDisplay}</a>
            <a href={CONTACT.landlineHref} className="flex min-h-11 items-center gap-3 rounded-xl border border-white/35 bg-white/20 px-4 text-sm font-semibold"><Phone className="size-4" />{isTr ? "Telefon" : "Phone"} · {CONTACT.landlineDisplay}</a>
            <a href={CONTACT.emailHref} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl border border-white/35 bg-white/20 px-4 py-2 text-sm font-semibold"><Mail className="size-4 shrink-0" /><span className="min-w-0 break-all">{CONTACT.email}</span></a>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="min-w-0 p-5 sm:p-7 lg:p-8">
          {submitted ? (
            <div aria-live="polite" className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl bg-[#F8FAF7] p-6 text-center sm:p-8">
              <div className="flex size-14 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent"><CheckCircle2 className="size-8" /></div>
              <p className="mt-5 font-heading text-xl text-ink">{isTr ? "Talebiniz alındı." : "Request received."}</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/70">{submissionMessage || (isTr ? "Bilgilerinizi aldık. Ekibimiz en kısa sürede sizinle iletişime geçecek." : "We have your details. Our team will contact you as soon as possible.")}</p>
              <p className="mt-6 font-semibold text-ink">{isTr ? "Beklemeye vaktiniz yok mu?" : "Can’t wait?"}</p>
              <p className="mt-1 text-sm text-ink/65">{isTr ? "WhatsApp üzerinden bize hemen ulaşabilirsiniz." : "You can reach us immediately on WhatsApp."}</p>
              <div className="mt-6 grid w-full max-w-lg gap-3 sm:grid-cols-2">
                <ButtonLink href={`https://wa.me/905442939040?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noopener noreferrer" size="lg" className="min-h-12"><MessageCircle className="size-4" />{isTr ? "WhatsApp’tan Yaz" : "Message on WhatsApp"}</ButtonLink>
                <Button type="button" onClick={resetForm} variant="outline" size="lg" className="min-h-12">{isTr ? "Yeni Talep Oluştur" : "Create a New Request"}<ArrowRight className="size-4" /></Button>
                <ButtonLink href={CONTACT.landlineHref} variant="ghost" className="min-h-11 sm:col-span-2"><Phone className="size-4" />{isTr ? "Bizi Ara" : "Call Us"}</ButtonLink>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} noValidate aria-label={bookingCTA.headline} data-form-id="consultation-request" className="min-w-0">
              <div className="mb-5"><p className="text-xs font-bold tracking-[.18em] text-[#819586] uppercase">{isTr ? "ÜCRETSİZ TANIŞMA GÖRÜŞMESİ" : "FREE INTRODUCTORY CONSULTATION"}</p><h3 className="mt-2 font-heading text-2xl text-[#10271B]">{isTr ? "Görüşme talebinizi iletin" : "Send your consultation request"}</h3></div>
              {selectedPackage && (
                <div className="mb-5 rounded-xl border border-[#DDE4DC] bg-[#F6F8F3] px-4 py-3 text-sm text-[#10271B]">
                  <span className="text-[11px] font-bold uppercase tracking-[.12em] text-[#819586]">{isTr ? "Seçilen paket" : "Selected package"}</span>
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                    <strong>{isTr ? selectedPackage.name_tr : selectedPackage.name_en || selectedPackage.name_tr}</strong>
                    <span className="font-semibold">{new Intl.NumberFormat(isTr ? "tr-TR" : "en-GB", { style: "currency", currency: selectedPackage.currency, maximumFractionDigits: 0 }).format(selectedPackage.current_total ?? selectedPackage.price_amount ?? 0)}</span>
                  </div>
                </div>
              )}
              {errors.submit && <div role="alert" className="mb-6 border-l-2 border-destructive bg-destructive/5 p-4 text-sm font-semibold text-destructive">{errors.submit}</div>}
              {Object.keys(errors).some((key) => key !== "submit") && (
                <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-6 border-l-2 border-destructive bg-destructive/5 p-4 outline-none focus-visible:ring-3 focus-visible:ring-destructive/20">
                  <p className="text-sm font-semibold text-destructive">{bookingCTA.form.errorSummary}</p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label htmlFor="consultation-name" className="text-sm font-medium text-ink">{bookingCTA.form.name} <span className="font-normal text-muted-foreground">({bookingCTA.form.requiredLabel})</span></label><input id="consultation-name" data-locale-field="consultation-name" name="name" type="text" value={nameVal} onChange={(e) => { setNameVal(e.target.value); clearError("name"); }} placeholder={isTr ? "Adınız Soyadınız" : "Your full name"} required autoComplete="name" className={fieldClass} />{errors.name && <p className="mt-2 text-sm text-destructive">{errors.name}</p>}</div>
                <div><label htmlFor="consultation-email" className="text-sm font-medium text-ink">{bookingCTA.form.email} <span className="font-normal text-muted-foreground">({bookingCTA.form.requiredLabel})</span></label><input id="consultation-email" data-locale-field="consultation-email" name="email" type="email" value={emailVal} onChange={(e) => { setEmailVal(e.target.value); clearError("email"); }} placeholder={isTr ? "E-posta adresiniz" : "Your email address"} required autoComplete="email" className={fieldClass} />{errors.email && <p className="mt-2 text-sm text-destructive">{errors.email}</p>}</div>
                <div className="sm:col-span-2"><label htmlFor="interest" className="text-sm font-medium text-ink">{bookingCTA.form.interestLabel}</label><select id="interest" data-locale-field="consultation-interest" name="interest" defaultValue={bookingCTA.form.interestOptions[0].value} className={fieldClass}>{bookingCTA.form.interestOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                <div className="sm:col-span-2"><ExamSelector value={exam} onChange={setExam} /></div>
                <div className="sm:col-span-2"><label htmlFor="consultation-message" className="text-sm font-medium text-ink">{bookingCTA.form.messageLabel} <span className="font-normal text-muted-foreground">{bookingCTA.form.messageOptional}</span></label><textarea id="consultation-message" data-locale-field="consultation-message" name="message" rows={3} className={`${fieldClass} resize-y py-2.5`} /></div>
                <div className="sm:col-span-2 border-t border-border pt-4"><label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink/75"><input type="checkbox" data-locale-field="consultation-privacy" checked={privacyConsent} onChange={(event) => { setPrivacyConsent(event.target.checked); clearError("privacy"); }} className="mt-1 size-4" /><span>{isTr ? "Tanışma görüşmesi talebimin yanıtlanması için iletişim bilgilerimin işlenmesini kabul ediyorum." : "I agree to the processing of my contact details for this consultation request."}</span></label>{errors.privacy && <p className="mt-2 text-sm text-destructive">{errors.privacy}</p>}</div>

                {/* Accessibility-safe hidden anti-bot honeypot */}
                <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
                  <label htmlFor="consultation_company_website">Company Website</label>
                  <input
                    id="consultation_company_website"
                    type="text"
                    name="company_website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={isSubmitting} directional size="lg" className="mt-5 h-12 w-full text-base">{isSubmitting ? <><Wave className="h-4 w-8 text-current" aria-label={isTr ? "Gönderiliyor" : "Sending"} /><span>{isTr ? "Gönderiliyor" : "Sending"}</span></> : <>{isTr ? "Görüşme Talebi Gönder" : "Send Consultation Request"}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" /></>}</Button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
