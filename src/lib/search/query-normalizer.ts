/**
 * Query Normalizer & String Utilities for English Admission Search
 */

export function normalizeQuery(input: string): string {
  if (!input) return "";

  return (
    input
      // Normalize unicode to NFKD (decomposes accents)
      .normalize("NFKD")
      // Remove diacritical marks
      .replace(/[\u0300-\u036f]/g, "")
      // Convert to lower case
      .toLowerCase()
      // Fold Turkish dotless i (has no NFKD decomposition, unlike the other
      // Turkish letters above which are already stripped to their ASCII base)
      .replace(/ı/g, "i")
      // Replace smart quotes/apostrophes with standard apostrophe
      .replace(/[\u2018\u2019`’]/g, "'")
      // Replace hyphen-like characters with standard hyphen
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
      // Remove extraneous punctuation except hyphens, apostrophes, and numbers/decimals
      .replace(/[^\w\s.'\-]/g, " ")
      // Standardize A-Level / A Level variations (e.g. a level -> a-level)
      .replace(/\ba\s+levels?\b/gi, "a-level")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Computes Damerau-Levenshtein edit distance for typo tolerance.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Returns similarity score between 0.0 and 1.0 based on edit distance.
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeQuery(str1);
  const s2 = normalizeQuery(str2);

  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const dist = editDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Extracts n-grams (1-gram to 4-gram) from tokenized input for multi-word entity matching.
 */
export function generateNGrams(tokens: string[], maxN = 4): { phrase: string; startIndex: number; endIndex: number }[] {
  const nGrams: { phrase: string; startIndex: number; endIndex: number }[] = [];
  const len = tokens.length;

  for (let n = maxN; n >= 1; n--) {
    for (let i = 0; i <= len - n; i++) {
      const slice = tokens.slice(i, i + n);
      nGrams.push({
        phrase: slice.join(" "),
        startIndex: i,
        endIndex: i + n - 1,
      });
    }
  }

  return nGrams;
}
