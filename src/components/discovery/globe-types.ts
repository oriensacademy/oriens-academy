import type { AdmissionRelationship } from "@/data/exam-university-map";
import type { ExamCode } from "@/content/exams";

export type StudyUniversity = {
  id: string;
  name: string;
  city?: string;
  country: string;
  lat: number;
  lng: number;
  examRelations: Array<{
    examId: ExamCode;
    relationship: AdmissionRelationship;
    programScope?: string;
    sourceUrl: string;
  }>;
};

export type StudyCountry = {
  id: string;
  nameTr: string;
  nameEn: string;
  lat: number;
  lng: number;
  universities: StudyUniversity[];
};

export type StudyRegion = {
  id: "uk" | "europe" | "us" | "canada" | "other";
  labelTr: string;
  labelEn: string;
  focus: { lat: number; lng: number; altitude?: number };
  countries: StudyCountry[];
  examIds: ExamCode[];
};
