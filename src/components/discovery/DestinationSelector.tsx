"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Locale } from "@/content/dictionaries";
import type { StudyRegion } from "./globe-types";

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
      className="-mx-6 flex snap-x gap-2.5 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {regions.map((region) => {
        const active = selectedId === region.id;
        const emphasized = emphasizedId === region.id;
        const tone = `var(--destination-${region.id})`;

        return (
          <button
            key={region.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(region)}
            className={`relative min-h-11 shrink-0 snap-start overflow-hidden rounded-full border px-4 py-2 text-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              active
                ? "border-forest bg-forest font-bold text-white shadow-[0_4px_14px_rgba(16,39,27,0.18)]"
                : emphasized
                  ? "border-primary bg-sage-soft font-semibold text-ink"
                  : "border-[#C0CEC3] bg-[#F2F6F3] font-semibold text-ink hover:border-[#819586] hover:bg-[#EBF2EC]"
            }`}
          >
            {active && (
              <motion.span
                layoutId="study-destination-active"
                className="absolute inset-0 bg-forest"
                transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 flex items-center gap-2.5">
              <span
                className={`size-2.5 rounded-full ring-2 transition-transform ${
                  active ? "scale-110 ring-white/60" : "ring-white"
                }`}
                style={{ backgroundColor: tone }}
                aria-hidden="true"
              />
              {locale === "tr" ? region.labelTr : region.labelEn}
            </span>
          </button>
        );
      })}
    </div>
  );
}
