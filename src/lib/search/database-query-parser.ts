import { SupabaseClient } from "@supabase/supabase-js";

export interface ParsedDatabaseQuery {
  rawQuery: string;
  matchedQualification?: { id: string; code: string; name: string };
  detectedNumericScore?: number;
  detectedGradeProfile?: string;
  matchedCountry?: { id: string; name: string; code: string };
  matchedFieldOfStudy?: { id: string; name: string; slug: string };
  intent: "QUALIFICATION_SEARCH" | "COUNTRY_SEARCH" | "PROGRAM_SEARCH" | "UNIVERSITY_SEARCH";
}

export class DatabaseQueryParser {
  private qualificationsCache: Array<{ id: string; code: string; name: string; aliases?: string[] }> = [];
  private countriesCache: Array<{ id: string; name: string; iso_code_2: string }> = [];
  private fieldsCache: Array<{ id: string; name: string; slug: string; aliases: string[] }> = [];

  constructor(private supabase: SupabaseClient) {}

  public async initialize(): Promise<void> {
    const { data: qualList } = await this.supabase.from("qualifications").select("id, code, name");
    if (qualList) this.qualificationsCache = qualList;

    const { data: countryList } = await this.supabase.from("countries").select("id, name, iso_code_2");
    if (countryList) this.countriesCache = countryList;

    const { data: fieldList } = await this.supabase.from("fields_of_study").select("id, name, slug, aliases");
    if (fieldList) this.fieldsCache = fieldList;
  }

  public parseQuery(queryText: string): ParsedDatabaseQuery {
    const clean = queryText.trim().toLowerCase();
    const result: ParsedDatabaseQuery = {
      rawQuery: queryText,
      intent: "UNIVERSITY_SEARCH",
    };

    // 1. Match Qualification against Database Ontology Cache & Alias Map
    const qualAliases: Record<string, string[]> = {
      ALEVEL: ["a-level", "a level", "a-levels", "a levels", "alevel"],
      IB: ["ib", "international baccalaureate", "ibdp"],
      SAT: ["sat", "sat reasoning"],
      ACT: ["act"],
      IELTS: ["ielts", "ielts academic"],
      TOEFL: ["toefl", "toefl ibt"],
      PTE: ["pte", "pte academic"],
      DUOLINGO: ["duolingo", "det"],
      GRE: ["gre"],
      GMAT: ["gmat"],
    };

    for (const q of this.qualificationsCache) {
      const codeUpper = q.code.toUpperCase();
      const aliases = qualAliases[codeUpper] || [q.code.toLowerCase(), q.name.toLowerCase()];
      if (aliases.some((alias) => clean.includes(alias))) {
        result.matchedQualification = q;
        result.intent = "QUALIFICATION_SEARCH";
        break;
      }
    }

    // 2. Match Country against Database Countries Cache
    for (const c of this.countriesCache) {
      if (clean.includes(c.name.toLowerCase()) || clean.includes(c.iso_code_2.toLowerCase())) {
        result.matchedCountry = { id: c.id, name: c.name, code: c.iso_code_2 };
        if (!result.matchedQualification) result.intent = "COUNTRY_SEARCH";
        break;
      }
    }

    // 3. Match Field of Study against Database Fields Cache
    for (const f of this.fieldsCache) {
      const aliases = f.aliases || [];
      if (clean.includes(f.name.toLowerCase()) || aliases.some((a) => clean.includes(a.toLowerCase()))) {
        result.matchedFieldOfStudy = { id: f.id, name: f.name, slug: f.slug };
        if (!result.matchedQualification && !result.matchedCountry) result.intent = "PROGRAM_SEARCH";
        break;
      }
    }

    // 4. Extract Numeric Score or Grade Profile
    const numMatch = queryText.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      result.detectedNumericScore = parseFloat(numMatch[1]);
    }

    const gradeMatch = queryText.match(/\b(A\*A\*A\*|A\*A\*A|A\*AA|AAA|AAB|ABB)\b/i);
    if (gradeMatch) {
      result.detectedGradeProfile = gradeMatch[1].toUpperCase();
    }

    return result;
  }
}
