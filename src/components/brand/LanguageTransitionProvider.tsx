"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export const LANGUAGE_TRANSITION_STORAGE_KEY = "oriens-language-transition";
const LOCALE_POSITION_KEY = "oriens-locale-position";
const LOCALE_FORM_KEY = "oriens-locale-form-state";

type SavedPosition = { sectionId: string | null; sectionOffset: number; scrollY: number };

type LanguageTransitionContextValue = {
  active: boolean;
  beginLanguageTransition: (href: string) => void;
};

const LanguageTransitionContext = createContext<LanguageTransitionContextValue | null>(null);

function cleanPath(value: string) {
  return value.replace(/\/$/, "") || "/";
}

export function LanguageTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const active = pendingPath !== null;
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priorPathnameRef = useRef(pathname);

  // Clear transition immediately whenever pathname changes
  useEffect(() => {
    if (priorPathnameRef.current !== pathname) {
      priorPathnameRef.current = pathname;
      if (fallbackTimer.current) {
        clearTimeout(fallbackTimer.current);
        fallbackTimer.current = null;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(LANGUAGE_TRANSITION_STORAGE_KEY);
        window.sessionStorage.removeItem(LOCALE_POSITION_KEY);
        window.sessionStorage.removeItem(LOCALE_FORM_KEY);
      }
      setPendingPath(null);
    }
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, []);

  function beginLanguageTransition(href: string) {
    if (cleanPath(href) === cleanPath(pathname)) return;

    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current);
    }

    try {
      const viewportAnchor = window.innerHeight * 0.42;
      const sections = Array.from(document.querySelectorAll<HTMLElement>("main section[id], footer[id]"));
      const currentSection = sections
        .map((section) => ({ section, rect: section.getBoundingClientRect() }))
        .filter(({ rect }) => rect.top <= viewportAnchor && rect.bottom >= viewportAnchor)
        .sort((a, b) => Math.abs(a.rect.top - viewportAnchor) - Math.abs(b.rect.top - viewportAnchor))[0];
      const position: SavedPosition = {
        sectionId: currentSection?.section.id || null,
        sectionOffset: currentSection ? currentSection.rect.top : 0,
        scrollY: window.scrollY,
      };
      window.sessionStorage.setItem(LOCALE_POSITION_KEY, JSON.stringify(position));

      const formState: Record<string, string | boolean> = {};
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-locale-field]").forEach((element) => {
        if (element instanceof HTMLInputElement && element.type === "password") return;
        const key = element.dataset.localeField;
        if (!key) return;
        formState[key] = element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio") ? element.checked : element.value;
      });
      window.sessionStorage.setItem(LOCALE_FORM_KEY, JSON.stringify(formState));
      window.sessionStorage.setItem(LANGUAGE_TRANSITION_STORAGE_KEY, href);
    } catch {
      // Safe fallback if sessionStorage is restricted
    }

    setPendingPath(href);

    // Responsive fail-safe: automatically dismiss spinner after 450ms max
    fallbackTimer.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(LANGUAGE_TRANSITION_STORAGE_KEY);
      }
      setPendingPath(null);
    }, 450);
  }

  return (
    <LanguageTransitionContext.Provider value={{ active, beginLanguageTransition }}>
      {children}
    </LanguageTransitionContext.Provider>
  );
}

export function useLanguageTransition() {
  const context = useContext(LanguageTransitionContext);
  if (!context) throw new Error("useLanguageTransition must be used within LanguageTransitionProvider");
  return context;
}
