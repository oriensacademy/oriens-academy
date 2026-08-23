"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Palette, Check, Sparkles } from "lucide-react";
import { useLocale } from "@/content/locale-context";

export interface ThemeOption {
  id: string;
  nameTr: string;
  nameEn: string;
  dotColor: string;
  accentColor: string;
  bgColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "theme-1",
    nameTr: "1. Klasik Sage & Fildişi",
    nameEn: "1. Classic Sage & Ivory",
    dotColor: "#5A7762",
    accentColor: "#C5B58A",
    bgColor: "#F6F8F3",
  },
  {
    id: "theme-2",
    nameTr: "2. Sage & Kraliyet Mavisi",
    nameEn: "2. Sage & Royal Blue",
    dotColor: "#1C5182",
    accentColor: "#658876",
    bgColor: "#F4F7F5",
  },
  {
    id: "theme-3",
    nameTr: "3. Gece Laciverti & Şampanya",
    nameEn: "3. Midnight Navy & Champagne",
    dotColor: "#B2883B",
    accentColor: "#0A192F",
    bgColor: "#F6F8FA",
  },
  {
    id: "theme-4",
    nameTr: "4. Koyu Teal & Kobalt",
    nameEn: "4. Deep Teal & Cobalt",
    dotColor: "#0D697C",
    accentColor: "#588C95",
    bgColor: "#F3F8F8",
  },
  {
    id: "theme-5",
    nameTr: "5. Orman & Sıcak Terracotta",
    nameEn: "5. Forest & Warm Terracotta",
    dotColor: "#B25332",
    accentColor: "#5F7A69",
    bgColor: "#F8F6F2",
  },
];

const STORAGE_KEY = "oriens-theme-preview";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("oriens-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("oriens-theme-change", callback);
  };
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "theme-1";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && THEME_OPTIONS.some((t) => t.id === saved) ? saved : "theme-1";
  } catch {
    return "theme-1";
  }
}

function getServerSnapshot(): string {
  return "theme-1";
}

export function ThemeSelector() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const activeTheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = activeTheme;
    } catch {
      // Safe ignore
    }
  }, [activeTheme]);

  const selectTheme = (themeId: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
      window.dispatchEvent(new Event("oriens-theme-change"));
    } catch {
      // Safe ignore
    }
  };

  return (
    <aside
      aria-label={isTr ? "Renk Teması Önizleme Seçici" : "Theme Color Preview Selector"}
      className="rounded-2xl border border-border bg-surface/90 p-4 shadow-sm backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-sage-soft text-ink">
            <Palette className="size-4 text-primary" />
          </span>
          <div>
            <h3 className="text-xs font-bold text-ink">
              {isTr ? "Renk Teması Seçici" : "Theme Palette Selector"}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {isTr ? "5 farklı premium renk paletini canlı deneyin" : "Preview 5 premium color palettes live"}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-sage-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
          <Sparkles className="size-3" />
          {isTr ? "Canlı Önizleme" : "Live Preview"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {THEME_OPTIONS.map((theme) => {
          const isSelected = activeTheme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => selectTheme(theme.id)}
              aria-pressed={isSelected}
              className={`group flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left text-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected
                  ? "border-primary bg-sage-soft/70 font-bold text-ink shadow-xs ring-1 ring-primary/40"
                  : "border-border bg-surface text-muted-foreground hover:border-primary/50 hover:bg-surface-muted hover:text-ink"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="flex size-4 shrink-0 items-center justify-center rounded-full border border-white shadow-xs"
                  style={{ backgroundColor: theme.dotColor }}
                />
                <span className="truncate text-[11px]">
                  {isTr ? theme.nameTr : theme.nameEn}
                </span>
              </div>
              {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
