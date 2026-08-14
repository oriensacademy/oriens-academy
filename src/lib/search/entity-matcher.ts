import type { EntityMatch } from "@/types/parser.types";
import type { DegreeLevel } from "@/types/admission.types";
import { generateNGrams, normalizeQuery, stringSimilarity } from "./query-normalizer";

interface PredefinedEntity {
  id?: string;
  code?: string;
  name: string;
  type: EntityMatch["type"];
  aliases: string[];
  canonicalSlug?: string;
  iso2?: string;
  iso3?: string;
}

const PREDEFINED_COUNTRIES: PredefinedEntity[] = [
  {
    name: "United Kingdom",
    type: "COUNTRY",
    iso2: "GB",
    iso3: "GBR",
    canonicalSlug: "united-kingdom",
    aliases: ["uk", "britain", "great britain", "england", "scotland", "wales", "united kingdom", "ingiltere", "birlesik krallik"],
  },
  {
    name: "United States",
    type: "COUNTRY",
    iso2: "US",
    iso3: "USA",
    canonicalSlug: "united-states",
    aliases: ["usa", "us", "america", "united states", "united states of america", "amerika", "abd"],
  },
  {
    name: "Canada",
    type: "COUNTRY",
    iso2: "CA",
    iso3: "CAN",
    canonicalSlug: "canada",
    aliases: ["canada", "kanada"],
  },
  {
    name: "Italy",
    type: "COUNTRY",
    iso2: "IT",
    iso3: "ITA",
    canonicalSlug: "italy",
    aliases: ["italy", "italia", "italian republic", "italya"],
  },
  {
    name: "Netherlands",
    type: "COUNTRY",
    iso2: "NL",
    iso3: "NLD",
    canonicalSlug: "netherlands",
    aliases: ["netherlands", "holland", "dutch", "hollanda"],
  },
  {
    name: "Switzerland",
    type: "COUNTRY",
    iso2: "CH",
    iso3: "CHE",
    canonicalSlug: "switzerland",
    aliases: ["switzerland", "swiss", "swiss confederation", "isvicre"],
  },
  {
    name: "France",
    type: "COUNTRY",
    iso2: "FR",
    iso3: "FRA",
    canonicalSlug: "france",
    aliases: ["france", "french republic", "fransa"],
  },
];

const PREDEFINED_UNIVERSITIES: PredefinedEntity[] = [
  {
    name: "University of Cambridge",
    type: "UNIVERSITY",
    canonicalSlug: "university-of-cambridge",
    aliases: ["cambridge", "university of cambridge", "cambridge university"],
  },
  {
    name: "University College London",
    type: "UNIVERSITY",
    canonicalSlug: "university-college-london",
    aliases: ["ucl", "university college london"],
  },
  {
    name: "Massachusetts Institute of Technology",
    type: "UNIVERSITY",
    canonicalSlug: "massachusetts-institute-of-technology",
    aliases: ["mit", "massachusetts institute of technology"],
  },
  {
    name: "Harvard University",
    type: "UNIVERSITY",
    canonicalSlug: "harvard-university",
    aliases: ["harvard", "harvard university"],
  },
  {
    name: "University of Oxford",
    type: "UNIVERSITY",
    canonicalSlug: "university-of-oxford",
    aliases: ["oxford", "university of oxford", "oxford university"],
  },
  {
    name: "Imperial College London",
    type: "UNIVERSITY",
    canonicalSlug: "imperial-college-london",
    aliases: ["imperial", "imperial college", "imperial college london"],
  },
  {
    name: "Bocconi University",
    type: "UNIVERSITY",
    canonicalSlug: "bocconi-university",
    aliases: ["bocconi", "bocconi university", "unibocconi"],
  },
  {
    name: "ETH Zurich",
    type: "UNIVERSITY",
    canonicalSlug: "eth-zurich",
    aliases: ["eth", "eth zurich", "swiss federal institute of technology zurich"],
  },
  {
    name: "Delft University of Technology",
    type: "UNIVERSITY",
    canonicalSlug: "tu-delft",
    aliases: ["tu delft", "delft university of technology", "delft"],
  },
  {
    name: "University of Milan",
    type: "UNIVERSITY",
    canonicalSlug: "university-of-milan",
    aliases: ["unimi", "university of milan", "milan university"],
  },
  {
    name: "Sapienza University of Rome",
    type: "UNIVERSITY",
    canonicalSlug: "sapienza-university-of-rome",
    aliases: ["sapienza", "sapienza university of rome", "uniroma1"],
  },
  {
    name: "London Business School",
    type: "UNIVERSITY",
    canonicalSlug: "london-business-school",
    aliases: ["lbs", "london business school"],
  },
  {
    name: "INSEAD",
    type: "UNIVERSITY",
    canonicalSlug: "insead",
    aliases: ["insead"],
  },
];

