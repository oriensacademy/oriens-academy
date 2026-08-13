"use client";

import React, { useState, useRef } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { WireframeDottedGlobe, type UniversityMarker } from "@/components/ui/wireframe-dotted-globe";
import { examMapProfiles, type ExamUniversityRelation, type AdmissionRelationship } from "@/data/exam-university-map";
import { useLocale } from "@/content/locale-context";
import { ExternalLink, Compass, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

function getRelationshipLabel(rel: AdmissionRelationship, isTr: boolean): string {
  switch (rel) {
    case "required":
      return isTr ? "Gerekli" : "Required";
    case "accepted":
      return isTr ? "Kabul Ediliyor" : "Accepted";
    case "program_specific":
      return isTr ? "Programa Özel" : "Program Specific";
    case "considered":
      return isTr ? "Değerlendiriliyor" : "Considered";
    case "recommended":
      return isTr ? "Öneriliyor" : "Recommended";
    default:
      return rel;
  }
}

export function ExamGlobeExplorer() {
  const locale = useLocale();
  const isTr = locale === "tr";

  const [activeExamCode, setActiveExamCode] = useState<string>("SAT");
  const [selectedRelation, setSelectedRelation] = useState<ExamUniversityRelation | null>(null);

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentProfile = examMapProfiles.find((p) => p.examCode === activeExamCode) || examMapProfiles[0];

  const markers: UniversityMarker[] = currentProfile.relations.map((r) => ({
    id: r.id,
    latitude: r.university.latitude,
    longitude: r.university.longitude,
    label: r.university.name,
    country: `${r.university.city ? r.university.city + ", " : ""}${r.university.country}`,
    subtitle: r.programScope,
    relationship: r.relationship,
    sourceUrl: r.source.url,
  }));

  const handleExamHover = (examCode: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setActiveExamCode(examCode);
      setSelectedRelation(null);
    }, 180);
  };

  const handleExamClick = (examCode: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setActiveExamCode(examCode);
    setSelectedRelation(null);
  };

  const handleMarkerClick = (marker: UniversityMarker) => {
    const rel = currentProfile.relations.find((r) => r.id === marker.id);
    if (rel) setSelectedRelation(rel);
  };

  return (
    <section
      id="global-universities"
      data-exam-globe
      data-active-exam={activeExamCode}
      className="section-offset bg-surface py-20 md:py-28 border-b border-border overflow-hidden"
    >
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        {/* Section Header */}
        <div className="max-w-3xl">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.24em] text-primary uppercase font-ui">
              {isTr ? "Global Üniversite Yolculuğu" : "Global University Pathways"}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 text-[clamp(1.85rem,2.8vw+1rem,3rem)] leading-[1.12] font-serif font-semibold text-ink">
              {isTr ? "Hangi sınav, hangi üniversitelerde kullanılıyor?" : "Which universities use each exam?"}
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 text-base md:text-lg leading-relaxed text-muted-foreground font-sans">
              {isTr
                ? "Sınavınızı seçin ve başvuru süreçlerinde bu sınavı kullanan üniversitelerden doğrulanmış örnekleri harita üzerinde keşfedin."
                : "Choose an exam to explore verified examples of universities that use it in their admissions process."}
            </p>
          </Reveal>
        </div>

        {/* Desktop Split / Mobile Stacked Area */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Exam Chips & Indicator */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Active Indicator Chip */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface-muted px-4 py-2 text-xs font-ui w-fit shadow-xs">
              <Compass className="size-4 text-primary animate-spin-slow" />
              <span className="text-muted-foreground">
                {isTr ? "Haritada Gösterilen:" : "Showing:"}
              </span>
              <span className="font-bold text-ink uppercase tracking-wide">
                {activeExamCode}
              </span>
            </div>

            {/* Exam Selector Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {examMapProfiles.map((prof) => {
                const isActive = prof.examCode === activeExamCode;
                return (
                  <button
                    key={prof.examCode}
                    type="button"
                    onPointerEnter={() => handleExamHover(prof.examCode)}
                    onFocus={() => handleExamHover(prof.examCode)}
                    onClick={() => handleExamClick(prof.examCode)}
                    className={cn(
                      "flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer font-ui",
                      isActive
                        ? "border-primary bg-primary/10 shadow-sm text-ink ring-1 ring-primary/30"
                        : "border-border bg-surface hover:border-primary/50 text-muted-foreground hover:text-ink"
                    )}
                  >
                    <span className="font-serif text-lg font-bold text-ink">
                      {prof.examCode}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1 line-clamp-1 font-sans">
                      {prof.relations.length} {isTr ? "Doğrulanmış Üniversite" : "Verified Universities"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Relation Information Panel */}
            {selectedRelation ? (
              <div className="p-6 rounded-2xl border border-primary/40 bg-surface-muted shadow-sm transition-all duration-300">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold text-primary uppercase font-ui">
                    {getRelationshipLabel(selectedRelation.relationship, isTr)}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-sans">
                    {selectedRelation.university.country}
                  </span>
                </div>

                <h3 className="font-serif text-xl font-bold text-ink">
                  {selectedRelation.university.name}
                </h3>
                {selectedRelation.programScope && (
                  <p className="text-xs text-muted-foreground mt-1 font-sans">
                    {selectedRelation.programScope}
                  </p>
                )}

                <a
                  href={selectedRelation.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline font-ui"
                >
                  {isTr ? "Resmi Kaynağı Gör" : "View Official Source"}
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            ) : (
              <div className="p-5 rounded-2xl border border-border bg-surface-muted text-xs text-muted-foreground font-sans leading-relaxed flex items-start gap-3">
                <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                <span>
                  {isTr
                    ? "Üniversitelerin kabul detaylarını ve resmi kaynak bağlantılarını görüntülemek için harita üzerindeki bir üniversite pinine tıklayın."
                    : "Click on any university pin on the globe to inspect detailed admission scope and verified source links."}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: D3 Globe Canvas */}
          <div className="lg:col-span-7 flex justify-center items-center relative">
            <WireframeDottedGlobe
              width={540}
              height={540}
              className="max-w-full"
              markers={markers}
              activeCountries={currentProfile.countries}
              focusLocation={currentProfile.focus}
              focusTrigger={activeExamCode}
              onMarkerClick={handleMarkerClick}
              ariaLabel={isTr ? "Etkileşimli sınav ve üniversite dünya haritası" : "Interactive exam and university world map"}
            />
          </div>
        </div>

        {/* Accessible Semantic University List */}
        <div className="mt-14 pt-10 border-t border-border">
          <h3 className="text-sm font-semibold text-ink font-ui uppercase tracking-wider mb-4">
            {isTr
              ? `${activeExamCode} Sınavını Başvurularında Kullanan Üniversitelerden Doğrulanmış Örnekler`
              : `Verified Examples of Universities Using ${activeExamCode} in Admissions`}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentProfile.relations.map((rel) => (
              <div
                key={rel.id}
                onClick={() => setSelectedRelation(rel)}
                className="p-4 rounded-xl border border-border bg-surface hover:border-primary transition-colors cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1 font-sans">
                    <span>{rel.university.country}</span>
                    <span className="font-semibold text-primary uppercase">
                      {getRelationshipLabel(rel.relationship, isTr)}
                    </span>
                  </div>
                  <h4 className="font-serif text-sm font-bold text-ink leading-snug">
                    {rel.university.name}
                  </h4>
                </div>

                <a
                  href={rel.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline font-ui"
                >
                  {isTr ? "Kaynak" : "Source"}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            ))}
          </div>

          {/* Section Disclaimer */}
          <div className="mt-8 flex items-start gap-2.5 rounded-xl bg-surface-muted p-4 border border-border text-xs text-muted-foreground leading-relaxed font-sans">
            <ShieldAlert className="size-4 text-primary shrink-0 mt-0.5" />
            <span>
              {isTr
                ? "Kabul koşulları üniversiteye, programa ve başvuru dönemine göre değişebilir. Güncel koşullar için ilgili üniversitenin resmi kabul sayfasını kontrol edin."
                : "Admission requirements may vary by university, programme and application cycle. Always check the university's official admissions page for current requirements."}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ExamGlobeExplorer;
