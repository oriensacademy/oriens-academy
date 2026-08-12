"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { CompassMark } from "@/components/brand/CompassMark";
import { RouteLine } from "@/components/brand/RouteLine";
import { MathBackground } from "@/components/math/MathBackground";
import { Button } from "@/components/ui/button";
import { ExamSelector, type ExamSelectorValue } from "@/components/forms/ExamSelector";
import { useHomeContent } from "@/content/locale-context";

/**
 * Form UI only — no submission backend yet (Resend/Supabase are out of
 * scope for this pass, see final report TODOs). Locally confirms receipt
 * so the interaction is honestly demonstrable without pretending to
 * persist anywhere.
 */
export function BookingCTA() {
  const { bookingCTA } = useHomeContent();
  const [submitted, setSubmitted] = useState(false);
  const [exam, setExam] = useState<ExamSelectorValue>(null);
  const [errors, setErrors] = useState<Partial<Record<"name" | "email", string>>>({});
  const summaryRef = useRef<HTMLDivElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const nextErrors: Partial<Record<"name" | "email", string>> = {};

    if (!name) nextErrors.name = bookingCTA.form.nameRequired;
    if (!email) nextErrors.email = bookingCTA.form.emailRequired;
    else if (!form.elements.namedItem("email") || !(form.elements.namedItem("email") as HTMLInputElement).validity.valid) {
      nextErrors.email = bookingCTA.form.emailInvalid;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => {
        summaryRef.current?.focus();
      });
      return;
    }
    setSubmitted(true);
  }

  function clearError(field: "name" | "email") {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  const fieldClass = "mt-2 min-h-11 w-full border border-border bg-background px-3 text-base outline-none transition-[border-color,box-shadow] duration-200 focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-brand-accent/25 focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

  return (
    <section
      id="booking"
      className="section-offset relative overflow-hidden border-t border-border bg-surface-muted py-20 md:py-28"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <MathBackground opacity={0.5} />
      </div>

      <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 gap-14 px-6 md:px-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div>
          <Reveal>
            <CompassMark size={36} interactive />
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-6 text-[clamp(1.75rem,2.5vw+1rem,2.75rem)] leading-[1.15] font-medium text-ink">
              {bookingCTA.headline}
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink/75">{bookingCTA.body}</p>
          </Reveal>

          <Reveal delay={0.2} className="mt-6 hidden max-w-xs md:block">
            <RouteLine
              d="M10,50 Q140,10 270,50"
              start={{ x: 10, y: 50 }}
              end={{ x: 270, y: 50 }}
              viewBox="0 0 280 60"
              strokeWidth={1.5}
            />
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          {submitted ? (
            <div role="status" className="flex h-full min-h-[320px] flex-col items-center justify-center border border-border bg-surface p-10 text-center">
              <CompassMark size={40} />
              <p className="mt-5 font-heading text-xl text-ink">{bookingCTA.successTitle}</p>
              <p className="mt-2 max-w-xs text-sm text-ink/70">{bookingCTA.successBody}</p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              aria-label={bookingCTA.headline}
              data-form-id="consultation-request"
              className="border border-border bg-surface p-6 sm:p-8"
            >
              {Object.keys(errors).length > 0 && (
                <div
                  ref={summaryRef}
                  tabIndex={-1}
                  role="alert"
                  aria-labelledby="booking-error-summary-title"
                  className="mb-6 border-l-2 border-destructive bg-destructive/5 p-4 outline-none focus-visible:ring-3 focus-visible:ring-destructive/20"
                >
                  <p id="booking-error-summary-title" className="text-sm font-semibold text-destructive">
                    {bookingCTA.form.errorSummary}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-destructive">
                    {errors.name && <li><a className="underline underline-offset-2" href="#name">{errors.name}</a></li>}
                    {errors.email && <li><a className="underline underline-offset-2" href="#email">{errors.email}</a></li>}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <label htmlFor="name" className="text-sm font-medium text-ink">
                    {bookingCTA.form.name}
                    <span className="ml-1 font-normal text-muted-foreground">({bookingCTA.form.requiredLabel})</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    aria-invalid={errors.name ? "true" : undefined}
                    aria-describedby={errors.name ? "name-error" : undefined}
                    onInput={() => clearError("name")}
                    autoComplete="name"
                    className={fieldClass}
                  />
                  {errors.name && <p id="name-error" role="alert" className="mt-2 text-sm text-destructive">{errors.name}</p>}
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="email" className="text-sm font-medium text-ink">
                    {bookingCTA.form.email}
                    <span className="ml-1 font-normal text-muted-foreground">({bookingCTA.form.requiredLabel})</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    aria-invalid={errors.email ? "true" : undefined}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    onInput={() => clearError("email")}
                    autoComplete="email"
                    className={fieldClass}
                  />
                  {errors.email && <p id="email-error" role="alert" className="mt-2 text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="interest" className="text-sm font-medium text-ink">
                    {bookingCTA.form.interestLabel}
                  </label>
                  <select
                    id="interest"
                    name="interest"
                    defaultValue={bookingCTA.form.interestOptions[0].value}
                    className={fieldClass}
                  >
                    {bookingCTA.form.interestOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <ExamSelector value={exam} onChange={setExam} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="message" className="text-sm font-medium text-ink">
                    {bookingCTA.form.messageLabel}{" "}
                    <span className="font-normal text-muted-foreground">
                      {bookingCTA.form.messageOptional}
                    </span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={3}
                    className={`${fieldClass} resize-y py-2.5`}
                  />
                </div>
              </div>

              <Button type="submit" directional size="lg" className="mt-7 h-12 w-full text-base">
                {bookingCTA.form.submit}
                <ArrowRight data-directional-arrow className="size-4" aria-hidden="true" />
              </Button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
