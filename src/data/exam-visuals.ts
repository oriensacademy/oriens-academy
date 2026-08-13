import type { ExamCode } from "@/content/exams";

export type ExamOwnerVisual = {
  animation: string;
  type: "quantitative" | "science" | "chemistry-science";
  speed: number;
  label: Record<"tr" | "en", string>;
};

export const examVisuals = {
  TMUA: { animation: "/animations/green-calculator.lottie", type: "quantitative", speed: 0.9, label: { tr: "TMUA nicel akıl yürütme animasyonu", en: "TMUA quantitative reasoning animation" } },
  OMPT: { animation: "/animations/green-calculator.lottie", type: "quantitative", speed: 0.9, label: { tr: "OMPT matematik hazırlık animasyonu", en: "OMPT mathematics preparation animation" } },
  ESAT: { animation: "/animations/science.lottie", type: "science", speed: 0.9, label: { tr: "ESAT fen ve mühendislik hazırlık animasyonu", en: "ESAT science and engineering preparation animation" } },
  IMAT: { animation: "/animations/erlenmeyer-flask.lottie", type: "chemistry-science", speed: 0.85, label: { tr: "IMAT kimya ve fen hazırlık animasyonu", en: "IMAT chemistry and science preparation animation" } },
} satisfies Partial<Record<ExamCode, ExamOwnerVisual>>;

export function getExamOwnerVisual(code: ExamCode): ExamOwnerVisual | undefined {
  return examVisuals[code as keyof typeof examVisuals];
}
