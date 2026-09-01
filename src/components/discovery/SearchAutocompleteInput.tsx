"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Search, Sparkles, X, ChevronRight, GraduationCap, Award, Globe, BookOpen, ArrowUpRight } from "lucide-react";
import type { GroupedSearchResults, SearchResultItem } from "@/lib/search/retrieval-engine";
import { emptySearchResults, retrieveCanonicalExamFallback } from "@/lib/search/canonical-exam-fallback";
import { retrieveSearchResultsFromDatabase } from "@/lib/search/db-retrieval-service";
import { useLocale } from "@/content/locale-context";

interface SearchAutocompleteInputProps {
  initialQuery?: string;
  onSearchSubmit?: (query: string) => void;
  onSelectResult?: (item: SearchResultItem) => void;
  className?: string;
}

const EXAMPLE_QUERIES_TR = [
  "Cambridge",
  "Digital SAT",
  "İtalya Tıp (IMAT)",
  "Cambridge TMUA",
  "IB Diploma",
];

const EXAMPLE_QUERIES_EN = [
  "Cambridge",
  "Digital SAT",
  "Italy Medicine (IMAT)",
  "Cambridge TMUA",
  "IB Diploma",
];

export function SearchAutocompleteInput({
  initialQuery = "",
  onSearchSubmit,
  onSelectResult,
  className = "",
}: SearchAutocompleteInputProps) {
  const locale = useLocale();
  const isTr = locale === "tr";
  const listboxId = useId();

  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<GroupedSearchResults | null>(() => emptySearchResults(initialQuery.trim()));
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search retrieval with runtime DB RPC + deterministic local fallback
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    const cleanQuery = query.trim();

    const timer = setTimeout(async () => {
      if (cleanQuery.length === 0) {
        if (!isCancelled) {
          setResults(emptySearchResults(""));
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const dbRes = await retrieveSearchResultsFromDatabase(cleanQuery, undefined, controller.signal);
        if (!isCancelled) {
          setResults(dbRes);
          setIsLoading(false);
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!isCancelled) {
          const fallbackRes = retrieveCanonicalExamFallback(cleanQuery);
          setResults(fallbackRes);
          setIsLoading(false);
        }
      }
    }, 180);

    return () => {
      isCancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  // Grouped items: Prioritize Qualifications (Sınavlar) and Universities (Üniversiteler)
  const qualificationItems = results?.groups.qualifications ?? [];
  const universityItems = results?.groups.universities ?? [];
  const countryItems = results?.groups.countries ?? [];
  const programItems = results?.groups.programs ?? [];

  // Flattened active items for keyboard navigation
  const allItems: SearchResultItem[] = [
    ...qualificationItems,
    ...universityItems,
    ...programItems,
    ...countryItems,
  ];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < allItems.length) {
        handleSelectItem(allItems[activeIndex]);
      } else {
        handleFormSubmit();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleSelectItem = (item: SearchResultItem) => {
    setQuery(item.title);
    setIsOpen(false);
    if (onSelectResult) {
      onSelectResult(item);
    } else if (onSearchSubmit) {
      onSearchSubmit(item.title);
    }
  };

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsOpen(false);
    if (onSearchSubmit) {
      onSearchSubmit(query);
    }
  };

  const exampleQueries = isTr ? EXAMPLE_QUERIES_TR : EXAMPLE_QUERIES_EN;

  return (
    <div ref={containerRef} className={`relative w-full max-w-3xl mx-auto ${className}`}>
      {/* Search Input Box */}
      <form onSubmit={handleFormSubmit} className="relative flex items-center">
        <div className="relative w-full flex items-center">
          <Search className="absolute left-4.5 size-5 text-[#819586] pointer-events-none transition-colors" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `search-item-${allItems[activeIndex]?.id}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={isTr ? "Sınav, üniversite veya hedef ülke arayın (örn: IB, Cambridge, SAT)..." : "Search exams, universities or destinations (e.g. IB, Cambridge, SAT)..."}
            className="w-full h-13 pl-12 pr-28 rounded-2xl bg-surface border border-border text-ink placeholder:text-muted-foreground text-sm md:text-base font-normal shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults(emptySearchResults(""));
                inputRef.current?.focus();
              }}
              className="absolute right-20 p-1.5 rounded-full text-muted-foreground hover:text-ink hover:bg-surface-muted transition-colors cursor-pointer"
              aria-label={isTr ? "Aramayı temizle" : "Clear search query"}
            >
              <X className="size-4" />
            </button>
          )}

          <button
            type="submit"
            className="absolute right-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs tracking-wider uppercase shadow-xs hover:opacity-90 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            {isTr ? "Ara" : "Search"}
          </button>
        </div>
      </form>

      {/* Helper Queries */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-ink/70">
          <Sparkles className="size-3 text-primary" aria-hidden="true" />
          {isTr ? "Örnek:" : "Try:"}
        </span>
        {exampleQueries.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQuery(example);
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            className="px-2 py-0.5 rounded-md bg-surface border border-border text-ink/80 hover:text-primary hover:border-primary/40 transition-colors cursor-pointer text-[11px]"
          >
            {example}
          </button>
        ))}
      </div>

      {/* Grouped Autocomplete Overlay Dropdown */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-2 w-full max-h-[70vh] overflow-y-auto rounded-2xl bg-surface border border-border shadow-xl p-2.5 divide-y divide-border/60 text-left"
        >
          {results?.sourceStatus === "local-exams" && (
            <div role="status" className="px-3 py-2 text-xs text-amber-800 bg-amber-50 rounded-xl">
              {isTr
                ? "Üniversite araması şu anda kullanılamıyor. Desteklenen sınav sonuçları gösteriliyor; yeniden deneyin."
                : "University search is temporarily unavailable. Supported exam results are shown; please retry."}
            </div>
          )}
          {/* GROUP 1: SINAVLAR / QUALIFICATIONS */}
          {qualificationItems.length > 0 && (
            <div className="py-2 first:pt-1">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold tracking-wider text-primary uppercase">
                <Award className="size-3.5" aria-hidden="true" />
                <span>{isTr ? "Sınavlar" : "Exams & Qualifications"}</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {qualificationItems.map((item) => {
                  const globalIdx = allItems.findIndex((i) => i.id === item.id);
                  const isActive = globalIdx === activeIndex;
                  return (
                    <li
                      id={`search-item-${item.id}`}
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectItem(item)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-sage-soft text-ink border border-primary/20 pl-4 font-medium"
                          : "text-ink hover:bg-surface-muted"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-sm text-ink flex items-center gap-2">
                          <span>{item.title}</span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-muted border border-border text-secondary font-mono">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* GROUP 2: ÜNİVERSİTELER / UNIVERSITIES */}
          {universityItems.length > 0 && (
            <div className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold tracking-wider text-secondary uppercase">
                <GraduationCap className="size-3.5" aria-hidden="true" />
                <span>{isTr ? "Üniversiteler" : "Universities"}</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {universityItems.map((item) => {
                  const globalIdx = allItems.findIndex((i) => i.id === item.id);
                  const isActive = globalIdx === activeIndex;
                  const verifiedUrl = item.officialUrl;

                  return (
                    <li
                      id={`search-item-${item.id}`}
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectItem(item)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-sage-soft text-ink border border-primary/20 pl-4 font-medium"
                          : "text-ink hover:bg-surface-muted"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-sm text-ink flex items-center gap-2">
                          <span>{item.title}</span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-muted border border-border text-muted-foreground font-mono">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>}
                        {!verifiedUrl && (
                          <p className="text-[11px] text-amber-700 mt-1" role="status">
                            {isTr ? "Resmî bağlantı doğrulanıyor" : "Official link is being verified"}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {verifiedUrl ? (
                          <a
                            href={verifiedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={isTr ? "Doğrulanmış Resmi Üniversite Sayfası" : "Verified Official University Website"}
                            className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <span>{isTr ? "Resmi Site" : "Official Site"}</span>
                            <ArrowUpRight className="size-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span className="hidden sm:inline-flex text-muted-foreground/50" title={isTr ? "Resmî bağlantı doğrulanıyor" : "Official link is being verified"} aria-disabled="true">
                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                          </span>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* GROUP 3: PROGRAMLAR / FIELDS */}
          {programItems.length > 0 && (
            <div className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                <BookOpen className="size-3.5" aria-hidden="true" />
                <span>{isTr ? "Bölümler & Çalışma Alanları" : "Programs & Fields"}</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {programItems.map((item) => {
                  const globalIdx = allItems.findIndex((i) => i.id === item.id);
                  const isActive = globalIdx === activeIndex;
                  return (
                    <li
                      id={`search-item-${item.id}`}
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectItem(item)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-sage-soft text-ink border border-primary/20 pl-4 font-medium"
                          : "text-ink hover:bg-surface-muted"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-sm text-ink">{item.title}</div>
                        {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* GROUP 4: ÜLKELER / DESTINATIONS */}
          {countryItems.length > 0 && (
            <div className="py-2 last:pb-1">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                <Globe className="size-3.5" aria-hidden="true" />
                <span>{isTr ? "Ülkeler & Rotalar" : "Destinations"}</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {countryItems.map((item) => {
                  const globalIdx = allItems.findIndex((i) => i.id === item.id);
                  const isActive = globalIdx === activeIndex;
                  return (
                    <li
                      id={`search-item-${item.id}`}
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectItem(item)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-sage-soft text-ink border border-primary/20 pl-4 font-medium"
                          : "text-ink hover:bg-surface-muted"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-sm text-ink">{item.title}</div>
                        {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* EMPTY STATE */}
          {allItems.length === 0 && !isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <p className="font-medium text-ink">
                {isTr ? "Sonuç bulunamadı." : "No results found."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isTr
                  ? "Aramak istediğiniz sınav adını (örn. IB, SAT, AP) veya hedef üniversiteyi yazabilirsiniz."
                  : "Try searching for an exam code (e.g. IB, SAT, AP) or target university."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
