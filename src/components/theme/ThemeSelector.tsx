"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeId = "theme-1" | "theme-2" | "theme-3" | "theme-4" | "theme-5";

const THEMES: Array<{
  id: ThemeId;
  nameTr: string;
  nameEn: string;
  color: string;
  borderColor: string;
}> = [
  {
    id: "theme-1",
    nameTr: "Klasik Sage & Fildişi",
    nameEn: "Classic Sage & Ivory",
    color: "#5A7762",
    borderColor: "#4B6452",
  },
  {
    id: "theme-2",
    nameTr: "Kraliyet Mavisi",
    nameEn: "Royal Blue",
    color: "#1E40AF",
    borderColor: "#1D4ED8",
  },
  {
    id: "theme-3",
    nameTr: "Gece Laciverti",
    nameEn: "Midnight Navy",
    color: "#0F172A",
    borderColor: "#D97706",
  },
  {
    id: "theme-4",
    nameTr: "Koyu Teal",
    nameEn: "Dark Teal",
    color: "#0D9488",
    borderColor: "#0F766E",
  },
  {
    id: "theme-5",
    nameTr: "Sıcak Terracotta",
    nameEn: "Warm Terracotta",
    color: "#C2410C",
    borderColor: "#9A3412",
  },
];

function subscribeToTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("oriens-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("oriens-theme-change", callback);
  };
}

function getThemeSnapshot(): ThemeId {
  if (typeof window === "undefined") return "theme-1";
  return (localStorage.getItem("oriens-theme") as ThemeId) || "theme-1";
}

function getThemeServerSnapshot(): ThemeId {
  return "theme-1";
}

function useHasMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function ThemeSelector({ locale = "tr" }: { locale?: "tr" | "en" }) {
  const activeTheme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getThemeServerSnapshot);
  const mounted = useHasMounted();

  const selectTheme = (id: ThemeId) => {
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem("oriens-theme", id);
      window.dispatchEvent(new Event("oriens-theme-change"));
    } catch {
      // Ignore storage errors in private browsing
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <span className="text-[11px] font-medium text-white/50">{locale === "tr" ? "Tema" : "Theme"}</span>
        <div className="flex items-center gap-1.5">
          {THEMES.map((t) => (
            <span
              key={t.id}
              className="inline-block size-4 rounded-full border border-white/20 opacity-60"
              style={{ backgroundColor: t.color }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label={locale === "tr" ? "Tema Seçimi" : "Theme Selection"}>
      <span className="text-[11px] font-medium text-white/60 select-none">
        {locale === "tr" ? "Tema" : "Theme"}
      </span>
      <div className="flex items-center gap-1.5">
        {THEMES.map((theme) => {
          const isSelected = activeTheme === theme.id;
          const label = locale === "tr" ? theme.nameTr : theme.nameEn;

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => selectTheme(theme.id)}
              title={label}
              aria-label={label}
              aria-pressed={isSelected}
              className={cn(
                "group relative flex size-4.5 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                isSelected
                  ? "ring-2 ring-white ring-offset-1 ring-offset-black/40 scale-105"
                  : "opacity-75 hover:opacity-100"
              )}
              style={{ backgroundColor: theme.color }}
            >
              {isSelected && (
                <Check className="size-2.5 text-white stroke-[3]" />
              )}
              {/* Accessible Hover Tooltip */}
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/90 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 z-50">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ThemeSelector;
