"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Check } from "lucide-react";
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
    <div
      aria-label={isTr ? "Renk Teması Seçici" : "Theme Palette"}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-2.5 py-1 shadow-2xs backdrop-blur-xs"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {isTr ? "Tema" : "Theme"}
      </span>
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label={isTr ? "Renk Temaları" : "Color Themes"}>
        {THEME_OPTIONS.map((theme) => {
          const isSelected = activeTheme === theme.id;
          const themeName = isTr ? theme.nameTr : theme.nameEn;

          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => selectTheme(theme.id)}
              title={themeName}
              aria-label={themeName}
              className={`group relative flex size-4.5 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-border-strong"
              }`}
              style={{ backgroundColor: theme.dotColor }}
            >
              {isSelected && (
                <Check className="size-2.5 text-white drop-shadow-xs stroke-[3]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
