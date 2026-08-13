"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Sparkles, X, ChevronRight, GraduationCap, Globe, BookOpen, Award } from "lucide-react";
import type { GroupedSearchResults, SearchResultItem } from "@/lib/search/retrieval-engine";
import { retrieveSearchResults } from "@/lib/search/retrieval-engine";

interface SearchAutocompleteInputProps {
  initialQuery?: string;
  onSearchSubmit?: (query: string) => void;
  onSelectResult?: (item: SearchResultItem) => void;
}

const EXAMPLE_QUERIES = [
  "Cambridge",
  "SAT",
  "Italy Medicine",
  "IB 38 Computer Science UK",
];

export function SearchAutocompleteInput({
  initialQuery = "",
  onSearchSubmit,
  onSelectResult,
}: SearchAutocompleteInputProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<GroupedSearchResults | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search retrieval
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 1) {
        const res = retrieveSearchResults(query);
        setResults(res);
      } else {
        const defaultRes = retrieveSearchResults("");
        setResults(defaultRes);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Flattened active items for keyboard navigation
  const allItems: SearchResultItem[] = results
    ? [
        ...results.groups.universities,
        ...results.groups.programs,
        ...results.groups.qualifications,
        ...results.groups.countries,
      ]
    : [];

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
      if (e.key === "ArrowDown") setIsOpen(true);
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

  return (
    <div ref={containerRef} className="relative w-full max-w-4xl mx-auto">
      {/* Search Input Box */}
      <form onSubmit={handleFormSubmit} className="relative flex items-center">
        <div className="relative w-full flex items-center">
          <Search className="absolute left-4 size-5 text-emerald-400/80 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls="autocomplete-listbox"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search universities, countries, programs or qualifications..."
            className="w-full h-14 pl-12 pr-28 rounded-2xl bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-400 text-base font-normal shadow-xl backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/80 transition-all duration-200"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults(retrieveSearchResults(""));
                inputRef.current?.focus();
              }}
              className="absolute right-24 p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Clear search query"
            >
              <X className="size-4" />
            </button>
          )}

          <button
            type="submit"
            className="absolute right-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold text-sm shadow-md transition-all duration-200 active:scale-95"
          >
            Search
          </button>
        </div>
      </form>

      {/* Subtle Example Helper Queries */}
      <div className="mt-3 flex flex-wrap items-center gap-2 px-1 text-xs text-slate-400">
        <span className="flex items-center gap-1 font-medium text-slate-400">
          <Sparkles className="size-3 text-emerald-400" />
          Try:
        </span>
        {EXAMPLE_QUERIES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQuery(example);
              onSearchSubmit?.(example);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:text-emerald-300 hover:bg-slate-800 hover:border-emerald-500/40 transition-all"
          >
            {example}
          </button>
        ))}
      </div>

      {/* Grouped Autocomplete Overlay Menu */}
      {isOpen && results && results.totalCount > 0 && (
        <div
          id="autocomplete-listbox"
          role="listbox"
          className="absolute z-50 mt-2 w-full max-h-[70vh] overflow-y-auto rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-2xl p-3 divide-y divide-slate-800/80 text-left"
        >
          {/* Group 1: UNIVERSITIES */}
          {results.groups.universities.length > 0 && (
            <div className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">
                <GraduationCap className="size-3.5" />
                Universities
              </div>
              <ul className="mt-1 space-y-1">
                {results.groups.universities.map((item) => {
                  const globalIdx = allItems.findIndex((i) => i.id === item.id);
                  const isActive = globalIdx === activeIndex;
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectItem(item)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 pl-4"
                          : "text-slate-200 hover:bg-slate-800/70 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm text-slate-100 flex items-center gap-2">
                          {item.title}
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.subtitle && <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>}
                      </div>
                      <ChevronRight className="size-4 text-slate-500 group-hover:text-slate-300" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Group 2: PROGRAMS */}
          {results.groups.programs.length > 0 && (
            <div className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold tracking-wider text-teal-400 uppercase">
                <BookOpen className="size-3.5" />
                Programs & Fields of Study
              </div>
              <ul className="mt-1 space-y-1">
                {results.groups.programs.map((item) => {
                  const globalIdx = allItems.findIndex((i) => i.id === item.id);
                  const isActive = globalIdx === activeIndex;
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectItem(item)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-teal-500/20 text-teal-200 border border-teal-500/30 pl-4"
                          : "text-slate-200 hover:bg-slate-800/70 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm text-slate-100">{item.title}</div>
                        {item.subtitle && <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>}
                      </div>
                      <ChevronRight className="size-4 text-slate-500" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Group 3: QUALIFICATIONS */}
          {results.groups.qualifications.length > 0 && (
            <div className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold tracking-wider text-amber-400 uppercase">
                <Award className="size-3.5" />
                Qualifications
              </div>
              <ul className="mt-1 space-y-1">
                {results.groups.qualifications.map((item) => {
                  const globalIdx = allItems.findIndex((i) => i.id === item.id);
                  const isActive = globalIdx === activeIndex;
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectItem(item)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-amber-500/20 text-amber-200 border border-amber-500/30 pl-4"
                          : "text-slate-200 hover:bg-slate-800/70 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm text-slate-100 flex items-center gap-2">
                          {item.title}
                          {item.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.subtitle && <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>}
                      </div>
                      <ChevronRight className="size-4 text-slate-500" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Group 4: COUNTRIES */}
          {results.groups.countries.length > 0 && (
            <div className="py-2">
              <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold tracking-wider text-sky-400 uppercase">
                <Globe className="size-3.5" />
                Countries
              </div>
              <ul className="mt-1 space-y-1">
                {results.groups.countries.map((item) => {
                  const globalIdx = allItems.findIndex((i) => i.id === item.id);
                  const isActive = globalIdx === activeIndex;
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectItem(item)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-sky-500/20 text-sky-200 border border-sky-500/30 pl-4"
                          : "text-slate-200 hover:bg-slate-800/70 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm text-slate-100">{item.title}</div>
                        {item.subtitle && <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>}
                      </div>
                      <ChevronRight className="size-4 text-slate-500" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
