"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/content/dictionaries";
import type { ExamCode, ExamTextMap } from "@/content/exams";
import type { StudyRegion } from "./globe-types";
import { examDetailPath } from "@/lib/routes";

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
            {isTr ? "Haritadan bir bölge seçin." : "Choose a destination."}
          </motion.div>
        ) : region.examIds.length === 0 ? (
          <motion.div
            key={region.id}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-[#DDE4DC] bg-white p-6 text-sm leading-7 text-[#68756C]"
          >
            {isTr
              ? "Üniversite ve sınav eşleşmeleri içerik doğrulaması tamamlandıkça burada gösterilecektir."
              : "University and exam relationships will appear here as verified programme data is added."}
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
                : `Exams relevant to ${region.labelEn}`}
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
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#68756C]">{exam.shortDescription}</p>
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

