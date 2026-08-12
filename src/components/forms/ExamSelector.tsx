"use client";

import { useEffect, useId, useState } from "react";
import { useReducedMotion } from "motion/react";
import { SplitFlapDisplay } from "./exam-selector/SplitFlapDisplay";
import { ExamSearch } from "./exam-selector/ExamSearch";
import { CompassNeedle } from "@/components/brand/CompassNeedle";
import { examCodes } from "@/content/shared";
import { useHomeContent } from "@/content/locale-context";
import { cn } from "@/lib/utils";

export type ExamSelectorValue = { type: "exam"; code: string } | { type: "other"; label: string } | null;

export type ExamSelectorProps = {
  value: ExamSelectorValue;
  onChange: (value: ExamSelectorValue) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
  id?: string;
};

const IDLE_INTERVAL_MS = 2600;

/**
 * "Hangi sınava hazırlanıyorsun?" — a premium, academic reinterpretation
 * of an airport departure board. Idle: exam codes cycle calmly. Focused:
 * cycling stops and a searchable, keyboard-navigable list takes over.
 * Selected: the exam resolves with a one-time compass-needle nudge, the
 * same "arrival" language as the rest of the brand's compass system.
 *
 * Controlled component — ready to be wired into a real booking form
 * later (no backend calls are made from here).
 */
export function ExamSelector({ value, onChange, disabled, error, className, id }: ExamSelectorProps) {
  const { examSelector } = useHomeContent();
  const generatedId = useId();
  const inputId = id ?? `exam-selector-${generatedId}`;
  const errorId = `${inputId}-error`;
  const prefersReducedMotion = useReducedMotion();

  const [idleIndex, setIdleIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [returning, setReturning] = useState(false);

  const isIdle = value === null && !focused;

  useEffect(() => {
    if (!isIdle || prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setIdleIndex((i) => (i + 1) % examCodes.length);
    }, IDLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isIdle, prefersReducedMotion]);

  function goBackToSearch() {
    setReturning(true);
    onChange(null);
  }

  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={inputId} className="block font-heading text-xl text-ink">
        {examSelector.heading}
      </label>

      {value === null && (
        <>
          <div
            aria-hidden="true"
            className="mt-3 flex h-8 items-center border-b border-border text-sm font-medium tracking-[0.04em] text-muted-foreground uppercase"
          >
            <SplitFlapDisplay text={examCodes[idleIndex]} className="min-w-[6ch]" />
          </div>

          <div className="mt-3">
            <ExamSearch
              id={inputId}
              exams={examCodes}
              disabled={disabled}
              autoFocus={returning}
              aria-describedby={error ? errorId : undefined}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSelectExam={(code) => onChange({ type: "exam", code })}
              onSelectOther={() => onChange({ type: "other", label: "" })}
            />
          </div>
        </>
      )}

      {value?.type === "exam" && (
        <SelectedExam code={value.code} disabled={disabled} onChange={goBackToSearch} />
      )}

      {value?.type === "other" && (
        <OtherExamInput
          id={inputId}
          value={value.label}
          disabled={disabled}
          onChange={(label) => onChange({ type: "other", label })}
          onBack={goBackToSearch}
        />
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectedExam({
  code,
  disabled,
  onChange,
}: {
  code: string;
  disabled?: boolean;
  onChange: () => void;
}) {
  const { examSelector } = useHomeContent();
  return (
    <div
      className="mt-3 flex items-center justify-between gap-4 border border-border bg-surface px-4 py-3"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <svg width="24" height="24" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <CompassNeedle rotation={8} revealFrom={0} size={30} />
        </svg>
        <div>
          <p className="font-heading text-xl text-ink">
            {code}
            <span className="sr-only"> {examSelector.selectedSrAnnounce}</span>
          </p>
          <p className="text-xs text-muted-foreground">{examSelector.selectedSubtitle}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onChange}
        className="min-h-11 cursor-pointer px-2 text-sm font-medium text-ink/70 underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-ink hover:decoration-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {examSelector.changeLabel}
      </button>
    </div>
  );
}

function OtherExamInput({
  id,
  value,
  disabled,
  onChange,
  onBack,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBack: () => void;
}) {
  const { examSelector } = useHomeContent();
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <label htmlFor={`${id}-other`} className="text-sm font-medium text-ink">
          {examSelector.otherInputLabel}
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={onBack}
          className="min-h-11 cursor-pointer px-2 text-sm font-medium text-ink/70 underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-ink hover:decoration-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {examSelector.changeLabel}
        </button>
      </div>
      <input
        id={`${id}-other`}
        type="text"
        autoFocus
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={examSelector.otherPlaceholder}
        className="mt-2 h-11 w-full border border-border bg-background px-4 text-base text-ink outline-none transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-ink disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
