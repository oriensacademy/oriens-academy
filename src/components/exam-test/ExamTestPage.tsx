"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ExamCode } from "@/content/exams";
import { examRecords } from "@/content/exams";
import { useLocale } from "@/content/locale-context";
import { getExamTestCopy } from "@/content/exam-test";
import { calculateTestResult, examTests, type AnswerId, type TestResult } from "@/data/exam-tests";
import { ExamTestSelector } from "./ExamTestSelector";
import { ExamTestProgress } from "./ExamTestProgress";
import { ExamTestQuestion } from "./ExamTestQuestion";
import { ExamTestResults } from "./ExamTestResults";

type Stage = "select" | "test" | "result";

export function ExamTestPage() {
  const locale = useLocale();
  const copy = getExamTestCopy(locale);
  const [selectedExam, setSelectedExam] = useState<ExamCode>(examRecords[0].code);
  const [stage, setStage] = useState<Stage>("select");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerId>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const finishLock = useRef(false);

  const test = examTests[selectedExam] ?? examTests[examRecords[0].code] ?? { exam: "SAT" as ExamCode, questions: [] };
  const questions = Array.isArray(test.questions) ? test.questions : [];
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, questions.length - 1));
  const current = questions[safeIndex];

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.location.hash) {
        const code = window.location.hash.slice(1).toUpperCase() as ExamCode;
        if (code in examTests) {
          queueMicrotask(() => setSelectedExam(code));
        }
      }
    } catch {
      // Safe hash ignore
    }
  }, []);

  function start() {
    finishLock.current = false;
    setAnswers({});
    setIndex(0);
    setResult(null);
    setIsFinishing(false);
    setStage("test");
    if (typeof window !== "undefined") {
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    }
  }

  function finish() {
    const allAnswered = questions.length > 0 && questions.every((question) => Boolean(answers[question.id]));
    if (finishLock.current || !allAnswered) return;
    finishLock.current = true;
    setIsFinishing(true);
    try {
      const computedResult = calculateTestResult(test, answers, locale);
      setResult(computedResult);
      setStage("result");
      if (typeof window !== "undefined") {
        try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
      }
    } catch (err) {
      console.error("Failed to compute test result:", err);
      // Safe fallback result
      setResult({
        examCode: selectedExam,
        correct: 0,
        incorrect: 0,
        unanswered: questions.length,
        total: questions.length,
        accuracy: 0,
        performanceTier: "foundation",
        topics: [],
        strengths: [],
        improvementAreas: [],
        breakdown: [],
      });
      setStage("result");
    }
  }

  return (
    <section className="min-h-[calc(100dvh-5rem)] border-b border-border bg-background pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="public-container">
        <div className="mx-auto max-w-4xl">
          <header className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">{copy.eyebrow}</p>
            <h1 className="mt-4 text-[clamp(2.75rem,6vw,5rem)] leading-none text-ink">{copy.title}</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">{copy.lead}</p>
          </header>

          <div className="mt-10 rounded-2xl border border-border bg-surface p-5 shadow-editorial sm:p-8 md:p-10">
            {stage === "select" && (
              <>
                <h2 className="text-2xl text-ink">{copy.selectTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.selectHint}</p>
                <div className="mt-7">
                  <ExamTestSelector locale={locale} selected={selectedExam} onSelect={setSelectedExam} />
                </div>
                <button
                  type="button"
                  onClick={start}
                  disabled={questions.length === 0}
                  className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer"
                >
                  {copy.start}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </>
            )}

            {stage === "test" && current && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-heading text-3xl text-ink">{selectedExam}</span>
                  <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {copy.question} {safeIndex + 1} {copy.of} {questions.length}
                  </span>
                </div>
                <div className="mt-5">
                  <ExamTestProgress current={safeIndex + 1} total={questions.length} label={copy.question} />
                </div>
                <div className="mt-9">
                  <ExamTestQuestion
                    question={current}
                    locale={locale}
                    selected={answers[current.id]}
                    onAnswer={(answer) => setAnswers((existing) => ({ ...existing, [current.id]: answer }))}
                  />
                </div>
                <p className="mt-3 min-h-5 text-xs text-muted-foreground" aria-live="polite">
                  {!answers[current.id] ? copy.answerPrompt : ""}
                </p>
                <div className="mt-7 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                  <button
                    type="button"
                    disabled={safeIndex === 0}
                    onClick={() => setIndex((value) => Math.max(0, value - 1))}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    {copy.previous}
                  </button>
                  {safeIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      disabled={!answers[current.id]}
                      onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                    >
                      {copy.next}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!answers[current.id] || isFinishing}
                      onClick={finish}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                    >
                      {copy.finish}
                    </button>
                  )}
                </div>
              </>
            )}

            {stage === "result" && (
              result ? (
                <ExamTestResults
                  locale={locale}
                  result={result}
                  testData={test}
                  onRetry={start}
                  onChangeExam={() => {
                    finishLock.current = false;
                    setStage("select");
                    setResult(null);
                  }}
                />
              ) : (
                <div className="text-center py-8 space-y-4">
                  <p className="text-sm text-muted-foreground">{copy.resultsTitle}</p>
                  <button
                    type="button"
                    onClick={start}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest cursor-pointer"
                  >
                    {copy.retry}
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
