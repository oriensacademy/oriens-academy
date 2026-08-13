"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Locale } from "@/content/dictionaries";
import type { StudyRegion } from "./globe-types";

export function DestinationSelector({
  locale,
  regions,
  selectedId,
  onSelect,
}: {
  locale: Locale;
  regions: StudyRegion[];
  selectedId: StudyRegion["id"] | null;
  onSelect: (region: StudyRegion) => void;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={locale === "tr" ? "Eğitim destinasyonu seçin" : "Choose a study destination"}
      className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {regions.map((region) => {
        const active = selectedId === region.id;
        return (
          <button
            key={region.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(region)}
            className="relative min-h-11 shrink-0 snap-start overflow-hidden rounded-full border border-[#DDE4DC] px-4 py-2 text-sm font-semibold text-[#10271B] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-2"
          >
            {active && (
              <motion.span
                layoutId="study-destination-active"
                className="absolute inset-0 bg-[#E9EFE9]"
                transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10">{locale === "tr" ? region.labelTr : region.labelEn}</span>
          </button>
        );
      })}
    </div>
  );
}

