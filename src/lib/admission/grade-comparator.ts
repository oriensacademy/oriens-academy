/**
 * Grade Comparison and Score Normalization Utilities.
 * Handles numeric scores, letter grade combinations (e.g. A*A*A), subject levels, and presence checks.
 */

const A_LEVEL_GRADE_WEIGHTS: Record<string, number> = {
  "A*": 56,
  A: 48,
  B: 40,
  C: 32,
  D: 24,
  E: 16,
};

/**
 * Calculates tariff points for letter grade combinations (e.g. "A*A*A" -> 56+56+48 = 160).
 */
export function calculateGradeCombinationPoints(gradeStr: string): number {
  if (!gradeStr) return 0;

  const normalized = gradeStr.toUpperCase().replace(/\s+/g, "");

  // Match A*, A, B, C, D, E patterns
  const matches = normalized.match(/A\*|[ABCDE]/g);
  if (!matches || matches.length === 0) return 0;

  return matches.reduce((acc, grade) => acc + (A_LEVEL_GRADE_WEIGHTS[grade] || 0), 0);
}

/**
 * Compares two grade string combinations (e.g., student "A*AA" vs required "AAA").
 */
export function isGradeCombinationSufficient(studentGrade: string, requiredGrade: string): boolean {
  const studentPoints = calculateGradeCombinationPoints(studentGrade);
  const requiredPoints = calculateGradeCombinationPoints(requiredGrade);

  if (studentPoints > 0 && requiredPoints > 0) {
    return studentPoints >= requiredPoints;
  }

  return studentGrade.toUpperCase().trim() === requiredGrade.toUpperCase().trim();
}

/**
 * Normalizes subject names for comparison (e.g., "Math AA" vs "Mathematics Analysis and Approaches").
 */
export function matchSubjectName(studentSubject?: string, requiredSubject?: string): boolean {
  if (!requiredSubject) return true;
  if (!studentSubject) return false;

  const s = studentSubject.toLowerCase().replace(/[^\w]/g, "");
  const r = requiredSubject.toLowerCase().replace(/[^\w]/g, "");

  if (s === r || s.includes(r) || r.includes(s)) return true;

  // Math aliases
  if (r.includes("math") && (s.includes("math") || s.includes("analysis") || s.includes("calculus"))) return true;

  return false;
}

/**
 * Evaluates subject level requirements (e.g., HL vs SL).
 */
export function matchSubjectLevel(studentLevel?: string, requiredLevel?: string): boolean {
  if (!requiredLevel) return true;
  if (!studentLevel) return false;

  const s = studentLevel.toUpperCase().trim();
  const r = requiredLevel.toUpperCase().trim();

  if (s === r) return true;
  if (r === "HL" && s !== "HL") return false; // HL required, SL supplied -> failed

  return true;
}
