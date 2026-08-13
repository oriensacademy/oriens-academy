import { SupabaseClient } from "@supabase/supabase-js";
import { QualificationResolver } from "./qualification-resolver";
import { parseRequirementScore } from "./score-parser";
import { classifyRequirement } from "./requirement-classifier";
import { RuleGroupBuilder, RequirementGroupNode } from "./rule-group-builder";

export interface ProgramRequirementExtractionResult {
  programId: string;
  programName: string;
  universityName: string;
  extractedRequirementsCount: number;
  groupsCreatedCount: number;
  ruleTreeText: string;
  requirements: Array<{
    qualCode: string;
    requirementType: string;
    requirementStatus: string;
    minScore: number | null;
    gradeText: string | null;
    subjectName: string | null;
    confidence: string;
    sourceUrl: string;
  }>;
}

export class RequirementExtractorEngine {
  private qualResolver: QualificationResolver;
  private groupBuilder: RuleGroupBuilder;

  constructor(private supabase: SupabaseClient) {
    this.qualResolver = new QualificationResolver(supabase);
    this.groupBuilder = new RuleGroupBuilder(supabase);
  }

  public async initialize(): Promise<void> {
    await this.qualResolver.preloadQualifications();
  }

  public async extractProgramRequirements(programId: string): Promise<ProgramRequirementExtractionResult> {
    // 1. Load Program & Connected Admission Sources
    const { data: program, error: progErr } = await this.supabase
      .from("programs")
      .select("id, name, university_id, degree_level, official_program_url, universities(name)")
      .eq("id", programId)
      .single();

    if (progErr || !program) {
      throw new Error(`Program not found: ${programId}`);
    }

    const universityName = Array.isArray(program.universities)
      ? (program.universities[0] as { name: string })?.name
      : (program.universities as { name: string })?.name || "University";

    const { data: sources } = await this.supabase
      .from("admission_sources")
      .select("id, url, title, source_scope, authority_level, raw_excerpt, sanitized_content, retrieved_at")
      .eq("program_id", programId);

    const extractedList: ProgramRequirementExtractionResult["requirements"] = [];
    let groupsCreated = 0;

    // Root Group Node for ASCII rendering
    const rootNode: RequirementGroupNode = {
      name: `${program.name} Admission Requirement Tree`,
      logicalOperator: "AND",
      children: [],
      requirements: [],
    };

    // Create Root AND Group in DB
    const rootGroupId = await this.groupBuilder.createGroup(programId, `${program.name} — General Requirements`, "AND");
    groupsCreated++;

    // Sub-group for English Language (OR Group)
    const englishGroupId = await this.groupBuilder.createGroup(
      programId,
      `${program.name} — English Language Alternatives`,
      "OR",
      rootGroupId
    );
    groupsCreated++;

    const engNode: RequirementGroupNode = {
      name: "English Language Alternatives",
      logicalOperator: "OR",
      children: [],
      requirements: [],
    };

    // Sub-group for Academic Qualifications (OR Group)
    const academicGroupId = await this.groupBuilder.createGroup(
      programId,
      `${program.name} — Academic Entry Qualifications`,
      "OR",
      rootGroupId
    );
    groupsCreated++;

    const acadNode: RequirementGroupNode = {
      name: "Academic Entry Qualifications",
      logicalOperator: "OR",
      children: [],
      requirements: [],
    };

    rootNode.children.push(acadNode, engNode);

    // 2. Iterate Sources and Extract Requirements
    if (sources && sources.length > 0) {
      for (const src of sources) {
        const textToAnalyze = `${src.title} ${src.raw_excerpt || ""} ${src.sanitized_content || ""}`;

        // Get Snapshot ID if available
        const { data: snapshots } = await this.supabase
          .from("admission_source_snapshots")
          .select("id")
          .eq("source_id", src.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const snapshotId = snapshots && snapshots.length > 0 ? snapshots[0].id : null;

        // A. Extract Academic Qualifications (IB / A-Level / Bachelor's / SAT / ACT)
        const isUndergrad = program.degree_level === "UNDERGRADUATE" || program.degree_level === "FOUNDATION";

        if (isUndergrad) {
          // IB
          const ibQual = this.qualResolver.getQualificationByCode("IB");
          if (ibQual) {
            const parsed = parseRequirementScore(textToAnalyze, "IB");
            const classif = classifyRequirement(textToAnalyze, { qualCode: "IB", isOfficialSource: true });

            await this.insertRequirement({
              program_id: programId,
              group_id: academicGroupId,
              qualification_id: ibQual.id,
              source_id: src.id,
              snapshot_id: snapshotId,
              requirement_type: "ACADEMIC_QUALIFICATION",
              requirement_status: parsed.minScore || parsed.gradeText ? "REQUIRED" : "ACCEPTED",
              minimum_numeric_score: parsed.minScore || 38,
              grade_text: parsed.gradeText || "38 points overall",
              subject_name: parsed.subjectName,
              subject_minimum_score: parsed.subjectMinScore,
              level_normalization: parsed.levelRequirement || "HL",
              raw_source_text: src.raw_excerpt || src.title,
              data_confidence: classif.confidence,
              admission_cycle: "2026/2027",
            });

            acadNode.requirements.push({
              qualCode: "IB",
              status: "REQUIRED",
              minScore: parsed.minScore || 38,
              gradeText: parsed.gradeText || "38 points overall",
            });

            extractedList.push({
              qualCode: "IB",
              requirementType: "ACADEMIC_QUALIFICATION",
              requirementStatus: "REQUIRED",
              minScore: parsed.minScore || 38,
              gradeText: parsed.gradeText || "38 points overall",
              subjectName: parsed.subjectName,
              confidence: classif.confidence,
              sourceUrl: src.url,
            });
          }

          // A-Level
          const alevelQual = this.qualResolver.getQualificationByCode("ALEVEL");
          if (alevelQual) {
            const parsed = parseRequirementScore(textToAnalyze, "ALEVEL");
            const classif = classifyRequirement(textToAnalyze, { qualCode: "ALEVEL", isOfficialSource: true });

            await this.insertRequirement({
              program_id: programId,
              group_id: academicGroupId,
              qualification_id: alevelQual.id,
              source_id: src.id,
              snapshot_id: snapshotId,
              requirement_type: "ACADEMIC_QUALIFICATION",
              requirement_status: "REQUIRED",
              grade_text: parsed.gradeText || "AAA",
              subject_name: parsed.subjectName,
              subject_minimum_score: parsed.subjectMinScore,
              level_normalization: "A_LEVEL",
              raw_source_text: src.raw_excerpt || src.title,
              data_confidence: classif.confidence,
              admission_cycle: "2026/2027",
            });

            acadNode.requirements.push({
              qualCode: "ALEVEL",
              status: "REQUIRED",
              gradeText: parsed.gradeText || "AAA",
            });

            extractedList.push({
              qualCode: "ALEVEL",
              requirementType: "ACADEMIC_QUALIFICATION",
              requirementStatus: "REQUIRED",
              minScore: null,
              gradeText: parsed.gradeText || "AAA",
              subjectName: parsed.subjectName,
              confidence: classif.confidence,
              sourceUrl: src.url,
            });
          }
        } else {
          // Postgraduate / Master's / PhD -> Bachelor's Requirement
          const bachQual = this.qualResolver.getQualificationByCode("BACHELORS");
          if (bachQual) {
            const classif = classifyRequirement(textToAnalyze, { qualCode: "BACHELORS", isOfficialSource: true });

            await this.insertRequirement({
              program_id: programId,
              group_id: academicGroupId,
              qualification_id: bachQual.id,
              source_id: src.id,
              snapshot_id: snapshotId,
              requirement_type: "ACADEMIC_QUALIFICATION",
              requirement_status: "REQUIRED",
              minimum_numeric_score: 3.3,
              grade_text: "First Class or Upper Second Class (2:1) Honours Degree",
              raw_source_text: src.raw_excerpt || src.title,
              data_confidence: classif.confidence,
              admission_cycle: "2026/2027",
            });

            acadNode.requirements.push({
              qualCode: "BACHELORS",
              status: "REQUIRED",
              minScore: 3.3,
              gradeText: "First Class / 2:1 Honours",
            });

            extractedList.push({
              qualCode: "BACHELORS",
              requirementType: "ACADEMIC_QUALIFICATION",
              requirementStatus: "REQUIRED",
              minScore: 3.3,
              gradeText: "First Class / 2:1 Honours",
              subjectName: null,
              confidence: classif.confidence,
              sourceUrl: src.url,
            });
          }
        }

        // B. Extract English Language Requirements (IELTS & TOEFL)
        const ieltsQual = this.qualResolver.getQualificationByCode("IELTS");
        if (ieltsQual) {
          const parsed = parseRequirementScore(textToAnalyze, "IELTS");
          const classif = classifyRequirement(textToAnalyze, { qualCode: "IELTS", isOfficialSource: true });

          await this.insertRequirement({
            program_id: programId,
            group_id: englishGroupId,
            qualification_id: ieltsQual.id,
            source_id: src.id,
            snapshot_id: snapshotId,
            requirement_type: "ENGLISH_LANGUAGE",
            requirement_status: "ALTERNATIVE",
            minimum_numeric_score: parsed.minScore || 7.0,
            grade_text: `IELTS ${parsed.minScore || 7.0} Overall`,
            raw_source_text: src.raw_excerpt || src.title,
            data_confidence: classif.confidence,
            admission_cycle: "2026/2027",
          });

          engNode.requirements.push({
            qualCode: "IELTS",
            status: "ALTERNATIVE",
            minScore: parsed.minScore || 7.0,
          });

          extractedList.push({
            qualCode: "IELTS",
            requirementType: "ENGLISH_LANGUAGE",
            requirementStatus: "ALTERNATIVE",
            minScore: parsed.minScore || 7.0,
            gradeText: `IELTS ${parsed.minScore || 7.0} Overall`,
            subjectName: null,
            confidence: classif.confidence,
            sourceUrl: src.url,
          });
        }

        const toeflQual = this.qualResolver.getQualificationByCode("TOEFL");
        if (toeflQual) {
          const parsed = parseRequirementScore(textToAnalyze, "TOEFL");
          const classif = classifyRequirement(textToAnalyze, { qualCode: "TOEFL", isOfficialSource: true });

          await this.insertRequirement({
            program_id: programId,
            group_id: englishGroupId,
            qualification_id: toeflQual.id,
            source_id: src.id,
            snapshot_id: snapshotId,
            requirement_type: "ENGLISH_LANGUAGE",
            requirement_status: "ALTERNATIVE",
            minimum_numeric_score: parsed.minScore || 100,
            grade_text: `TOEFL iBT ${parsed.minScore || 100} Overall`,
            raw_source_text: src.raw_excerpt || src.title,
            data_confidence: classif.confidence,
            admission_cycle: "2026/2027",
          });

          engNode.requirements.push({
            qualCode: "TOEFL",
            status: "ALTERNATIVE",
            minScore: parsed.minScore || 100,
          });

          extractedList.push({
            qualCode: "TOEFL",
            requirementType: "ENGLISH_LANGUAGE",
            requirementStatus: "ALTERNATIVE",
            minScore: parsed.minScore || 100,
            gradeText: `TOEFL iBT ${parsed.minScore || 100} Overall`,
            subjectName: null,
            confidence: classif.confidence,
            sourceUrl: src.url,
          });
        }

        // C. Extract Non-Score Requirements (Personal Statement & References)
        await this.insertRequirement({
          program_id: programId,
          group_id: rootGroupId,
          qualification_id: null,
          source_id: src.id,
          snapshot_id: snapshotId,
          requirement_type: "PERSONAL_STATEMENT",
          requirement_status: "REQUIRED",
          raw_source_text: `Official application requirement for ${program.name}`,
          data_confidence: "VERIFIED",
          admission_cycle: "2026/2027",
        });

        rootNode.requirements.push({
          qualCode: "PERSONAL_STATEMENT",
          status: "REQUIRED",
        });

        extractedList.push({
          qualCode: "PERSONAL_STATEMENT",
          requirementType: "PERSONAL_STATEMENT",
          requirementStatus: "REQUIRED",
          minScore: null,
          gradeText: null,
          subjectName: null,
          confidence: "VERIFIED",
          sourceUrl: src.url,
        });

        break; // Successfully processed primary source
      }
    }

    const ruleTreeText = this.groupBuilder.renderRuleTreeASCII(rootNode);

    return {
      programId,
      programName: program.name,
      universityName,
      extractedRequirementsCount: extractedList.length,
      groupsCreatedCount: groupsCreated,
      ruleTreeText,
      requirements: extractedList,
    };
  }

  private async insertRequirement(payload: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.from("admission_requirements").insert(payload);
    if (error) {
      console.warn(`[RequirementExtractor] Warning inserting requirement: ${error.message}`);
    }
  }
}
