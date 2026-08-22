import type { AnswerId, ExamTestQuestion as Question } from "@/data/exam-tests";
import type { Locale } from "@/content/dictionaries";

export function ExamTestQuestion({ question, locale, selected, onAnswer }: { question: Question; locale: Locale; selected?: AnswerId; onAnswer: (answer: AnswerId) => void }) {
  return (
    <fieldset>
      <legend className="text-xl leading-snug text-ink md:text-2xl">{question.question[locale]}</legend>
      <p className="mt-2 text-xs font-semibold tracking-[0.12em] text-primary uppercase">{question.topic[locale]}</p>
      <div className="mt-7 grid gap-3">
        {question.answers.map((answer) => {
          const active = selected === answer.id;
          return (
            <label key={answer.id} className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${active ? "border-primary bg-sage-soft" : "border-border bg-surface hover:border-border-strong hover:bg-surface-muted"}`}>
              <input type="radio" name={question.id} value={answer.id} checked={active} onChange={() => onAnswer(answer.id)} className="size-4 accent-[var(--primary)]" />
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold uppercase text-ink">{answer.id}</span>
              <span className="text-sm text-foreground">{answer.label[locale]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
