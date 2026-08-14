"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocale } from "@/content/locale-context";

const concerns = [
  {
    id: "start",
    tr: "Nereden başlamalıyım?",
    en: "Where should I start?",
    answerTr: "Mevcut seviyenizi, hedef ülke/üniversiteyi ve zaman planınızı birlikte değerlendirerek ilk adımı belirliyoruz.",
    answerEn: "We assess your current level, target country or university, and timeline together to define your first step.",
    width: 330, x: 12, y: 10, rotate: -2.2,
  },
  {
    id: "exam",
    tr: "Hangi sınava hazırlanmalıyım?",
    en: "Which exam should I prepare for?",
    answerTr: "Hedeflediğiniz ülke, üniversite, bölüm ve başvuru dönemine göre hangi sınavların gerekli veya uygun olduğunu birlikte netleştiriyoruz.",
    answerEn: "We work out which exams are required or suitable for you based on your target country, university, programme and application cycle.",
    width: 390, x: 45, y: 58, rotate: 1.5,
  },
  {
    id: "study",
    tr: "Nasıl çalışacağım?",
    en: "How should I study?",
    answerTr: "Seviyenize ve sınav tarihine göre konu çalışması, soru pratiği, zaman yönetimi ve deneme analizini içeren kişisel bir çalışma düzeni oluşturuyoruz.",
    answerEn: "We build a personal study plan around your level and exam date, covering topic study, practice questions, time management and mock analysis.",
    width: 300, x: 20, y: 113, rotate: -1.4,
  },
  {
    id: "university",
    tr: "Hangi üniversite bana uygun?",
    en: "Which university suits my goals?",
    answerTr: "Akademik profiliniz, hedef bölümünüz, ülke tercihiniz ve sınav sonuçlarınız doğrultusunda değerlendirebileceğiniz üniversite rotalarını birlikte inceliyoruz.",
    answerEn: "We review the university routes worth considering based on your academic profile, target programme, country preference and exam results.",
    width: 430, x: 40, y: 158, rotate: 1.1,
  },
  {
    id: "programme",
    tr: "Programım nasıl olacak?",
    en: "What will my study plan look like?",
    answerTr: "Ders sıklığı ve çalışma planı; mevcut seviyeniz, sınav tarihi, okul programınız ve ihtiyaç duyduğunuz konulara göre kişiselleştirilir.",
    answerEn: "Lesson frequency and your study plan are personalised around your current level, exam date, school schedule and the topics you need most.",
    width: 340, x: 25, y: 211, rotate: -1.2,
  },
  {
    id: "process",
    tr: "Süreç nasıl ilerliyor?",
    en: "How does the process work?",
    answerTr: "Tanışma ve hedef analizinin ardından çalışma planı oluşturulur; dersler, geri bildirimler ve ilerleme değerlendirmeleriyle süreç düzenli olarak güncellenir.",
    answerEn: "After an introductory session and goal analysis, we build your study plan; lessons, feedback and progress reviews keep it updated throughout.",
    width: 260, x: 55, y: 252, rotate: 1.8,
  },
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
            <p className="font-sans text-xl font-semibold tracking-[-0.02em] text-[#10271B]">&ldquo;{isTr ? active.tr : active.en}&rdquo;</p>
            <p className="mt-3 text-sm leading-7 text-[#68756C] sm:text-base">{isTr ? active.answerTr : active.answerEn}</p>
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
