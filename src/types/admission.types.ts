/**
 * Oriens Academy — Global University Admission Engine Types
 * Domain model interfaces and rule execution schemas.
 */

export type DegreeLevel =
  | "FOUNDATION"
  | "UNDERGRADUATE"
  | "POSTGRADUATE"
  | "POSTGRADUATE_TAUGHT"
  | "POSTGRADUATE_RESEARCH"
  | "MBA"
  | "PHD"
  | "PROFESSIONAL"
  | "OTHER";

export type InstitutionType = "PUBLIC" | "PRIVATE" | "OTHER";

export type QualificationCategory =
  | "DIPLOMA"
  | "SECONDARY_QUALIFICATION"
  | "SUBJECT_EXAM"
  | "ADMISSION_TEST"
  | "ENGLISH_LANGUAGE_TEST"
  | "GRADUATE_ADMISSION_TEST"
  | "PLACEMENT_TEST"
  | "NATIONAL_HIGH_SCHOOL_EXAM"
  | "OTHER";

export type SourceType =
  | "MAIN_WEBSITE"
  | "PROGRAM_CATALOG"
  | "UNDERGRADUATE_PROGRAMS"
  | "POSTGRADUATE_PROGRAMS"
  | "PHD_PROGRAMS"
  | "MBA_PROGRAMS"
  | "INTERNATIONAL_ADMISSIONS"
  | "UNDERGRADUATE_ADMISSIONS"
  | "POSTGRADUATE_ADMISSIONS"
  | "ENTRY_REQUIREMENTS"
  | "COUNTRY_REQUIREMENTS"
  | "ENGLISH_LANGUAGE_REQUIREMENTS"
  | "TUITION_FEES"
  | "APPLICATION_GUIDE"
  | "OFFICIAL_CATALOG_PDF"
  | "PROGRAM_ENTRY_REQUIREMENTS"
  | "PROGRAM_ADMISSIONS"
  | "UNDERGRADUATE_ENTRY_REQUIREMENTS"
  | "POSTGRADUATE_ENTRY_REQUIREMENTS"
  | "INTERNATIONAL_ENTRY_REQUIREMENTS"
  | "COUNTRY_SPECIFIC_REQUIREMENTS"
  | "QUALIFICATION_SPECIFIC_REQUIREMENTS"
  | "ADMISSION_TEST_REQUIREMENTS"
  | "FACULTY_REQUIREMENTS"
  | "APPLICATION_REQUIREMENTS"
  | "OFFICIAL_CATALOG"
  | "OFFICIAL_PROGRAM_PAGE"
  | "OFFICIAL_ADMISSIONS_PAGE"
  | "OFFICIAL_UNIVERSITY_PAGE"
  | "OFFICIAL_INTERNATIONAL_REQUIREMENTS_PAGE"
  | "OFFICIAL_COUNTRY_REQUIREMENTS_PAGE"
  | "OFFICIAL_PDF"
  | "OFFICIAL_DELEGATED_PLATFORM"
  | "GOVERNMENT"
  | "OFFICIAL_ADMISSIONS_PLATFORM"
  | "GOVERNMENT_DATABASE"
  | "RECOGNIZED_ADMISSIONS_DATABASE"
  | "MANUALLY_VERIFIED"
  | "OTHER";

export type RequirementType =
  | "ACADEMIC_QUALIFICATION"
  | "ADMISSION_TEST"
  | "ENGLISH_LANGUAGE"
  | "SUBJECT_REQUIREMENT"
  | "GRADE_REQUIREMENT"
  | "PORTFOLIO"
  | "INTERVIEW"
  | "WORK_EXPERIENCE"
  | "PERSONAL_STATEMENT"
  | "REFERENCE"
  | "REQUIRED"
  | "RECOMMENDED"
  | "OPTIONAL"
  | "ALTERNATIVE"
  | "COMPETITIVE"
  | "OTHER";

export type RequirementStatus =
  | "REQUIRED"
  | "RECOMMENDED"
  | "OPTIONAL"
  | "ACCEPTED"
  | "ALTERNATIVE"
  | "COMPETITIVE"
  | "NOT_ACCEPTED"
  | "UNKNOWN";

export type DataConfidenceStatus =
  | "VERIFIED"
  | "HIGH_CONFIDENCE"
  | "NEEDS_REVIEW"
  | "CONFLICTING"
  | "STALE"
  | "UNVERIFIED";

export type ApplicantType =
  | "DOMESTIC"
  | "INTERNATIONAL"
  | "EU"
  | "NON_EU"
  | "OTHER";

export type StudyMode =
  | "FULL_TIME"
  | "PART_TIME"
  | "DISTANCE"
  | "HYBRID"
  | "FLEXIBLE"
  | "OTHER";

