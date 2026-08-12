"use client";

import { Check } from "lucide-react";

export type StepItem = {
  title: string;
  subtitle: string;
};

type BookingStepperProps = {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
};

export function BookingStepper({
  steps,
  currentStep,
  onStepClick,
}: BookingStepperProps) {
  return (
    <nav aria-label="Booking process progress" className="w-full">
      {/* Screen reader summary */}
      <p className="sr-only">
        Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.title}
      </p>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {steps.map((step, idx) => {
          const isCurrent = idx === currentStep;
          const isCompleted = idx < currentStep;
          const isClickable = isCompleted && onStepClick;

          return (
            <li key={step.title} className="relative">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(idx)}
                aria-current={isCurrent ? "step" : undefined}
                className={`group flex w-full flex-col border p-3.5 text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:outline-none ${
                  isCurrent
                    ? "border-brand-accent bg-surface shadow-sm"
                    : isCompleted
                      ? "border-border bg-surface-muted hover:border-ink/40 cursor-pointer"
                      : "border-border/60 bg-surface-muted/40 cursor-not-allowed opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex size-6 items-center justify-center text-xs font-semibold rounded-full transition-colors ${
                      isCompleted
                        ? "bg-brand-accent text-background"
                        : isCurrent
                          ? "bg-ink text-background"
                          : "bg-border text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="size-3.5" /> : idx + 1}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    0{idx + 1}
                  </span>
                </div>

                <div className="mt-3">
                  <p
                    className={`text-xs font-medium leading-tight ${
                      isCurrent ? "text-ink font-semibold" : "text-ink/80"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate hidden sm:block">
                    {step.subtitle}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
