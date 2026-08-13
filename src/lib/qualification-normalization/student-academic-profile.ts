export interface StudentQualificationRecord {
  qualCode: string;
  scoreType: string;
  overallScore?: number | null;
  gradeProfile?: string | null;
  components?: Record<string, number>;
  level?: string | null;
  subjectGrades?: Array<{
    subjectName: string;
    level: string;
    gradeText?: string;
    numericScore?: number;
  }>;
}

export interface StudentAcademicProfile {
  applicantId?: string;
  citizenshipCountryCode: string; // e.g. "TR", "GB", "US", "IN", "CN"
  applicantType: "DOMESTIC" | "INTERNATIONAL" | "EU" | "NON_EU";
  primaryQualification: StudentQualificationRecord;
  secondaryQualifications?: StudentQualificationRecord[];
  englishTest?: {
    testCode: "IELTS" | "TOEFL" | "PTE" | "DUOLINGO" | "CAMBRIDGE_ENG";
    overallScore: number;
    listening?: number;
    reading?: number;
    writing?: number;
    speaking?: number;
  };
  admissionTests?: Array<{
    testCode: "SAT" | "ACT" | "GRE" | "GMAT" | "UCAT" | "TMUA" | "IMAT" | "ESAT" | "YKS" | "GAOKAO" | "JEE" | "NEET";
    compositeScore: number;
    sections?: Record<string, number>;
  }>;
  targetDegreeLevel: "UNDERGRADUATE" | "POSTGRADUATE" | "MBA" | "PHD";
  targetFieldOfStudy?: string;
}

export function createStudentProfile(input: Partial<StudentAcademicProfile>): StudentAcademicProfile {
  return {
    citizenshipCountryCode: input.citizenshipCountryCode || "INTERNATIONAL",
    applicantType: input.applicantType || "INTERNATIONAL",
    primaryQualification: input.primaryQualification || { qualCode: "IB", scoreType: "GRADE_POINTS", overallScore: 38 },
    secondaryQualifications: input.secondaryQualifications || [],
    englishTest: input.englishTest,
    admissionTests: input.admissionTests || [],
    targetDegreeLevel: input.targetDegreeLevel || "UNDERGRADUATE",
    targetFieldOfStudy: input.targetFieldOfStudy,
  };
}
