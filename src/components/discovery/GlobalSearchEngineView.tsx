"use client";

import { useState, useTransition } from "react";
import { Filter, SlidersHorizontal, Sparkles, RefreshCw, Layers, ArrowRight } from "lucide-react";
import { SearchAutocompleteInput } from "./SearchAutocompleteInput";
import { ProgramResultCard } from "./ProgramResultCard";
import { QualificationDetailCard } from "./QualificationDetailCard";
import { CountryDetailCard } from "./CountryDetailCard";
import { searchAndRankPrograms } from "@/lib/search/intent-ranking-engine";
import { createNormalizedProfile } from "@/lib/admission/profile-normalizer";
import { evaluateProgramMatch } from "@/lib/admission/eligibility-matcher";
import { INITIAL_QUALIFICATIONS_SEED, INITIAL_COUNTRIES_SEED } from "@/data/admission-seed";
import type { ProgramMatchEvaluation } from "@/types/matching.types";

interface GlobalSearchEngineViewProps {
  defaultQuery?: string;
}

export function GlobalSearchEngineView({ defaultQuery = "" }: GlobalSearchEngineViewProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [selectedCountry, setSelectedCountry] = useState<string>("ALL");
  const [selectedDegree, setSelectedDegree] = useState<string>("ALL");
  const [selectedMatchCategory, setSelectedMatchCategory] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Perform search and ranking
  const searchResult = searchAndRankPrograms(query, currentPage, 6);
  const parsedQuery = searchResult.items.length > 0 ? searchAndRankPrograms(query).items : [];

  // Construct normalized student profile from query
  const studentProfile = createNormalizedProfile(null, searchResult.items.length > 0 ? searchAndRankPrograms(query).items[0] ? undefined : undefined : undefined);

  // Evaluate candidate program matches
  let programMatches: ProgramMatchEvaluation[] = searchResult.items.map((item) => {
    return evaluateProgramMatch(
      { id: item.id, name: item.programName, universityName: item.universityName },
      {
        id: `tree-${item.id}`,
        programId: item.id,
        logicalOperator: "AND",
        requirements: [
          {
            id: `req-${item.id}-1`,
            groupId: `tree-${item.id}`,
            qualificationId: "ib-id",
            qualification: { id: "ib-id", code: "IB", name: "International Baccalaureate", shortName: "IB", category: "DIPLOMA", active: true },
            requirementType: "REQUIRED",
            minimumScore: item.countryIso2 === "GB" ? 38 : 36,
            academicYear: 2026,
          },
        ],
      },
      studentProfile,
      { minimumIb: 36, typicalIb: 40 },
      item.finalScore
    );
  });

  // Apply UI Filters
  if (selectedCountry !== "ALL") {
    programMatches = programMatches.filter((m) => {
      const card = searchResult.items.find((i) => i.id === m.programId);
      return card?.countryIso2 === selectedCountry;
    });
  }

  if (selectedMatchCategory !== "ALL") {
    programMatches = programMatches.filter((m) => m.category === selectedMatchCategory);
  }

  // Active Qualification or Country entity matches
  const matchedQualCode = searchResult.items.length > 0 ? searchResult.items[0].badge?.includes("IMAT") ? "IMAT" : undefined : undefined;
  const matchedQual = INITIAL_QUALIFICATIONS_SEED.find((q) => q.code === (query.toUpperCase().trim()));
  const matchedCountry = INITIAL_COUNTRIES_SEED.find((c) => c.name.toLowerCase() === query.toLowerCase().trim() || c.iso2 === query.toUpperCase().trim());

  const handleSearchSubmit = (newQuery: string) => {
    startTransition(() => {
      setQuery(newQuery);
      setCurrentPage(1);
    });
  };

  return (
    <section className="relative overflow-hidden py-16 md:py-24 bg-slate-950 text-slate-100 min-h-screen">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-[1280px] px-6 md:px-12 relative z-10">
        {/* Header Title */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-widest uppercase mb-4">
            <Sparkles className="size-3.5" />
            Oriens Admission Search Engine
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
            Global University Admission & Eligibility Engine
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-300">
            Deterministic qualification matching, requirement verification, and instant global admission search.
          </p>
        </div>

        {/* Autocomplete Search Bar Component */}
        <SearchAutocompleteInput
          initialQuery={query}
          onSearchSubmit={handleSearchSubmit}
        />

        {/* Dedicated Country or Qualification Detail Hero Cards */}
        {matchedQual && (
          <div className="mt-8">
            <QualificationDetailCard qualification={{ id: `q-${matchedQual.code}`, ...matchedQual }} />
          </div>
        )}

        {matchedCountry && (
          <div className="mt-8">
            <CountryDetailCard country={{ id: `c-${matchedCountry.iso2}`, ...matchedCountry }} />
          </div>
        )}

        {/* Interactive Filters Bar */}
        <div className="mt-10 rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider pr-2">
              <SlidersHorizontal className="size-4 text-emerald-400" />
              Filters:
            </div>

            {/* Country Filter */}
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="ALL">All Countries</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
              <option value="IT">Italy</option>
              <option value="NL">Netherlands</option>
            </select>

            {/* Match Status Filter */}
            <select
              value={selectedMatchCategory}
              onChange={(e) => setSelectedMatchCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="ALL">All Match Categories</option>
              <option value="ELIGIBLE">Eligible / Strong Match</option>
              <option value="MATCH">Match</option>
              <option value="REACH">Reach</option>
              <option value="REQUIREMENT_GAP">Requirement Gap</option>
              <option value="MISSING_INFORMATION">Missing Information</option>
            </select>
          </div>

          {(selectedCountry !== "ALL" || selectedMatchCategory !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSelectedCountry("ALL");
                setSelectedMatchCategory("ALL");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="size-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Results Header Bar */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100">
              {query ? `Results for "${query}"` : "Featured Global Programs"}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              {searchResult.intent.replace("_", " ")}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-200">{programMatches.length}</span> programs
          </p>
        </div>

        {/* Results Cards List / Empty State / Skeleton */}
        {isPending ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse p-6" />
            ))}
          </div>
        ) : programMatches.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {programMatches.map((match) => {
              const cardData = searchResult.items.find((i) => i.id === match.programId);
              return (
                <ProgramResultCard
                  key={match.programId}
                  match={match}
                  dataQuality={cardData?.dataQuality}
                  onViewRequirements={() => {}}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl bg-slate-900/40 border border-slate-800/80 p-12 text-center max-w-xl mx-auto">
            <div className="size-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400 mb-4">
              <Layers className="size-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200">No matching programs found</h3>
            <p className="mt-2 text-sm text-slate-400">
              Try changing the country, program or qualification filter parameters.
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {searchResult.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400 font-medium">
              Page {currentPage} of {searchResult.totalPages}
            </span>
            <button
              type="button"
              disabled={!searchResult.hasMore}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
