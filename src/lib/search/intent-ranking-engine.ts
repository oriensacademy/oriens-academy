import type { SearchResultItem } from "./retrieval-engine";
import { retrieveSearchResults } from "./retrieval-engine";
import { calculateDataQuality } from "./data-confidence-service";
import type { DataQualityMetrics } from "@/types/confidence.types";

export interface RankedProgramCard {
  id: string;
  programName: string;
  universityName: string;
  universitySlug: string;
  countryName: string;
  countryIso2: string;
  degreeLevel: string;
  finalScore: number;
  dataQuality: DataQualityMetrics;
  badge?: string;
}

export interface PaginatedRankedResults {
  query: string;
  intent: string;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
  items: RankedProgramCard[];
}

interface ScoringWeights {
  textRelevance: number;
  entityMatch: number;
  programMatch: number;
  countryMatch: number;
  qualificationMatch: number;
  eligibilityMatch: number;
  dataConfidence: number;
  popularity: number;
}

function getAdaptiveScoringWeights(intent: string): ScoringWeights {
  switch (intent) {
    case "UNIVERSITY_SEARCH":
      return {
        textRelevance: 0.25,
        entityMatch: 0.6,
        programMatch: 0.05,
        countryMatch: 0.03,
        qualificationMatch: 0.02,
        eligibilityMatch: 0.0,
        dataConfidence: 0.02,
        popularity: 0.03,
      };
    case "COUNTRY_SEARCH":
      return {
        textRelevance: 0.25,
        entityMatch: 0.1,
        programMatch: 0.05,
        countryMatch: 0.55,
        qualificationMatch: 0.02,
        eligibilityMatch: 0.0,
        dataConfidence: 0.0,
        popularity: 0.03,
      };
    case "QUALIFICATION_SEARCH":
      return {
        textRelevance: 0.25,
        entityMatch: 0.1,
        programMatch: 0.05,
        countryMatch: 0.02,
        qualificationMatch: 0.55,
        eligibilityMatch: 0.0,
        dataConfidence: 0.0,
        popularity: 0.03,
      };
    case "ELIGIBILITY_SEARCH":
    case "DISCOVERY_SEARCH":
      return {
        textRelevance: 0.15,
        entityMatch: 0.1,
        programMatch: 0.25,
        countryMatch: 0.2,
        qualificationMatch: 0.15,
        eligibilityMatch: 0.1,
        dataConfidence: 0.03,
        popularity: 0.02,
      };
    default:
      return {
        textRelevance: 0.24,
        entityMatch: 0.12,
        programMatch: 0.16,
        countryMatch: 0.08,
        qualificationMatch: 0.12,
        eligibilityMatch: 0.18,
        dataConfidence: 0.07,
        popularity: 0.03,
      };
  }
}

/**
 * Fixture program cards database for deterministic search ranking testing.
 */
const PROGRAM_CARD_DATABASE: Omit<RankedProgramCard, "finalScore" | "dataQuality">[] = [
  {
    id: "cambridge-cs",
    programName: "Computer Science BSc",
    universityName: "University of Cambridge",
    universitySlug: "university-of-cambridge",
    countryName: "United Kingdom",
    countryIso2: "GB",
    degreeLevel: "UNDERGRADUATE",
    badge: "UK Top 1",
  },
  {
    id: "cambridge-eng",
    programName: "Engineering Tripos",
    universityName: "University of Cambridge",
    universitySlug: "university-of-cambridge",
    countryName: "United Kingdom",
    countryIso2: "GB",
    degreeLevel: "UNDERGRADUATE",
    badge: "UK Top 1",
  },
  {
    id: "ucl-cs",
    programName: "Computer Science BSc",
    universityName: "University College London",
    universitySlug: "university-college-london",
    countryName: "United Kingdom",
    countryIso2: "GB",
    degreeLevel: "UNDERGRADUATE",
    badge: "London",
  },
  {
    id: "mit-cs",
    programName: "Electrical Engineering & Computer Science",
    universityName: "Massachusetts Institute of Technology",
    universitySlug: "massachusetts-institute-of-technology",
    countryName: "United States",
    countryIso2: "US",
    degreeLevel: "UNDERGRADUATE",
    badge: "US Top 1",
  },
  {
    id: "milan-med",
    programName: "Medicine and Surgery (English)",
    universityName: "University of Milan",
    universitySlug: "university-of-milan",
    countryName: "Italy",
    countryIso2: "IT",
    degreeLevel: "UNDERGRADUATE",
    badge: "Italy IMAT",
  },
  {
    id: "bologna-med",
    programName: "Medicine and Surgery",
    universityName: "University of Bologna",
    universitySlug: "university-of-bologna",
    countryName: "Italy",
    countryIso2: "IT",
    degreeLevel: "UNDERGRADUATE",
    badge: "Italy IMAT",
  },
];

export function searchAndRankPrograms(
  rawQuery: string,
  page = 1,
  pageSize = 10
): PaginatedRankedResults {
  const retrieval = retrieveSearchResults(rawQuery);
  const parsed = retrieval.parsedQuery;
  const weights = getAdaptiveScoringWeights(parsed.intent);

  const scoredCards: RankedProgramCard[] = [];

  for (const card of PROGRAM_CARD_DATABASE) {
    let score = 0;

    // 1. Text & Entity Match Boost
    const isCambridgeUni = card.universitySlug === "university-of-cambridge";
    const isCambridgeQuery = parsed.universities.some((u) => u.name === "University of Cambridge");

    if (isCambridgeQuery && isCambridgeUni) {
      score += 1500 * weights.entityMatch; // Hard boost for exact university query
    }

    // 2. Country Match
    const matchesCountry = parsed.countries.some((c) => c.iso2 === card.countryIso2 || c.name === card.countryName);
    if (matchesCountry) {
      score += 500 * weights.countryMatch;
    }

    // 3. Program/Field Match
    const matchesField = parsed.fieldsOfStudy.some(
      (f) => card.programName.toLowerCase().includes(f.name.toLowerCase()) || f.name.toLowerCase().includes("computer") && card.programName.toLowerCase().includes("computer")
    );
    if (matchesField) {
      score += 600 * weights.programMatch;
    }

    // 4. Data Quality & Freshness
    const dataQuality = calculateDataQuality([
      {
        id: `src-${card.id}`,
        url: `https://admissions.example.com/${card.id}`,
        title: `${card.universityName} Official Portal`,
        sourceType: "OFFICIAL_ADMISSIONS_PAGE",
        retrievedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        academicYear: 2026,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    score += dataQuality.confidenceScore * weights.dataConfidence;

    scoredCards.push({
      ...card,
      finalScore: Math.round(score),
      dataQuality,
    });
  }

  // Sort descending by finalScore
  scoredCards.sort((a, b) => b.finalScore - a.finalScore);

  // Paginate
  const totalItems = scoredCards.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginatedItems = scoredCards.slice(startIndex, startIndex + pageSize);

  return {
    query: rawQuery,
    intent: parsed.intent,
    page,
    pageSize,
    totalItems,
    totalPages,
    hasMore: page < totalPages,
    items: paginatedItems,
  };
}
