"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

export const LESSON_MINUTE_OPTIONS = ["00", "15", "30", "45"] as const;

export function withDefaultLessonMinute(value: string) {
  const match = /^(\d{2}):\d{2}$/.exec(value);
  return `${match?.[1] ?? "00"}:00`;
}

export const LESSON_CALENDAR_WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;

export function canonicalDateToDisplay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

export function displayDateToCanonical(value: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  if (date.getUTCFullYear() !== Number(match[3]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[1])) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function dateFromCanonical(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function canonicalFromDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function useCloseOnOutsideClick(ref: React.RefObject<HTMLDivElement | null>, close: () => void) {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [close, ref]);
}

const controlClass = "flex min-h-[46px] w-full items-center justify-between rounded-xl border border-[#D9D6CC] bg-white px-3.5 text-left text-sm text-[#1C231E] outline-none focus-visible:ring-2 focus-visible:ring-[#C0902F]";

export function ControlledLessonDate({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => dateFromCanonical(value));
  const rootRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(rootRef, () => setOpen(false));

  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [visibleMonth]);

  const selected = dateFromCanonical(value);
  return (
    <div ref={rootRef} className="relative mt-1">
      <button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (!open) setVisibleMonth(dateFromCanonical(value)); setOpen((current) => !current); }} className={controlClass}>
        <span data-guard-val="">{canonicalDateToDisplay(value)}</span><CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>
      {open && (
        <div role="dialog" aria-label={`${label} takvimi`} className="absolute left-0 z-[210] mt-1 w-[300px] rounded-2xl border border-[#E6E4DC] bg-white p-3.5 shadow-[0_16px_40px_rgba(16,39,27,0.18)]">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Önceki ay" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} className="rounded-lg p-1.5 hover:bg-surface-muted"><ChevronLeft className="size-4" /></button>
            <strong className="text-xs capitalize">{new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(visibleMonth)}</strong>
            <button type="button" aria-label="Sonraki ay" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} className="rounded-lg p-1.5 hover:bg-surface-muted"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1" data-week-start="monday">
            {LESSON_CALENDAR_WEEKDAYS.map((weekday) => <span key={weekday} className="py-1 text-center text-[10px] font-semibold text-muted-foreground">{weekday}</span>)}
            {days.map((day) => {
              const canonical = canonicalFromDate(day);
              const isSelected = day.getFullYear() === selected.getFullYear() && day.getMonth() === selected.getMonth() && day.getDate() === selected.getDate();
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const now = new Date();
              const isToday = day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate();
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return <button key={canonical} type="button" data-guard-pick="" aria-label={canonicalDateToDisplay(canonical)} aria-pressed={isSelected} onClick={() => { onChange(canonical); setOpen(false); }} className={`aspect-square rounded-[10px] text-sm hover:bg-[#F7F6F1] ${isSelected ? "bg-[#10271B] font-bold text-white hover:bg-[#10271B]" : isCurrentMonth ? (isWeekend ? "text-[#9AA09B]" : "text-[#1C231E]") : "text-[#9AA09B]/50"} ${isToday && !isSelected ? "ring-1 ring-inset ring-[#C0902F]" : ""}`}>{day.getDate()}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ControlledLessonTime({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useCloseOnOutsideClick(rootRef, () => setOpen(false));
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = match?.[1] ?? "00";
  const minute = match?.[2] ?? "00";
  const update = (nextHour: string, nextMinute: string) => onChange(`${nextHour}:${nextMinute}`);

  return (
    <div ref={rootRef} className="relative mt-1">
      <button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={controlClass}>
        <span data-guard-val="">{`${hour}:${minute}`}</span><Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>
      {open && (
        <div role="dialog" aria-label={`${label} seçici`} className="absolute left-0 z-[210] mt-1 flex w-44 items-center gap-2 rounded-xl border border-[#E6E4DC] bg-white p-3 shadow-xl">
          <select aria-label="Saat" value={hour} onChange={(event) => update(event.target.value, minute)} className="min-h-10 flex-1 rounded-lg border border-input bg-white px-2 text-sm">
            {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0")).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <span className="font-bold">:</span>
          <select aria-label="Dakika" value={minute} onChange={(event) => update(hour, event.target.value)} className="min-h-10 flex-1 rounded-lg border border-input bg-white px-2 text-sm">
            {LESSON_MINUTE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
