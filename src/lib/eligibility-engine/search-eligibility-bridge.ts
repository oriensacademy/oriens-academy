import { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseQueryParser } from "../search/database-query-parser";
import { StudentAcademicProfile, createStudentProfile } from "../qualification-normalization/student-academic-profile";
import { EligibilityEvaluator, EligibilityEvaluationResult } from "./eligibility-evaluator";

export interface ProgramWithEligibility {
  id: string;
  name: string;
  degreeLevel: string;
  universityName: string;
  countryName: string;
  eligibility: EligibilityEvaluationResult;
}

export class SearchEligibilityBridge {
  private parser: DatabaseQueryParser;
  private evaluator: EligibilityEvaluator;

  constructor(private supabase: SupabaseClient) {
    this.parser = new DatabaseQueryParser(supabase);
    this.evaluator = new EligibilityEvaluator(supabase);
  }

  public async initialize(): Promise<void> {
    await this.parser.initialize();
  }

  public async searchWithEligibility(
    queryText: string,
    customProfile?: Partial<StudentAcademicProfile>
  ): Promise<ProgramWithEligibility[]> {
    // 1. Parse query to extract ephemeral student profile
    const parsedQuery = this.parser.parseQuery(queryText);

    let profile: StudentAcademicProfile;

    if (customProfile) {
      profile = createStudentProfile(customProfile);
    } else {
      const qualCode = parsedQuery.matchedQualification?.code || "IB";
      const score = parsedQuery.detectedNumericScore || 38;
      const gradeProfile = parsedQuery.detectedGradeProfile || (qualCode === "ALEVEL" ? "AAA" : undefined);

      profile = createStudentProfile({
        citizenshipCountryCode: parsedQuery.matchedCountry?.code || "GB",
        primaryQualification: {
          qualCode,
          scoreType: qualCode === "IB" ? "GRADE_POINTS" : "NUMERIC_SCALE",
          overallScore: score,
          gradeProfile,
        },
        englishTest: {
          testCode: "IELTS",
          overallScore: 7.5,
          listening: 7.5,
          reading: 7.5,
          writing: 7.0,
          speaking: 7.5,
        },
      });
    }

    // 2. Query matching programs from DB (prefer programs with requirements)
    const { data: reqProgs } = await this.supabase
      .from("admission_requirements")
      .select("program_id")
      .limit(20);

    const progIds = Array.from(new Set(reqProgs?.map((r) => r.program_id) || []));

    const { data: programs, error: progErr } = await this.supabase
      .from("programs")
      .select("id, name, degree_level, universities(name, countries(name))")
      .in("id", progIds.length > 0 ? progIds : ["00000000-0000-0000-0000-000000000000"])
      .limit(10);

    if (progErr || !programs) return [];

    // 3. Batch evaluate eligibility for candidate programs
    const results: ProgramWithEligibility[] = [];

    for (const prog of programs) {
      const univObj = Array.isArray(prog.universities) ? prog.universities[0] : prog.universities;
      const countryObj = Array.isArray(univObj?.countries) ? univObj.countries[0] : univObj?.countries;

      const eligibility = await this.evaluator.evaluateProgramEligibility(prog.id, profile);

      results.push({
        id: prog.id,
        name: (prog as { title?: string; name?: string }).title || prog.name || "Program",
        degreeLevel: prog.degree_level,
        universityName: univObj?.name || "Unknown University",
        countryName: countryObj?.name || "Unknown Country",
        eligibility,
      });
    }

    return results;
  }
}
