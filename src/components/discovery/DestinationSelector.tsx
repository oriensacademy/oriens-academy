"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Locale } from "@/content/dictionaries";
import type { StudyRegion } from "./globe-types";
import { cn } from "@/lib/utils";

interface CountryMeta {
  flag: string;
  shortLabelTr?: string;
  shortLabelEn?: string;
  bgClass: string;
  borderClass: string;
  dotColor: string;
  textClass: string;
}

const COUNTRY_CONFIG: Record<string, CountryMeta> = {
  uk: {
    flag: "🇬🇧",
    shortLabelTr: "Birleşik Krallık",
    shortLabelEn: "UK",
    bgClass: "bg-[#F0F4F8]",
    borderClass: "border-[#CBD5E1]",
    dotColor: "#1E3A8A",
    textClass: "text-[#0F172A]",
  },
  us: {
    flag: "🇺🇸",
    shortLabelTr: "ABD",
    shortLabelEn: "USA",
    bgClass: "bg-[#EFF6FF]",
    borderClass: "border-[#BFDBFE]",
    dotColor: "#2563EB",
    textClass: "text-[#1E3A8A]",
  },
  canada: {
    flag: "🇨🇦",
    shortLabelTr: "Kanada",
    shortLabelEn: "Canada",
    bgClass: "bg-[#FEF2F2]",
    borderClass: "border-[#FECACA]",
    dotColor: "#DC2626",
    textClass: "text-[#7F1D1D]",
  },
  italy: {
    flag: "🇮🇹",
    shortLabelTr: "İtalya",
    shortLabelEn: "Italy",
    bgClass: "bg-[#F0FDF4]",
    borderClass: "border-[#BBF7D0]",
    dotColor: "#16A34A",
    textClass: "text-[#14532D]",
  },
  netherlands: {
    flag: "🇳🇱",
    shortLabelTr: "Hollanda",
    shortLabelEn: "Netherlands",
    bgClass: "bg-[#FFF7ED]",
    borderClass: "border-[#FED7AA]",
    dotColor: "#EA580C",
    textClass: "text-[#7C2D12]",
  },
  germany: {
    flag: "🇩🇪",
    shortLabelTr: "Almanya",
    shortLabelEn: "Germany",
    bgClass: "bg-[#FEFCE8]",
    borderClass: "border-[#FEF08A]",
    dotColor: "#CA8A04",
    textClass: "text-[#713F12]",
  },
  switzerland: {
    flag: "🇨🇭",
    shortLabelTr: "İsviçre",
    shortLabelEn: "Switzerland",
    bgClass: "bg-[#FFF1F2]",
    borderClass: "border-[#FECDD3]",
    dotColor: "#E11D48",
    textClass: "text-[#881337]",
  },
  france: {
    flag: "🇫🇷",
    shortLabelTr: "Fransa",
    shortLabelEn: "France",
    bgClass: "bg-[#F0F9FF]",
    borderClass: "border-[#BAE6FD]",
    dotColor: "#0284C7",
    textClass: "text-[#0C4A6E]",
  },
};

function getCountryMeta(id: string, countryCode?: string): CountryMeta {
  const key = (id || "").toLowerCase();
  const codeKey = (countryCode || "").toLowerCase();
  return (
    COUNTRY_CONFIG[key] ||
    COUNTRY_CONFIG[codeKey] || {
      flag: "🌍",
      bgClass: "bg-surface-muted",
      borderClass: "border-border",
      dotColor: "#4B5563",
      textClass: "text-ink",
    }
  );
}

export function DestinationSelector({
  locale,
  regions,
  selectedId,
  onSelect,
  emphasizedId = null,
}: {
  locale: Locale;
  regions: StudyRegion[];
  selectedId: StudyRegion["id"] | null;
  onSelect: (region: StudyRegion) => void;
  emphasizedId?: StudyRegion["id"] | null;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={locale === "tr" ? "Eğitim destinasyonu seçin" : "Choose a study destination"}
      className="flex flex-wrap items-center gap-2 sm:gap-2.5"
    >
      {regions.map((region) => {
        const active = selectedId === region.id;
        const emphasized = emphasizedId === region.id;
        const meta = getCountryMeta(region.id, region.countryCode);
        const isTr = locale === "tr";
        const fullName = isTr ? region.labelTr : region.labelEn;
        const shortName = isTr ? meta.shortLabelTr || fullName : meta.shortLabelEn || fullName;

        return (
          <button
            key={region.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(region)}
            className={cn(
              "group relative flex min-h-[42px] items-center gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 select-none cursor-pointer",
              active
                ? "border-[#10271B] bg-[#10271B] text-white shadow-[0_4px_14px_rgba(16,39,27,0.22)] ring-1 ring-primary/40 font-bold"
                : emphasized
                  ? "border-primary bg-sage-soft text-ink shadow-xs scale-[1.02]"
                  : cn(
                      meta.bgClass,
                      meta.borderClass,
                      meta.textClass,
                      "shadow-[0_1.5px_6px_rgba(16,39,27,0.05)] hover:shadow-[0_4px_12px_rgba(16,39,27,0.1)] hover:scale-[1.02] active:scale-[0.98]"
                    )
            )}
          >
            {active && (
              <motion.span
                layoutId="study-destination-active"
                className="absolute inset-0 rounded-xl bg-[#10271B]"
                transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
                aria-hidden="true"
              />
            )}
            {meta.flag && (
              <span className="relative z-10 text-sm sm:text-base leading-none transition-transform group-hover:scale-110" aria-hidden="true">
                {meta.flag}
              </span>
            )}
            <span className="relative z-10 tracking-tight">
              {/* Responsive name: compact ABD on mobile screens, full title on sm+ */}
              {region.id === "us" ? (
                <>
                  <span className="sm:hidden">{shortName}</span>
                  <span className="hidden sm:inline">{fullName}</span>
                </>
              ) : (
                fullName
              )}
            </span>
            <span
              className={cn(
                "relative z-10 size-2 rounded-full transition-all",
                active
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] scale-125"
                  : "ring-1 ring-black/15 group-hover:scale-110"
              )}
              style={!active ? { backgroundColor: meta.dotColor } : undefined}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
