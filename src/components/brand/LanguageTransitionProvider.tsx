"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useCommonContent } from "@/content/locale-context";
import { CompassMark } from "./CompassMark";
import { OriensWordmark } from "./OriensWordmark";

export const LANGUAGE_TRANSITION_STORAGE_KEY = "oriens-language-transition";

type LanguageTransitionContextValue = {
  active: boolean;
  beginLanguageTransition: (href: string) => void;
};

const LanguageTransitionContext = createContext<LanguageTransitionContextValue | null>(null);
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function cleanPath(value: string) {
  return value.replace(/\/$/, "") || "/";
}

export function LanguageTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const reducedMotion = useReducedMotion();
  const { nav } = useCommonContent();
  const [active, setActive] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useIsomorphicLayoutEffect(() => {
    const storedPath = window.sessionStorage.getItem(LANGUAGE_TRANSITION_STORAGE_KEY);
    if (storedPath && cleanPath(storedPath) === cleanPath(pathname)) {
      setPendingPath(storedPath);
      setActive(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!active || !pendingPath || cleanPath(pathname) !== cleanPath(pendingPath)) return;

    exitTimer.current = setTimeout(() => {
      window.sessionStorage.removeItem(LANGUAGE_TRANSITION_STORAGE_KEY);
      setActive(false);
      setPendingPath(null);
    }, reducedMotion ? 70 : 130);

    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [active, pathname, pendingPath, reducedMotion]);

  useEffect(() => {
    document.body.style.overflow = active ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  useEffect(() => {
    return () => {
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  function beginLanguageTransition(href: string) {
    if (active || cleanPath(href) === cleanPath(pathname)) return;
    window.sessionStorage.setItem(LANGUAGE_TRANSITION_STORAGE_KEY, href);
    setPendingPath(href);
    setActive(true);

    navigationTimer.current = setTimeout(() => {
      router.push(href);
    }, reducedMotion ? 110 : 520);
  }

  return (
    <LanguageTransitionContext.Provider value={{ active, beginLanguageTransition }}>
      {children}
      <AnimatePresence>
        {active && (
          <motion.div
            key="language-transition"
            className="fixed inset-0 z-150 flex flex-col items-center justify-center gap-5 bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.1 : 0.14, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            aria-live="polite"
            aria-label={nav.languageTransitionLabel}
          >
            <CompassMark size={76} animated={!reducedMotion} needleSequence={[0, 38, -16, 5, 0]} animationDelay={0.02} />
            <OriensWordmark animated={!reducedMotion} layout="stacked" size="lg" delay={0.28} />
          </motion.div>
        )}
      </AnimatePresence>
    </LanguageTransitionContext.Provider>
  );
}

export function useLanguageTransition() {
  const context = useContext(LanguageTransitionContext);
  if (!context) throw new Error("useLanguageTransition must be used within LanguageTransitionProvider");
  return context;
}
