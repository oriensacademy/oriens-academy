"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocale } from "@/content/locale-context";

const concerns = [
  { id: "start", tr: "Nereden başlamalıyım?", en: "Where should I start?", width: 330, x: 12, y: 10, rotate: -2.2 },
  { id: "exam", tr: "Hangi sınava hazırlanmalıyım?", en: "Which exam should I prepare for?", width: 390, x: 45, y: 58, rotate: 1.5 },
  { id: "study", tr: "Nasıl çalışacağım?", en: "How should I study?", width: 300, x: 20, y: 113, rotate: -1.4 },
  { id: "university", tr: "Hangi üniversite bana uygun?", en: "Which university suits my goals?", width: 430, x: 40, y: 158, rotate: 1.1 },
  { id: "programme", tr: "Programım nasıl olacak?", en: "What will my study plan look like?", width: 340, x: 25, y: 211, rotate: -1.2 },
  { id: "process", tr: "Süreç nasıl ilerliyor?", en: "How does the process work?", width: 260, x: 55, y: 252, rotate: 1.8 },
] as const;

export function MarketingBadges() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const active = concerns.find((item) => item.id === selected);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="relative mx-auto h-[355px] w-full max-w-[900px] sm:h-[370px]" data-concern-pile>
        {concerns.map((item, index) => {
          const pressed = item.id === selected;
          return (
            <motion.button
              key={item.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setSelected(pressed ? null : item.id)}
              whileHover={reducedMotion ? undefined : { y: -5, rotate: 0, scale: 1.015 }}
              animate={pressed && !reducedMotion ? { scale: 1.035, rotate: 0, y: -4 } : { scale: 1 }}
              transition={{ duration: reducedMotion ? 0 : .22 }}
              className="absolute flex min-h-[58px] max-w-[88vw] items-center justify-center rounded-full border border-[#C9D7C9] bg-white/95 px-7 text-center font-sans text-[clamp(1rem,2.2vw,1.4rem)] font-semibold tracking-[-0.02em] text-[#10271B] shadow-[0_9px_24px_rgba(16,39,27,.09)] outline-none hover:shadow-[0_15px_35px_rgba(16,39,27,.16)] focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-4 sm:min-h-[68px]"
              style={{
                width: `min(${item.width}px, 88vw)`,
                left: `${item.x}%`,
                top: item.y,
                rotate: reducedMotion || pressed ? 0 : item.rotate,
                zIndex: pressed ? 20 : index + 1,
                background: index % 3 === 1 ? "#E7E9D8" : index % 2 ? "#D8E2D8" : "#EEF2EC",
              }}
            >
              {isTr ? item.tr : item.en}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {active && (
          <motion.div key={active.id} initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -6 }} className="mx-auto mt-2 max-w-3xl rounded-2xl border border-[#DDE4DC] bg-white p-6 text-center shadow-sm sm:p-8">
            <p className="font-sans text-xl font-semibold tracking-[-0.02em] text-[#10271B]">“{isTr ? active.tr : active.en}”</p>
            <p className="mt-3 text-sm leading-7 text-[#68756C] sm:text-base">{isTr ? "Hedeflerinizi, mevcut seviyenizi ve planladığınız rotayı ücretsiz tanışma görüşmesinde birlikte netleştirebiliriz." : "We can clarify your goals, current level and intended route together during a free introductory consultation."}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @media (max-width: 639px) {
          [data-concern-pile] { height: 410px; }
          [data-concern-pile] :global(button) { transform-origin: center; }
          [data-concern-pile] :global(button:nth-child(1)) { left: 2%; top: 4px; }
          [data-concern-pile] :global(button:nth-child(2)) { left: 8%; top: 66px; }
          [data-concern-pile] :global(button:nth-child(3)) { left: 1%; top: 132px; }
          [data-concern-pile] :global(button:nth-child(4)) { left: 5%; top: 194px; }
          [data-concern-pile] :global(button:nth-child(5)) { left: 1%; top: 260px; }
          [data-concern-pile] :global(button:nth-child(6)) { left: 15%; top: 326px; }
        }
      `}</style>
    </div>
  );
}

export default MarketingBadges;
