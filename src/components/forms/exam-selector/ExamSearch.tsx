"use client";

import { useMemo, useRef, useState } from "react";
import { ExamOption } from "./ExamOption";
import { useHomeContent } from "@/content/locale-context";
import { cn } from "@/lib/utils";

type ExamSearchProps = {
  id: string;
  exams: readonly string[];
  onSelectExam: (code: string) => void;
  onSelectOther: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholderExample?: string;
  "aria-describedby"?: string;
};

type Option = { type: "exam"; code: string } | { type: "other" };

/**
 * The actual search combobox: a text input plus a filtered listbox of
 * exam codes (prefix match, case-insensitive), always ending in a
 * constant "Diğer" fallback option. Full keyboard support: ArrowUp/Down,
 * Enter to commit, Escape to close without losing focus.
 */
export function ExamSearch({
  id,
  exams,
  onSelectExam,
  onSelectOther,
  onFocus,
  onBlur,
  disabled,
  autoFocus,
  "aria-describedby": describedBy,
}: ExamSearchProps) {
  const { examSelector } = useHomeContent();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter((code) => code.toLowerCase().startsWith(q));
  }, [query, exams]);

  const options = useMemo<Option[]>(
    () => [...filtered.map((code) => ({ type: "exam" as const, code })), { type: "other" as const }],
    [filtered]
  );

  // Defensive clamp: `activeIndex` can briefly point past the end right
  // after the result count shrinks (e.g. a keystroke narrows the list) —
  // derive a safe index at render time instead of syncing state in an effect.
  const safeIndex = Math.min(activeIndex, options.length - 1);

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    if (option.type === "exam") onSelectExam(option.code);
    else onSelectOther();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex(0);
        setIsOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((safeIndex + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((safeIndex - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(safeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  const activeOption = options[safeIndex];
  const activeId = activeOption
    ? activeOption.type === "exam"
      ? `${id}-option-${activeOption.code}`
      : `${id}-option-other`
    : undefined;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen ? activeId : undefined}
        aria-autocomplete="list"
        aria-describedby={describedBy}
        autoComplete="off"
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={examSelector.inputPlaceholder}
        aria-label={examSelector.inputPlaceholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => {
          setActiveIndex(0);
          setIsOpen(true);
          onFocus?.();
        }}
        onBlur={() => {
          // Give option `onMouseDown` a chance to fire before the list unmounts.
          window.setTimeout(() => setIsOpen(false), 100);
          onBlur?.();
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-11 w-full border border-border bg-background px-4 text-base text-ink outline-none transition-colors duration-200",
          "placeholder:text-muted-foreground focus-visible:border-ink",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={examSelector.listboxLabel}
          className="absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-y-auto border border-border bg-surface shadow-md"
        >
          {filtered.length === 0 && (
            <li role="presentation" className="px-4 py-3 text-sm text-muted-foreground">
              {examSelector.noResults}
            </li>
          )}
          {filtered.map((code, index) => (
            <ExamOption
              key={code}
              id={`${id}-option-${code}`}
              label={code}
              matchLength={query.trim().length}
              active={index === safeIndex}
              onSelect={() => onSelectExam(code)}
              onMouseEnter={() => setActiveIndex(index)}
            />
          ))}
          <ExamOption
            id={`${id}-option-other`}
            label={examSelector.otherLabel}
            active={safeIndex === filtered.length}
            onSelect={onSelectOther}
            onMouseEnter={() => setActiveIndex(filtered.length)}
            isOther
          />
        </ul>
      )}
    </div>
  );
}
