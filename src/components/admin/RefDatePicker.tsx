"use client";

import { useEffect, useRef, useState } from "react";
import pages from "./admin-pages.module.css";

// Referans: oriens-admin.js `.dp` tarih seçici (Pazartesi ile başlayan ay
// ızgarası, GG.AA.YYYY gösterim). Değer YYYY-MM-DD olarak taşınır; boşsa
// `emptyLabel` gösterilir.

const AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function parse(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? new Date(+match[1], +match[2] - 1, +match[3]) : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

export function RefDatePicker({
  id,
  value,
  onChange,
  emptyLabel = "Seçilmedi",
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date | null>(null);
  const [today, setToday] = useState("");
  const selected = parse(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const now = new Date();
    const base = selected ?? now;
    setToday(iso(now));
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
    setOpen(true);
  };

  const days: Array<Date | null> = [];
  if (view) {
    const lead = (view.getDay() + 6) % 7; // pazartesi = 0
    for (let i = 0; i < lead; i++) days.push(null);
    const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= count; d++) days.push(new Date(view.getFullYear(), view.getMonth(), d));
  }

  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <div className="dp" ref={ref}>
        <button type="button" id={id} className="m-input dp-btn" aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel} onClick={toggle}>
          <span className="dp-val">{selected ? fmt(selected) : emptyLabel}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B635C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        </button>
        <div className="dp-pop" hidden={!open} role="dialog" aria-label="Tarih seç">
          <div className="dp-head">
            <button type="button" className="dp-nav" aria-label="Önceki ay" onClick={() => setView((v) => (v ? new Date(v.getFullYear(), v.getMonth() - 1, 1) : v))}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <span className="dp-title">{view ? `${AY[view.getMonth()]} ${view.getFullYear()}` : ""}</span>
            <button type="button" className="dp-nav" aria-label="Sonraki ay" onClick={() => setView((v) => (v ? new Date(v.getFullYear(), v.getMonth() + 1, 1) : v))}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
          <div className="dp-grid">
            {DOW.map((d) => <span key={d} className="dp-dow">{d}</span>)}
            <div className="dp-days">
              {days.map((day, index) => {
                if (!day) return <span key={`e${index}`} />;
                const key = iso(day);
                const dow = (day.getDay() + 6) % 7;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`dp-day${dow >= 5 ? " we" : ""}${key === today ? " today" : ""}`}
                    aria-selected={selected ? key === iso(selected) : false}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Referans `.tm`: saat 00–23, dakika 00/15/30/45. Kayıtlı değer çeyrek
// dakika değilse kaybolmaması için listeye eklenir.
export function RefTimeSelect({
  hour,
  minute,
  onChange,
}: {
  hour: string;
  minute: string;
  onChange: (hour: string, minute: string) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes = ["00", "15", "30", "45"];
  if (minute && !minutes.includes(minute)) minutes.push(minute);
  minutes.sort();
  return (
    <div className={pages.root} style={{ display: "contents" }}>
      <div className="tm">
        <select className="m-input" aria-label="Saat" value={hour} onChange={(e) => onChange(e.target.value, minute)}>
          {hours.map((h) => <option key={h}>{h}</option>)}
        </select>
        <span>:</span>
        <select className="m-input" aria-label="Dakika" value={minute} onChange={(e) => onChange(hour, e.target.value)}>
          {minutes.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
