import type { TestResult } from "@/data/exam-tests";
import { getExamTestCopy } from "@/content/exam-test";
import type { Locale } from "@/content/dictionaries";

export function ExamTestResults({ locale, result, onRetry, onChangeExam }: { locale: Locale; result?: TestResult | null; onRetry: () => void; onChangeExam: () => void }) {
  const copy = getExamTestCopy(locale);
  const topics = Array.isArray(result?.topics) ? result.topics : [];
  const strong = topics.filter((topic) => (topic?.accuracy ?? 0) >= 80);
  const improve = topics.filter((topic) => (topic?.accuracy ?? 0) < 60);
  const totalQuestions = result?.total ?? 6;
  const correctCount = result?.correct ?? 0;
  const incorrectCount = result?.incorrect ?? Math.max(0, totalQuestions - correctCount);
  const rawAccuracy = result?.accuracy ?? 0;
  const accuracy = Number.isFinite(rawAccuracy) ? Math.min(100, Math.max(0, Math.round(rawAccuracy))) : 0;

  const recommendation = accuracy >= 80
    ? (copy?.performance?.strong ?? "Güçlü bir örnek performans.")
    : accuracy >= 60
      ? (copy?.performance?.moderate ?? "Orta düzey bir örnek performans.")
      : (copy?.performance?.foundation ?? "Temel tekrar önerilir.");

  return (
    <div aria-live="polite">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        {totalQuestions} {locale === "tr" ? "soruluk örnek test" : "question sample test"}
      </p>
      <h2 className="mt-3 text-3xl text-ink md:text-4xl">{copy?.resultsTitle ?? "Sonuç Analizi"}</h2>
      <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4">
        {[
          [copy?.correct ?? "Doğru", `${correctCount} / ${totalQuestions}`],
          [copy?.incorrect ?? "Yanlış", `${incorrectCount} / ${totalQuestions}`],
          [copy?.accuracy ?? "Başarı Oranı", `${accuracy}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface-muted p-3 sm:p-5">
            <div className="text-[11px] font-semibold text-muted-foreground sm:text-xs">{label}</div>
            <div className="mt-2 font-heading text-2xl text-ink sm:text-3xl">{value}</div>
          </div>
        ))}
      </div>
      {topics.length > 0 && (
        <section className="mt-8" aria-labelledby="topic-results-title">
          <h3 id="topic-results-title" className="text-xl text-ink">{copy?.topicBreakdown ?? "Konu Dağılımı"}</h3>
          <div className="mt-4 space-y-3">
            {topics.map((topic, idx) => {
              const topicAccuracy = Number.isFinite(topic.accuracy) ? Math.min(100, Math.max(0, Math.round(topic.accuracy))) : 0;
              const topicKey = topic.category || topic.label || `topic-${idx}`;
              return (
                <div key={topicKey} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink">{topic.label || "Konu"}</span>
                    <span className="tabular-nums text-muted-foreground">{topic.correct ?? 0} / {topic.total ?? 0}</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${topicAccuracy}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-lg text-ink">{copy?.strongAreas ?? "Güçlü Alanlar"}</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {strong.length ? strong.map((t) => t.label).filter(Boolean).join(" · ") : (copy?.emptyStrong ?? "Henüz güçlü alan oluşmadı.")}
          </p>
        </section>
        <section className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-lg text-ink">{copy?.improveAreas ?? "Geliştirilmesi Gereken Alanlar"}</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {improve.length ? improve.map((t) => t.label).filter(Boolean).join(" · ") : (copy?.emptyImprove ?? "Belirgin bir gelişim alanı yok.")}
          </p>
        </section>
      </div>
      <section className="mt-4 rounded-xl border border-primary/35 bg-sage-soft p-5">
        <h3 className="text-lg text-ink">{copy?.focusAreas ?? "Önerilen Çalışma Alanları"}</h3>
        <p className="mt-2 text-sm leading-6 text-foreground">{recommendation}</p>
        {topics.length > 0 && (
          <ul className="mt-4 space-y-2">
            {topics.map((topic, idx) => {
              const topicAcc = Number.isFinite(topic.accuracy) ? topic.accuracy : 0;
              const topicKey = topic.category || topic.label || `topic-li-${idx}`;
              return (
                <li key={topicKey} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-2">
                  <span className="font-semibold text-ink">{topic.label || "Konu"}:</span>
                  <span className="text-foreground">
                    {topicAcc >= 80
                      ? (copy?.topicPerformance?.strong ?? "Güçlü alan.")
                      : topicAcc >= 60
                        ? (copy?.topicPerformance?.moderate ?? "Hedefli soru pratiği yapın.")
                        : (copy?.topicPerformance?.review ?? "Temel kavramları gözden geçirin.")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {copy?.retry ?? "Yeniden Dene"}
        </button>
        <button
          type="button"
          onClick={onChangeExam}
          className="min-h-11 rounded-lg border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {copy?.changeExam ?? "Başka Sınav Seç"}
        </button>
      </div>
    </div>
  );
}
