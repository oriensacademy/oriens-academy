import type { ParsedQuery } from "@/types/parser.types";
import { normalizeQuery } from "./query-normalizer";
import { extractEntities } from "./entity-matcher";
import { extractQualificationQueries } from "./score-recognizer";
import { classifySearchIntent } from "./intent-engine";

/**
 * Deterministic English Query Understanding & Intent Engine.
 * Transforms free-text admission queries into structured search parameters.
 */
export function parseQuery(
  rawQuery: string,
  options: { includePredefinedUniversities?: boolean } = {},
): ParsedQuery {
  if (!rawQuery || typeof rawQuery !== "string") {
    return {
      raw: "",
      normalized: "",
      universities: [],
      countries: [],
      qualifications: [],
      programs: [],
      fieldsOfStudy: [],
      intent: "MIXED",
      confidence: 0.0,
    };
  }

  const normalized = normalizeQuery(rawQuery);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  // 1. Extract Entities
  const entityResult = extractEntities(tokens, options);

  // 2. Extract Qualification Queries & Contextual Scores
  const qualificationQueries = extractQualificationQueries(
    rawQuery,
    entityResult.qualifications
  );

  // 3. Classify Search Intent
  const { intent, confidence } = classifySearchIntent(
    rawQuery,
    entityResult.universities,
    entityResult.countries,
    qualificationQueries,
    entityResult.programs,
    entityResult.fieldsOfStudy
  );

  // Collect location terms from countries or cities
  const locationTerms: string[] = [];
  for (const c of entityResult.countries) {
    locationTerms.push(c.name);
    if (c.iso2) locationTerms.push(c.iso2);
  }

  return {
    raw: rawQuery,
    normalized,
    universities: entityResult.universities,
    countries: entityResult.countries,
    qualifications: qualificationQueries,
    programs: entityResult.programs,
    fieldsOfStudy: entityResult.fieldsOfStudy,
    degreeLevel: entityResult.degreeLevel,
    locationTerms: locationTerms.length > 0 ? locationTerms : undefined,
    intent,
    confidence,
  };
}
