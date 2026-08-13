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

  useEffect(() => {
    const storedPath = window.sessionStorage.getItem(LANGUAGE_TRANSITION_STORAGE_KEY);
    if (storedPath && cleanPath(storedPath) === cleanPath(pathname)) {
      queueMicrotask(() => setPendingPath(storedPath));
    }
  }, [pathname]);

  useEffect(() => {
    if (!active || !pendingPath || cleanPath(pathname) !== cleanPath(pendingPath)) return;
    const restore = (finalize = false) => {
      const rawPosition = window.sessionStorage.getItem(LOCALE_POSITION_KEY);
      if (rawPosition) {
        try {
          const saved = JSON.parse(rawPosition) as SavedPosition;
          const section = saved.sectionId ? document.getElementById(saved.sectionId) : null;
          const top = section ? section.getBoundingClientRect().top + window.scrollY - saved.sectionOffset : saved.scrollY;
          window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        } catch {
          // Ignore malformed session-only navigation state.
        }
      }

      const rawFormState = window.sessionStorage.getItem(LOCALE_FORM_KEY);
      if (rawFormState) {
        try {
          const values = JSON.parse(rawFormState) as Record<string, string | boolean>;
          Object.entries(values).forEach(([key, value]) => {
            const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-locale-field="${CSS.escape(key)}"]`);
            if (!element || element instanceof HTMLInputElement && element.type === "password") return;
            if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) element.checked = Boolean(value);
            else element.value = String(value);
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
          });
        } catch {
          // Form restoration is best-effort and never includes passwords.
        }
      }

      if (finalize) {
        window.sessionStorage.removeItem(LANGUAGE_TRANSITION_STORAGE_KEY);
        window.sessionStorage.removeItem(LOCALE_POSITION_KEY);
        window.sessionStorage.removeItem(LOCALE_FORM_KEY);
        setPendingPath(null);
      }
    };

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => restore(false));
      fallbackTimer.current = setTimeout(() => restore(true), 700);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, [active, pathname, pendingPath]);

  useEffect(
    () => () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    },
    [],
  );

  function beginLanguageTransition(href: string) {
    if (active || cleanPath(href) === cleanPath(pathname)) return;
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
    setPendingPath(href);

    fallbackTimer.current = setTimeout(() => {
      window.sessionStorage.removeItem(LANGUAGE_TRANSITION_STORAGE_KEY);
      setPendingPath(null);
    }, 5000);
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
