"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, ExternalLink, GraduationCap, Route, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/button";
import { useExamsContent, useLocale } from "@/content/locale-context";
import { studyDestinations } from "@/data/study-destinations";
import { examDetailPath, localizedPath } from "@/lib/routes";
import { loadFeaturedUniversities } from "@/lib/universities/featured-service";
import { DestinationExamPanel } from "./DestinationExamPanel";
import { DestinationSelector } from "./DestinationSelector";
import type { StudyRegion } from "./globe-types";

const StudyDestinationGlobe = dynamic(
  () => import("./StudyDestinationGlobe").then((mod) => mod.StudyDestinationGlobe),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto aspect-square w-full max-w-[620px] animate-pulse rounded-full border border-border bg-surface-muted" />
    ),
  }
);

function relationshipLabel(relationship: string, isTr: boolean) {
  const labels: Record<string, [string, string]> = {
    required: ["Zorunlu / İsteniyor", "Required"],
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
  const [hoveredRegionId, setHoveredRegionId] = useState<StudyRegion["id"] | null>(null);
  const [countryResult, setCountryResult] = useState<{
    iso3: string;
    universities: StudyRegion["countries"][number]["universities"];
  } | null>(null);
  const universityRequestVersion = useRef(0);
  
  useEffect(() => {
    const countryCode = selectedRegion?.countryCode;
    const requestVersion = ++universityRequestVersion.current;
    const controller = new AbortController();
    if (!countryCode) return () => controller.abort();

    loadFeaturedUniversities(countryCode, controller.signal)
      .then((universities) => {
        if (requestVersion === universityRequestVersion.current) {
          setCountryResult({ iso3: countryCode, universities: universities.slice(0, 3) });
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [selectedRegion?.countryCode]);

  // The browser never loads the global catalog; this contains only the DB-ranked
  // rows for the currently selected ISO3 country.
  const visibleUniversities = countryResult && countryResult.iso3 === selectedRegion?.countryCode
    ? countryResult.universities
    : [];
  const bookingHref = `${localizedPath("home", locale)}#consultation-form`;

  return (
    <section
      id="study-destinations"
      data-study-destination-section
      data-selected-destination={selectedRegion?.id ?? "none"}
      className={`overflow-hidden border-y border-border bg-background ${compact ? "py-16 md:py-20" : "py-20 md:py-28"}`}
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <Reveal className="max-w-3xl" y={10}>
          <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
            {isTr ? "Yurt Dışında Eğitim" : "Study Abroad"}
          </p>
          <h2 className="mt-4 max-w-[16ch] font-heading text-[clamp(2.35rem,5.5vw,4.7rem)] leading-[0.98] tracking-[-0.025em] text-ink">
            {isTr ? "Nerede okumak istersiniz?" : "Where would you like to study?"}
          </h2>
          <p className="mt-5 max-w-[64ch] text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
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
            emphasizedId={hoveredRegionId}
          />
        </div>

        <div className={`mt-8 grid items-center gap-8 lg:grid-cols-12 ${compact ? "lg:gap-8" : "lg:gap-12"}`}>
          <Reveal className="order-1 min-w-0 lg:col-span-7" y={8}>
            <div className="relative rounded-[2rem] border border-border bg-surface/45 p-2 sm:p-4">
              <StudyDestinationGlobe
                locale={locale}
                region={selectedRegion}
                regions={studyDestinations}
                compact={compact}
                onSelect={setSelectedRegion}
                onHoverRegion={setHoveredRegionId}
              />
              <div className="absolute right-4 bottom-4 hidden items-center gap-2 rounded-full border border-border bg-surface/85 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm sm:flex">
                <Route className="size-3.5 text-primary" aria-hidden="true" />
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

        {selectedRegion && visibleUniversities.length > 0 && (
          <div className={`${compact ? "mt-10" : "mt-14"} border-t border-border pt-8`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                  {isTr ? "Öne Çıkan Üniversiteler" : "Featured Universities"}
                </p>
                <h3 className="mt-2 font-heading text-2xl text-ink">
                  {isTr ? `${selectedRegion.labelTr} Üniversite Rotaları` : `${selectedRegion.labelEn} University Routes`}
                </h3>
              </div>
              <p className="max-w-[48ch] text-xs leading-5 text-muted-foreground">
                {isTr
                  ? "Koşullar ve kabul kriterleri programa göre değişiklik gösterebilir."
                  : "Admission criteria and requirements may vary by programme."}
              </p>
            </div>

            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleUniversities.map((university) => (
                <li key={university.id} className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
                  <div>
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-soft text-ink">
                        <GraduationCap className="size-5 text-primary" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold leading-5 text-ink">
                          {(() => {
                            const officialUrl = university.officialUrl;
                            if (officialUrl) {
                              return (
                                <a
                                  href={officialUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
                                  title={isTr ? `${university.name} Resmi Web Sitesi` : `${university.name} Official Website`}
                                >
                                  <span>{university.name}</span>
                                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </a>
                              );
                            }
                            return <span>{university.name}</span>;
                          })()}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">{university.city ?? university.country}</p>
                      </div>
                    </div>

                    {/* Evidence-Aware Exam Chips */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {university.examChips && university.examChips.length > 0 ? (
                        university.examChips.map((chip) => (
                          <Link
                            key={`${university.id}-${chip.exam}`}
                            href={examDetailPath(locale, chip.exam.toLowerCase())}
                            title={chip.evidence ? `${chip.evidence} (Doğrulanmış resmi kaynak)` : undefined}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-[#F7FAF7] px-3 py-1 text-[11px] font-semibold text-ink outline-none transition-colors hover:border-primary hover:bg-white focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <ShieldCheck className="size-3 text-primary/70" aria-hidden="true" />
                            <span>{isTr ? chip.labelTr : chip.labelEn}</span>
                          </Link>
                        ))
                      ) : (
                        university.examRelations.map((relation) => (
                          <Link
                            key={`${university.id}-${relation.examId}`}
                            href={examDetailPath(locale, relation.examId.toLowerCase())}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-ink outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <span>{relation.examId} · {relationshipLabel(relation.relationship, isTr)}</span>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>

                  {university.verifiedAt && (
                    <div className="mt-4 border-t border-border/50 pt-2 text-[10px] text-muted-foreground/70">
                      {isTr ? `Doğrulandı: ${university.verifiedAt}` : `Verified: ${university.verifiedAt}`}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
