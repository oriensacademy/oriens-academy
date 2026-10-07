"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Locale } from "@/content/dictionaries";
import type { StudyRegion } from "./globe-types";
import { cn } from "@/lib/utils";

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
      className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 sm:gap-2.5 xl:justify-between"
    >
      {regions.map((region) => {
        const active = selectedId === region.id;
        const emphasized = emphasizedId === region.id;
        const isTr = locale === "tr";
        const fullName = isTr ? region.labelTr : region.labelEn;
        const shortName = isTr ? (region.id === "us" ? "ABD" : fullName) : (region.id === "us" ? "USA" : fullName);

        return (
          <button
            key={region.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(region)}
            className={cn(
              "group relative flex min-h-[42px] max-w-full items-center gap-2.5 rounded-full border px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 select-none cursor-pointer sm:text-sm",
              active
                ? "border-[#10271B] bg-[#10271B] text-white shadow-[0_4px_14px_rgba(16,39,27,0.2)] font-bold"
                : emphasized
                  ? "border-primary bg-sage-soft text-[#10271B] shadow-xs scale-[1.02]"
                  : "border-[#D0DBD2] bg-[#F4F7F4] text-[#10271B] shadow-[0_1px_4px_rgba(16,39,27,0.04)] hover:border-[#819586] hover:bg-[#EBF2EC] hover:shadow-[0_3px_10px_rgba(16,39,27,0.08)] active:scale-[0.98]"
            )}
          >
            {active && (
              <motion.span
                layoutId="study-destination-active"
                className="absolute inset-0 rounded-full bg-[#10271B]"
                transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 tracking-tight">
              {/* Responsive name: compact ABD/USA on mobile screens, full title on sm+ */}
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
                "relative z-10 size-2 rounded-full transition-all duration-200",
                active
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] scale-110"
                  : "bg-[#819586]/70 group-hover:bg-primary group-hover:scale-110"
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
