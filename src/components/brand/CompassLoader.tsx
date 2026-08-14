"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Wave } from "@/components/ui/wave";
import { LANGUAGE_TRANSITION_STORAGE_KEY } from "./LanguageTransitionProvider";
import { LoaderRevealProvider } from "./loader-context";

const STORAGE_KEY = "oriens-loader-seen";
/** Total on-screen budget for the brand moment — MASTER.md §13: 800–1400ms. */
const TOTAL_MS = 720;

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
  // Render the initial cover in the server output. Deciding to show it in an
  // effect caused the reported PAGE -> LOADER -> PAGE flash.
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [skipExit, setSkipExit] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const alreadySeen = window.sessionStorage.getItem(STORAGE_KEY) === "1";
    const languageTransitionPending = !!window.sessionStorage.getItem(LANGUAGE_TRANSITION_STORAGE_KEY);

    if (alreadySeen || languageTransitionPending || prefersReducedMotion) {
      queueMicrotask(() => {
        setSkipExit(true);
        setVisible(false);
      });
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    timeoutRef.current = setTimeout(() => setExiting(true), TOTAL_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.body.style.overflow = previousOverflow;
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
            data-initial-loader
            className="fixed inset-0 z-100 flex items-center justify-center bg-background"
            exit={{ opacity: 0 }}
            transition={{ duration: skipExit ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            aria-label="Oriens Academy loading"
          >
            <Wave className="h-6 w-16 text-[#819586]" aria-label="Oriens Academy loading" />
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </LoaderRevealProvider>
  );
}
