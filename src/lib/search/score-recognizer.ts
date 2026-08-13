import type { QualificationQuery } from "@/types/parser.types";
import type { EntityMatch } from "@/types/parser.types";

interface QualificationScoreRange {
  min: number;
  max: number;
}

const SCORE_RANGES: { [code: string]: QualificationScoreRange } = {
  IB: { min: 24, max: 45 },
  SAT: { min: 400, max: 1600 },
  ACT: { min: 1, max: 36 },
  AP: { min: 1, max: 5 },
  ESAT: { min: 1.0, max: 9.0 },
  TMUA: { min: 1.0, max: 9.0 },
  IELTS: { min: 1.0, max: 9.0 },
  TOEFL: { min: 0, max: 120 },
  GRE: { min: 260, max: 340 },
  GMAT: { min: 200, max: 800 },
  IMAT: { min: 0, max: 90 },
  UCAT: { min: 1200, max: 3600 },
  OMPT: { min: 0, max: 100 },
};

export function extractQualificationQueries(
  rawQuery: string,
  qualificationMatches: EntityMatch[]
): QualificationQuery[] {
  const result: QualificationQuery[] = [];
  const tokens = rawQuery.trim().split(/\s+/);

  for (const match of qualificationMatches) {
    const code = (match.code || match.name).toUpperCase();
    let score: number | undefined = undefined;

    // Search near the matched qualification token for a valid score
    const range = SCORE_RANGES[code];
    const matchIndex = tokens.findIndex(
      (t) => t.toLowerCase() === match.matchedTerm.toLowerCase() || t.toUpperCase() === code
    );

    if (matchIndex !== -1) {
      // Check adjacent tokens (+1, +2, -1) for numeric score
      const candidateIndices = [matchIndex + 1, matchIndex + 2, matchIndex - 1];

      for (const idx of candidateIndices) {
        if (idx >= 0 && idx < tokens.length) {
          const rawToken = tokens[idx];
          // Skip if token is part of 'top 20' or '2026/2027' academic year context
          const prevToken = idx > 0 ? tokens[idx - 1].toLowerCase() : "";
          if (prevToken === "top" || prevToken === "best" || prevToken === "in") {
            continue;
          }

          const parsedNum = parseFloat(rawToken);
          if (!isNaN(parsedNum)) {
            // Is it a valid year? (e.g. 2024 - 2030)
            if (parsedNum >= 2020 && parsedNum <= 2035) continue;

            // Validate against score range if known
            if (range) {
              if (parsedNum >= range.min && parsedNum <= range.max) {
                score = parsedNum;
                break;
              }
            } else if (parsedNum > 0 && parsedNum <= 2400) {
              score = parsedNum;
              break;
            }
          }
        }
      }
    }

    result.push({
      code,
      name: match.name,
      score,
      matchedTerm: score ? `${match.matchedTerm} ${score}` : match.matchedTerm,
      confidence: match.confidence,
    });
  }

  return result;
}
