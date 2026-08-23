"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Send, Calendar, RefreshCcw, BookOpen, Sparkles, Award } from "lucide-react";
import type { TestResult } from "@/data/exam-tests";
import { getExamTestCopy } from "@/content/exam-test";
import type { Locale } from "@/content/dictionaries";
import { useAccount } from "@/lib/auth/account-context";
import { submitContact } from "@/lib/contact/api";

export function ExamTestResults({
  locale,
  result,
  onRetry,
  onChangeExam,
}: {
  locale: Locale;
  result: TestResult;
  onRetry: () => void;
  onChangeExam: () => void;
}) {
  const copy = getExamTestCopy(locale);
  const isTr = locale === "tr";
  const { user } = useAccount();

  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});
  const [showSendModal, setShowSendModal] = useState(false);
  const [senderName, setSenderName] = useState(() => user?.user_metadata?.full_name || "");
  const [senderEmail, setSenderEmail] = useState(() => user?.email || "");
  const [senderPhone, setSenderPhone] = useState(() => user?.user_metadata?.phone || "");
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState("");
  const [isSending, startSendTransition] = useTransition();

  const toggleQuestion = (id: string) => {
    setExpandedQuestions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const topics = Array.isArray(result.topics) ? result.topics : [];
  const strong = topics.filter((topic) => (topic?.accuracy ?? 0) >= 80);
  const improve = topics.filter((topic) => (topic?.accuracy ?? 0) < 60);
  const totalQuestions = Number.isFinite(result.total) ? Math.max(0, result.total) : 0;
  const correctCount = Number.isFinite(result.correct) ? Math.max(0, result.correct) : 0;
  const incorrectCount = Number.isFinite(result.incorrect) ? Math.max(0, result.incorrect) : 0;
  const rawAccuracy = result.accuracy;
  const accuracy = Number.isFinite(rawAccuracy) ? Math.min(100, Math.max(0, Math.round(rawAccuracy))) : 0;

  const recommendation =
    accuracy >= 75
      ? copy.performance.strong
      : accuracy >= 40
        ? copy.performance.moderate
        : copy.performance.foundation;

  const handleSendToConsultant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderEmail.trim() || !senderName.trim()) {
      setSendError(isTr ? "Lütfen ad soyad ve e-posta adresinizi girin." : "Please enter your name and email.");
      return;
    }

    setSendError("");
    startSendTransition(async () => {
      const examName = (result.examCode || "Exam").toUpperCase();
      const topicSummary = topics
        .map((t) => `${t.label}: %${t.accuracy} (${t.correct}/${t.total})`)
        .join(" | ");

      const resultPayloadMessage = [
        `[KENDİNİ DENE TEST SONUCU]`,
        `Sınav: ${examName}`,
        `Doğru/Toplam: ${correctCount}/${totalQuestions} (%${accuracy})`,
        `Konu Dağılımı: ${topicSummary}`,
        senderPhone ? `Telefon: ${senderPhone}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await submitContact({
        fullName: senderName.trim(),
        email: senderEmail.trim().toLowerCase(),
        phone: senderPhone.trim() || "Belirtilmedi",
        subject: `${examName} Kendini Dene Sonuç Analizi (${correctCount}/${totalQuestions})`,
        message: resultPayloadMessage,
        locale: locale as "tr" | "en",
        privacyConsent: true,
        source: "consultation",
      });

      if (res.success) {
        setSendSuccess(true);
      } else {
        setSendError(res.message || (isTr ? "Sonuç iletilemedi, lütfen tekrar deneyin." : "Could not send results, please retry."));
      }
    });
  };

  return (
    <div aria-live="polite" data-testid="exam-result" className="space-y-8">
      {/* Header & Score Badge */}
      <div className="border-b border-[#DDE4DC] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF0E6] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#2E4A36]">
            <Award className="size-3.5" />
            {result.examCode?.toUpperCase()} · {totalQuestions} {isTr ? "Soruluk Değerlendirme" : "Question Diagnostic"}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {isTr ? "Tamamlandı" : "Completed"}
          </span>
        </div>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          {copy.resultsTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-2xl">
          {recommendation}
        </p>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div
          data-testid="exam-result-correct"
          className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="size-4" />
            <span>{copy.correct}</span>
          </div>
          <div className="mt-2 font-heading text-2xl font-bold text-emerald-950 sm:text-3xl">
            {correctCount} <span className="text-sm font-normal text-emerald-700">/ {totalQuestions}</span>
          </div>
        </div>

        <div
          data-testid="exam-result-incorrect"
          className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
            <XCircle className="size-4" />
            <span>{copy.incorrect}</span>
          </div>
          <div className="mt-2 font-heading text-2xl font-bold text-rose-950 sm:text-3xl">
            {incorrectCount} <span className="text-sm font-normal text-rose-700">/ {totalQuestions}</span>
          </div>
        </div>

        <div
          data-testid="exam-result-accuracy"
          className="rounded-2xl border border-primary/25 bg-surface-muted p-4 sm:p-5"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-4" />
            <span>{copy.accuracy}</span>
          </div>
          <div className="mt-2 font-heading text-2xl font-bold text-ink sm:text-3xl">
            {accuracy}%
          </div>
        </div>
      </div>

      {/* Topic Mastery Breakdown */}
      {topics.length > 0 && (
        <section aria-labelledby="topic-breakdown-heading" className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 id="topic-breakdown-heading" className="text-lg font-bold text-ink flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              {copy.topicBreakdown}
            </h3>
            <span className="text-xs text-muted-foreground">{topics.length} {isTr ? "Konu Alanı" : "Topics"}</span>
          </div>

          <div className="mt-5 space-y-4">
            {topics.map((topic, idx) => {
              const topicAcc = Number.isFinite(topic.accuracy) ? Math.min(100, Math.max(0, Math.round(topic.accuracy))) : 0;
              const topicKey = topic.category || topic.label || `topic-${idx}`;
              const isStrong = topicAcc >= 80;
              const isModerate = topicAcc >= 50 && topicAcc < 80;

              return (
                <div key={topicKey} className="rounded-xl border border-border/70 bg-[#F9FAF8] p-4 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink">{topic.label || "Konu"}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          isStrong
                            ? "bg-emerald-100 text-emerald-800"
                            : isModerate
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isStrong ? copy.statusStrong : isModerate ? copy.statusModerate : copy.statusImprove}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {topic.correct} / {topic.total} (%{topicAcc})
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-border/40">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isStrong ? "bg-emerald-600" : isModerate ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${topicAcc}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Strengths and Focus Areas Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
          <h3 className="text-base font-bold text-emerald-950 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-700" />
            {copy.strongAreas}
          </h3>
          <p className="mt-3 text-xs leading-relaxed text-emerald-900">
            {strong.length
              ? strong.map((t) => t.label).filter(Boolean).join(" · ")
              : copy.emptyStrong}
          </p>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
          <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-700" />
            {copy.improveAreas}
          </h3>
          <p className="mt-3 text-xs leading-relaxed text-amber-900">
            {improve.length
              ? improve.map((t) => t.label).filter(Boolean).join(" · ")
              : copy.emptyImprove}
          </p>
        </section>
      </div>

      {/* Question-by-Question Detailed Breakdown */}
      {result.breakdown && result.breakdown.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-ink">
              {copy.questionBreakdown}
            </h3>
            <span className="text-xs text-muted-foreground">
              {isTr ? "Soru ve Çözüm Detayları" : "Solutions & Details"}
            </span>
          </div>

          <div className="space-y-3">
            {result.breakdown.map((item) => {
              const isExpanded = expandedQuestions[item.id] ?? true;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-all ${
                    item.isCorrect ? "border-emerald-200/80 bg-white" : "border-rose-200/80 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleQuestion(item.id)}
                    className="flex w-full items-center justify-between p-4 text-left cursor-pointer hover:bg-[#F9FAF8] rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                          item.isCorrect
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {item.questionNumber}
                      </span>
                      <div>
                        <span className="text-xs font-semibold text-ink">{item.topic}</span>
                        <div className="text-[11px] text-muted-foreground">
                          {item.isCorrect ? (
                            <span className="text-emerald-700 font-medium">{copy.correct}</span>
                          ) : (
                            <span className="text-rose-700 font-medium">{copy.incorrect}</span>
                          )}
                          {" · "}
                          <span>{copy.yourAnswer}: {item.selectedAnswer ? item.selectedAnswer.toUpperCase() : "—"}</span>
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/50 p-4 pt-3 text-xs space-y-3">
                      <p className="font-medium text-ink leading-relaxed">{item.questionText}</p>

                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {item.answers.map((opt) => {
                          const isSelected = opt.id === item.selectedAnswer;
                          const isCorrectOpt = opt.id === item.correctAnswer;
                          const label = opt.label[locale] || opt.label.tr;

                          return (
                            <div
                              key={opt.id}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                                isCorrectOpt
                                  ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-950"
                                  : isSelected
                                    ? "border-rose-400 bg-rose-50 text-rose-950"
                                    : "border-border/60 bg-surface-muted/40 text-muted-foreground"
                              }`}
                            >
                              <span className="font-bold uppercase">{opt.id})</span>
                              <span>{label}</span>
                              {isCorrectOpt && <CheckCircle2 className="ml-auto size-3.5 text-emerald-600 shrink-0" />}
                              {isSelected && !isCorrectOpt && <XCircle className="ml-auto size-3.5 text-rose-600 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {item.explanation && (
                        <div className="rounded-xl bg-[#F4F6F1] p-3.5 text-ink leading-relaxed border border-[#E0E6DA]">
                          <span className="font-semibold text-primary block mb-1">{copy.explanation}:</span>
                          <p className="text-[11px] text-ink/80">{item.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Next Step / Consultation & Advisor CTAs */}
      <section className="rounded-2xl border border-primary/40 bg-[#F4F6F0] p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {copy.nextStep}
            </span>
            <h3 className="font-heading text-2xl text-ink">
              {isTr ? "Sonuçlarınızı uzman eğitmenlerimizle analiz edin" : "Review your results with our academic team"}
            </h3>
            <p className="text-xs sm:text-sm text-ink/75 leading-relaxed">
              {copy.nextStepBody}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`#consultation`}
              onClick={(e) => {
                const el = document.getElementById("consultation") || document.querySelector("form");
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-semibold text-white shadow-sm hover:bg-forest transition-colors cursor-pointer"
            >
              <Calendar className="size-4" />
              {copy.requestConsultation}
            </a>

            <button
              type="button"
              onClick={() => {
                setShowSendModal(true);
                setSendSuccess(false);
                setSendError("");
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-6 text-sm font-semibold text-ink shadow-sm hover:bg-[#F9FAF8] transition-colors cursor-pointer"
            >
              <Send className="size-4 text-primary" />
              {copy.sendToConsultant}
            </button>
          </div>
        </div>
      </section>

      {/* Send Results Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-[#DDE4DC] bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            {sendSuccess ? (
              <div className="text-center py-4 space-y-4">
                <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
                <h4 className="text-xl font-bold text-ink">{isTr ? "Sonuçlarınız İletildi!" : "Results Sent!"}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {copy.sentSuccess}
                </p>
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="mt-4 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-white hover:bg-forest cursor-pointer"
                >
                  {isTr ? "Kapat" : "Close"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendToConsultant} className="space-y-4">
                <div>
                  <h4 className="text-lg font-bold text-ink">{copy.sendModalTitle}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.sendModalDesc}</p>
                </div>

                {sendError && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                    {sendError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-ink">{copy.fullName}</label>
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder={isTr ? "Adınız Soyadınız" : "Full Name"}
                    className="mt-1.5 min-h-10 w-full rounded-lg border border-input px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">{copy.email}</label>
                  <input
                    type="email"
                    required
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    className="mt-1.5 min-h-10 w-full rounded-lg border border-input px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink">{copy.phone}</label>
                  <input
                    type="tel"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder={copy.phonePlaceholder}
                    className="mt-1.5 min-h-10 w-full rounded-lg border border-input px-3 text-sm"
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSendModal(false)}
                    className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold text-ink hover:bg-surface-muted cursor-pointer"
                  >
                    {copy.cancelBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="flex-1 rounded-xl bg-ink py-2.5 text-xs font-semibold text-white hover:bg-forest disabled:opacity-50 cursor-pointer"
                  >
                    {isSending ? copy.sending : copy.sendBtn}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons: Retry / Change Exam */}
      <div className="flex flex-col gap-3 sm:flex-row pt-4 border-t border-[#DDE4DC]">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest cursor-pointer"
        >
          <RefreshCcw className="size-4" />
          {copy.retry}
        </button>
        <button
          type="button"
          onClick={onChangeExam}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted cursor-pointer"
        >
          {copy.changeExam}
        </button>
      </div>
    </div>
  );
}

