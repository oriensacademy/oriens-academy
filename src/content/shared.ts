/**
 * Locale-invariant content — values that are identical in every language
 * (international exam/test names, kept untranslated by design) and so
 * don't belong inside a per-locale dictionary.
 */
export const examCodes = [
  "IB",
  "AP",
  "IGCSE",
  "A-Level",
  "SAT",
  "ACT",
  "ESAT",
  "TMUA",
  "TARA",
  "UCAT",
  "LNAT",
  "IMAT",
  "GAMSAT",
  "MCAT",
  "LSAT",
  "GRE",
  "GMAT",
  "OMPT",
] as const;

