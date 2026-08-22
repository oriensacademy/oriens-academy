import { examRecords, type ExamCode } from "@/content/exams";
import type { Locale } from "@/content/dictionaries";
import { examTests } from "@/data/exam-tests";

export function ExamTestSelector({ locale, selected, onSelect }: { locale: Locale; selected: ExamCode; onSelect: (exam: ExamCode) => void }) {
  return (
    <div role="radiogroup" aria-label={locale === "tr" ? "Sınav seçimi" : "Exam selection"} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {examRecords.map(({ code }) => {
        const active = code === selected;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(code)}
            className={`min-h-16 rounded-xl border px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${active ? "border-primary bg-sage-soft text-ink" : "border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-muted"}`}
          >
            <span className="block font-heading text-2xl">{code}</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">{examTests[code].questions.length} {locale === "tr" ? "soru" : "questions"}</span>
          </button>
        );
      })}
    </div>
  );
}
