import { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedQualification {
  id: string;
  code: string;
  name: string;
  category: string;
  scoreType: string;
  minScore: number | null;
  maxScore: number | null;
}

export class QualificationResolver {
  private qualificationsCache: Map<string, ResolvedQualification> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor(private supabase: SupabaseClient) {
    this.initializeAliases();
  }

  private initializeAliases() {
    // Alias to canonical Qualification Code mappings
    const mappings: [string, string][] = [
      ["ib", "IB"],
      ["international baccalaureate", "IB"],
      ["ib diploma", "IB"],
      ["ibdp", "IB"],
      ["a-level", "ALEVEL"],
      ["a level", "ALEVEL"],
      ["a-levels", "ALEVEL"],
      ["a levels", "ALEVEL"],
      ["gce a level", "ALEVEL"],
      ["gce a-level", "ALEVEL"],
      ["gce advanced level", "ALEVEL"],
      ["sat", "SAT"],
      ["sat reasoning", "SAT"],
      ["sat reasoning test", "SAT"],
      ["act", "ACT"],
      ["american college testing", "ACT"],
      ["ielts", "IELTS"],
      ["ielts academic", "IELTS"],
      ["toefl", "TOEFL"],
      ["toefl ibt", "TOEFL"],
      ["toefl internet-based test", "TOEFL"],
      ["pte", "PTE"],
      ["pte academic", "PTE"],
      ["duolingo", "DUOLINGO"],
      ["det", "DUOLINGO"],
      ["gre", "GRE"],
      ["gre general", "GRE"],
      ["gmat", "GMAT"],
      ["ucat", "UCAT"],
      ["tmua", "TMUA"],
      ["imat", "IMAT"],
      ["esat", "ESAT"],
      ["tara", "TARA"],
      ["igcse", "IGCSE"],
      ["gcse", "IGCSE"],
      ["bachelor", "BACHELORS"],
      ["bachelors", "BACHELORS"],
      ["bachelor degree", "BACHELORS"],
      ["undergraduate degree", "BACHELORS"],
    ];

    mappings.forEach(([alias, code]) => this.aliasMap.set(alias.toLowerCase(), code));
  }

  public async preloadQualifications(): Promise<void> {
    const { data: qualList } = await this.supabase.from("qualifications").select("id, code, name, category, score_type, minimum_possible_score, maximum_possible_score");

    if (qualList) {
      qualList.forEach((q) => {
        const resolved: ResolvedQualification = {
          id: q.id,
          code: q.code,
          name: q.name,
          category: q.category,
          scoreType: q.score_type,
          minScore: q.minimum_possible_score,
          maxScore: q.maximum_possible_score,
        };
        this.qualificationsCache.set(q.code.toUpperCase(), resolved);
      });
    }
  }

  public resolveQualificationCode(text: string): string | null {
    const lower = text.toLowerCase().trim();
    if (this.aliasMap.has(lower)) {
      return this.aliasMap.get(lower)!;
    }

    // Keyword matching
    for (const [alias, code] of this.aliasMap.entries()) {
      if (lower.includes(alias)) {
        return code;
      }
    }

    return null;
  }

  public getQualificationByCode(code: string): ResolvedQualification | null {
    return this.qualificationsCache.get(code.toUpperCase()) || null;
  }

  public resolveQualification(text: string): ResolvedQualification | null {
    const code = this.resolveQualificationCode(text);
    if (!code) return null;
    return this.getQualificationByCode(code);
  }
}
