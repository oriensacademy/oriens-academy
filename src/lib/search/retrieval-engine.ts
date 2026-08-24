import type { ParsedQuery } from "@/types/parser.types";
import { parseQuery } from "./query-parser";
import { normalizeQuery, stringSimilarity } from "./query-normalizer";

export type SearchResultType = "UNIVERSITY" | "PROGRAM" | "COUNTRY" | "QUALIFICATION";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  slug: string;
  score: number;
  matchLayer: 1 | 2 | 3 | 4;
  badge?: string;
  countryIso2?: string;
  countryName?: string;
  officialUrl?: string;
}

export interface GroupedSearchResults {
  query: string;
  intent: ParsedQuery["intent"];
  confidence: number;
  parsedQuery: ParsedQuery;
  groups: {
    universities: SearchResultItem[];
    programs: SearchResultItem[];
    countries: SearchResultItem[];
    qualifications: SearchResultItem[];
  };
  totalCount: number;
}

interface DataItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  slug: string;
  aliases: string[];
  popularityScore?: number;
  countryIso2?: string;
  countryName?: string;
  officialUrl?: string;
  badge?: string;
}

// Built-in dataset for rapid deterministic search retrieval
const SEARCH_DATABASE: DataItem[] = [
  // UNIVERSITIES
  {
    id: "uni-cambridge",
    type: "UNIVERSITY",
    title: "University of Cambridge",
    subtitle: "Cambridge, United Kingdom",
    slug: "university-of-cambridge",
    aliases: ["cambridge", "university of cambridge", "cambridge university", "cam"],
    popularityScore: 98,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "UK Top 2",
    officialUrl: "https://www.cam.ac.uk",
  },
  {
    id: "uni-ucl",
    type: "UNIVERSITY",
    title: "University College London",
    subtitle: "London, United Kingdom",
    slug: "university-college-london",
    aliases: ["ucl", "university college london"],
    popularityScore: 95,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "London",
    officialUrl: "https://www.ucl.ac.uk",
  },
  {
    id: "uni-mit",
    type: "UNIVERSITY",
    title: "Massachusetts Institute of Technology",
    subtitle: "Cambridge, MA, United States",
    slug: "massachusetts-institute-of-technology",
    aliases: ["mit", "massachusetts institute of technology"],
    popularityScore: 100,
    countryIso2: "US",
    countryName: "United States",
    badge: "US Top 1",
    officialUrl: "https://www.mit.edu",
  },
  {
    id: "uni-harvard",
    type: "UNIVERSITY",
    title: "Harvard University",
    subtitle: "Cambridge, MA, United States",
    slug: "harvard-university",
    aliases: ["harvard", "harvard university"],
    popularityScore: 99,
    countryIso2: "US",
    countryName: "United States",
    badge: "Ivy League",
    officialUrl: "https://www.harvard.edu",
  },
  {
    id: "uni-stanford",
    type: "UNIVERSITY",
    title: "Stanford University",
    subtitle: "Stanford, CA, United States",
    slug: "stanford-university",
    aliases: ["stanford", "stanford university"],
    popularityScore: 99,
    countryIso2: "US",
    countryName: "United States",
    badge: "Top US",
    officialUrl: "https://www.stanford.edu",
  },
  {
    id: "uni-toronto",
    type: "UNIVERSITY",
    title: "University of Toronto",
    subtitle: "Toronto, ON, Canada",
    slug: "university-of-toronto",
    aliases: ["toronto", "uoft", "u of t", "university of toronto"],
    popularityScore: 96,
    countryIso2: "CA",
    countryName: "Canada",
    badge: "Canada Top 1",
    officialUrl: "https://www.utoronto.ca",
  },
  {
    id: "uni-ubc",
    type: "UNIVERSITY",
    title: "University of British Columbia",
    subtitle: "Vancouver, BC, Canada",
    slug: "university-of-british-columbia",
    aliases: ["ubc", "british columbia", "university of british columbia"],
    popularityScore: 93,
    countryIso2: "CA",
    countryName: "Canada",
    badge: "Canada Top 2",
    officialUrl: "https://www.ubc.ca",
  },
  {
    id: "uni-oxford",
    type: "UNIVERSITY",
    title: "University of Oxford",
    subtitle: "Oxford, United Kingdom",
    slug: "university-of-oxford",
    aliases: ["oxford", "university of oxford", "oxford university"],
    popularityScore: 99,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "UK Top 1",
    officialUrl: "https://www.ox.ac.uk",
  },
  {
    id: "uni-imperial",
    type: "UNIVERSITY",
    title: "Imperial College London",
    subtitle: "London, United Kingdom",
    slug: "imperial-college-london",
    aliases: ["imperial", "imperial college", "imperial college london"],
    popularityScore: 94,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "STEM",
    officialUrl: "https://www.imperial.ac.uk",
  },
  {
    id: "uni-bocconi",
    type: "UNIVERSITY",
    title: "Bocconi University",
    subtitle: "Milan, Italy",
    slug: "bocconi-university",
    aliases: ["bocconi", "bocconi university", "unibocconi"],
    popularityScore: 90,
    countryIso2: "IT",
    countryName: "Italy",
    badge: "Business",
    officialUrl: "https://www.unibocconi.it",
  },
  {
    id: "uni-bologna",
    type: "UNIVERSITY",
    title: "University of Bologna",
    subtitle: "Bologna, Italy",
    slug: "university-of-bologna",
    aliases: ["bologna", "university of bologna", "unibo"],
    popularityScore: 85,
    countryIso2: "IT",
    countryName: "Italy",
    badge: "Medicine & Law",
    officialUrl: "https://www.unibo.it",
  },
  {
    id: "uni-eth",
    type: "UNIVERSITY",
    title: "ETH Zurich",
    subtitle: "Zurich, Switzerland",
    slug: "eth-zurich",
    aliases: ["eth", "eth zurich", "swiss federal institute of technology"],
    popularityScore: 93,
    countryIso2: "CH",
    countryName: "Switzerland",
    badge: "Europe STEM",
    officialUrl: "https://ethz.ch",
  },
  {
    id: "uni-epfl",
    type: "UNIVERSITY",
    title: "EPFL",
    subtitle: "Lausanne, Switzerland",
    slug: "epfl",
    aliases: ["epfl", "ecole polytechnique federale de lausanne", "swiss federal institute of technology lausanne"],
    popularityScore: 94,
    countryIso2: "CH",
    countryName: "Switzerland",
    badge: "Europe STEM",
    officialUrl: "https://www.epfl.ch",
  },
  {
    id: "uni-tum",
    type: "UNIVERSITY",
    title: "Technical University of Munich",
    subtitle: "Munich, Germany",
    slug: "technical-university-of-munich",
    aliases: ["tum", "tu munich", "technical university of munich", "technische universitat munchen"],
    popularityScore: 95,
    countryIso2: "DE",
    countryName: "Germany",
    badge: "Europe STEM",
    officialUrl: "https://www.tum.de",
  },
  {
    id: "uni-tudelft",
    type: "UNIVERSITY",
    title: "Delft University of Technology",
    subtitle: "Delft, Netherlands",
    slug: "tu-delft",
    aliases: ["tu delft", "delft", "delft university of technology"],
    popularityScore: 88,
    countryIso2: "NL",
    countryName: "Netherlands",
    badge: "Engineering",
    officialUrl: "https://www.tudelft.nl",
  },

  // COUNTRIES
  {
    id: "country-gb",
    type: "COUNTRY",
    title: "United Kingdom",
    subtitle: "Europe",
    slug: "united-kingdom",
    aliases: ["uk", "britain", "great britain", "england", "scotland", "wales", "united kingdom"],
    popularityScore: 98,
    countryIso2: "GB",
    countryName: "United Kingdom",
  },
  {
    id: "country-us",
    type: "COUNTRY",
    title: "United States",
    subtitle: "North America",
    slug: "united-states",
    aliases: ["usa", "us", "america", "united states", "united states of america"],
    popularityScore: 99,
    countryIso2: "US",
    countryName: "United States",
  },
  {
    id: "country-it",
    type: "COUNTRY",
    title: "Italy",
    subtitle: "Europe",
    slug: "italy",
    aliases: ["italy", "italia", "italian republic"],
    popularityScore: 90,
    countryIso2: "IT",
    countryName: "Italy",
  },
  {
    id: "country-nl",
    type: "COUNTRY",
    title: "Netherlands",
    subtitle: "Europe",
    slug: "netherlands",
    aliases: ["netherlands", "holland", "dutch"],
    popularityScore: 88,
    countryIso2: "NL",
    countryName: "Netherlands",
  },

  // QUALIFICATIONS
  {
    id: "qual-ib",
    type: "QUALIFICATION",
    title: "International Baccalaureate (IB)",
    subtitle: "Diploma Category",
    slug: "ib",
    aliases: ["ib", "ib diploma", "international baccalaureate"],
    popularityScore: 95,
    officialUrl: "https://www.ibo.org",
    badge: "Global Diploma",
  },
  {
    id: "qual-sat",
    type: "QUALIFICATION",
    title: "SAT Reasoning Test",
    subtitle: "Admission Test",
    slug: "sat",
    aliases: ["sat", "sats", "sat test", "sat exam"],
    popularityScore: 96,
    officialUrl: "https://satsuite.collegeboard.org",
    badge: "Admissions Test",
  },
  {
    id: "qual-tmua",
    type: "QUALIFICATION",
    title: "Test of Mathematics for University Admission (TMUA)",
    subtitle: "UK Admissions Test",
    slug: "tmua",
    aliases: ["tmua", "test of mathematics for university admission"],
    popularityScore: 82,
    officialUrl: "https://www.tmua.org.uk",
    badge: "UK Math Test",
  },
  {
    id: "qual-imat",
    type: "QUALIFICATION",
    title: "International Medical Admissions Test (IMAT)",
    subtitle: "Italy Medical Admissions",
    slug: "imat",
    aliases: ["imat", "international medical admissions test"],
    popularityScore: 89,
    officialUrl: "https://www.mur.gov.it",
    badge: "Italy Medicine",
  },
  {
    id: "qual-ap",
    type: "QUALIFICATION",
    title: "Advanced Placement (AP)",
    subtitle: "Subject Exam",
    slug: "ap",
    aliases: ["ap", "advanced placement", "ap exams"],
    popularityScore: 91,
    officialUrl: "https://apstudents.collegeboard.org",
  },
  {
    id: "qual-gmat",
    type: "QUALIFICATION",
    title: "Graduate Management Admission Test (GMAT)",
    subtitle: "Graduate Business Test",
    slug: "gmat",
    aliases: ["gmat", "graduate management admission test"],
    popularityScore: 87,
    officialUrl: "https://www.mba.com",
    badge: "MBA Test",
  },

  // PROGRAMS & FIELDS OF STUDY
  {
    id: "program-cs",
    type: "PROGRAM",
    title: "Computer Science",
    subtitle: "BSc / Undergraduate Field",
    slug: "computer-science",
    aliases: ["computer science", "cs", "computer sciences", "comp sci", "computing", "software engineering"],
    popularityScore: 98,
    badge: "Popular Field",
  },
  {
    id: "program-med",
    type: "PROGRAM",
    title: "Medicine",
    subtitle: "Single-Cycle / MBBS",
    slug: "medicine",
    aliases: ["medicine", "med", "medical", "surgery", "medicine and surgery"],
    popularityScore: 97,
    badge: "High Demand",
  },
  {
    id: "program-eng",
    type: "PROGRAM",
    title: "Engineering",
    subtitle: "BSc / BEng Field",
    slug: "engineering",
    aliases: ["engineering", "engineer", "mechanical engineering", "electrical engineering"],
    popularityScore: 92,
  },
  {
    id: "program-mba",
    type: "PROGRAM",
    title: "Business Administration (MBA)",
    subtitle: "Postgraduate Business Degree",
    slug: "mba",
    aliases: ["mba", "business administration", "business management"],
    popularityScore: 90,
  },
];

