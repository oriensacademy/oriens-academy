"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Sparkles,
  BookOpen,
  Target,
  Award,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale } from "@/content/locale-context";
import { cn } from "@/lib/utils";

export interface PhoneCarouselProps {
  autoPlayInterval?: number;
  className?: string;
}

export function PhoneCarousel({
  autoPlayInterval = 5000,
  className,
}: PhoneCarouselProps) {
  const locale = useLocale();
  const isTr = locale === "tr";
  const slideCount = 3;
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inViewport, setInViewport] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry.isIntersecting),
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (slideCount < 2 || !inViewport || !tabVisible) return;

    const timer = window.setTimeout(() => {
      setCurrentIndex((previousIndex) => (previousIndex + 1) % slideCount);
    }, autoPlayInterval);

    return () => window.clearTimeout(timer);
  }, [autoPlayInterval, currentIndex, slideCount, inViewport, tabVisible]);

  const handleManualNext = () => {
    setCurrentIndex((previousIndex) => (previousIndex + 1) % slideCount);
  };

  const handleManualPrev = () => {
    setCurrentIndex((previousIndex) => (previousIndex - 1 + slideCount) % slideCount);
  };

  return (
    <div
      ref={containerRef}
      data-phone-carousel
      data-slide-count={slideCount}
      data-active-slide={currentIndex + 1}
      data-autoplay-interval={autoPlayInterval}
      className={cn(
        "mx-auto flex w-full max-w-4xl select-none flex-col items-center gap-5 py-4",
        className,
      )}
    >
      <div className="relative flex w-full items-center justify-center px-4">
        <motion.div
          className="relative h-[520px] w-[280px] touch-pan-y rounded-[48px] border-4 border-[#0D2A1C] bg-[#10271B] p-3 shadow-[0_24px_60px_rgba(16,39,27,0.16)] ring-1 ring-[#819586]/30 transition-all duration-300 sm:h-[577px] sm:w-[310px] lg:h-[650px] lg:w-[340px]"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.x < -45) handleManualNext();
            if (info.offset.x > 45) handleManualPrev();
          }}
        >
          {/* Dynamic Island / Speaker Pill */}
          <div className="absolute top-5 left-1/2 z-20 flex h-5 w-28 -translate-x-1/2 items-center justify-center rounded-full bg-[#0D2A1C]">
            <div className="mr-2 size-3 rounded-full border border-[#819586]/40 bg-[#10271B]" />
            <div className="size-2 rounded-full bg-[#25382D]" />
          </div>

          <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-[#0E2419] shadow-inner">
            <AnimatePresence mode="wait">
              {currentIndex === 0 && (
                <motion.div
                  key="slide-exam-prep"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-[#132C1E] to-[#0A1A12] p-5 pt-14 text-white sm:p-6 sm:pt-16"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 rounded-full bg-[#819586]/20 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-[#A2B8A8] uppercase">
                        <Target className="size-3 text-[#A2B8A8]" />
                        {isTr ? "Sınav Hazırlığı" : "Exam Prep"}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-white/60">
                        <Sparkles className="size-3 text-[#D6B56D]" />
                        {isTr ? "1-e-1 Özel" : "1-on-1"}
                      </span>
                    </div>

                    <h3 className="mt-3 font-heading text-2xl font-normal text-white sm:text-3xl">
                      {isTr ? "Hedef Odaklı Hazırlık" : "Target-Driven Prep"}
                    </h3>
                    <p className="mt-1 text-xs text-white/70">
                      {isTr ? "Sınav formatına özel soru çözüm teknikleri" : "Exam-specific problem-solving mastery"}
                    </p>

                    <div className="mt-4 space-y-2.5">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs transition-colors hover:bg-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-[#819586]/30 text-xs font-bold text-white">
                              IB
                            </span>
                            <div>
                              <p className="text-xs font-bold text-white">Math AA & Physics HL</p>
                              <p className="text-[10px] text-white/60">{isTr ? "İç Değerlendirme & Soru Analizi" : "IA Strategy & Past Papers"}</p>
                            </div>
                          </div>
                          <span className="rounded-md bg-[#819586]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#A2B8A8]">
                            7 / 7
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs transition-colors hover:bg-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-[#D6B56D]/30 text-xs font-bold text-[#F4E7C5]">
                              SAT
                            </span>
                            <div>
                              <p className="text-xs font-bold text-white">Digital SAT · Math & RW</p>
                              <p className="text-[10px] text-white/60">{isTr ? "Modül & Zaman Yönetimi" : "Module & Time Management"}</p>
                            </div>
                          </div>
                          <span className="rounded-md bg-[#D6B56D]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#F4E7C5]">
                            1540+
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs transition-colors hover:bg-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-[#819586]/30 text-xs font-bold text-white">
                              AP
                            </span>
                            <div>
                              <p className="text-xs font-bold text-white">Calculus BC & Physics C</p>
                              <p className="text-[10px] text-white/60">{isTr ? "Üniversite Kredi Yeterliliği" : "University Credit Mastery"}</p>
                            </div>
                          </div>
                          <span className="rounded-md bg-[#819586]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#A2B8A8]">
                            5 / 5
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                    <p className="text-[11px] font-semibold text-[#D6B56D]">
                      {isTr ? "Birebir Soru Analizi & Düzenli Takip" : "1-on-1 Practice & Structured Progress"}
                    </p>
                  </div>
                </motion.div>
              )}

              {currentIndex === 1 && (
                <motion.div
                  key="slide-student-portal"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-[#102B1D] to-[#08180F] p-5 pt-14 text-white sm:p-6 sm:pt-16"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 rounded-full bg-[#D6B56D]/20 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-[#F4E7C5] uppercase">
                        <Calendar className="size-3 text-[#D6B56D]" />
                        {isTr ? "Öğrenci Portalı" : "Student Portal"}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {isTr ? "Aktif Dönem" : "Active Term"}
                      </span>
                    </div>

                    <h3 className="mt-3 font-heading text-2xl font-normal text-white sm:text-3xl">
                      {isTr ? "Ders & İlerleme" : "Lessons & Progress"}
                    </h3>
                    <p className="mt-1 text-xs text-white/70">
                      {isTr ? "Planlanan dersler, ödevler ve paket durumu" : "Scheduled lessons, assignments & credits"}
                    </p>

                    <div className="mt-4 space-y-2.5">
                      {/* Upcoming Lesson */}
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
                        <div className="flex items-center justify-between text-[11px] text-white/60">
                          <span className="flex items-center gap-1 font-semibold text-[#D6B56D]">
                            <Clock className="size-3" />
                            {isTr ? "Yarın · 18:30" : "Tomorrow · 18:30"}
                          </span>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase font-bold text-white/80">
                            {isTr ? "Canlı Birebir" : "Live 1-on-1"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs font-bold text-white">Calculus & University Physics</p>
                        <p className="text-[10px] text-white/60">{isTr ? "Eğitmen: Doğuhan" : "Tutor: Doğuhan"}</p>
                      </div>

                      {/* Homework status */}
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                              <CheckCircle2 className="size-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{isTr ? "Zamanlı Deneme 4" : "Timed Mock Exam 4"}</p>
                              <p className="text-[10px] text-white/60">{isTr ? "İncelendi · Not: 92/100" : "Reviewed · Score: 92/100"}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Package Meter */}
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white/80">{isTr ? "10 Derslik Paket" : "10-Lesson Package"}</span>
                          <span className="font-bold text-[#D6B56D]">8 / 10 {isTr ? "Ders" : "Lessons"}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-[#D6B56D]" style={{ width: "80%" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                    <p className="text-[11px] font-semibold text-white/80">
                      {isTr ? "Ders takvimi ve gelişim raporu her an elinizin altında" : "Lesson schedule & reports always at hand"}
                    </p>
                  </div>
                </motion.div>
              )}

              {currentIndex === 2 && (
                <motion.div
                  key="slide-university-routes"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-[#132A22] to-[#0A1A14] p-5 pt-14 text-white sm:p-6 sm:pt-16"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 rounded-full bg-[#819586]/20 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-[#A2B8A8] uppercase">
                        <Compass className="size-3 text-[#A2B8A8]" />
                        {isTr ? "Akademik Rota" : "Academic Route"}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-white/60">
                        <GraduationCap className="size-3.5 text-[#819586]" />
                        {isTr ? "Global Kabul" : "Global Entry"}
                      </span>
                    </div>

                    <h3 className="mt-3 font-heading text-2xl font-normal text-white sm:text-3xl">
                      {isTr ? "Üniversite Kabul Rotası" : "University Pathways"}
                    </h3>
                    <p className="mt-1 text-xs text-white/70">
                      {isTr ? "Dünya çapında seçkin programlara stratejik hazırlık" : "Strategic prep for leading international degrees"}
                    </p>

                    <div className="mt-4 space-y-2.5">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-[#D6B56D] uppercase">UK &middot; Oxbridge / Imperial</span>
                            </div>
                            <p className="mt-0.5 text-xs font-bold text-white">Mathematics & Computer Science</p>
                            <p className="text-[10px] text-white/60">{isTr ? "TMUA, STEP & Mülakat Stratejisi" : "TMUA, STEP & Interview Strategy"}</p>
                          </div>
                          <Award className="size-4 text-[#D6B56D] shrink-0" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-[#A2B8A8] uppercase">US &middot; Top 20 & Ivy League</span>
                            </div>
                            <p className="mt-0.5 text-xs font-bold text-white">Engineering & Natural Sciences</p>
                            <p className="text-[10px] text-white/60">{isTr ? "Digital SAT, AP Physics & Calculus" : "Digital SAT, AP Physics & Calculus"}</p>
                          </div>
                          <BookOpen className="size-4 text-[#819586] shrink-0" />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-sky-400 uppercase">EU &middot; İtalya Tıp & Hollanda</span>
                            </div>
                            <p className="mt-0.5 text-xs font-bold text-white">Medicine & Quantitative Econ</p>
                            <p className="text-[10px] text-white/60">{isTr ? "IMAT & OMPT Matematik Yeterliliği" : "IMAT & OMPT Placement Prep"}</p>
                          </div>
                          <GraduationCap className="size-4 text-sky-400 shrink-0" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                    <p className="text-[11px] font-semibold text-[#A2B8A8]">
                      {isTr ? "Hedef programa göre özelleştirilmiş çalışma takvimi" : "Customized study roadmap tailored to your target programme"}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="absolute top-2 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-[#25382D]" />
        </motion.div>

        <div className="pointer-events-none absolute -z-10 h-[85%] w-[110%] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="flex items-center gap-4 rounded-full border border-border bg-card px-4 py-2 shadow-xs">
        <button
          type="button"
          onClick={handleManualPrev}
          className="cursor-pointer rounded-full p-1.5 text-foreground transition-colors hover:bg-muted focus:ring-2 focus:ring-primary/30 focus:outline-hidden"
          aria-label={isTr ? "Önceki slayt" : "Previous slide"}
        >
          <ChevronLeft className="size-4" />
        </button>

        <div
          className="flex items-center gap-2 px-1"
          role="tablist"
          aria-label={isTr ? "Telefon ekranları" : "Phone screens"}
        >
          {Array.from({ length: slideCount }).map((_, index) => {
            const isActive = currentIndex === index;

            return (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Slide ${index + 1}`}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "cursor-pointer rounded-full transition-all duration-300 focus:outline-hidden",
                  isActive
                    ? "h-[7px] w-[22px] bg-primary shadow-xs"
                    : "size-[7px] bg-muted-foreground/30 hover:bg-muted-foreground/60",
                )}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleManualNext}
          className="cursor-pointer rounded-full p-1.5 text-foreground transition-colors hover:bg-muted focus:ring-2 focus:ring-primary/30 focus:outline-hidden"
          aria-label={isTr ? "Sonraki slayt" : "Next slide"}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default PhoneCarousel;
