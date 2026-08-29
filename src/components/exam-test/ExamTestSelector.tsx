import { examRecords, type ExamCode } from "@/content/exams";
import type { Locale } from "@/content/dictionaries";
import { examTests } from "@/data/exam-tests";

interface ExamTestSelectorProps {
  locale: Locale;
  selected: ExamCode;
  onSelect: (exam: ExamCode) => void;
}

export function ExamTestSelector({ locale, selected, onSelect }: ExamTestSelectorProps) {
  const internationalCurricula = examRecords.filter(
    (e) => e.primaryCategory === "international-curriculum" || e.categories.includes("international-curriculum")
  );
  const admissionSpecific = examRecords.filter(
    (e) => e.primaryCategory === "admission-specific" && !internationalCurricula.some((c) => c.code === e.code)
  );

  const groups = [
    {
      id: "curricula",
      title: locale === "tr" ? "Uluslararası Müfredatlar & Lise Diplomaları" : "International Curricula & High School Qualifications",
      description: locale === "tr" ? "Lise düzeyinde uluslararası diploma ve genel yeterlilik sınavları" : "High school international diploma and general qualification exams",
      exams: internationalCurricula,
    },
    {
      id: "admissions",
      title: locale === "tr" ? "Üniversite Kabul & Programa Özel Sınavlar" : "University Admissions & Specific Programme Tests",
      description: locale === "tr" ? "Mühendislik, tıp, hukuk, mimarlık, işletme ve lisansüstü seçme testleri" : "Engineering, medicine, law, architecture, business and graduate admissions tests",
      exams: admissionSpecific,
    },
  ];

  return (
    <div className="space-y-6" role="radiogroup" aria-label={locale === "tr" ? "Değerlendirme sınavı seçimi" : "Diagnostic exam selection"}>
      {groups.map((group) => (
        <div key={group.id} className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <div className="mb-4">
            <h3 className="font-heading text-lg font-medium text-ink sm:text-xl">{group.title}</h3>
            <p className="text-xs text-muted-foreground sm:text-sm">{group.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {group.exams.map(({ code }) => {
              const active = code === selected;
              const qCount = examTests[code]?.questions?.length || 6;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(code)}
                  className={`group relative flex min-h-[72px] flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    active
                      ? "border-primary bg-sage-soft text-ink shadow-sm ring-1 ring-primary/30"
                      : "border-border bg-background text-ink hover:border-border-strong hover:bg-surface-muted"
                  }`}
                >
                  <span className="font-heading text-xl font-medium tracking-tight text-ink sm:text-2xl">{code}</span>
                  <span className="mt-1 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>{qCount} {locale === "tr" ? "soru" : "questions"}</span>
                    {active && <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