const PREDEFINED_QUALIFICATIONS: PredefinedEntity[] = [
  { name: "International Baccalaureate", code: "IB", type: "QUALIFICATION", aliases: ["ib", "ib diploma", "international baccalaureate"] },
  { name: "Advanced Placement", code: "AP", type: "QUALIFICATION", aliases: ["ap", "advanced placement", "ap exam", "ap exams"] },
  { name: "SAT Reasoning Test", code: "SAT", type: "QUALIFICATION", aliases: ["sat", "sats", "sat test", "sat exam", "sat reasoning"] },
  { name: "Engineering and Science Admissions Test", code: "ESAT", type: "QUALIFICATION", aliases: ["esat", "engineering and science admissions test"] },
  { name: "Test for Admission to Architecture", code: "TARA", type: "QUALIFICATION", aliases: ["tara"] },
  { name: "Test of Mathematics for University Admission", code: "TMUA", type: "QUALIFICATION", aliases: ["tmua", "test of mathematics for university admission"] },
  { name: "International General Certificate of Secondary Education", code: "IGCSE", type: "QUALIFICATION", aliases: ["igcse", "gcse"] },
  { name: "Graduate Record Examinations", code: "GRE", type: "QUALIFICATION", aliases: ["gre", "graduate record examination"] },
  { name: "Graduate Management Admission Test", code: "GMAT", type: "QUALIFICATION", aliases: ["gmat", "graduate management admission test"] },
  { name: "University Clinical Aptitude Test", code: "UCAT", type: "QUALIFICATION", aliases: ["ucat"] },
  { name: "International Medical Admissions Test", code: "IMAT", type: "QUALIFICATION", aliases: ["imat", "international medical admissions test"] },
  { name: "Online Math Placement Test", code: "OMPT", type: "QUALIFICATION", aliases: ["ompt", "ompt-a", "ompt-b", "ompt-d"] },
  { name: "A-Level", code: "A-LEVEL", type: "QUALIFICATION", aliases: ["a-level", "a level", "a levels", "a-levels", "gce a level"] },
  { name: "ACT", code: "ACT", type: "QUALIFICATION", aliases: ["act", "act test"] },
  { name: "IELTS", code: "IELTS", type: "QUALIFICATION", aliases: ["ielts", "ielts academic"] },
  { name: "TOEFL", code: "TOEFL", type: "QUALIFICATION", aliases: ["toefl", "toefl ibt"] },
];

const PREDEFINED_FIELDS_OF_STUDY: PredefinedEntity[] = [
  { name: "Computer Science", code: "CS", type: "FIELD_OF_STUDY", aliases: ["computer science", "cs", "computer sciences", "comp sci", "computing", "software engineering"] },
  { name: "Medicine", code: "MED", type: "FIELD_OF_STUDY", aliases: ["medicine", "med", "medical", "surgery", "mbbs", "medicine and surgery"] },
  { name: "Engineering", code: "ENG", type: "FIELD_OF_STUDY", aliases: ["engineering", "engineer", "mechanical engineering", "electrical engineering", "civil engineering"] },
  { name: "Economics", code: "ECON", type: "FIELD_OF_STUDY", aliases: ["economics", "econ", "finance", "econometrics"] },
  { name: "Business Administration", code: "BUS", type: "FIELD_OF_STUDY", aliases: ["business administration", "mba", "business", "management", "business analytics"] },
  { name: "Architecture", code: "ARCH", type: "FIELD_OF_STUDY", aliases: ["architecture", "architectural studies"] },
  { name: "Law", code: "LAW", type: "FIELD_OF_STUDY", aliases: ["law", "llb", "jurisprudence"] },
];

