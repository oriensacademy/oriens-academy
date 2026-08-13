import { DegreeLevel, StudyMode, DurationUnit } from "@/types/admission.types";

export interface DiscoveredProgramLink {
  url: string;
  title?: string;
  anchorText?: string;
  degreeLevelHint?: string;
  departmentHint?: string;
}

export interface ExtractedProgramRecord {
  universityId: string;
  name: string;
  normalizedName: string;
  slug: string;
  degreeLevel: DegreeLevel;
  degreeTitle?: string | null;
  fieldOfStudyId?: string | null;
  facultyOrDepartment?: string | null;
  campus?: string | null;
  studyMode?: StudyMode | null;
  language: string;
  durationValue?: number | null;
  durationUnit?: DurationUnit | null;
  officialProgramUrl: string;
  externalId?: string | null;
  rawEvidence?: Record<string, unknown>;
}

export interface AdapterContext {
  universityId: string;
  universityName: string;
  officialDomain: string;
  sourceId: string;
  sourceUrl: string;
}

export interface ProgramSourceAdapter {
  name: string;
  canHandle(url: string, domain: string): boolean;
  discoverProgramLinks(html: string, baseUrl: string, ctx: AdapterContext): Promise<DiscoveredProgramLink[]>;
  extractProgram(html: string, pageUrl: string, ctx: AdapterContext): Promise<ExtractedProgramRecord | null>;
}
