import type { DegreeLevel } from "./admission.types";

export type SearchIntent =
  | "UNIVERSITY_SEARCH"
  | "COUNTRY_SEARCH"
  | "QUALIFICATION_SEARCH"
  | "PROGRAM_SEARCH"
  | "ELIGIBILITY_SEARCH"
  | "DISCOVERY_SEARCH"
  | "MIXED";

export type ParserEntityType =
  | "UNIVERSITY"
  | "COUNTRY"
  | "QUALIFICATION"
  | "PROGRAM"
  | "FIELD_OF_STUDY";

export interface EntityMatch {
  id?: string;
  code?: string;
  name: string;
  matchedTerm: string;
  confidence: number; // 0.0 to 1.0
  type: ParserEntityType;
  canonicalSlug?: string;
  iso2?: string;
  iso3?: string;
  isFuzzy?: boolean;
}

export interface QualificationQuery {
  code: string;
  name: string;
  score?: number;
  exactGrade?: string;
  subject?: string;
  matchedTerm: string;
  confidence: number;
}

export interface ParsedQuery {
  raw: string;
  normalized: string;

  universities: EntityMatch[];
  countries: EntityMatch[];
  qualifications: QualificationQuery[];
  programs: EntityMatch[];
  fieldsOfStudy: EntityMatch[];

  degreeLevel?: DegreeLevel;
  locationTerms?: string[];

  intent: SearchIntent;
  confidence: number; // 0.0 to 1.0
}
