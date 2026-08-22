"use client";

import { useState } from "react";
import { Check, Globe, GraduationCap, Sparkles, ArrowRight } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { SUPPORTED_EXAMS, SUPPORTED_DESTINATIONS, saveStudentPreferences } from "@/lib/student/preferences";

interface StudentOnboardingPersonalizationProps {
  studentId: string;
  initialExams?: string[];
  initialCountries?: string[];
  onComplete: (exams: string[], countries: string[]) => void;
  onSkip?: () => void;
}

export function StudentOnboardingPersonalization({
  studentId,
  initialExams = [],
  initialCountries = [],
  onComplete,
  onSkip,
}: StudentOnboardingPersonalizationProps) {
  const locale = useLocale();
  const isTr = locale === "tr";

  const [selectedExams, setSelectedExams] = useState<string[]>(initialExams);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(initialCountries);
  const [saving, setSaving] = useState(false);

  const toggleExam = (id: string) => {
    setSelectedExams((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleCountry = (id: string) => {
    setSelectedCountries((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await saveStudentPreferences(studentId, selectedExams, selectedCountries, true);
    setSaving(false);
    onComplete(selectedExams, selectedCountries);
  };

  const handleSkip = async () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete(selectedExams, selectedCountries);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-8 md:p-10">
      <div className="flex items-center gap-2.5 text-xs font-bold tracking-[0.2em] text-primary uppercase">
        <Sparkles className="size-4" />
        <span>{isTr ? "Kişiselleştirme" : "Personalization"}</span>
      </div>

      <h1 className="mt-3 font-heading text-2xl text-ink sm:text-3xl">
        {isTr ? "Eğitim Deneyiminizi Kişiselleştirin" : "Personalize Your Academic Journey"}
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {isTr
          ? "Hedeflediğiniz sınavları ve üniversite ülkelerini seçerek size özel ders programı ve içerik önerileri oluşturmamıza yardımcı olun (Birden fazla seçebilirsiniz)."
          : "Select your target exams and destination countries to help us tailor lesson plans and recommendations for you (Multiple selections supported)."}
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
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-150 ${
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

      {/* Target Destinations Multi-Selection */}
      <div className="mt-8">
        <label className="flex items-center gap-2 text-xs font-bold tracking-wider text-ink uppercase">
          <Globe className="size-4 text-primary" />
          <span>{isTr ? "Hedef Üniversite Ülkeleri" : "Target Destination Countries"}</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            ({selectedCountries.length} {isTr ? "seçildi" : "selected"})
          </span>
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUPPORTED_DESTINATIONS.map((dest) => {
            const isSelected = selectedCountries.includes(dest.id);
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => toggleCountry(dest.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-150 ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs ring-1 ring-emerald-600/20"
                    : "border-border bg-background text-foreground hover:border-emerald-600/40 hover:bg-surface-muted"
                }`}
              >
                {isSelected ? (
                  <Check className="size-3.5 text-emerald-700" />
                ) : (
                  <span className="size-3.5 rounded-full border border-border" />
                )}
                <span>{isTr ? dest.name_tr : dest.name_en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-10 flex flex-col-reverse justify-end gap-3 pt-4 sm:flex-row border-t border-border">
        <button
          type="button"
          onClick={handleSkip}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted hover:text-ink"
        >
          {isTr ? "Şimdilik Atla" : "Skip for Now"}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-45"
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
