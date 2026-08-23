"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, ArrowDown } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import { getExamTestCopy } from "@/content/exam-test";

export interface NormalizedReviewItem {
  id: string;
  questionNumber: number;
  topic: string;
  prompt: string;
  selectedAnswerId: string | null;
  correctAnswerId: string;
  selectedAnswerText?: string | null;
  correctAnswerText?: string;
  isCorrect: boolean;
  explanation: string;
  options?: Array<{
    id: string;
    label: string;
  }>;
}

export function ExamQuestionReview({
  items,
  locale,
  onCompleteReview,
  className = "",
}: {
  items: NormalizedReviewItem[];
  locale: Locale;
  onCompleteReview?: () => void;
  className?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const copy = getExamTestCopy(locale);
  const isTr = locale === "tr";

  const total = items.length;
  if (total === 0) return null;

  const safeIndex = Math.min(Math.max(0, currentIndex), total - 1);
  const currentItem = items[safeIndex];

  const isFirst = safeIndex === 0;
  const isLast = safeIndex === total - 1;

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    }
  };

  const handleNext = () => {
    if (!isLast) {
      setCurrentIndex((prev) => Math.min(total - 1, prev + 1));
    } else if (onCompleteReview) {
      onCompleteReview();
    }
  };

  const handleSelect = (idx: number) => {
    setCurrentIndex(idx);
  };

  return (
    <section
      aria-label={copy.questionBreakdown}
      className={`space-y-4 rounded-2xl border border-[#DDE4DC] bg-white p-4 sm:p-6 shadow-xs ${className}`}
    >
      {/* Header & Question Navigation Bar */}
      <div className="flex flex-col gap-3 border-b border-[#EAEFE8] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {copy.questionBreakdown}
          </span>
          <h3 data-testid="question-review-counter" className="text-lg font-bold text-ink sm:text-xl">
            {copy.question} {safeIndex + 1} <span className="text-muted-foreground font-normal text-sm">/ {total}</span>
          </h3>
        </div>

        {/* Compact Number Selector Pills: 1 2 3 4 5 6 */}
        <div
          role="tablist"
          aria-label={copy.questionBreakdown}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0"
        >
          {items.map((item, idx) => {
            const isActive = idx === safeIndex;
            const isCorrect = item.isCorrect;

            let pillStyle = "border-[#DDE4DC] bg-surface text-ink/75 hover:bg-[#F2F5F0]";
            if (isActive) {
              pillStyle = "border-primary bg-primary/10 text-ink ring-2 ring-primary/30 font-bold shadow-xs";
            }

            return (
              <button
                key={item.id || idx}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${idx + 1}. ${copy.goToQuestion} (${isCorrect ? copy.correct : copy.incorrect})`}
                onClick={() => handleSelect(idx)}
                className={`inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${pillStyle}`}
              >
                <span>{idx + 1}</span>
                {isCorrect ? (
                  <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="size-3 text-rose-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Card Content Container (Sensible min-height to eliminate layout shifts) */}
      <div className="min-h-[280px] space-y-4 pt-1 transition-opacity duration-200">
        {/* Topic & Correctness Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-lg bg-[#F4F6F1] px-2.5 py-1 text-xs font-semibold text-ink/80 border border-[#E0E6DA]">
            {currentItem.topic}
          </span>

          <span
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
              currentItem.isCorrect
                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : "bg-rose-100 text-rose-800 border border-rose-200"
            }`}
          >
            {currentItem.isCorrect ? (
              <>
                <CheckCircle2 className="size-3.5" />
                {copy.correct}
              </>
            ) : (
              <>
                <XCircle className="size-3.5" />
                {copy.incorrect}
              </>
            )}
          </span>
        </div>

        {/* Question Prompt */}
        <p className="text-sm font-semibold text-ink sm:text-base leading-relaxed">
          {currentItem.prompt}
        </p>

        {/* Options List if structured options exist */}
        {currentItem.options && currentItem.options.length > 0 ? (
          <div className="grid gap-2 pt-1">
            {currentItem.options.map((opt) => {
              const isSelected = currentItem.selectedAnswerId === opt.id;
              const isCorrectOpt = currentItem.correctAnswerId === opt.id;

              let optionStyle = "border-border bg-surface text-ink/80";
              if (isCorrectOpt) {
                optionStyle = "border-emerald-500 bg-emerald-50/90 text-emerald-950 font-medium shadow-2xs";
              } else if (isSelected && !isCorrectOpt) {
                optionStyle = "border-rose-400 bg-rose-50/90 text-rose-950 font-medium shadow-2xs";
              }

              return (
                <div
                  key={opt.id}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs sm:text-sm leading-snug transition-colors ${optionStyle}`}
                >
                  <span className="font-bold uppercase shrink-0 mt-0.5">{opt.id.toUpperCase()})</span>
                  <span className="flex-1">{opt.label}</span>
                  {isCorrectOpt && <CheckCircle2 className="size-4 text-emerald-600 shrink-0 ml-1 mt-0.5" />}
                  {isSelected && !isCorrectOpt && <XCircle className="size-4 text-rose-600 shrink-0 ml-1 mt-0.5" />}
                </div>
              );
            })}
          </div>
        ) : (
          /* Snapshot Comparison fallback for attempt history */
          <div className="grid gap-2 sm:grid-cols-2 pt-1">
            <div className="rounded-xl border border-border p-3 text-xs bg-slate-50">
              <span className="block text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                {copy.yourAnswer}
              </span>
              <p className={currentItem.isCorrect ? "font-semibold text-emerald-800" : "font-semibold text-rose-800"}>
                {currentItem.selectedAnswerText || (isTr ? "Boş" : "Unanswered")}
              </p>
            </div>
            {!currentItem.isCorrect && (
              <div className="rounded-xl border border-emerald-200 p-3 text-xs bg-emerald-50/60">
                <span className="block text-[10px] font-bold uppercase text-emerald-800 mb-0.5">
                  {copy.correctAnswer}
                </span>
                <p className="font-semibold text-emerald-950">{currentItem.correctAnswerText}</p>
              </div>
            )}
          </div>
        )}

        {/* Explanation Callout */}
        {currentItem.explanation && (
          <div className="rounded-xl bg-[#F4F6F1] p-3.5 text-ink leading-relaxed border border-[#E0E6DA]">
            <span className="font-semibold text-primary block mb-1 text-xs">{copy.explanation}:</span>
            <p className="text-xs text-ink/85 sm:text-[13px]">{currentItem.explanation}</p>
          </div>
        )}
      </div>

      {/* Navigation Footer Controls */}
      <div className="flex items-center justify-between gap-3 border-t border-[#EAEFE8] pt-4">
        <button
          type="button"
          disabled={isFirst}
          onClick={handlePrev}
          aria-label={copy.previousQuestion}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft className="size-4" />
          <span>{copy.previousQuestion}</span>
        </button>

        <span className="text-xs font-medium text-muted-foreground">
          {safeIndex + 1} / {total}
        </span>

        <button
          type="button"
          onClick={handleNext}
          aria-label={isLast ? copy.completeReview : copy.nextQuestion}
          className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            isLast
              ? "bg-primary text-white hover:bg-forest shadow-xs"
              : "bg-ink text-white hover:bg-forest shadow-xs"
          }`}
        >
          <span>{isLast ? copy.completeReview : copy.nextQuestion}</span>
          {isLast ? <ArrowDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      </div>
    </section>
  );
}