export function retrieveSearchResults(
  rawQuery: string,
  limits = { universities: 5, programs: 4, qualifications: 3, countries: 3 }
): GroupedSearchResults {
  const parsedQuery = parseQuery(rawQuery);
  const normalized = normalizeQuery(rawQuery);

  // Default suggestions for empty query (0 chars)
  if (!normalized) {
    return {
      query: "",
      intent: "MIXED",
      confidence: 1.0,
      parsedQuery,
      groups: {
        universities: SEARCH_DATABASE.filter((d) => d.type === "UNIVERSITY").slice(0, limits.universities).map(toSearchResultItem),
        programs: SEARCH_DATABASE.filter((d) => d.type === "PROGRAM").slice(0, limits.programs).map(toSearchResultItem),
        countries: SEARCH_DATABASE.filter((d) => d.type === "COUNTRY").slice(0, limits.countries).map(toSearchResultItem),
        qualifications: SEARCH_DATABASE.filter((d) => d.type === "QUALIFICATION").slice(0, limits.qualifications).map(toSearchResultItem),
      },
      totalCount: limits.universities + limits.programs + limits.countries + limits.qualifications,
    };
  }

  const matches: SearchResultItem[] = [];

  for (const item of SEARCH_DATABASE) {
    const itemTitleNorm = normalizeQuery(item.title);
    let layerScore = 0;
    let matchLayer: 1 | 2 | 3 | 4 = 4;

    // LAYER 1: Exact Match
    if (itemTitleNorm === normalized) {
      layerScore = 1200;
      matchLayer = 1;
    }

    // LAYER 2: Alias Match
    if (!layerScore) {
      for (const alias of item.aliases) {
        const normAlias = normalizeQuery(alias);
        if (normAlias === normalized) {
          layerScore = 950;
          matchLayer = 2;
          break;
        }
      }
    }

    // LAYER 3: Prefix Match
    if (!layerScore) {
      if (itemTitleNorm.startsWith(normalized)) {
        layerScore = 650 + (normalized.length / itemTitleNorm.length) * 50;
        matchLayer = 3;
      } else {
        for (const alias of item.aliases) {
          const normAlias = normalizeQuery(alias);
          if (normAlias.startsWith(normalized)) {
            layerScore = 600 + (normalized.length / normAlias.length) * 50;
            matchLayer = 3;
            break;
          }
        }
      }
    }

    // LAYER 4: Typo / Fuzzy Match (Only for queries >= 2 chars)
    if (!layerScore && normalized.length >= 2) {
      let maxSim = 0;
      if (itemTitleNorm.length >= 3) {
        maxSim = Math.max(maxSim, stringSimilarity(normalized, itemTitleNorm));
      }
      for (const alias of item.aliases) {
        if (alias.length >= 3) {
          maxSim = Math.max(maxSim, stringSimilarity(normalized, alias));
        }
      }

      // Strict threshold so irrelevant items don't pollute
      if (maxSim >= 0.72) {
        layerScore = 300 + maxSim * 200;
        matchLayer = 4;
      }
    }

    // LAYER 5: Parsed Compound Entity Match (e.g. "Italy medicine")
    if (!layerScore) {
      if (item.type === "COUNTRY" && parsedQuery.countries.some((c) => c.iso2 === item.countryIso2 || c.name === item.title)) {
        layerScore = 900;
        matchLayer = 2;
      } else if (item.type === "UNIVERSITY" && parsedQuery.universities.some((u) => u.name === item.title)) {
        layerScore = 900;
        matchLayer = 2;
      } else if (item.type === "QUALIFICATION" && parsedQuery.qualifications.some((q) => q.code === item.slug.toUpperCase() || q.name === item.title)) {
        layerScore = 900;
        matchLayer = 2;
      } else if (item.type === "PROGRAM" && parsedQuery.fieldsOfStudy.some((f) => f.name === item.title || f.code === item.slug.toUpperCase())) {
        layerScore = 900;
        matchLayer = 2;
      }
    }

    if (layerScore > 0) {
      // Intent Multiplier Boost
      let intentMultiplier = 1.0;
      if (parsedQuery.intent === "UNIVERSITY_SEARCH" && item.type === "UNIVERSITY") intentMultiplier = 1.6;
      if (parsedQuery.intent === "COUNTRY_SEARCH" && item.type === "COUNTRY") intentMultiplier = 1.6;
      if (parsedQuery.intent === "QUALIFICATION_SEARCH" && item.type === "QUALIFICATION") intentMultiplier = 1.6;
      if (parsedQuery.intent === "PROGRAM_SEARCH" && item.type === "PROGRAM") intentMultiplier = 1.6;

      // Secondary popularity boost
      const popBoost = (item.popularityScore || 50) * 0.1;
      const finalScore = Math.round((layerScore + popBoost) * intentMultiplier);

      matches.push({
        id: item.id,
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        slug: item.slug,
        score: finalScore,
        matchLayer,
        badge: item.badge,
        countryIso2: item.countryIso2,
        countryName: item.countryName,
        officialUrl: item.officialUrl,
      });
    }
  }

  // Sort candidates by score descending
  matches.sort((a, b) => b.score - a.score);

  // Group by entity type with limits
  const universities = matches.filter((m) => m.type === "UNIVERSITY").slice(0, limits.universities);
  const programs = matches.filter((m) => m.type === "PROGRAM").slice(0, limits.programs);
  const countries = matches.filter((m) => m.type === "COUNTRY").slice(0, limits.countries);
  const qualifications = matches.filter((m) => m.type === "QUALIFICATION").slice(0, limits.qualifications);

  const totalCount = universities.length + programs.length + countries.length + qualifications.length;

  return {
    query: rawQuery,
    intent: parsedQuery.intent,
    confidence: parsedQuery.confidence,
    parsedQuery,
    groups: {
      universities,
      programs,
      countries,
      qualifications,
    },
    totalCount,
  };
}

function toSearchResultItem(d: DataItem): SearchResultItem {
  return {
    id: d.id,
    type: d.type,
    title: d.title,
    subtitle: d.subtitle,
    slug: d.slug,
    score: d.popularityScore || 50,
    matchLayer: 1,
    badge: d.badge,
    countryIso2: d.countryIso2,
    countryName: d.countryName,
    officialUrl: d.officialUrl,
  };
}

export { retrieveSearchResultsFromDatabase } from "./db-retrieval-service";

