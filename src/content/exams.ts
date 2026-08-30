import { examCodes } from "./shared";
import { canonicalExamByCode } from "./canonical-exams";

export type ExamCode = (typeof examCodes)[number];
export type ExamVisualVariant = "coordinate" | "vector" | "function" | "geometry" | "route";

/**
 * Locale-invariant exam structure. Real classifications, not decorative
 * ones: IB/AP/IGCSE are secondary qualifications/curricula (only IB and
 * AP also directly gate university admission, so they carry both tags);
 * SAT/ESAT/TMUA/TARA are standalone university admissions tests;
 * UCAT/IMAT are health-sciences admissions tests; OMPT is a programme-
 * specific mathematics admissions assessment; GRE/GMAT are graduate-level.
 * An exam may legitimately belong to more than one
 * category — the data model supports it, it is not forced to one.
 */
export type ExamCategoryId =
  | "international-curriculum"
  | "admission-specific";

export const examCategoryOrder: ExamCategoryId[] = [
  "international-curriculum",
  "admission-specific",
];

type ExamMeta = {
  categories: ExamCategoryId[];
  primaryCategory: ExamCategoryId;
  visualVariant: ExamVisualVariant;
  relatedExams: ExamCode[];
  featured?: boolean;
};

/**
 * Keyed by `(typeof examCodes)[number]` so TypeScript forces this table to
 * stay in sync with `examCodes` — add or remove a code there and this
 * object must be updated to match, nothing drifts silently.
 */
const examMeta: Record<ExamCode, ExamMeta> = {
  IB: {
    categories: ["international-curriculum"],
    primaryCategory: "international-curriculum",
    visualVariant: "geometry",
    relatedExams: ["AP", "A-Level"],
    featured: true,
  },
  AP: {
    categories: ["international-curriculum"],
    primaryCategory: "international-curriculum",
    visualVariant: "function",
    relatedExams: ["IB", "A-Level"],
  },
  IGCSE: {
    categories: ["international-curriculum"],
    primaryCategory: "international-curriculum",
    visualVariant: "function",
    relatedExams: ["IB", "A-Level"],
  },
  "A-Level": {
    categories: ["international-curriculum"],
    primaryCategory: "international-curriculum",
    visualVariant: "coordinate",
    relatedExams: ["IB", "AP"],
  },
  SAT: {
    categories: ["international-curriculum"],
    primaryCategory: "international-curriculum",
    visualVariant: "coordinate",
    relatedExams: ["ACT", "AP"],
    featured: true,
  },
  ACT: {
    categories: ["international-curriculum"],
    primaryCategory: "international-curriculum",
    visualVariant: "coordinate",
    relatedExams: ["SAT", "AP"],
  },
  ESAT: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "coordinate",
    relatedExams: ["TMUA", "A-Level"],
  },
  TMUA: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "vector",
    relatedExams: ["ESAT", "A-Level"],
  },
  TARA: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "route",
    relatedExams: ["SAT", "TMUA"],
  },
  UCAT: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "route",
    relatedExams: ["IMAT", "GAMSAT"],
  },
  LNAT: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "vector",
    relatedExams: ["LSAT"],
  },
  IMAT: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "geometry",
    relatedExams: ["UCAT", "MCAT"],
  },
  GAMSAT: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "route",
    relatedExams: ["UCAT", "MCAT"],
  },
  MCAT: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "geometry",
    relatedExams: ["IMAT", "GAMSAT"],
  },
  LSAT: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "route",
    relatedExams: ["LNAT", "GRE"],
  },
  GRE: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "route",
    relatedExams: ["GMAT"],
    featured: true,
  },
  GMAT: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "function",
    relatedExams: ["GRE"],
  },
  OMPT: {
    categories: ["admission-specific"],
    primaryCategory: "admission-specific",
    visualVariant: "coordinate",
    relatedExams: ["TMUA", "SAT"],
  },
};

export type ExamRecord = {
  code: ExamCode;
  /** Stable across locales — a future detail page is `/{lang}/{hubSlug}/{slug}`. */
  slug: string;
  categories: ExamCategoryId[];
  primaryCategory: ExamCategoryId;
  visualVariant: ExamVisualVariant;
  relatedExams: ExamCode[];
  featured: boolean;
  order: number;
};

export const examRecords: ExamRecord[] = examCodes.map((code) => ({
  code,
  slug: canonicalExamByCode[code].slug,
  categories: examMeta[code].categories,
  primaryCategory: examMeta[code].primaryCategory,
  visualVariant: examMeta[code].visualVariant,
  relatedExams: examMeta[code].relatedExams,
  featured: !!examMeta[code].featured,
  order: canonicalExamByCode[code].displayOrder - 1,
}));

export function examsInCategory(category: ExamCategoryId): ExamRecord[] {
  return examRecords.filter((exam) => exam.categories.includes(category));
}

export function examsInPrimaryCategory(category: ExamCategoryId): ExamRecord[] {
  return examRecords.filter((exam) => exam.primaryCategory === category);
}

/** Locale-specific summary fields used by both hub and detail pages. */
export type ExamLocaleEntry = {
  title: string;
  shortDescription: string;
  purpose: string;
  audience: string;
  subjects: string[];
  ctaLabel: string;
};

export type ExamTextMap = Record<ExamCode, ExamLocaleEntry>;

export type ExamDetailLocaleEntry = {
  seoTitle: string;
  seoDescription: string;
  overview: string[];
  preparationAreas: { title: string; description: string }[];
  oriensSupport: string;
  featuredFacts: { label: string; value: string }[];
  faqs: { question: string; answer: string }[];
  cta: {
    title: string;
    body: string;
    primary: string;
    secondary: string;
  };
};

export type ExamDetailTextMap = Record<ExamCode, ExamDetailLocaleEntry>;

export function examBySlug(slug: string): ExamRecord | undefined {
  return examRecords.find((exam) => exam.slug === slug);
}
