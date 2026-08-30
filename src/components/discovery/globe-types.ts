import type { ExamCode } from "@/content/exams";

export type AdmissionRelationship =
  | "required"
  | "accepted"
  | "considered"
  | "program_specific"
  | "recommended";

export type ExamEvidenceChip = {
  exam: ExamCode;
  relationship: AdmissionRelationship;
  labelTr: string;
  labelEn: string;
  evidence?: string;
};

export type StudyUniversity = {
  id: string;
  name: string;
  city?: string;
  country: string;
  countryCode?: string;
  lat: number;
  lng: number;
  officialUrl?: string;
  admissionsUrl?: string;
  sourceUrl?: string;
  verifiedAt?: string;
  examChips?: ExamEvidenceChip[];
  examRelations: Array<{
    examId: ExamCode;
    relationship: AdmissionRelationship;
    programScope?: string;
    sourceUrl: string;
  }>;
};

export type StudyCountry = {
  id: string;
  iso3?: string;
  nameTr: string;
  nameEn: string;
  lat: number;
  lng: number;
  universities: StudyUniversity[];
};

export type StudyRegion = {
  id: string;
  countryCode?: string;
  labelTr: string;
  labelEn: string;
  focus: { lat: number; lng: number; altitude?: number };
  countries: StudyCountry[];
  examIds: ExamCode[];
  hasDirectExams: boolean;
  noMatchMessageTr?: string;
  noMatchMessageEn?: string;
};
