"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale } from "@/content/locale-context";
import { cn } from "@/lib/utils";

const concerns = [
  {
    id: "start",
    tr: "Nereden başlamalıyım?",
    en: "Where should I start?",
    answerTr: "Mevcut seviyenizi, hedef ülke/üniversiteyi ve zaman planınızı birlikte değerlendirerek ilk adımı belirliyoruz.",
    answerEn: "We assess your current level, target country or university, and timeline together to define your first step.",
    dWidth: 330, dX: 12, dY: 10, dRotate: -2.2,
    mY: 0, mNudge: -8, mRotate: -1.8,
  },
  {
    id: "exam",
    tr: "Hangi sınava hazırlanmalıyım?",
    en: "Which exam should I prepare for?",
    answerTr: "Hedeflediğiniz ülke, üniversite, bölüm ve başvuru dönemine göre hangi sınavların gerekli veya uygun olduğunu birlikte netleştiriyoruz.",
    answerEn: "We work out which exams are required or suitable for you based on your target country, university, programme and application cycle.",
    dWidth: 390, dX: 45, dY: 58, dRotate: 1.5,
    mY: 52, mNudge: 10, mRotate: 1.6,
  },
  {
    id: "study",
    tr: "Nasıl çalışacağım?",
    en: "How should I study?",
    answerTr: "Seviyenize ve sınav tarihine göre konu çalışması, soru pratiği, zaman yönetimi ve deneme analizini içeren kişisel bir çalışma düzeni oluşturuyoruz.",
    answerEn: "We build a personal study plan around your level and exam date, covering topic study, practice questions, time management and mock analysis.",
    dWidth: 300, dX: 20, dY: 113, dRotate: -1.4,
    mY: 104, mNudge: -10, mRotate: -1.5,
  },
  {
    id: "university",
    tr: "Hangi üniversite bana uygun?",
    en: "Which university suits my goals?",
    answerTr: "Akademik profiliniz, hedef bölümünüz, ülke tercihiniz ve sınav sonuçlarınız doğrultusunda değerlendirebileceğiniz üniversite rotalarını birlikte inceliyoruz.",
    answerEn: "We review the university routes worth considering based on your academic profile, target programme, country preference and exam results.",
    dWidth: 430, dX: 40, dY: 158, dRotate: 1.1,
    mY: 156, mNudge: 8, mRotate: 1.4,
  },
  {
    id: "programme",
    tr: "Programım nasıl olacak?",
    en: "What will my study plan look like?",
    answerTr: "Ders sıklığı ve çalışma planı; mevcut seviyeniz, sınav tarihi, okul programınız ve ihtiyaç duyduğunuz konulara göre kişiselleştirilir.",
    answerEn: "Lesson frequency and your study plan are personalised around your current level, exam date, school schedule and the topics you need most.",
    dWidth: 340, dX: 25, dY: 211, dRotate: -1.2,
    mY: 208, mNudge: -6, mRotate: -1.4,
  },
  {
    id: "process",
    tr: "Süreç nasıl ilerliyor?",
    en: "How does the process work?",
    answerTr: "Tanışma ve hedef analizinin ardından çalışma planı oluşturulur; dersler, geri bildirimler ve ilerleme değerlendirmeleriyle süreç düzenli olarak güncellenir.",
    answerEn: "After an introductory session and goal analysis, we build your study plan; lessons, feedback and progress reviews keep it updated throughout.",
    dWidth: 260, dX: 55, dY: 252, dRotate: 1.8,
    mY: 260, mNudge: 8, mRotate: 1.8,
  },
] as const;

export function MarketingBadges() {
  const locale = useLocale();
  const isTr = locale === "tr";
  const [selected, setSelected] = useState<string | null>(null);
  const active = concerns.find((item) => item.id === selected);

  return (
    <div className="mx-auto w-full max-w-5xl px-3 sm:px-6">
      {/* Mobile view (< 768px): Centered, staggered tactile badge stack - 100% responsive, zero clipping */}
      <div className="flex flex-col items-center -space-y-2.5 w-full max-w-[420px] mx-auto md:hidden py-2 px-2">
        {concerns.map((item, index) => {
          const pressed = item.id === selected;
          const rotateClass =
            index === 0
              ? "-rotate-[1.6deg]"
              : index === 1
                ? "rotate-[1.8deg]"
                : index === 2
                  ? "-rotate-[1.2deg]"
                  : index === 3
                    ? "rotate-[1.5deg]"
                    : index === 4
                      ? "-rotate-[1.4deg]"
                      : "rotate-[1.6deg]";
          const nudgeClass =
            index % 2 === 0 ? "-translate-x-2" : "translate-x-2";

          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setSelected(pressed ? null : item.id)}
              className={cn(
                "group relative flex min-h-[46px] w-auto max-w-full items-center justify-center rounded-full border border-[#C5D2C5] px-5 py-2.5 text-center font-sans text-xs sm:text-sm font-semibold tracking-tight text-[#10271B] shadow-[0_4px_14px_rgba(16,39,27,0.07)] transition-all duration-200 outline-none select-none cursor-pointer active:scale-95",
                pressed
                  ? "!rotate-0 !translate-x-0 scale-[1.04] ring-2 ring-primary/40 !border-primary z-30 shadow-[0_10px_25px_rgba(16,39,27,0.15)]"
                  : cn(rotateClass, nudgeClass, "hover:scale-[1.02] hover:z-20")
              )}
              style={{
                zIndex: pressed ? 30 : index + 1,
                background: index % 3 === 1 ? "#E7E9D8" : index % 2 ? "#D8E2D8" : "#EEF2EC",
              }}
            >
              <span className="whitespace-nowrap">
                {isTr ? item.tr : item.en}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop view (>= 768px): Scattered wide editorial pile */}
      <div className="hidden md:block relative h-[370px] w-full max-w-[900px] mx-auto">
        {concerns.map((item, index) => {
          const pressed = item.id === selected;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setSelected(pressed ? null : item.id)}
              className={cn(
                "absolute flex min-h-[68px] items-center justify-center rounded-full border border-[#C9D7C9] px-7 py-3 text-center font-sans text-[clamp(1rem,2.2vw,1.4rem)] font-semibold tracking-[-0.02em] text-[#10271B] shadow-[0_9px_24px_rgba(16,39,27,.09)] outline-none hover:shadow-[0_15px_35px_rgba(16,39,27,.16)] focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-4 select-none cursor-pointer transition-all duration-200",
                pressed
                  ? "!rotate-0 scale-105 ring-2 ring-primary/40 !border-primary z-30 shadow-[0_15px_35px_rgba(16,39,27,.2)]"
                  : "hover:-translate-y-1 hover:scale-[1.015]"
              )}
              style={{
                left: `${item.dX}%`,
                top: `${item.dY}px`,
                width: `min(${item.dWidth}px, 88vw)`,
                transform: pressed ? "rotate(0deg) scale(1.05)" : `rotate(${item.dRotate}deg)`,
                zIndex: pressed ? 30 : index + 1,
                background: index % 3 === 1 ? "#E7E9D8" : index % 2 ? "#D8E2D8" : "#EEF2EC",
              }}
            >
              {isTr ? item.tr : item.en}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-4 max-w-2xl rounded-2xl border border-[#DDE4DC] bg-white p-5 text-center shadow-sm sm:p-7"
          >
            <p className="font-sans text-lg sm:text-xl font-semibold tracking-[-0.02em] text-[#10271B]">
              &ldquo;{isTr ? active.tr : active.en}&rdquo;
            </p>
            <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#68756C]">
              {isTr ? active.answerTr : active.answerEn}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MarketingBadges;
