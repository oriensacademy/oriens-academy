"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, GraduationCap, Loader2, Search, X } from "lucide-react";
import type { SearchResultItem } from "@/lib/search/retrieval-engine";
import { retrieveUniversitySuggestions, UNIVERSITY_SUGGESTION_LIMIT } from "@/lib/search/university-suggestions";
import { useLocale } from "@/content/locale-context";
import { cn } from "@/lib/utils";

interface UniversitySearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Dış sarmalayıcı. */
  className?: string;
  /** Girdi kutusunun görünümü; çağıran ekranın form stiline uydurmak için. */
  fieldClassName?: string;
  /** Girdi metninin görünümü. */
  inputClassName?: string;
}

/** Hero aramasıyla aynı gecikme; yazarken sonuçlar akıcı biçimde tazelenir. */
const SEARCH_DEBOUNCE_MS = 220;

export function UniversitySearchSelect({
  value,
  onChange,
  placeholder,
  className,
  fieldClassName,
  inputClassName,
}: UniversitySearchSelectProps) {
  const locale = useLocale();
  const isTr = locale === "tr";
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [value]);

  const isDebouncing = isOpen && value !== debouncedQuery;
  const isLoading = isDebouncing || isFetching;

  // Yalnızca liste açıkken sorgu atılır; seçim yapıldıktan sonra gereksiz
  // istek oluşmaz.
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    const controller = new AbortController();
    // Hero aramasındaki gibi: effect gövdesinde senkron setState yerine
    // mikro görev, zincirleme render tetiklemez.
    queueMicrotask(() => {
      if (isSubscribed) setIsFetching(true);
    });

    retrieveUniversitySuggestions(debouncedQuery, controller.signal, UNIVERSITY_SUGGESTION_LIMIT)
      .then((suggestions) => {
        if (!isSubscribed) return;
        setItems(suggestions.items);
        setActiveIndex(0);
        setIsFetching(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!isSubscribed) return;
        setItems([]);
        setIsFetching(false);
      });

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [debouncedQuery, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedTitle = useMemo(
    () => items.find((item) => item.title === value)?.title ?? null,
    [items, value],
  );

  const handleSelect = (item: SearchResultItem) => {
    onChange(item.title);
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!isOpen) {
        setIsOpen(true);
        event.preventDefault();
        return;
      }
      if (items.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((prev) => (prev + step + items.length) % items.length);
      return;
    }
    if (event.key === "Enter" && isOpen && items[activeIndex]) {
      event.preventDefault();
      handleSelect(items[activeIndex]);
    }
  };

  const showDropdown = isOpen && (isLoading || items.length > 0 || value.trim() !== "");

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center rounded-xl border border-border bg-background px-3.5 py-2.5 shadow-xs focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
          fieldClassName,
        )}
      >
        {isLoading ? (
          <Loader2 className="mr-2 size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <Search className="mr-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <input
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            placeholder ??
            (isTr
              ? "Örn: University of Oxford, Imperial College, Bocconi..."
              : "e.g., University of Oxford, Imperial College, Bocconi...")
          }
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showDropdown && items[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-label={isTr ? "Hedef üniversite ara" : "Search target university"}
          className={cn(
            "w-full bg-transparent text-xs text-ink placeholder:text-muted-foreground/60 focus:outline-none",
            inputClassName,
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(true);
            }}
            aria-label={isTr ? "Üniversite seçimini temizle" : "Clear university selection"}
            className="ml-1 shrink-0 text-muted-foreground transition-colors hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-editorial"
        >
          {items.length > 0 ? (
            items.map((item, index) => {
              const isActive = index === activeIndex;
              const isSelected = item.title === selectedTitle;
              return (
                <button
                  key={item.id}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                    isActive ? "bg-surface-muted" : "hover:bg-surface-muted",
                  )}
                >
                  <GraduationCap className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{item.title}</span>
                    {(item.subtitle || item.countryName) && (
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {item.subtitle || item.countryName}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
                </button>
              );
            })
          ) : isLoading ? (
            <p role="status" className="px-3 py-2.5 text-[11px] text-muted-foreground">
              {isTr ? "Aranıyor…" : "Searching…"}
            </p>
          ) : (
            <p role="status" className="px-3 py-2.5 text-[11px] text-muted-foreground">
              {isTr
                ? "Eşleşen üniversite bulunamadı; yazdığınız isim kaydedilir."
                : "No matching university found; the name you typed will be saved."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default UniversitySearchSelect;
