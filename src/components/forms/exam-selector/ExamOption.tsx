"use client";

import { cn } from "@/lib/utils";

type ExamOptionProps = {
  id: string;
  label: string;
  /** Number of leading characters to render in the accent color (the matched query prefix). */
  matchLength?: number;
  active: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  isOther?: boolean;
};

/**
 * A single result row in the exam listbox. Uses `onMouseDown` (not
 * `onClick`) so the selection registers before the input's blur handler
 * would otherwise close the list first.
 */
export function ExamOption({
  id,
  label,
  matchLength = 0,
  active,
  onSelect,
  onMouseEnter,
  isOther,
}: ExamOptionProps) {
  const matched = label.slice(0, matchLength);
  const rest = label.slice(matchLength);

  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(event) => {
        event.preventDefault();
        onSelect();
      }}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex min-h-11 cursor-pointer items-center px-4 text-base transition-colors duration-150",
        active ? "bg-surface-muted text-ink" : "text-ink/85",
        isOther && "border-t border-border text-sm text-ink/70"
      )}
    >
      {isOther ? (
        <span>{label}</span>
      ) : (
        <span className="font-heading text-lg tracking-wide">
          {matchLength > 0 ? (
            <>
              <mark className="bg-transparent font-semibold text-brand-accent">{matched}</mark>
              {rest}
            </>
          ) : (
            label
          )}
        </span>
      )}
    </li>
  );
}
