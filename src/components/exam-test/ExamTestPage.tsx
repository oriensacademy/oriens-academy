"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
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
  const test = examTests[selectedExam];
  const current = test.questions[index];

  useEffect(() => {
    const code = window.location.hash.slice(1).toUpperCase() as ExamCode;
    if (code in examTests) setSelectedExam(code);
  }, []);

  function start() { setAnswers({}); setIndex(0); setResult(null); setStage("test"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function finish() { setResult(calculateTestResult(test, answers, locale)); setStage("result"); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return (
    <section className="min-h-[calc(100vh-5rem)] border-b border-border bg-background pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="public-container">
        <div className="mx-auto max-w-4xl">
          <header className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">{copy.eyebrow}</p>
            <h1 className="mt-4 text-[clamp(2.75rem,6vw,5rem)] leading-none text-ink">{copy.title}</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">{copy.lead}</p>
          </header>

          <div className="mt-10 rounded-2xl border border-border bg-surface p-5 shadow-editorial sm:p-8 md:p-10">
            {stage === "select" && <>
              <h2 className="text-2xl text-ink">{copy.selectTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.selectHint}</p>
              <div className="mt-7"><ExamTestSelector locale={locale} selected={selectedExam} onSelect={setSelectedExam} /></div>
              <button type="button" onClick={start} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{copy.start}<ArrowRight className="size-4" aria-hidden="true" /></button>
            </>}

            {stage === "test" && <>
              <div className="flex items-center justify-between gap-4"><span className="font-heading text-3xl text-ink">{selectedExam}</span><span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{copy.question} {index + 1} {copy.of} {test.questions.length}</span></div>
              <div className="mt-5"><ExamTestProgress current={index + 1} total={test.questions.length} label={copy.question} /></div>
              <div className="mt-9"><ExamTestQuestion question={current} locale={locale} selected={answers[current.id]} onAnswer={(answer) => setAnswers((existing) => ({ ...existing, [current.id]: answer }))} /></div>
              <p className="mt-3 min-h-5 text-xs text-muted-foreground" aria-live="polite">{!answers[current.id] ? copy.answerPrompt : ""}</p>
              <div className="mt-7 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                <button type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft className="size-4" aria-hidden="true" />{copy.previous}</button>
                {index < test.questions.length - 1 ? <button type="button" disabled={!answers[current.id]} onClick={() => setIndex((value) => value + 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{copy.next}<ArrowRight className="size-4" aria-hidden="true" /></button> : <button type="button" disabled={!answers[current.id]} onClick={finish} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{copy.finish}</button>}
              </div>
            </>}

            {stage === "result" && result && <ExamTestResults locale={locale} result={result} onRetry={start} onChangeExam={() => { setStage("select"); setResult(null); }} />}
          </div>

          <aside className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-surface-muted px-4 py-3 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" /><p>{copy.notice}</p></aside>
        </div>
      </div>
    </section>
  );
}