const DEGREE_LEVEL_MAP: { [key: string]: DegreeLevel } = {
  mba: "MBA",
  master: "POSTGRADUATE",
  masters: "POSTGRADUATE",
  msc: "POSTGRADUATE",
  postgraduate: "POSTGRADUATE",
  bachelor: "UNDERGRADUATE",
  bachelors: "UNDERGRADUATE",
  bsc: "UNDERGRADUATE",
  undergraduate: "UNDERGRADUATE",
  phd: "PHD",
  doctorate: "PHD",
  foundation: "FOUNDATION",
};

export interface ExtractedEntities {
  universities: EntityMatch[];
  countries: EntityMatch[];
  qualifications: EntityMatch[];
  programs: EntityMatch[];
  fieldsOfStudy: EntityMatch[];
  degreeLevel?: DegreeLevel;
  consumedTokensIndex: Set<number>;
}

export function extractEntities(
  tokens: string[],
  options: { includePredefinedUniversities?: boolean } = {},
): ExtractedEntities {
  const result: ExtractedEntities = {
    universities: [],
    countries: [],
    qualifications: [],
    programs: [],
    fieldsOfStudy: [],
    consumedTokensIndex: new Set<number>(),
  };

  if (!tokens.length) return result;

  const nGrams = generateNGrams(tokens, 4);

  // Check degree levels
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();
    if (DEGREE_LEVEL_MAP[token]) {
      result.degreeLevel = DEGREE_LEVEL_MAP[token];
    }
  }

  const allDefinitions: { list: PredefinedEntity[]; category: keyof Omit<ExtractedEntities, "degreeLevel" | "consumedTokensIndex"> }[] = [
    ...(options.includePredefinedUniversities === false
      ? []
      : [{ list: PREDEFINED_UNIVERSITIES, category: "universities" as const }]),
    { list: PREDEFINED_COUNTRIES, category: "countries" },
    { list: PREDEFINED_QUALIFICATIONS, category: "qualifications" },
    { list: PREDEFINED_FIELDS_OF_STUDY, category: "fieldsOfStudy" },
  ];

  // Resolve every exact entity first. Otherwise a fuzzy, longer n-gram such as
  // "uk computer science" can consume the exact "UK" country token before it
  // is considered.
  for (const allowFuzzy of [false, true]) {
    for (const { phrase, startIndex, endIndex } of nGrams) {
      let overlap = false;
      for (let i = startIndex; i <= endIndex; i++) {
        if (result.consumedTokensIndex.has(i)) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;

      const normPhrase = normalizeQuery(phrase);

      for (const group of allDefinitions) {
        for (const entity of group.list) {
          for (const alias of entity.aliases) {
            const normAlias = normalizeQuery(alias);
            const similarity = stringSimilarity(normPhrase, normAlias);
            const isExact = normPhrase === normAlias;
            const isFuzzy = allowFuzzy && normPhrase.length >= 4 && similarity >= 0.82;

            if ((allowFuzzy && !isFuzzy) || (!allowFuzzy && !isExact)) continue;

            const confidence = isExact ? 1.0 : Math.round(similarity * 100) / 100;
            {
            const match: EntityMatch = {
              id: entity.id,
              code: entity.code,
              name: entity.name,
              matchedTerm: phrase,
              confidence,
              type: entity.type,
              canonicalSlug: entity.canonicalSlug,
              iso2: entity.iso2,
              iso3: entity.iso3,
              isFuzzy: !isExact,
            };

            // Avoid duplicates
            const existing = result[group.category].find((m) => m.name === entity.name);
            if (!existing) {
              result[group.category].push(match);
              for (let i = startIndex; i <= endIndex; i++) {
                result.consumedTokensIndex.add(i);
              }
            }
          }
        }
      }
    }
  }
  }

  return result;
}