export type DurationUnit =
  | "YEARS"
  | "MONTHS"
  | "WEEKS"
  | "TERMS"
  | "SEMESTERS"
  | "OTHER";

export type SourceScope =
  | "PROGRAM"
  | "UNIVERSITY"
  | "FACULTY"
  | "COUNTRY"
  | "QUALIFICATION"
  | "LANGUAGE_REQUIREMENT"
  | "GENERAL_ADMISSIONS"
  | "OTHER";

export type AuthorityLevel =
  | "OFFICIAL_PROGRAM_PAGE"
  | "OFFICIAL_UNIVERSITY_PAGE"
  | "OFFICIAL_FACULTY_PAGE"
  | "OFFICIAL_DEPARTMENT_PAGE"
  | "OFFICIAL_DELEGATED_PLATFORM"
  | "GOVERNMENT"
  | "NATIONAL_ADMISSIONS_PLATFORM"
  | "THIRD_PARTY";

export type ProgramCoverageStatus =
  | "NO_ADMISSION_SOURCE"
  | "PROGRAM_SOURCE_ONLY"
  | "GENERAL_REQUIREMENTS_FOUND"
  | "PROGRAM_REQUIREMENTS_FOUND"
  | "INTERNATIONAL_REQUIREMENTS_FOUND"
  | "ENGLISH_REQUIREMENTS_FOUND"
  | "FULL_SOURCE_COVERAGE"
  | "NEEDS_REVIEW";

export type AdmissionConflictStatus = "NO_CONFLICT" | "POTENTIAL_CONFLICT" | "RESOLVED";

export type RegistrySourceType =
  | "PROGRAM_CATALOG"
  | "UNDERGRADUATE_PROGRAMS"
  | "POSTGRADUATE_PROGRAMS"
  | "INTERNATIONAL_ADMISSIONS"
  | "ENTRY_REQUIREMENTS"
  | "COUNTRY_REQUIREMENTS"
  | "ENGLISH_REQUIREMENTS"
  | "OTHER";

export type RegistrySourceStatus =
  | "DISCOVERED"
  | "PENDING"
  | "ACTIVE"
  | "FAILED"
  | "ARCHIVED";

export type IngestionRunStatus =
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "PARTIAL_SUCCESS";

export type LogicalOperator = "AND" | "OR";

export type SearchEntityType =
  | "UNIVERSITY"
  | "COUNTRY"
  | "PROGRAM"
  | "QUALIFICATION"
  | "FIELD_OF_STUDY";

