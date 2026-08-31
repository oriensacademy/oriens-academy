export const UNIVERSITY_NORMALIZATION_VERSION = "oriens-university-normalization-v2";

const EXPLICIT_FOLDS = new Map([
  ["ı", "i"],
  ["ß", "ss"],
  ["æ", "ae"],
  ["œ", "oe"],
  ["ø", "o"],
  ["ł", "l"],
  ["đ", "d"],
  ["ð", "d"],
  ["þ", "th"],
  ["ħ", "h"],
]);

/**
 * Canonical university search normalization shared by browser and importer.
 *
 * Contract: NFKD -> remove combining marks -> locale-independent lowercase ->
 * explicit non-decomposing folds -> ampersand as "and" -> punctuation as word
 * boundaries -> ASCII alphanumeric tokens with one separating space.
 */
export function normalizeUniversitySearchText(value) {
  let normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  normalized = [...normalized]
    .map((character) => EXPLICIT_FOLDS.get(character) ?? character)
    .join("");

  return normalized
    .replace(/&/g, " and ")
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

