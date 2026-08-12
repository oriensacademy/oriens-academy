/**
 * Locale-invariant content — values that are identical in every language
 * (international exam/test names, kept untranslated by design) and so
 * don't belong inside a per-locale dictionary.
 */
export const examCodes = [
  "IB",
  "AP",
  "SAT",
  "ESAT",
  "TARA",
  "TMUA",
  "IGCSE",
  "GRE",
  "GMAT",
  "UKCAT",
  "IMAT",
  "OMPT",
] as const;