export interface Country {
  id: string;
  iso2: string;
  iso3: string;
  name: string;
  slug: string;
  region?: string | null;
  aliases: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface University {
  id: string;
  name: string;
  normalizedName: string;
  slug: string;
  countryId: string;
  city?: string | null;
  stateOrRegion?: string | null;
  website?: string | null;
  admissionsUrl?: string | null;
  logoUrl?: string | null;
  institutionType: InstitutionType;
  rankingValue?: number | null;
  popularityScore?: number | null;
  active: boolean;
  country?: Country;
  createdAt?: string;
  updatedAt?: string;
}

export interface FieldOfStudy {
  id: string;
  name: string;
  slug: string;
  code?: string | null;
  parentId?: string | null;
  parent?: FieldOfStudy | null;
  aliases: string[];
  description?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProgramExternalIdentifier {
  id: string;
  programId: string;
  sourceType: string;
  externalId: string;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Program {
  id: string;
  universityId: string;
  name: string;
  normalizedName: string;
  slug: string;
  degreeLevel: DegreeLevel;
  degreeTitle?: string | null;
  fieldOfStudyId?: string | null;
  fieldOfStudy?: FieldOfStudy | string | null;
  facultyOrDepartment?: string | null;
  countryId?: string | null;
  campus?: string | null;
  studyMode?: StudyMode | null;
  language: string;
  durationValue?: number | null;
  durationUnit?: DurationUnit | null;
  duration?: string | null;
  officialProgramUrl?: string | null;
  applicationUrl?: string | null;
  coverageStatus?: ProgramCoverageStatus;
  active: boolean;
  sourceId?: string | null;
  university?: University;
  requirementGroups?: AdmissionRequirementGroup[];
  externalIdentifiers?: ProgramExternalIdentifier[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Qualification {
  id: string;
  code: string;
  name: string;
  shortName: string;
  category: QualificationCategory;
  description?: string | null;
  countryScope?: string | null;
  scoreType?: string | null;
  minimumPossibleScore?: number | null;
  maximumPossibleScore?: number | null;
  officialUrl?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdmissionSourceSnapshot {
  id: string;
  sourceId: string;
  contentHash: string;
  snapshotExcerpt?: string | null;
  rawPayload?: Record<string, unknown>;
  httpHeaders?: Record<string, unknown>;
  createdAt?: string;
}

export interface AdmissionSource {
  id: string;
  url: string;
  title: string;
  sourceType: SourceType;
  sourceScope?: SourceScope;
  authorityLevel?: AuthorityLevel;
  universityId?: string | null;
  programId?: string | null;
  discoveredFromId?: string | null;
  countryId?: string | null;
  qualificationId?: string | null;
  conflictStatus?: AdmissionConflictStatus;
  canonicalUrl?: string | null;
  pageTitle?: string | null;
  publisher?: string | null;
  contentHash?: string | null;
  httpStatus?: number | null;
  language?: string | null;
  isOfficial?: boolean;
  active?: boolean;
  retrievedAt: string;
  verifiedAt?: string | null;
  academicYear?: number | string;
  admissionCycle?: string | null;
  rawExcerpt?: string | null;
  sanitizedContent?: string | null;
  retrievalMetadata?: Record<string, unknown>;
  snapshots?: AdmissionSourceSnapshot[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AdmissionRequirement {
  id: string;
  groupId: string;
  programId?: string | null;
  qualificationId?: string | null;
  requirementType: RequirementType;
  requirementStatus?: RequirementStatus;
  minimumScore?: number | null;
  maximumScore?: number | null;
  recommendedScore?: number | null;
  minimumNumericScore?: number | null;
  maximumNumericScore?: number | null;
  recommendedNumericScore?: number | null;
  exactGrade?: string | null;
  gradeText?: string | null;
  subjectId?: string | null;
  subjectName?: string | null;
  subjectRequirement?: string | null;
  levelRequirement?: string | null;
  subjectMinimumScore?: string | number | null;
  notes?: string | null;
  academicYear: number | string;
  admissionCycle?: string;
  intakeTerm?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  applicantType?: ApplicantType;
  applicantCountryId?: string | null;
  applicantCurriculum?: string | null;
  dataConfidence?: DataConfidenceStatus;
  rawEvidence?: Record<string, unknown>;
  sourceId?: string | null;
  source?: AdmissionSource | null;
  qualification?: Qualification | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdmissionRequirementGroup {
  id: string;
  programId: string;
  parentGroupId?: string | null;
  logicalOperator: LogicalOperator;
  name?: string | null;
  academicYear?: number | string;
  admissionCycle?: string;
  applicantType?: ApplicantType;
  requirements?: AdmissionRequirement[];
  subGroups?: AdmissionRequirementGroup[];
  createdAt?: string;
  updatedAt?: string;
}

export type DomainVerificationStatus =
  | "VERIFIED"
  | "LIKELY_OFFICIAL"
  | "NEEDS_REVIEW"
  | "REJECTED"
  | "UNKNOWN";

export type DomainVerificationMethod =
  | "HOME_PAGE_HEURISTIC"
  | "OPENALEX_CANONICAL"
  | "GOVERNMENT_REGISTRY"
  | "MANUAL";

export interface UniversityDomain {
  id: string;
  universityId: string;
  domain: string;
  rootDomain: string;
  sourceUrl?: string | null;
  isPrimary: boolean;
  verificationStatus: DomainVerificationStatus;
  verificationMethod?: DomainVerificationMethod | null;
  verifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UniversitySourceRegistry {
  id: string;
  universityId: string;
  sourceType: RegistrySourceType;
  url: string;
  canonicalUrl?: string | null;
  domain?: string | null;
  pageTitle?: string | null;
  language?: string | null;
  isOfficial?: boolean;
  provenanceType?: string;
  verificationStatus?: string;
  priority: number;
  httpStatus?: number | null;
  contentType?: string;
  notes?: string | null;
  discoveredAt: string;
  lastCheckedAt?: string | null;
  status?: RegistrySourceStatus;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface IngestionRun {
  id: string;
  runType: string;
  source: string;
  startedAt: string;
  finishedAt?: string | null;
  status: IngestionRunStatus;
  recordsDiscovered: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  errorSummary?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchAlias {
  id: string;
  entityType: SearchEntityType;
  entityId?: string | null;
  alias: string;
  normalizedAlias: string;
  language: string;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Pre-seeded initial qualifications list for fast access & validation */
export const INITIAL_QUALIFICATION_CODES = [
  "IB",
  "AP",
  "SAT",
  "ESAT",
  "TARA",
  "TMUA",
  "IGCSE",
  "GRE",
  "GMAT",
  "UCAT",
  "IMAT",
  "OMPT",
] as const;

export type InitialQualificationCode = (typeof INITIAL_QUALIFICATION_CODES)[number];
