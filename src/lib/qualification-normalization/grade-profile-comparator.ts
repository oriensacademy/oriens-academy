export class GradeProfileComparator {
  private static ALEVEL_PROFILE_RANKS: Record<string, number> = {
    "A*A*A*": 7,
    "A*A*A": 6,
    "A*AA": 5,
    AAA: 4,
    AAB: 3,
    ABB: 2,
    BBB: 1,
  };

  /**
   * Compares A-Level grade profiles deterministically.
   * Returns true if studentProfile is equal to or higher rank than requiredProfile.
   */
  public static compareALevelProfiles(studentProfile: string, requiredProfile: string): boolean {
    const studentRank = GradeProfileComparator.ALEVEL_PROFILE_RANKS[studentProfile.toUpperCase()] || 0;
    const requiredRank = GradeProfileComparator.ALEVEL_PROFILE_RANKS[requiredProfile.toUpperCase()] || 0;

    if (studentRank === 0 || requiredRank === 0) return false;
    return studentRank >= requiredRank;
  }

  /**
   * Compares English Language subscores.
   * Hard subscore failures cannot be averaged away.
   */
  public static compareEnglishSubscores(
    student: { overall: number; listening?: number; reading?: number; writing?: number; speaking?: number },
    requirement: { minOverall: number; minComponent?: number }
  ): boolean {
    if (student.overall < requirement.minOverall) return false;

    if (requirement.minComponent !== undefined) {
      const components = [student.listening, student.reading, student.writing, student.speaking];
      for (const comp of components) {
        if (comp !== undefined && comp < requirement.minComponent) {
          return false; // Hard component failure
        }
      }
    }

    return true;
  }

  /**
   * Compares IB Mathematics Subjects.
   * Math AI does NOT satisfy Math AA unless explicitly source-backed.
   */
  public static compareIBMathSubject(studentSubject: string, requiredSubject: string): boolean {
    const sNorm = studentSubject.toLowerCase();
    const rNorm = requiredSubject.toLowerCase();

    if (rNorm.includes("math aa") || rNorm.includes("analysis")) {
      return sNorm.includes("math aa") || sNorm.includes("analysis");
    }

    if (rNorm.includes("math ai") || rNorm.includes("applications")) {
      return sNorm.includes("math ai") || sNorm.includes("applications");
    }

    return sNorm.includes(rNorm);
  }

  /**
   * Enforces zero cross-qualification conversion rule.
   * No IB=SAT or A-Level=IB conversions are allowed unless explicitly source-backed.
   */
  public static isCrossQualificationConversionAllowed(
    studentQual: string,
    requiredQual: string,
    isExplicitSourceOverride: boolean = false
  ): boolean {
    if (studentQual.toUpperCase() === requiredQual.toUpperCase()) return true;
    return isExplicitSourceOverride;
  }
}
