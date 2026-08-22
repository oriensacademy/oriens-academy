"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Search, Loader2, Info, X, GraduationCap, BookOpen, Award, Globe, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/content/locale-context";
import { cn } from "@/lib/utils";

export type SearchResultType = "UNIVERSITY" | "PROGRAM" | "COUNTRY" | "QUALIFICATION";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  slug: string;
  score: number;
  badge?: string;
  countryIso2?: string;
  countryName?: string;
  officialUrl?: string;
}

export interface GroupedSearchResults {
  query: string;
  intent: string;
  confidence: number;
  groups: {
    universities: SearchResultItem[];
    programs: SearchResultItem[];
    countries: SearchResultItem[];
    qualifications: SearchResultItem[];
  };
  totalCount: number;
}

const ROTATING_EXAMS_TR = [
  "Oxford ara...",
  "Cambridge ara...",
  "SAT ara...",
  "IB Diploma ara...",
  "Imperial College London ara...",
  "University College London ara...",
  "İtalya Tıp ara...",
];
const ROTATING_EXAMS_EN = [
  "Search Oxford...",
  "Search Cambridge...",
  "Search SAT...",
  "Search IB Diploma...",
  "Search Imperial College...",
  "Search UCL...",
  "Search Medicine in Italy...",
];

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function GooeySearchBar() {
  const router = useRouter();
  const locale = useLocale();
  const currentLocale = (locale === "tr" ? "tr" : "en") as "tr" | "en";
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const [isOpen, setIsOpen] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const [searchResults, setSearchResults] = useState<GroupedSearchResults | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);

  const debouncedSearchText = useDebounce(searchText, 250);
  const hasSearchText = searchText.trim() !== "";
  const isLoading = hasSearchText && (searchText !== debouncedSearchText || isFetching);
  const visibleSearchResults = hasSearchText ? searchResults : null;
  const visibleIsError = hasSearchText && isError;

  const rotatingPlaceholders = currentLocale === "tr" ? ROTATING_EXAMS_TR : ROTATING_EXAMS_EN;

  useEffect(() => {
    if (isFocused || searchText.trim() !== "" || prefersReducedMotion) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % rotatingPlaceholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isFocused, searchText, prefersReducedMotion, rotatingPlaceholders.length]);

  const currentPlaceholder =
    rotatingPlaceholders[placeholderIndex] || (currentLocale === "tr" ? "Üniversite veya sınav ara..." : "Search universities or exams...");

  // Fetch API results with AbortController for race condition safety
  useEffect(() => {
    const query = debouncedSearchText.trim();
    if (!query) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsFetching(true);
        setIsError(false);
      }
    });

    fetch(`/api/search/autocomplete?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Search API HTTP Error");
        const data: GroupedSearchResults = await res.json();
        setSearchResults(data);
        setIsFetching(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("[Search UI Error]:", err);
          setSearchResults(null);
          setIsError(true);
          setIsFetching(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedSearchText]);

  // Flatten items across groups for keyboard navigation
  const allItems = useMemo(() => {
    if (!visibleSearchResults) return [];
    return [
      ...visibleSearchResults.groups.universities,
      ...visibleSearchResults.groups.programs,
      ...visibleSearchResults.groups.qualifications,
      ...visibleSearchResults.groups.countries,
    ];
  }, [visibleSearchResults]);

  const handleOpen = () => {
    setIsOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleClose = () => {
    setIsOpen(true);
    setSearchText("");
    setSearchResults(null);
    setSelectedIndex(0);
    setIsFocused(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getTargetHref = (item: SearchResultItem): string => {
    const prefix = currentLocale === "tr" ? "/tr" : "/en";
    if (item.type === "QUALIFICATION") {
      return `${prefix}/sinavlar/${item.slug}`;
    }
    if (item.type === "UNIVERSITY") {
      return `${prefix}/universite-destegi?uni=${encodeURIComponent(item.slug)}`;
    }
    return `${prefix}/universite-destegi`;
  };

  const handleSelectItem = (item: SearchResultItem) => {
    const href = getTargetHref(item);
    router.push(href);
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (allItems.length || 1)) % (allItems.length || 1));
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      e.preventDefault();
      handleSelectItem(allItems[selectedIndex]);
    }
  };

  const isTr = currentLocale === "tr";
  const buttonText = isTr ? "Ara" : "Search";

  return (
    <div ref={containerRef} className="relative z-30 w-full max-w-[620px] font-sans" onKeyDown={handleKeyDown}>
      {!isOpen ? (
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-border text-[#25382D] hover:bg-sage-soft/50 transition-all duration-200 shadow-[0_2px_8px_rgba(16,39,27,0.04)] focus:outline-hidden focus:ring-2 focus:ring-primary/30 text-xs font-ui font-medium cursor-pointer"
          aria-label={buttonText}
        >
          <Search className="size-3.5 text-[#819586] shrink-0" />
          <div className="relative overflow-hidden h-4 w-28 text-left">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentPlaceholder}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 truncate text-xs text-[#7D8A81] font-sans"
              >
                {currentPlaceholder}
              </motion.span>
            </AnimatePresence>
          </div>
        </button>
      ) : (
        <div className="relative">
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex h-14 w-full items-center gap-3 rounded-2xl border border-[#C7D2C8] bg-white px-4 shadow-[0_8px_28px_rgba(16,39,27,0.08)] transition-shadow focus-within:border-[#819586] focus-within:ring-2 focus-within:ring-[#819586]/20"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin text-primary shrink-0" />
            ) : (
              <Search className="size-4 text-foreground shrink-0" />
            )}

            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onFocus={() => setIsFocused(true)}
              onChange={(e) => {
                setSearchText(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder={currentPlaceholder}
              aria-label={isTr ? "Üniversite, ülke veya sınav ara" : "Search universities, countries or exams"}
              role="combobox"
              aria-expanded={debouncedSearchText.trim().length > 0}
              aria-controls="academic-search-results"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden font-sans sm:text-base"
            />

            {searchText && (
              <button
                type="button"
                onClick={handleClose}
                className="p-1 text-muted-foreground hover:text-foreground rounded-full transition-colors cursor-pointer"
                aria-label={isTr ? "Aramayı temizle" : "Clear search"}
              >
                <X className="size-3.5" />
              </button>
            )}
          </motion.div>

          {/* Results Dropdown */}
          <AnimatePresence>
            {isOpen && debouncedSearchText.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                id="academic-search-results"
                className="absolute inset-x-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-xl divide-y divide-border/60"
              >
                {visibleIsError ? (
                  <div className="p-4 text-center text-xs text-amber-600 flex flex-col items-center gap-1.5 font-sans">
                    <Info className="size-4 text-amber-500" />
                    <span>{isTr ? "Arama geçici olarak kullanılamıyor." : "Search is temporarily unavailable."}</span>
                  </div>
                ) : visibleSearchResults && visibleSearchResults.totalCount > 0 ? (
                  <div className="space-y-3">
                    {/* UNIVERSITIES */}
                    {visibleSearchResults.groups.universities.length > 0 && (
                      <div className="py-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">
                          <GraduationCap className="size-3.5" />
                          {isTr ? "Üniversiteler" : "Universities"}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {visibleSearchResults.groups.universities.map((item) => {
                            const globalIdx = allItems.findIndex((i) => i.id === item.id);
                            const isActive = globalIdx === selectedIndex;
                            return (
                              <li
                                key={item.id}
                                role="option"
                                aria-selected={isActive}
                                onClick={() => handleSelectItem(item)}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors block text-left",
                                  isActive ? "bg-muted border-l-2 border-primary" : "hover:bg-muted/50"
                                )}
                              >
                                <div>
                                  <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                                    {item.title}
                                    {item.badge && (
                                      <span className="text-[10px] uppercase font-semibold text-primary-foreground bg-primary px-1.5 py-0.5 rounded">
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                  {item.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle}</p>}
                                </div>
                                <ChevronRight className="size-4 text-muted-foreground" />
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* QUALIFICATIONS */}
                    {visibleSearchResults.groups.qualifications.length > 0 && (
                      <div className="py-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-amber-700 dark:text-amber-400 uppercase">
                          <Award className="size-3.5" />
                          {isTr ? "Sınavlar ve Yeterlilikler" : "Qualifications & Exams"}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {visibleSearchResults.groups.qualifications.map((item) => {
                            const globalIdx = allItems.findIndex((i) => i.id === item.id);
                            const isActive = globalIdx === selectedIndex;
                            return (
                              <li
                                key={item.id}
                                role="option"
                                aria-selected={isActive}
                                onClick={() => handleSelectItem(item)}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors block text-left",
                                  isActive ? "bg-muted border-l-2 border-amber-500" : "hover:bg-muted/50"
                                )}
                              >
                                <div>
                                  <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                                    {item.title}
                                    {item.badge && (
                                      <span className="text-[10px] font-mono font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                  {item.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle}</p>}
                                </div>
                                <ChevronRight className="size-4 text-muted-foreground" />
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* COUNTRIES */}
                    {visibleSearchResults.groups.countries.length > 0 && (
                      <div className="py-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-sky-700 dark:text-sky-400 uppercase">
                          <Globe className="size-3.5" />
                          {isTr ? "Ülkeler" : "Countries"}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {visibleSearchResults.groups.countries.map((item) => {
                            const globalIdx = allItems.findIndex((i) => i.id === item.id);
                            const isActive = globalIdx === selectedIndex;
                            return (
                              <li
                                key={item.id}
                                role="option"
                                aria-selected={isActive}
                                onClick={() => handleSelectItem(item)}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors block text-left",
                                  isActive ? "bg-muted border-l-2 border-sky-500" : "hover:bg-muted/50"
                                )}
                              >
                                <div>
                                  <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                                    {item.title}
                                    {item.countryIso2 && (
                                      <span className="text-[10px] font-mono uppercase bg-sky-500/10 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded">
                                        {item.countryIso2}
                                      </span>
                                    )}
                                  </div>
                                  {item.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle}</p>}
                                </div>
                                <ChevronRight className="size-4 text-muted-foreground" />
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* PROGRAMS */}
                    {visibleSearchResults.groups.programs.length > 0 && (
                      <div className="py-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-teal-700 dark:text-teal-400 uppercase">
                          <BookOpen className="size-3.5" />
                          {isTr ? "Programlar & Alanlar" : "Programs & Fields"}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {visibleSearchResults.groups.programs.map((item) => {
                            const globalIdx = allItems.findIndex((i) => i.id === item.id);
                            const isActive = globalIdx === selectedIndex;
                            return (
                              <li
                                key={item.id}
                                role="option"
                                aria-selected={isActive}
                                onClick={() => handleSelectItem(item)}
                                className={cn(
                                  "flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors block text-left",
                                  isActive ? "bg-muted border-l-2 border-teal-500" : "hover:bg-muted/50"
                                )}
                              >
                                <div>
                                  <div className="text-xs font-semibold text-foreground">{item.title}</div>
                                  {item.subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle}</p>}
                                </div>
                                <ChevronRight className="size-4 text-muted-foreground" />
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-1 font-sans">
                    <Info className="size-4 text-muted-foreground" />
                    <span>{isTr ? "Sonuç bulunamadı." : "No matching results found."}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default GooeySearchBar;
