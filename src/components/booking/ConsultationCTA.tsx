"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, Calendar } from "lucide-react";
import { BorderBeamPanel } from "@/components/ui/border-beam-panel";
import { useLocale } from "@/content/locale-context";

const SESSION_STORAGE_KEY = "oriens_consultation_cta_seen_v1";
const DISPLAY_DELAY_MS = 18000;

export function ConsultationCTA() {
  const pathname = usePathname();
  const locale = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pathname) return;

    // Route exclusions: admin, booking/randevu, contact/iletisim
    const isExcluded =
      pathname.includes("/admin") ||
      pathname.includes("/randevu") ||
      pathname.includes("/booking") ||
      pathname.includes("/iletisim") ||
      pathname.includes("/contact");

    if (isExcluded) return;

    // Session storage check
    try {
      const seen = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (seen === "true") return;
    } catch {
      // Storage unavailable fallback
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, DISPLAY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [pathname]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
    } catch {
      // Storage error ignored
    }
  };

  if (!visible) return null;

  const isTr = locale === "tr";
  const bookingHref = `/${locale}#consultation-form`;

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-[360px] sm:max-w-[400px] w-[calc(100vw-3rem)] animate-in fade-in slide-in-from-bottom-5 duration-500">
      <BorderBeamPanel
        beams={2}
        colors={["#819586", "#C5B58A"]}
        thickness={2}
        radius={16}
        glow
        className="p-5 bg-white shadow-2xl rounded-2xl border border-border"
      >
        <div className="relative flex flex-col gap-3">
          {/* Close button top right */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute -top-1 -right-1 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={isTr ? "Kapat" : "Close"}
          >
            <X className="size-4" />
          </button>

          {/* Header Eyebrow & Icon */}
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center size-7 rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-4" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-ui">
              Oriens Academy
            </span>
          </div>

          {/* Heading */}
          <h4 className="text-lg font-serif font-semibold text-foreground tracking-tight leading-snug">
            {isTr
              ? "Tanışma görüşmesi planlayalım mı?"
              : "Shall we schedule an introductory meeting?"}
          </h4>

          {/* Body */}
          <p className="text-xs text-muted-foreground leading-relaxed font-sans">
            {isTr
              ? "Sorularınızı konuşmak ve size uygun çalışma yolunu değerlendirmek için kısa bir görüşme planlayabilirsiniz."
              : "Schedule a short meeting to discuss your questions and explore the most suitable study path."}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Link
              href={bookingHref}
              onClick={handleDismiss}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 text-xs font-semibold font-ui text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
            >
              {isTr ? "Görüşme Planla" : "Schedule a Meeting"}
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-2 text-xs font-medium font-ui text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {isTr ? "Şimdi değil" : "Not now"}
            </button>
          </div>
        </div>
      </BorderBeamPanel>
    </div>
  );
}

export default ConsultationCTA;
