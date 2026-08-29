"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import type { ExamCode, ExamTextMap } from "@/content/exams";
import type { StudyRegion } from "./globe-types";
import { examDetailPath, localizedPath } from "@/lib/routes";

export function DestinationExamPanel({
  locale,
  region,
  examText,
}: {
  locale: Locale;
  region: StudyRegion | null;
  examText: ExamTextMap;
}) {
  const reducedMotion = useReducedMotion();
  const isTr = locale === "tr";
  const bookingHref = `${localizedPath("home", locale)}#consultation-form`;

  return (
    <div className="min-h-[13rem]" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {!region ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-dashed border-[#C8D2C9] bg-white/55 p-6 text-sm leading-7 text-[#68756C]"
          >
            {isTr ? "Haritadan veya yukarıdaki listeden bir ülke seçin." : "Choose a country from the map or list."}
          </motion.div>
        ) : !region.hasDirectExams || region.examIds.length === 0 ? (
          /* Graceful Informational State when no direct country-wide mapping exists */
          <motion.div
            key={`fallback-${region.id}`}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
            className="rounded-2xl border border-[#DDE4DC] bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-sage-soft text-ink">
                <Compass className="size-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-heading text-xl leading-tight text-[#10271B]">
                  {isTr ? `${region.labelTr} Eğitim Rehberi` : `${region.labelEn} Study Guidance`}
                </h3>
                <span className="text-xs font-semibold text-primary">
                  {isTr ? "Bireysel Değerlendirme" : "Individual Assessment"}
                </span>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[#68756C]">
              {isTr
                ? (region.noMatchMessageTr || "Bu ülke için Oriens’in desteklediği uluslararası sınavlardan doğrudan ülke-geneli bir eşleşme bulunamadı. Üniversite ve program koşulları kuruma göre değişebilir. Hedef kurumunuz için bireysel hazırlık rotası oluşturabiliriz.")
                : (region.noMatchMessageEn || "No direct country-wide match was found for Oriens-supported international exams for this destination. University and programme requirements vary by institution. We can build an individualized preparation roadmap for your target university.")}
            </p>

            <div className="mt-5 border-t border-[#F0F4F0] pt-4">
              <Link
                href={bookingHref}
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-forest/90"
              >
                <Sparkles className="size-3.5 text-sage" aria-hidden="true" />
                <span>{isTr ? "Ön Görüşme Planla" : "Book a Free Consultation"}</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={region.id}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
          >
            <h3 className="font-heading text-2xl leading-tight text-[#10271B]">
              {isTr
                ? `${region.labelTr} için hazırlanabileceğiniz sınavlar`
                : `Exams you can prepare for in ${region.labelEn}`}
            </h3>
            <p className="mt-2 text-xs leading-6 text-[#68756C]">
              {isTr
                ? "Gereklilikler programa ve başvuru dönemine göre değişebilir."
                : "Requirements can vary by programme and application cycle."}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {region.examIds.map((examId, index) => {
                const exam = examText[examId as ExamCode];
                return (
                  <motion.div
                    key={examId}
                    initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reducedMotion ? 0 : index * 0.045, duration: 0.24 }}
                  >
                    <Link
                      href={examDetailPath(locale, examId.toLowerCase())}
                      className="group flex h-full min-h-28 flex-col justify-between rounded-xl border border-[#DDE4DC] bg-white p-4 outline-none transition-colors hover:border-[#819586] focus-visible:ring-2 focus-visible:ring-[#819586]"
                    >
                      <div>
                        <span className="font-heading text-xl text-[#10271B]">{examId}</span>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#68756C]">
                          {exam?.shortDescription ?? examId}
                        </p>
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#10271B]">
                        {isTr ? "İncele" : "Explore"}
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
