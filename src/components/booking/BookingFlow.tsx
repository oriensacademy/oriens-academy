"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Calendar, Clock, AlertTriangle, CheckCircle2, Globe, MessageCircle, Phone } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { CompassMark } from "@/components/brand/CompassMark";
import { Button, ButtonLink } from "@/components/ui/button";
import { ExamSelector, type ExamSelectorValue } from "@/components/forms/ExamSelector";
import { useHomeContent, useLocale } from "@/content/locale-context";
import { getPublicAvailability, submitBooking } from "@/lib/booking/api";
import type { PublicAvailabilitySlot, SupportType, BookingResult } from "@/lib/booking/types";
import { BookingStepper } from "./BookingStepper";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/components/security/TurnstileWidget";
import { useAccount } from "@/lib/auth/account-context";
import { getStudentPortalData } from "@/lib/student/data";
import { CONTACT } from "@/config/contact";

export function BookingFlow() {
  const { bookingFlow } = useHomeContent();
  const locale = useLocale();
  const { user, accountType } = useAccount();

  // Turnstile security state
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);

  // Form selections & values
  const [supportType, setSupportType] = useState<SupportType>("exam_preparation");
  const [exam, setExam] = useState<ExamSelectorValue>(null);
  const [notes, setNotes] = useState("");

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [fullName, setFullName] = useState(() => user?.user_metadata?.full_name || "");
  const [email, setEmail] = useState(() => user?.email || "");
  const [phone, setPhone] = useState(() => user?.user_metadata?.phone || "");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Prefill for authenticated student
  useEffect(() => {
    if (user && accountType === "student") {
      getStudentPortalData(user.id).then((res) => {
        if (res.data?.profile) {
          if (res.data.profile.full_name) setFullName(res.data.profile.full_name);
          if (res.data.profile.email) setEmail(res.data.profile.email);
          if (res.data.profile.phone) setPhone(res.data.profile.phone);
          if (res.data.profile.target_exam) {
            setExam({ type: "exam", code: res.data.profile.target_exam.toLowerCase() });
          }
        }
      });
    }
  }, [user, accountType]);

  // Availability & loading states
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // Error & Submission state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slotUnavailableMessage, setSlotUnavailableMessage] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.submit;
      return copy;
    });
  }, []);
  const handleTurnstileReset = useCallback(() => setTurnstileToken(""), []);

  // Detect browser timezone on client
  const [timeZone] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        return "UTC";
      }
    }
    return "UTC";
  });

  // Fetch public availability slots
  useEffect(() => {
    async function loadAvailability() {
      setLoadingSlots(true);
      const availableSlots = await getPublicAvailability();
      setSlots(availableSlots);
      setLoadingSlots(false);
    }
    loadAvailability();
  }, []);

  // Selected slot helper
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  // Validation functions per step
  function validateStep(step: number): boolean {
    const nextErrors: Record<string, string> = {};

    if (step === 0) {
      if (supportType === "exam_preparation" && !exam) {
        nextErrors.exam = locale === "tr" ? "Lütfen bir sınav seçin." : "Please select an exam.";
      }
    } else if (step === 1) {
      if (!selectedSlotId) {
        nextErrors.slot = locale === "tr" ? "Lütfen bir görüşme saati seçin." : "Please select an appointment time.";
      }
    } else if (step === 2) {
      if (!fullName.trim() || fullName.trim().length < 2) {
        nextErrors.fullName = locale === "tr" ? "Ad Soyad alanı zorunludur." : "Full name is required.";
      }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        nextErrors.email = locale === "tr" ? "Geçerli bir e-posta adresi girin." : "Enter a valid email address.";
      }
      if (!privacyConsent) {
        nextErrors.privacyConsent = bookingFlow.step3.privacyConsentRequired;
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleNextStep() {
    if (validateStep(currentStep)) {
      setSlotUnavailableMessage(null);
      setCurrentStep((prev) => Math.min(prev + 1, bookingFlow.steps.length - 1));
    }
  }

  function handlePrevStep() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleFinalSubmit() {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
      return;
    }

    if (!selectedSlotId) return;

    if (!turnstileToken) {
      setErrors({
        submit:
          locale === "tr"
            ? "Lütfen devam etmeden önce güvenlik doğrulamasını (Turnstile) tamamlayın."
            : "Please complete the security verification (Turnstile) before proceeding.",
      });
      return;
    }

    startTransition(async () => {
      const examCode = exam?.type === "exam" ? exam.code : undefined;
      const customExam = exam?.type === "other" ? exam.label : undefined;

      const res = await submitBooking({
        slotId: selectedSlotId,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        supportType,
        examCode,
        customExam,
        notes: notes.trim() || undefined,
        locale: locale as "tr" | "en",
        privacyConsent,
        marketingConsent,
        turnstileToken,
      });

      if (res.success) {
        setBookingResult(res);
      } else {
        // Reset turnstile token for retry
        setTurnstileToken("");
        turnstileRef.current?.reset();

        if (res.errorCode === "SLOT_UNAVAILABLE" || res.errorCode === "SLOT_NOT_FOUND") {
          setSlotUnavailableMessage(bookingFlow.slotUnavailableNotice);
          const refreshedSlots = await getPublicAvailability();
          setSlots(refreshedSlots);
          setSelectedSlotId(null);
          setCurrentStep(1);
        } else {
          setErrors({ submit: res.message });
        }
      }
    });
  }

  function formatSlotDateTime(isoString: string) {
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = d.toLocaleTimeString(locale === "tr" ? "tr-TR" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return { dateStr, timeStr };
  }

  async function resetBooking() {
    setCurrentStep(0);
    setSupportType("exam_preparation");
    setExam(null);
    setNotes("");
    setSelectedSlotId(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setPrivacyConsent(false);
    setMarketingConsent(false);
    setTurnstileToken("");
    setErrors({});
    setSlotUnavailableMessage(null);
    setBookingResult(null);
    turnstileRef.current?.reset();
    setLoadingSlots(true);
    setSlots(await getPublicAvailability());
    setLoadingSlots(false);
  }

  if (bookingResult && bookingResult.success) {
    const slotDetails = bookingResult.startsAt ? formatSlotDateTime(bookingResult.startsAt) : null;
    const isTr = locale === "tr";
    const whatsappMessage = isTr
      ? "Merhaba Oriens Academy, tanışma görüşmesi hakkında bilgi almak istiyorum."
      : "Hello Oriens Academy, I would like to get information about an introductory consultation.";
    const whatsappHref = `https://wa.me/905442939040?text=${encodeURIComponent(whatsappMessage)}`;

    return (
      <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <Reveal>
          <div className="border border-border bg-surface p-8 sm:p-12 text-center shadow-sm">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
              <CheckCircle2 className="size-8" />
            </div>

            <h1 className="mt-6 text-2xl sm:text-3xl font-medium text-ink">
              {isTr ? "Talebiniz alındı." : "Request received."}
            </h1>
            <p className="mt-3 text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
              {isTr
                ? "Bilgilerinizi aldık. Ekibimiz en kısa sürede sizinle iletişime geçecek."
                : "We have your details. Our team will contact you as soon as possible."}
            </p>

            <div className="mt-8 border-y border-border py-6 text-left max-w-md mx-auto space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{bookingFlow.step4.contactSummary}:</span>
                <span className="font-medium text-ink">{fullName} ({email})</span>
              </div>
              {slotDetails && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{bookingFlow.step4.slotSummary}:</span>
                  <span className="font-medium text-ink">{slotDetails.dateStr} @ {slotDetails.timeStr}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{bookingFlow.success.referenceLabel}</span>
                <span className="font-mono text-xs text-muted-foreground">{bookingResult.bookingId.slice(0, 8)}...</span>
              </div>
            </div>

            <p className="mt-7 font-semibold text-ink">{isTr ? "Beklemeye vaktiniz yok mu?" : "Can’t wait?"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{isTr ? "WhatsApp üzerinden bize hemen ulaşabilirsiniz." : "You can reach us immediately on WhatsApp."}</p>
            <div className="mx-auto mt-7 grid max-w-lg gap-3 sm:grid-cols-2">
              <ButtonLink href={whatsappHref} target="_blank" rel="noreferrer" size="lg" className="min-h-12">
                <MessageCircle className="size-4" aria-hidden="true" />
                {isTr ? "WhatsApp’tan Yaz" : "Message on WhatsApp"}
              </ButtonLink>
              <Button type="button" onClick={resetBooking} variant="outline" size="lg" className="min-h-12">
                {isTr ? "Yeni Talep Oluştur" : "Create a New Request"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <ButtonLink href={CONTACT.landlineHref} variant="ghost" className="min-h-11 sm:col-span-2">
                <Phone className="size-4" aria-hidden="true" />
                {isTr ? "Bizi Ara" : "Call Us"}
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-12 md:py-20">
      <div className="mb-10 text-center">
        <CompassMark size={36} className="mx-auto mb-4" />
        <h1 className="text-2xl sm:text-4xl font-medium tracking-tight text-ink">
          {bookingFlow.headline}
        </h1>
        <p className="mt-3 text-base text-muted-foreground max-w-xl mx-auto">
          {bookingFlow.subheadline}
        </p>
      </div>

      <BookingStepper
        steps={bookingFlow.steps}
        currentStep={currentStep}
        onStepClick={(idx) => setCurrentStep(idx)}
      />

      {slotUnavailableMessage && (
        <div role="alert" className="mt-6 border-l-4 border-amber-500 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{slotUnavailableMessage}</span>
          </div>
        </div>
      )}

      {errors.submit && (
        <div role="alert" className="mt-6 border-l-4 border-destructive bg-destructive/10 p-4 text-sm text-destructive font-medium">
          {errors.submit}
        </div>
      )}

      <div className="mt-8 border border-border bg-surface p-6 sm:p-10 shadow-sm">
        {currentStep === 0 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-medium text-ink">{bookingFlow.step1.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "tr"
                  ? "Size en uygun akademik programı ve eğitmeni belirleyebilmemiz için alan seçin."
                  : "Select an option so we can tailor the diagnostic and instructor matching."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {bookingFlow.supportTypeOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col border p-5 transition-all duration-200 ${
                    supportType === option.value
                      ? "border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent"
                      : "border-border bg-surface hover:border-ink/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="supportType"
                    value={option.value}
                    checked={supportType === option.value}
                    onChange={() => {
                      setSupportType(option.value as SupportType);
                      setErrors({});
                    }}
                    className="sr-only"
                  />
                  <span className="font-heading font-medium text-ink">{option.label}</span>
                  <span className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>

            {supportType === "exam_preparation" && (
              <div className="pt-4 border-t border-border">
                <ExamSelector value={exam} onChange={(val) => { setExam(val); setErrors({}); }} />
                {errors.exam && (
                  <p className="mt-2 text-xs font-medium text-destructive">{errors.exam}</p>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <label htmlFor="notes" className="block text-sm font-medium text-ink">
                {bookingFlow.step1.notesLabel}{" "}
                <span className="font-normal text-muted-foreground">
                  ({locale === "tr" ? "isteğe bağlı" : "optional"})
                </span>
              </label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={bookingFlow.step1.notesPlaceholder}
                className="mt-2 w-full border border-border bg-background p-3 text-base sm:text-sm outline-none transition-colors focus:border-ink"
              />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-ink">{bookingFlow.step2.title}</h2>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="size-3.5" />
                <span>{bookingFlow.step2.timezoneNotice} <strong className="text-ink">{timeZone}</strong></span>
              </div>
            </div>

            {errors.slot && (
              <p role="alert" className="text-xs font-medium text-destructive">{errors.slot}</p>
            )}

            {loadingSlots ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <div className="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-brand-accent border-t-transparent" />
                <span>{locale === "tr" ? "Randevu saatleri yükleniyor..." : "Loading available appointment times..."}</span>
              </div>
            ) : slots.length === 0 ? (
              <div className="border border-border bg-surface-muted p-8 text-center">
                <Calendar className="mx-auto size-10 text-muted-foreground/60" />
                <h3 className="mt-4 font-medium text-ink">{bookingFlow.step2.emptyStateTitle}</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  {bookingFlow.step2.emptyStateBody}
                </p>
                <ButtonLink
                  href={locale === "tr" ? "/tr/iletisim" : "/en/contact"}
                  variant="secondary"
                  className="mt-6"
                >
                  {bookingFlow.step2.contactCta}
                </ButtonLink>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[380px] overflow-y-auto pr-1">
                {slots.map((slot) => {
                  const { dateStr, timeStr } = formatSlotDateTime(slot.startsAt);
                  const isSelected = selectedSlotId === slot.id;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        setSelectedSlotId(slot.id);
                        setErrors({});
                      }}
                      className={`flex flex-col border p-4 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-brand-accent bg-brand-accent/10 ring-2 ring-brand-accent"
                          : "border-border bg-surface hover:border-ink/50"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium text-ink">
                          <Calendar className="size-3.5" />
                          {dateStr}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-base font-semibold text-ink">
                        <Clock className="size-4 text-brand-accent" />
                        <span>{timeStr}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-ink">{bookingFlow.step3.title}</h2>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label htmlFor="fullName" className="block text-sm font-medium text-ink">
                  {locale === "tr" ? "Ad Soyad" : "Full Name"} <span className="text-destructive">*</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder={locale === "tr" ? "Adınız Soyadınız" : "Your full name"}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-2 w-full border border-border bg-background p-3 text-base sm:text-sm outline-none transition-colors focus:border-ink"
                />
                {errors.fullName && <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>}
              </div>

              <div className="sm:col-span-1">
                <label htmlFor="email" className="block text-sm font-medium text-ink">
                  {locale === "tr" ? "E-posta Adresi" : "Email Address"} <span className="text-destructive">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder={locale === "tr" ? "E-posta adresiniz" : "Your email address"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full border border-border bg-background p-3 text-base sm:text-sm outline-none transition-colors focus:border-ink"
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="phone" className="block text-sm font-medium text-ink">
                  {bookingFlow.step3.phoneLabel} <span className="font-normal text-muted-foreground">{bookingFlow.step3.phoneOptional}</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-2 w-full border border-border bg-background p-3 text-base sm:text-sm outline-none transition-colors focus:border-ink"
                />
              </div>

              <div className="sm:col-span-2 space-y-4 pt-2 border-t border-border">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-1 size-4 rounded border-border text-brand-accent focus:ring-brand-accent"
                  />
                  <span className="text-xs text-ink/80 leading-normal">
                    {bookingFlow.step3.privacyConsentLabel} <span className="text-destructive">*</span>
                  </span>
                </label>
                {errors.privacyConsent && <p className="text-xs text-destructive">{errors.privacyConsent}</p>}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-1 size-4 rounded border-border text-brand-accent focus:ring-brand-accent"
                  />
                  <span className="text-xs text-muted-foreground leading-normal">
                    {bookingFlow.step3.marketingConsentLabel}
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-ink">{bookingFlow.step4.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "tr"
                  ? "Randevu talebinizi iletmeden önce lütfen detayları kontrol edin."
                  : "Please review your appointment summary before submitting your request."}
              </p>
            </div>

            <div className="border border-border bg-surface-muted p-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground font-medium">{bookingFlow.step4.academicSummary}:</span>
                <span className="text-ink font-semibold">
                  {bookingFlow.supportTypeOptions.find((o) => o.value === supportType)?.label}
                  {exam ? ` (${exam.type === "exam" ? exam.code.toUpperCase() : exam.label})` : ""}
                </span>
              </div>

              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground font-medium">{bookingFlow.step4.slotSummary}:</span>
                <span className="text-ink font-semibold">
                  {selectedSlot ? formatSlotDateTime(selectedSlot.startsAt).dateStr + " @ " + formatSlotDateTime(selectedSlot.startsAt).timeStr : "-"}
                </span>
              </div>

              <div className="flex justify-between border-b border-border pb-3">
                <span className="text-muted-foreground font-medium">{bookingFlow.step4.contactSummary}:</span>
                <span className="text-ink font-semibold">{fullName} ({email})</span>
              </div>

              {notes.trim() && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground font-medium">{bookingFlow.step4.notesSummary}:</span>
                  <span className="text-ink text-xs italic">{notes}</span>
                </div>
              )}
            </div>

            <TurnstileWidget
              ref={turnstileRef}
              action="booking_submit"
              locale={locale as "tr" | "en"}
              onVerify={handleTurnstileVerify}
              onExpire={handleTurnstileReset}
              onError={handleTurnstileReset}
            />
          </div>
        )}

        <div className="mt-10 flex items-center justify-between pt-6 border-t border-border">
          {currentStep > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevStep}
              disabled={isPending}
            >
              <ArrowLeft className="size-4 mr-2" />
              {bookingFlow.actions.back}
            </Button>
          ) : (
            <div />
          )}

          {currentStep < bookingFlow.steps.length - 1 ? (
            <Button
              type="button"
              onClick={handleNextStep}
              disabled={currentStep === 1 && slots.length === 0}
            >
              {bookingFlow.actions.continue}
              <ArrowRight className="size-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isPending}
              className="px-8"
            >
              {isPending ? bookingFlow.step4.submittingButton : bookingFlow.step4.submitButton}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
