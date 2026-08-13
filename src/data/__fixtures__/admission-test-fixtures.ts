import {
  University,
  Program,
  AdmissionRequirementGroup,
  AdmissionRequirement,
  AdmissionSource,
  Qualification,
} from "../../types/admission.types";

/**
 * Isolated unit test fixtures for program & admission requirement rule testing.
 * Strictly isolated from production / database layer.
 */

export const MOCK_QUALIFICATION_IB: Qualification = {
  id: "qual-fixture-ib-001",
  code: "IB",
  name: "International Baccalaureate Diploma",
  shortName: "IB",
  category: "DIPLOMA",
  scoreType: "GRADE_POINTS",
  minimumPossibleScore: 24,
  maximumPossibleScore: 45,
  active: true,
};

export const MOCK_QUALIFICATION_IELTS: Qualification = {
  id: "qual-fixture-ielts-002",
  code: "IELTS",
  name: "International English Language Testing System",
  shortName: "IELTS",
  category: "ENGLISH_LANGUAGE_TEST",
  scoreType: "NUMERIC_SCALE",
  minimumPossibleScore: 1.0,
  maximumPossibleScore: 9.0,
  active: true,
};

export const MOCK_SOURCE_OFFICIAL: AdmissionSource = {
  id: "source-fixture-001",
  url: "https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/computer-science",
  title: "University of Oxford — Computer Science Entry Requirements",
  sourceType: "OFFICIAL_PROGRAM_PAGE",
  isOfficial: true,
  active: true,
  retrievedAt: new Date().toISOString(),
  verifiedAt: new Date().toISOString(),
  academicYear: 2026,
};

export const MOCK_TEST_UNIVERSITY: University = {
  id: "univ-fixture-oxford-001",
  name: "University of Oxford",
  normalizedName: "university of oxford",
  slug: "university-of-oxford",
  countryId: "country-fixture-uk-001",
  city: "Oxford",
  institutionType: "PUBLIC",
  rankingValue: 1,
  popularityScore: 100,
  active: true,
};

export const MOCK_TEST_PROGRAM_CS: Program = {
  id: "prog-fixture-oxford-cs-001",
  universityId: MOCK_TEST_UNIVERSITY.id,
  name: "Computer Science BA",
  normalizedName: "computer science ba",
  slug: "computer-science-ba",
  degreeLevel: "UNDERGRADUATE",
  degreeTitle: "Bachelor of Arts (BA)",
  fieldOfStudy: "Computer Science",
  studyMode: "FULL_TIME",
  durationValue: 3,
  durationUnit: "YEARS",
  language: "English",
  officialProgramUrl: MOCK_SOURCE_OFFICIAL.url,
  active: true,
};

export const MOCK_TEST_REQUIREMENT_GROUP_ROOT: AdmissionRequirementGroup = {
  id: "group-fixture-root-001",
  programId: MOCK_TEST_PROGRAM_CS.id,
  logicalOperator: "AND",
  name: "Standard Oxford Computer Science BA Admission Criteria",
};

export const MOCK_TEST_REQUIREMENTS: AdmissionRequirement[] = [
  {
    id: "req-fixture-ib-001",
    groupId: MOCK_TEST_REQUIREMENT_GROUP_ROOT.id,
    programId: MOCK_TEST_PROGRAM_CS.id,
    qualificationId: MOCK_QUALIFICATION_IB.id,
    requirementType: "ACADEMIC_QUALIFICATION",
    requirementStatus: "REQUIRED",
    minimumNumericScore: 39,
    recommendedNumericScore: 40,
    gradeText: "39 overall with 766 at HL",
    academicYear: 2026,
    admissionCycle: "2026/2027",
    applicantType: "INTERNATIONAL",
    dataConfidence: "VERIFIED",
    sourceId: MOCK_SOURCE_OFFICIAL.id,
  },
  {
    id: "req-fixture-ielts-002",
    groupId: MOCK_TEST_REQUIREMENT_GROUP_ROOT.id,
    programId: MOCK_TEST_PROGRAM_CS.id,
    qualificationId: MOCK_QUALIFICATION_IELTS.id,
    requirementType: "ENGLISH_LANGUAGE",
    requirementStatus: "REQUIRED",
    minimumNumericScore: 7.5,
    gradeText: "7.5 minimum overall with at least 7.0 in each component",
    academicYear: 2026,
    admissionCycle: "2026/2027",
    applicantType: "INTERNATIONAL",
    dataConfidence: "VERIFIED",
    sourceId: MOCK_SOURCE_OFFICIAL.id,
  },
];
