"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CompassMark } from "./CompassMark";
import { OriensWordmark } from "./OriensWordmark";
import { LANGUAGE_TRANSITION_STORAGE_KEY } from "./LanguageTransitionProvider";
import { LoaderRevealProvider } from "./loader-context";
import { useCommonContent } from "@/content/locale-context";

const STORAGE_KEY = "oriens-loader-seen";
/** Total on-screen budget for the brand moment — MASTER.md §13: 800–1400ms. */
const TOTAL_MS = 1300;

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The Oriens compass loading sequence: geometry draws in, the needle
 * searches and settles north, the wordmark resolves beneath it, then the
 * whole thing cross-fades to reveal the page already mounted underneath.
 *
 * Never replays within a session, and is skipped entirely (no lingering
 * static frame) when the visitor prefers reduced motion — MASTER.md §13,
 * §12.
 */
export function CompassLoader({ children }: { children: React.ReactNode }) {
  const { loader } = useCommonContent();
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [skipExit, setSkipExit] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useIsomorphicLayoutEffect(() => {
    const alreadySeen = window.sessionStorage.getItem(STORAGE_KEY) === "1";
    const languageTransitionPending = !!window.sessionStorage.getItem(LANGUAGE_TRANSITION_STORAGE_KEY);

    if (alreadySeen || languageTransitionPending || prefersReducedMotion) {
      setSkipExit(true);
      setVisible(false);
      return;
    }

    document.body.style.overflow = "hidden";
    timeoutRef.current = setTimeout(() => setExiting(true), TOTAL_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [prefersReducedMotion]);

  function handleExitComplete() {
    document.body.style.overflow = "";
    window.sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  const revealed = exiting || !visible;

  return (
    <LoaderRevealProvider value={revealed}>
      <AnimatePresence onExitComplete={handleExitComplete}>
        {visible && !exiting && (
          <motion.div
            key="oriens-loader"
            className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 bg-background"
            exit={{ opacity: 0 }}
            transition={{ duration: skipExit ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            aria-label={loader.ariaLabel}
          >
            <CompassMark size={88} animated animationDelay={0.05} />
            <OriensWordmark animated layout="stacked" size="lg" delay={0.72} />
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </LoaderRevealProvider>
  );
}
