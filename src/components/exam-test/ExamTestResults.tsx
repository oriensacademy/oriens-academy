import type { TestResult } from "@/data/exam-tests";
import { getExamTestCopy } from "@/content/exam-test";
import type { Locale } from "@/content/dictionaries";

export function ExamTestResults({ locale, result, onRetry, onChangeExam }: { locale: Locale; result: TestResult; onRetry: () => void; onChangeExam: () => void }) {
  const copy = getExamTestCopy(locale);
  const strong = result.topics.filter((topic) => topic.accuracy >= 80);
  const improve = result.topics.filter((topic) => topic.accuracy < 60);
  const recommendation = result.accuracy >= 80 ? copy.performance.strong : result.accuracy >= 60 ? copy.performance.moderate : copy.performance.foundation;
  return (
    <div aria-live="polite">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{result.total} {locale === "tr" ? "soruluk örnek test" : "question sample test"}</p>
      <h2 className="mt-3 text-3xl text-ink md:text-4xl">{copy.resultsTitle}</h2>
      <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4">
        {[[copy.correct, `${result.correct} / ${result.total}`], [copy.incorrect, `${result.incorrect} / ${result.total}`], [copy.accuracy, `${result.accuracy}%`]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface-muted p-3 sm:p-5"><div className="text-[11px] font-semibold text-muted-foreground sm:text-xs">{label}</div><div className="mt-2 font-heading text-2xl text-ink sm:text-3xl">{value}</div></div>
        ))}
      </div>
      <section className="mt-8" aria-labelledby="topic-results-title">
        <h3 id="topic-results-title" className="text-xl text-ink">{copy.topicBreakdown}</h3>
        <div className="mt-4 space-y-3">
          {result.topics.map((topic) => <div key={topic.category} className="rounded-xl border border-border bg-surface p-4"><div className="flex items-center justify-between text-sm"><span className="font-semibold text-ink">{topic.label}</span><span className="tabular-nums text-muted-foreground">{topic.correct} / {topic.total}</span></div><div className="mt-3 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${topic.accuracy}%` }} /></div></div>)}
        </div>
      </section>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5"><h3 className="text-lg text-ink">{copy.strongAreas}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{strong.length ? strong.map((topic) => topic.label).join(" · ") : copy.emptyStrong}</p></section>
        <section className="rounded-xl border border-border bg-surface p-5"><h3 className="text-lg text-ink">{copy.improveAreas}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{improve.length ? improve.map((topic) => topic.label).join(" · ") : copy.emptyImprove}</p></section>
      </div>
      <section className="mt-4 rounded-xl border border-primary/35 bg-sage-soft p-5"><h3 className="text-lg text-ink">{copy.focusAreas}</h3><p className="mt-2 text-sm leading-6 text-foreground">{recommendation}</p><ul className="mt-4 space-y-2">{result.topics.map((topic) => <li key={topic.category} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-2"><span className="font-semibold text-ink">{topic.label}:</span><span className="text-foreground">{topic.accuracy >= 80 ? copy.topicPerformance.strong : topic.accuracy >= 60 ? copy.topicPerformance.moderate : copy.topicPerformance.review}</span></li>)}</ul></section>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={onRetry} className="min-h-11 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{copy.retry}</button><button type="button" onClick={onChangeExam} className="min-h-11 rounded-lg border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{copy.changeExam}</button></div>
    </div>
  );
}
