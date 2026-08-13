import type { AdmissionRequirement, AdmissionRequirementGroup } from "@/types/admission.types";
import type { GroupCheckResult, SingleRequirementCheck, StudentProfile } from "@/types/rule-engine.types";
import { isGradeCombinationSufficient, matchSubjectLevel, matchSubjectName } from "./grade-comparator";

export function evaluateRequirement(
  req: AdmissionRequirement,
  qualCode: string,
  profile: StudentProfile
): SingleRequirementCheck {
  const reqType = req.requirementType || "REQUIRED";

  // Find matching qualification in student profile
  const studentRecords = profile.qualifications.filter(
    (q) => q.code.toUpperCase() === qualCode.toUpperCase()
  );

  if (!studentRecords.length) {
    if (reqType === "REQUIRED" || reqType === "COMPETITIVE") {
      return {
        qualificationCode: qualCode,
        subject: req.subjectRequirement || undefined,
        requirementType: reqType,
        status: "MISSING",
        requiredScore: req.minimumScore ?? req.exactGrade ?? "Required",
        reason: `${qualCode} is required but student record is missing`,
      };
    }
    return {
      qualificationCode: qualCode,
      subject: req.subjectRequirement || undefined,
      requirementType: reqType,
      status: "NOT_REQUIRED",
      requiredScore: req.minimumScore ?? req.exactGrade ?? "Optional",
      reason: `${qualCode} is ${reqType.toLowerCase()} and omitted by student`,
    };
  }

  // Evaluate subject & score against records
  let matchedRecord = studentRecords[0];
  if (req.subjectRequirement) {
    const subjectMatch = studentRecords.find((r) =>
      matchSubjectName(r.subject, req.subjectRequirement || undefined)
    );
    if (subjectMatch) {
      matchedRecord = subjectMatch;
    }
  }

  // 1. Evaluate Subject & Level
  if (req.subjectRequirement && !matchSubjectName(matchedRecord.subject, req.subjectRequirement)) {
    return {
      qualificationCode: qualCode,
      subject: req.subjectRequirement,
      requirementType: reqType,
      status: "FAILED",
      requiredScore: req.minimumScore ?? req.exactGrade ?? "Required",
      studentScore: matchedRecord.score ?? matchedRecord.exactGrade,
      reason: `Subject requirement ${req.subjectRequirement} not met (found: ${matchedRecord.subject || "None"})`,
    };
  }

  if (req.levelRequirement && !matchSubjectLevel(matchedRecord.level, req.levelRequirement)) {
    return {
      qualificationCode: qualCode,
      subject: req.subjectRequirement || undefined,
      requirementType: reqType,
      status: "FAILED",
      requiredScore: req.levelRequirement,
      studentScore: matchedRecord.level,
      reason: `Level requirement ${req.levelRequirement} not met (found: ${matchedRecord.level || "None"})`,
    };
  }

  // 2. Evaluate Exact Grade (e.g. A*A*A)
  if (req.exactGrade) {
    const studentGradeStr = matchedRecord.exactGrade || (matchedRecord.score ? String(matchedRecord.score) : "");
    const isSufficient = isGradeCombinationSufficient(studentGradeStr, req.exactGrade);

    return {
      qualificationCode: qualCode,
      subject: req.subjectRequirement || undefined,
      requirementType: reqType,
      status: isSufficient ? "PASSED" : "FAILED",
      requiredScore: req.exactGrade,
      studentScore: studentGradeStr,
      reason: isSufficient
        ? `Grade ${studentGradeStr} meets or exceeds required ${req.exactGrade}`
        : `Grade ${studentGradeStr} does not meet required ${req.exactGrade}`,
    };
  }

  // 3. Evaluate Minimum Score
  if (req.minimumScore !== undefined && req.minimumScore !== null) {
    const studentScore = matchedRecord.score;
    if (studentScore === undefined || studentScore === null) {
      return {
        qualificationCode: qualCode,
        subject: req.subjectRequirement || undefined,
        requirementType: reqType,
        status: "MISSING",
        requiredScore: req.minimumScore,
        reason: `${qualCode} score missing`,
      };
    }

    const isPassed = studentScore >= req.minimumScore;
    return {
      qualificationCode: qualCode,
      subject: req.subjectRequirement || undefined,
      requirementType: reqType,
      status: isPassed ? "PASSED" : "FAILED",
      requiredScore: req.minimumScore,
      studentScore,
      reason: isPassed
        ? `Score ${studentScore} meets minimum required ${req.minimumScore}`
        : `Score ${studentScore} is below minimum required ${req.minimumScore}`,
    };
  }

  // 4. Presence check (Test taken / present)
  const isPresent = matchedRecord.present !== false;
  return {
    qualificationCode: qualCode,
    subject: req.subjectRequirement || undefined,
    requirementType: reqType,
    status: isPresent ? "PASSED" : "FAILED",
    requiredScore: "Present",
    studentScore: isPresent ? "Present" : "Absent",
    reason: isPresent ? `${qualCode} requirement fulfilled` : `${qualCode} presence required`,
  };
}

export function evaluateRequirementGroup(
  group: AdmissionRequirementGroup,
  qualCodeMap: Record<string, string>,
  profile: StudentProfile
): GroupCheckResult {
  const op = group.logicalOperator || "AND";
  const checks: SingleRequirementCheck[] = [];
  const subGroupResults: GroupCheckResult[] = [];

  // Evaluate direct requirement checks
  if (group.requirements) {
    for (const req of group.requirements) {
      const code = req.qualification?.code || (req.qualificationId ? qualCodeMap[req.qualificationId] : undefined) || "UNKNOWN";
      checks.push(evaluateRequirement(req, code, profile));
    }
  }

  // Evaluate nested sub-groups
  if (group.subGroups) {
    for (const sg of group.subGroups) {
      subGroupResults.push(evaluateRequirementGroup(sg, qualCodeMap, profile));
    }
  }

  if (op === "AND") {
    const anyFailed = checks.some((c) => c.status === "FAILED") || subGroupResults.some((sg) => !sg.passed && !sg.hasMissingInfo);
    const anyMissing = checks.some((c) => c.status === "MISSING") || subGroupResults.some((sg) => sg.hasMissingInfo);
    const passed = !anyFailed && !anyMissing;

    return {
      groupId: group.id,
      logicalOperator: "AND",
      passed,
      hasMissingInfo: anyMissing,
      checks,
      subGroups: subGroupResults,
    };
  } else {
    // OR logic: If ANY branch passes, the group passes!
    const anyPassed = checks.some((c) => c.status === "PASSED") || subGroupResults.some((sg) => sg.passed);
    const allMissing = checks.every((c) => c.status === "MISSING") && subGroupResults.every((sg) => sg.hasMissingInfo);

    return {
      groupId: group.id,
      logicalOperator: "OR",
      passed: anyPassed,
      hasMissingInfo: !anyPassed && allMissing,
      checks,
      subGroups: subGroupResults,
    };
  }
}
