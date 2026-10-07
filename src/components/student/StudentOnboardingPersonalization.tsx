"use client";

import { useState } from "react";
import { Check, Globe, GraduationCap, Sparkles, ArrowRight, X } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { SUPPORTED_EXAMS, saveStudentPreferences } from "@/lib/student/preferences";
import { useAccount } from "@/lib/auth/account-context";
import { pathForLocale } from "@/lib/routes";

interface StudentOnboardingPersonalizationProps {
  studentId: string;
  initialExams?: string[];
  onComplete: (exams: string[]) => void;
  onSkip?: () => void;
  onClose?: () => void;
}

export function StudentOnboardingPersonalization({
  studentId,
  initialExams = [],
  onComplete,
  onSkip,
  onClose,
}: StudentOnboardingPersonalizationProps) {
  const locale = useLocale();
  const isTr = locale === "tr";
  const { user } = useAccount();

  const [selectedExams, setSelectedExams] = useState<string[]>(initialExams);
  const [selectedLanguage, setSelectedLanguage] = useState<"tr" | "en">(isTr ? "tr" : "en");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleExam = (id: string) => {
    setSelectedExams((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    const targetUserId = (studentId && studentId !== "student-id" && studentId !== "new-student-id")
      ? studentId
      : user?.id;

    if (!targetUserId) {
      onComplete(selectedExams);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const result = await saveStudentPreferences(
        targetUserId,
        selectedExams,
        undefined,
        true,
        selectedLanguage
      );
      if (!result.success) throw new Error(result.error || (isTr ? "Tercihler kaydedilemedi." : "Preferences could not be saved."));

      onComplete(selectedExams);

      if (selectedLanguage !== locale && typeof window !== "undefined") {
        const targetUrl = pathForLocale(window.location.pathname, selectedLanguage);
        window.location.href = targetUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (isTr ? "Tercihler kaydedilemedi." : "Preferences could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete(selectedExams);
    }
  };

  return (
    <div className="mx-auto flex max-h-[min(90dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-editorial">
      {/* Sticky Header - Always visible on mobile, never cut off */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/80 bg-surface/95 px-5 py-3.5 backdrop-blur-md sm:px-8 sm:py-4">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-primary uppercase">
          <Sparkles className="size-4" />
          <span>{isTr ? "Kişiselleştirme" : "Personalization"}</span>
        </div>
        {(onClose || onSkip) && (
          <button
            type="button"
            onClick={onClose || onSkip}
            aria-label={isTr ? "Kapat" : "Close"}
            className="flex size-9 items-center justify-center rounded-xl p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
        <h1 className="font-heading text-xl sm:text-2xl md:text-3xl text-ink">
          {isTr ? "Eğitim Deneyiminizi Kişiselleştirin" : "Personalize Your Academic Journey"}
        </h1>

        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
          {isTr
            ? "Hedeflediğiniz sınavları seçerek size özel ders programı ve içerik önerileri oluşturmamıza yardımcı olun (Birden fazla seçebilirsiniz)."
            : "Select your target exams to help us tailor lesson plans and recommendations for you (Multiple selections supported)."}
        </p>

      {/* Target Exams Multi-Selection */}
      <div className="mt-8">
        <label className="flex items-center gap-2 text-xs font-bold tracking-wider text-ink uppercase">
          <GraduationCap className="size-4 text-primary" />
          <span>{isTr ? "Hedef Sınavlar ve Yeterlilikler" : "Target Exams & Qualifications"}</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            ({selectedExams.length} {isTr ? "seçildi" : "selected"})
          </span>
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUPPORTED_EXAMS.map((exam) => {
            const isSelected = selectedExams.includes(exam.id);
            return (
              <button
                key={exam.id}
                type="button"
                onClick={() => toggleExam(exam.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20"
                    : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-surface-muted"
                }`}
              >
                {isSelected ? (
                  <Check className="size-3.5 text-primary" />
                ) : (
                  <span className="size-3.5 rounded-full border border-border" />
                )}
                <span>{isTr ? exam.name_tr : exam.name_en}</span>
                {exam.badge && (
                  <span className="text-[10px] text-muted-foreground/75 font-normal">
                    · {exam.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferred Communication Language Selection */}
      <div className="mt-8">
        <label className="flex items-center gap-2 text-xs font-bold tracking-wider text-ink uppercase">
          <Globe className="size-4 text-primary" />
          <span>{isTr ? "Tercih Edilen İletişim Dili" : "Preferred Communication Language"}</span>
        </label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {isTr
            ? "Ders, randevu, ödeme ve destek bildirimlerinizin iletileceği dil."
            : "The language used for your lesson, booking, payment, and support notifications."}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedLanguage("tr")}
            className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-semibold transition-all ${
              selectedLanguage === "tr"
                ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20"
                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-surface-muted"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>TR</span>
            </div>
            {selectedLanguage === "tr" && <Check className="size-4 text-primary" />}
          </button>

          <button
            type="button"
            onClick={() => setSelectedLanguage("en")}
            className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-semibold transition-all ${
              selectedLanguage === "en"
                ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20"
                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-surface-muted"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>EN</span>
            </div>
            {selectedLanguage === "en" && <Check className="size-4 text-primary" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      </div>

      {/* Sticky Bottom Actions - Always accessible on mobile without scrolling */}
      <div className="flex shrink-0 flex-col-reverse justify-end gap-2.5 border-t border-border/80 bg-surface/95 px-5 py-3.5 backdrop-blur-md sm:flex-row sm:px-8 sm:py-4">
        <button
          type="button"
          onClick={handleSkip}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted hover:text-ink select-none cursor-pointer"
        >
          {isTr ? "Şimdilik Atla" : "Skip for Now"}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45 select-none cursor-pointer"
        >
          {saving ? (
            <span>{isTr ? "Kaydediliyor..." : "Saving..."}</span>
          ) : (
            <>
              <span>{isTr ? "Kaydet ve Devam Et" : "Save and Continue"}</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
