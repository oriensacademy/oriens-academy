import { examCodes } from "./shared";

export type ExamCode = (typeof examCodes)[number];
export type ExamVisualVariant = "coordinate" | "vector" | "function" | "geometry" | "route";

/**
 * Locale-invariant exam structure. Real classifications, not decorative
 * ones: IB/AP/IGCSE are secondary qualifications/curricula (only IB and
 * AP also directly gate university admission, so they carry both tags);
 * SAT/ESAT/TMUA/TARA are standalone university admissions tests;
 * UKCAT/IMAT are health-sciences admissions tests; OMPT is a programme-
 * specific mathematics admissions assessment; GRE/GMAT are graduate-level.
 * An exam may legitimately belong to more than one
 * category — the data model supports it, it is not forced to one.
 */
export type ExamCategoryId =
  | "university-admissions"
  | "academic-programmes"
  | "medical-admissions"
  | "graduate-admissions";

export const examCategoryOrder: ExamCategoryId[] = [
  "university-admissions",
  "academic-programmes",
  "medical-admissions",
  "graduate-admissions",
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
    categories: ["academic-programmes", "university-admissions"],
    primaryCategory: "academic-programmes",
    visualVariant: "geometry",
    relatedExams: ["AP", "IGCSE"],
    featured: true,
  },
  AP: {
    categories: ["academic-programmes", "university-admissions"],
    primaryCategory: "academic-programmes",
    visualVariant: "function",
    relatedExams: ["IB", "IGCSE"],
  },
  SAT: {
    categories: ["university-admissions"],
    primaryCategory: "university-admissions",
    visualVariant: "coordinate",
    relatedExams: ["OMPT", "ESAT", "TMUA"],
    featured: true,
  },
  ESAT: { categories: ["university-admissions"], primaryCategory: "university-admissions", visualVariant: "coordinate", relatedExams: ["TMUA", "SAT"] },
  TARA: { categories: ["university-admissions"], primaryCategory: "university-admissions", visualVariant: "route", relatedExams: ["SAT", "TMUA"] },
  TMUA: { categories: ["university-admissions"], primaryCategory: "university-admissions", visualVariant: "vector", relatedExams: ["ESAT", "SAT"] },
  IGCSE: { categories: ["academic-programmes"], primaryCategory: "academic-programmes", visualVariant: "function", relatedExams: ["IB", "AP"] },
  GRE: {
    categories: ["graduate-admissions"],
    primaryCategory: "graduate-admissions",
    visualVariant: "route",
    relatedExams: ["GMAT"],
    featured: true,
  },
  GMAT: { categories: ["graduate-admissions"], primaryCategory: "graduate-admissions", visualVariant: "function", relatedExams: ["GRE"] },
  UKCAT: { categories: ["medical-admissions"], primaryCategory: "medical-admissions", visualVariant: "route", relatedExams: ["IMAT"] },
  IMAT: { categories: ["medical-admissions"], primaryCategory: "medical-admissions", visualVariant: "geometry", relatedExams: ["UKCAT"] },
  OMPT: { categories: ["university-admissions"], primaryCategory: "university-admissions", visualVariant: "coordinate", relatedExams: ["SAT", "ESAT"] },
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

export const examRecords: ExamRecord[] = examCodes.map((code, index) => ({
  code,
  slug: code.toLowerCase(),
  categories: examMeta[code].categories,
  primaryCategory: examMeta[code].primaryCategory,
  visualVariant: examMeta[code].visualVariant,
  relatedExams: examMeta[code].relatedExams,
  featured: !!examMeta[code].featured,
  order: index,
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
