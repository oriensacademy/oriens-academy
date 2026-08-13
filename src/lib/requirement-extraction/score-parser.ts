export interface ParsedScore {
  minScore: number | null;
  maxScore: number | null;
  recScore: number | null;
  gradeText: string | null;
  levelRequirement: string | null;
  subjectName: string | null;
  subjectMinScore: string | null;
  rawText: string;
}

export function parseRequirementScore(text: string, qualCode: string): ParsedScore {
  const result: ParsedScore = {
    minScore: null,
    maxScore: null,
    recScore: null,
    gradeText: null,
    levelRequirement: "DEFAULT",
    subjectName: null,
    subjectMinScore: null,
    rawText: text,
  };

  const clean = text.trim();

  // 1. IB Diploma Specific Parsing (e.g., "39 points overall with 7,6,6 at HL" or "38 points")
  if (qualCode === "IB") {
    const ibMatch = clean.match(/(?:overall\s*)?(\d{2})\s*(?:points|pts)?/i);
    if (ibMatch) {
      const val = parseInt(ibMatch[1], 10);
      if (val >= 24 && val <= 45) {
        result.minScore = val;
      }
    }

    const hlMatch = clean.match(/(\d\s*,\s*\d\s*,\s*\d|\d{3})\s*(?:at|in)?\s*(?:higher\s*level|hl)/i);
    if (hlMatch) {
      result.gradeText = `${hlMatch[1].replace(/\s+/g, "")} at HL`;
      result.levelRequirement = "HL";
    }

    const subMatch = clean.match(/(mathematics\s*(?:analysis|applications|aa|ai)?|chemistry|physics|biology|english)\s*(?:hl|sl)?\s*(?:grade|of|:)?\s*([67])/i);
    if (subMatch) {
      result.subjectName = subMatch[1].trim();
      result.subjectMinScore = subMatch[2];
      result.levelRequirement = clean.toLowerCase().includes("hl") ? "HL" : "SL";
    }

    return result;
  }

  // 2. A-Level Specific Parsing (e.g., "A*A*A", "A*AA", "AAA", "AAB", "ABB", "A-level Mathematics at grade A*")
  if (qualCode === "ALEVEL") {
    const gradeProfileMatch = clean.match(/\b(A\*A\*A\*|A\*A\*A|A\*AA|AAA|AAB|ABB|BBB|BBC|BCC)\b/i);
    if (gradeProfileMatch) {
      result.gradeText = gradeProfileMatch[1].toUpperCase();
    }

    const subMatch = clean.match(/(mathematics|further mathematics|physics|chemistry|biology|computer science)\s*(?:at\s*grade|:)?\s*(A\*|A|B|C)/i);
    if (subMatch) {
      result.subjectName = subMatch[1].trim();
      result.subjectMinScore = subMatch[2].toUpperCase();
    }

    return result;
  }

  // 3. IELTS Specific Parsing (e.g., "Overall score of 7.5 with no band less than 7.0" or "IELTS 7.0")
  if (qualCode === "IELTS") {
    const ieltsMatch = clean.match(/(?:overall\s*)?(\d(?:\.\d)?)/i);
    if (ieltsMatch) {
      const val = parseFloat(ieltsMatch[1]);
      if (val >= 4.0 && val <= 9.0) {
        result.minScore = val;
      }
    }
    return result;
  }

  // 4. TOEFL Specific Parsing (e.g., "100 overall", "TOEFL iBT 92")
  if (qualCode === "TOEFL") {
    const toeflMatch = clean.match(/(\d{2,3})/);
    if (toeflMatch) {
      const val = parseInt(toeflMatch[1], 10);
      if (val >= 60 && val <= 120) {
        result.minScore = val;
      }
    }
    return result;
  }

  // 5. SAT Specific Parsing (e.g., "1450 overall", "SAT score of 1500")
  if (qualCode === "SAT") {
    const satMatch = clean.match(/(\d{4})/);
    if (satMatch) {
      const val = parseInt(satMatch[1], 10);
      if (val >= 400 && val <= 1600) {
        result.minScore = val;
      }
    }
    return result;
  }

  // 6. Generic Numeric Extraction Fallback
  const genMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (genMatch) {
    const val = parseFloat(genMatch[1]);
    if (!isNaN(val)) {
      result.minScore = val;
    }
  }

  return result;
}
