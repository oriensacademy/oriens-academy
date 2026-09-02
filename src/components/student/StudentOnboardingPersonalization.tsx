"use client";

import { useState, useMemo } from "react";
import { Check, Globe, GraduationCap, Sparkles, ArrowRight, Building2, Search, X } from "lucide-react";
import { useLocale } from "@/content/locale-context";
import { SUPPORTED_EXAMS, SUPPORTED_DESTINATIONS, saveStudentPreferences } from "@/lib/student/preferences";
import { VERIFIED_OFFICIAL_UNIVERSITY_URLS } from "@/data/official-universities";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAccount } from "@/lib/auth/account-context";
import { pathForLocale } from "@/lib/routes";

interface StudentOnboardingPersonalizationProps {
  studentId: string;
  initialExams?: string[];
  initialCountries?: string[];
  initialUniversity?: string;
  onComplete: (exams: string[], countries: string[]) => void;
  onSkip?: () => void;
  onClose?: () => void;
}

const ALL_UNIVERSITIES = Object.keys(VERIFIED_OFFICIAL_UNIVERSITY_URLS);

export function StudentOnboardingPersonalization({
  studentId,
  initialExams = [],
  initialCountries = [],
  initialUniversity = "",
  onComplete,
  onSkip,
  onClose,
}: StudentOnboardingPersonalizationProps) {
  const locale = useLocale();
  const isTr = locale === "tr";
  const { user } = useAccount();

  const [selectedExams, setSelectedExams] = useState<string[]>(initialExams);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(initialCountries);
  const [selectedUniversity, setSelectedUniversity] = useState<string>(initialUniversity);
  const [universityQuery, setUniversityQuery] = useState("");
  const [isUniDropdownOpen, setIsUniDropdownOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"tr" | "en">(isTr ? "tr" : "en");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredUniversities = useMemo(() => {
    const raw = universityQuery.trim();
    if (!raw) return ALL_UNIVERSITIES.slice(0, 8);
    const q = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return ALL_UNIVERSITIES.filter((u) => {
      const norm = u.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return norm.includes(q);
    }).slice(0, 10);
  }, [universityQuery]);

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
    const targetUserId = (studentId && studentId !== "student-id" && studentId !== "new-student-id")
      ? studentId
      : user?.id;

    if (!targetUserId) {
      onComplete(selectedExams, selectedCountries);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const result = await saveStudentPreferences(
        targetUserId,
        selectedExams,
        selectedCountries,
        true,
        selectedLanguage
      );
      if (!result.success) throw new Error(result.error || (isTr ? "Tercihler kaydedilemedi." : "Preferences could not be saved."));

      const finalUniversity = (selectedUniversity || universityQuery).trim();
      if (finalUniversity) {
        const supabase = getSupabaseClient();
        await supabase
          .from("student_profiles")
          .update({ target_university: finalUniversity })
          .eq("id", targetUserId);
      }

      onComplete(selectedExams, selectedCountries);

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
      onComplete(selectedExams, selectedCountries);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-surface p-6 shadow-editorial sm:p-8 md:p-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs font-bold tracking-[0.2em] text-primary uppercase">
          <Sparkles className="size-4" />
          <span>{isTr ? "Kişiselleştirme" : "Personalization"}</span>
        </div>
        {(onClose || onSkip) && (
          <button
            type="button"
            onClick={onClose || onSkip}
            aria-label={isTr ? "Kapat" : "Close"}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        )}
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
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ${
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

      {/* Target University Searchable Selection */}
      <div className="mt-8">
        <label className="flex items-center gap-2 text-xs font-bold tracking-wider text-ink uppercase">
          <Building2 className="size-4 text-primary" />
          <span>{isTr ? "Hedef Üniversite (Opsiyonel)" : "Target University (Optional)"}</span>
        </label>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {isTr
            ? "Kabul almayı hedeflediğiniz üniversiteyi arayarak seçebilir veya yazabilirsiniz."
            : "Search and select or enter your target university."}
        </p>

        <div className="relative mt-3">
          <div className="flex items-center rounded-xl border border-border bg-background px-3.5 py-2.5 shadow-xs focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <Search className="size-4 text-muted-foreground mr-2 shrink-0" />
            <input
              type="text"
              value={selectedUniversity || universityQuery}
              onChange={(e) => {
                setSelectedUniversity("");
                setUniversityQuery(e.target.value);
                setIsUniDropdownOpen(true);
              }}
              onFocus={() => setIsUniDropdownOpen(true)}
              placeholder={isTr ? "Örn: University of Oxford, Imperial College, Bocconi..." : "e.g., University of Oxford, Imperial College, Bocconi..."}
              className="w-full bg-transparent text-xs text-ink placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {(selectedUniversity || universityQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUniversity("");
                  setUniversityQuery("");
                }}
                className="text-muted-foreground hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {isUniDropdownOpen && filteredUniversities.length > 0 && !selectedUniversity && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-editorial">
              {filteredUniversities.map((uni) => (
                <button
                  key={uni}
                  type="button"
                  onClick={() => {
                    setSelectedUniversity(uni);
                    setUniversityQuery("");
                    setIsUniDropdownOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-ink hover:bg-surface-muted transition-colors"
                >
                  <span>{uni}</span>
                  <Check className="size-3.5 text-primary opacity-0 hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
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
