import type { ParsedQuery } from "@/types/parser.types";
import type { QualificationRecord, StudentAcademicProfile, SubjectRecord } from "@/types/matching.types";
import type { StudentProfile, StudentQualificationRecord } from "@/types/rule-engine.types";

/**
 * Normalizes and merges saved student profile with ephemeral query overrides.
 */
export function createNormalizedProfile(
  savedProfile?: Partial<StudentAcademicProfile> | null,
  parsedQuery?: ParsedQuery | null
): StudentAcademicProfile {
  const qualifications: QualificationRecord[] = [];
  const subjects: SubjectRecord[] = [];

  let country = savedProfile?.country;
  let targetDegreeLevel = savedProfile?.targetDegreeLevel;

  // 1. Copy saved profile qualifications & subjects if available
  if (savedProfile?.qualifications) {
    for (const q of savedProfile.qualifications) {
      qualifications.push({
        code: q.code.toUpperCase(),
        score: q.score,
        exactGrade: q.exactGrade,
        present: q.present,
      });
    }
  }

  if (savedProfile?.subjects) {
    for (const s of savedProfile.subjects) {
      subjects.push({
        name: s.name,
        level: s.level,
        score: s.score,
        exactGrade: s.exactGrade,
      });
    }
  }

  // 2. Apply Ephemeral Query Overrides
  let isEphemeral = false;
  if (parsedQuery) {
    // Override country if explicitly present in query
    if (parsedQuery.countries.length > 0 && parsedQuery.countries[0].iso2) {
      country = parsedQuery.countries[0].iso2;
    }

    if (parsedQuery.degreeLevel) {
      targetDegreeLevel = parsedQuery.degreeLevel;
    }

    // Merge qualification query scores (Explicit query score overrides saved profile score for search session)
    for (const qq of parsedQuery.qualifications) {
      isEphemeral = true;
      const codeUpper = qq.code.toUpperCase();
      const existingIdx = qualifications.findIndex((q) => q.code === codeUpper);

      if (existingIdx !== -1) {
        // Override existing saved profile score for session
        if (qq.score !== undefined) {
          qualifications[existingIdx].score = qq.score;
        }
        if (qq.exactGrade !== undefined) {
          qualifications[existingIdx].exactGrade = qq.exactGrade;
        }
      } else {
        // Add new qualification extracted from search query
        qualifications.push({
          code: codeUpper,
          score: qq.score,
          exactGrade: qq.exactGrade,
          present: true,
        });
      }
    }
  }

  return {
    country,
    targetDegreeLevel,
    qualifications,
    subjects,
    isEphemeral,
  };
}

/**
 * Converts `StudentAcademicProfile` to engine-ready `StudentProfile`.
 */
export function toEngineStudentProfile(profile: StudentAcademicProfile): StudentProfile {
  const records: StudentQualificationRecord[] = [];

  // Add top-level qualifications
  for (const q of profile.qualifications) {
    records.push({
      code: q.code,
      score: q.score,
      exactGrade: q.exactGrade,
      present: q.present !== false,
    });
  }

  // Add subject-level qualifications
  for (const s of profile.subjects) {
    records.push({
      code: "IB", // Or subject domain code
      subject: s.name,
      level: s.level,
      score: s.score,
      exactGrade: s.exactGrade,
      present: true,
    });
  }

  return { qualifications: records };
}
