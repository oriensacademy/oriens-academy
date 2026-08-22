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
      className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {regions.map((region) => {
        const active = selectedId === region.id;
        const emphasized = emphasizedId === region.id;
        const tone = `var(--destination-${region.id})`;
        const softTone = `var(--destination-${region.id}-soft)`;
        return (
          <button
            key={region.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(region)}
            className="relative min-h-11 shrink-0 snap-start overflow-hidden rounded-full border bg-surface px-4 py-2 text-sm font-semibold text-ink outline-none transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            style={{ borderColor: active || emphasized ? tone : "var(--border)", backgroundColor: active ? softTone : emphasized ? "var(--surface-muted)" : "var(--surface)", boxShadow: active ? `inset 0 0 0 1px ${tone}` : undefined }}
          >
            {active && (
              <motion.span
                layoutId="study-destination-active"
                className="absolute inset-0"
                style={{ backgroundColor: softTone }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 flex items-center gap-2"><span className="size-1.5 rounded-full" style={{ backgroundColor: tone }} aria-hidden="true" />{locale === "tr" ? region.labelTr : region.labelEn}</span>
          </button>
        );
      })}
    </div>
  );
}
