"use client";

import { useEffect, useState } from "react";

/**
 * True once the page has scrolled past `threshold` px. Used to switch the navbar
 * from transparent-over-hero to a solid surface.
 *
 * The scroll handler is rAF-throttled: `window.scrollY` is a layout read, and
 * the listener fires far more often than once per frame on touch devices, so
 * reading it on every event made the navbar a per-event cost on every page.
 * State is only written when the boolean actually flips, so crossing the
 * threshold re-renders the navbar once instead of continuously.
 */
export function useScrolled(threshold = 80) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    let current = false;

    const evaluate = () => {
      ticking = false;
      const next = window.scrollY > threshold;
      if (next === current) return;
      current = next;
      setScrolled(next);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(evaluate);
    };

    evaluate();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
