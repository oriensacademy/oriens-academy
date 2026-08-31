import {
  normalizeUniversitySearchText,
  UNIVERSITY_NORMALIZATION_VERSION,
} from "../../src/lib/search/university-normalization.mjs";

export const UNIVERSITY_ELIGIBILITY_MODEL_VERSION = "oriens-university-eligibility-v2.0.0";

const CLEAR_UNIVERSITY = /(^| )(university|universite|universitesi|universitat|universita|universidad|universidade|universiteit|universitet|universitas|universitatea|universite|uniwersytet)( |$)/;
const HIGHER_EDUCATION = /(^| )(college|polytechnic|polytechnique|hochschule|business school|graduate school|faculty|ecole|conservatoire|conservatory|institute of technology|institut.{0,18}technolog)( |$)/;
const STRONG_NEGATIVE = /(^| )(science park|research park|school district|middle school|secondary school|high school|elementary school|primary school|training cent(er|re)|trade association|professional (association|society)|publish(er|ing)|government authority|performing arts cent(er|re)|hospital|clinic|health system|medical cent(er|re)|museum)( |$)/;
const RESEARCH_ONLY = /(^| )(academy of sciences|national laboratory|research cent(er|re)|research institute|observatory)( |$)/;
const WEAK_NEGATIVE = /(^| )(association|society|council|authority|foundation|institute|academy|centre|center)( |$)/;

function bounded(value) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export function classifyUniversityEntity(record, openalex = null, wikidata = null) {
  const displayName = record?.names?.find((name) => name.types?.includes("ror_display"))?.value || record?.name || "";
  const normalizedName = normalizeUniversitySearchText(displayName);
  const normalizedIdentities = (record?.names || [])
    .map((name) => normalizeUniversitySearchText(name.value))
    .filter(Boolean)
    .join(" | ") || normalizedName;
  const rorTypes = Array.isArray(record?.types) ? record.types.map((value) => String(value).toLowerCase()) : [];
  const rorActive = record?.status === "active";
  const rorEducation = rorTypes.includes("education");
  const openAlexType = String(openalex?.type || "").toLowerCase() || null;
  const wikidataClasses = Array.isArray(wikidata?.instance_of) ? wikidata.instance_of : [];
  const evidence = [];
  let confidence = 0.2;

  if (!rorActive) {
    return {
      confidence: 0,
      status: "ineligible",
      degreeGranting: null,
      institutionClass: "inactive",
      institutionSource: "ROR",
      reason: "ROR record is not active",
      evidence: { model_version: UNIVERSITY_ELIGIBILITY_MODEL_VERSION, normalization_version: UNIVERSITY_NORMALIZATION_VERSION, negative: ["ror_inactive"] },
    };
  }

  if (rorEducation) {
    confidence += 0.18;
    evidence.push({ source: "ROR", signal: "type:education", weight: 0.18 });
  } else {
    confidence -= 0.2;
    evidence.push({ source: "ROR", signal: "type:not_education", weight: -0.2 });
  }

  if (openAlexType === "education") {
    confidence += 0.16;
    evidence.push({ source: "OpenAlex", signal: "type:education", weight: 0.16 });
  } else if (["company", "government", "healthcare", "facility"].includes(openAlexType)) {
    confidence -= 0.28;
    evidence.push({ source: "OpenAlex", signal: `type:${openAlexType}`, weight: -0.28 });
  }

  const hasUniversityIdentity = CLEAR_UNIVERSITY.test(normalizedIdentities);
  const hasHigherEducationIdentity = HIGHER_EDUCATION.test(normalizedIdentities);
  const hasStrongNegative = STRONG_NEGATIVE.test(normalizedName);
  const hasResearchOnlyIdentity = RESEARCH_ONLY.test(normalizedName) && !hasUniversityIdentity;

  if (hasUniversityIdentity) {
    confidence += 0.42;
    evidence.push({ source: "name", signal: "explicit_university_identity", weight: 0.42 });
  } else if (hasHigherEducationIdentity) {
    confidence += 0.27;
    evidence.push({ source: "name", signal: "higher_education_identity", weight: 0.27 });
  }

  if (hasStrongNegative) {
    confidence -= 0.75;
    evidence.push({ source: "name", signal: "strong_non_hei_identity", weight: -0.75 });
  } else if (hasResearchOnlyIdentity) {
    confidence -= 0.5;
    evidence.push({ source: "name", signal: "research_only_identity", weight: -0.5 });
  } else if (WEAK_NEGATIVE.test(normalizedName) && !hasUniversityIdentity && !hasHigherEducationIdentity) {
    confidence -= 0.12;
    evidence.push({ source: "name", signal: "ambiguous_organization_identity", weight: -0.12 });
  }

  if (wikidataClasses.length > 0) {
    evidence.push({ source: "Wikidata", signal: "identity_classes_present", values: wikidataClasses });
  }

  confidence = bounded(confidence);
  if (hasStrongNegative || hasResearchOnlyIdentity || confidence < 0.3) {
    return {
      confidence,
      status: "ineligible",
      degreeGranting: false,
      institutionClass: hasStrongNegative ? "non_higher_education" : "research_only",
      institutionSource: openAlexType ? "ROR+OpenAlex" : "ROR",
      reason: "Strong evidence indicates this is not a degree-granting higher-education institution",
      evidence: { model_version: UNIVERSITY_ELIGIBILITY_MODEL_VERSION, normalization_version: UNIVERSITY_NORMALIZATION_VERSION, signals: evidence },
    };
  }

  if (confidence < 0.65) {
    return {
      confidence,
      status: "needs_review",
      degreeGranting: null,
      institutionClass: "ambiguous_education_organization",
      institutionSource: openAlexType ? "ROR+OpenAlex" : "ROR",
      reason: "Education-organization evidence exists, but degree-granting identity is not sufficiently established",
      evidence: { model_version: UNIVERSITY_ELIGIBILITY_MODEL_VERSION, normalization_version: UNIVERSITY_NORMALIZATION_VERSION, signals: evidence },
    };
  }

  const degreeGranting = hasUniversityIdentity && rorEducation && openAlexType === "education" ? true : null;
  return {
    confidence,
    status: "eligible",
    degreeGranting,
    institutionClass: hasUniversityIdentity ? "university" : "higher_education_college",
    institutionSource: openAlexType ? "ROR+OpenAlex" : "ROR",
    reason: degreeGranting ? "Independent ROR and OpenAlex education signals support an explicit university identity" : "Higher-education identity meets the public confidence threshold",
    evidence: { model_version: UNIVERSITY_ELIGIBILITY_MODEL_VERSION, normalization_version: UNIVERSITY_NORMALIZATION_VERSION, signals: evidence },
  };
}

export function aliasMetadata(name) {
  const trimmed = String(name || "").trim();
  const acronym = /^[\p{Lu}\d][\p{Lu}\d.&-]{1,11}$/u.test(trimmed);
  return {
    aliasType: acronym ? "acronym" : "native",
    trust: acronym ? 0.9 : 0.72,
    priority: acronym ? 105 : 78,
  };
}
