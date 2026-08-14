"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, GraduationCap, Route } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/button";
import { useExamsContent, useLocale } from "@/content/locale-context";
import { studyDestinations } from "@/data/study-destinations";
import { examDetailPath, localizedPath } from "@/lib/routes";
import { DestinationExamPanel } from "./DestinationExamPanel";
import { DestinationSelector } from "./DestinationSelector";
import type { StudyRegion } from "./globe-types";

const StudyDestinationGlobe = dynamic(
  () => import("./StudyDestinationGlobe").then((mod) => mod.StudyDestinationGlobe),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto aspect-square w-full max-w-[620px] animate-pulse rounded-full border border-[#DDE4DC] bg-[#EEF2EC]" />
    ),
  }
);

function relationshipLabel(relationship: string, isTr: boolean) {
  const labels: Record<string, [string, string]> = {
    required: ["Gerekli", "Required"],
    accepted: ["Kabul ediliyor", "Accepted"],
    considered: ["Değerlendiriliyor", "Considered"],
    program_specific: ["Programa özel", "Programme-specific"],
    recommended: ["Öneriliyor", "Recommended"],
  };
  return labels[relationship]?.[isTr ? 0 : 1] ?? relationship;
}

export function StudyDestinationSection({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const exams = useExamsContent();
  const isTr = locale === "tr";
  const [selectedRegion, setSelectedRegion] = useState<StudyRegion | null>(() => studyDestinations[0] ?? null);
  const universities = selectedRegion?.countries.flatMap((country) => country.universities) ?? [];
  const visibleUniversities = compact ? universities.slice(0, 3) : universities;
  const bookingHref = `${localizedPath("home", locale)}#consultation-form`;

  return (
    <section
      id="study-destinations"
      data-study-destination-section
      data-selected-destination={selectedRegion?.id ?? "none"}
      className={`overflow-hidden border-y border-[#DDE4DC] bg-[#F6F8F3] ${compact ? "py-16 md:py-20" : "py-20 md:py-28"}`}
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal className="max-w-3xl" y={10}>
          <p className="text-xs font-semibold tracking-[0.22em] text-[#819586] uppercase">
            {isTr ? "Yurt Dışında Eğitim" : "Study Abroad"}
          </p>
          <h2 className="mt-4 max-w-[16ch] font-heading text-[clamp(2.35rem,5.5vw,4.7rem)] leading-[0.98] tracking-[-0.025em] text-[#10271B]">
            {isTr ? "Nerede okumak istersiniz?" : "Where would you like to study?"}
          </h2>
          <p className="mt-5 max-w-[64ch] text-base leading-7 text-[#68756C] md:text-lg md:leading-8">
            {isTr
              ? "Hedeflediğiniz ülkeyi seçin; ilgili sınavları, hazırlık alanlarını ve üniversite rotanızı tek bir yerde keşfedin."
              : "Choose your destination and explore the exams, preparation areas and university pathways relevant to your goals."}
          </p>
        </Reveal>

        <div className="mt-8">
          <DestinationSelector
            locale={locale}
            regions={studyDestinations}
            selectedId={selectedRegion?.id ?? null}
            onSelect={setSelectedRegion}
          />
        </div>

        <div className={`mt-8 grid items-center gap-8 lg:grid-cols-12 ${compact ? "lg:gap-8" : "lg:gap-12"}`}>
          <Reveal className="order-1 min-w-0 lg:col-span-7" y={8}>
            <div className="relative rounded-[2rem] border border-[#DDE4DC] bg-white/45 p-2 sm:p-4">
              <StudyDestinationGlobe locale={locale} region={selectedRegion} regions={studyDestinations} compact={compact} />
              <div className="absolute right-4 bottom-4 hidden items-center gap-2 rounded-full border border-[#DDE4DC] bg-white/85 px-3 py-1.5 text-[11px] text-[#68756C] backdrop-blur-sm sm:flex">
                <Route className="size-3.5 text-[#819586]" aria-hidden="true" />
                {isTr ? "Sürükleyerek keşfedin" : "Drag to explore"}
              </div>
            </div>
          </Reveal>

          <div className="order-2 min-w-0 lg:col-span-5">
            <DestinationExamPanel locale={locale} region={selectedRegion} examText={exams.examText} />
            {selectedRegion && (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <ButtonLink href={localizedPath("exams", locale)} variant="outline" size="lg" directional className="min-h-11">
                  {isTr ? "Sınavları İncele" : "Explore Exams"}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" />
                </ButtonLink>
                <ButtonLink href={bookingHref} size="lg" directional className="min-h-11">
                  {isTr ? "Ücretsiz Görüşme Planla" : "Book a Free Consultation"}<ArrowRight data-directional-arrow className="size-4" aria-hidden="true" />
                </ButtonLink>
              </div>
            )}
          </div>
        </div>

        {selectedRegion && universities.length > 0 && (
          <div className={`${compact ? "mt-10" : "mt-14"} border-t border-[#DDE4DC] pt-8`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[#819586] uppercase">
                  {isTr ? "Doğrulanmış örnekler" : "Verified examples"}
                </p>
                <h3 className="mt-2 font-heading text-2xl text-[#10271B]">
                  {isTr ? `${selectedRegion.labelTr} üniversite rotaları` : `${selectedRegion.labelEn} university routes`}
                </h3>
              </div>
              <p className="max-w-[48ch] text-xs leading-5 text-[#68756C]">
                {isTr
                  ? "Koşullar programa ve döneme göre değişir."
                  : "Conditions vary by programme and cycle."}
              </p>
            </div>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleUniversities.map((university) => (
                <li key={university.id} className="rounded-xl border border-[#DDE4DC] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E9EFE9] text-[#10271B]"><GraduationCap className="size-4" aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold leading-5 text-[#10271B]">{university.name}</h4>
                      <p className="mt-1 text-xs text-[#68756C]">{university.city ?? university.country}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {university.examRelations.map((relation) => (
                      <Link
                        key={`${university.id}-${relation.examId}`}
                        href={examDetailPath(locale, relation.examId.toLowerCase())}
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[#DDE4DC] px-2.5 py-1 text-[11px] font-semibold text-[#10271B] outline-none hover:border-[#819586] focus-visible:ring-2 focus-visible:ring-[#819586]"
                        aria-label={`${relation.examId}: ${relationshipLabel(relation.relationship, isTr)}`}
                      >
                        {relation.examId} · {relationshipLabel(relation.relationship, isTr)}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
