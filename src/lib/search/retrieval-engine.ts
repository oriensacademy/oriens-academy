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
  matchLayer: 1 | 2 | 3 | 4 | 5 | 6;
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
  sourceStatus?: "database" | "local" | "local-exams";
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
    aliases: ["cambridge", "university of cambridge", "cambridge university", "cam", "kembridc", "cambdrige"],
    popularityScore: 99,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "UK Top 1",
    officialUrl: "https://www.cam.ac.uk",
  },
  {
    id: "uni-oxford",
    type: "UNIVERSITY",
    title: "University of Oxford",
    subtitle: "Oxford, United Kingdom",
    slug: "university-of-oxford",
    aliases: ["oxford", "university of oxford", "oxford university", "oxfrod"],
    popularityScore: 100,
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
    popularityScore: 98,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "STEM",
    officialUrl: "https://www.imperial.ac.uk",
  },
  {
    id: "uni-ucl",
    type: "UNIVERSITY",
    title: "University College London",
    subtitle: "London, United Kingdom",
    slug: "university-college-london",
    aliases: ["ucl", "university college london"],
    popularityScore: 96,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "London",
    officialUrl: "https://www.ucl.ac.uk",
  },
  {
    id: "uni-lse",
    type: "UNIVERSITY",
    title: "London School of Economics",
    subtitle: "London, United Kingdom",
    slug: "london-school-of-economics",
    aliases: ["lse", "london school of economics", "london school of economics and political science"],
    popularityScore: 95,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "Economics",
    officialUrl: "https://www.lse.ac.uk",
  },
  {
    id: "uni-kcl",
    type: "UNIVERSITY",
    title: "King's College London",
    subtitle: "London, United Kingdom",
    slug: "kings-college-london",
    aliases: ["kcl", "king's college london", "kings college london"],
    popularityScore: 93,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "London",
    officialUrl: "https://www.kcl.ac.uk",
  },
  {
    id: "uni-warwick",
    type: "UNIVERSITY",
    title: "University of Warwick",
    subtitle: "Coventry, United Kingdom",
    slug: "university-of-warwick",
    aliases: ["warwick", "university of warwick"],
    popularityScore: 91,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "Russell Group",
    officialUrl: "https://warwick.ac.uk",
  },
  {
    id: "uni-durham",
    type: "UNIVERSITY",
    title: "Durham University",
    subtitle: "Durham, United Kingdom",
    slug: "durham-university",
    aliases: ["durham", "durham university"],
    popularityScore: 90,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "Russell Group",
    officialUrl: "https://www.durham.ac.uk",
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
    aliases: ["harvard", "harvard university", "harward"],
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
    aliases: ["stanford", "stanford university", "standford", "stanford univ"],
    popularityScore: 99,
    countryIso2: "US",
    countryName: "United States",
    badge: "Top US",
    officialUrl: "https://www.stanford.edu",
  },
  {
    id: "uni-princeton",
    type: "UNIVERSITY",
    title: "Princeton University",
    subtitle: "Princeton, NJ, United States",
    slug: "princeton-university",
    aliases: ["princeton", "princeton university"],
    popularityScore: 98,
    countryIso2: "US",
    countryName: "United States",
    badge: "Ivy League",
    officialUrl: "https://www.princeton.edu",
  },
  {
    id: "uni-yale",
    type: "UNIVERSITY",
    title: "Yale University",
    subtitle: "New Haven, CT, United States",
    slug: "yale-university",
    aliases: ["yale", "yale university"],
    popularityScore: 98,
    countryIso2: "US",
    countryName: "United States",
    badge: "Ivy League",
    officialUrl: "https://www.yale.edu",
  },
  {
    id: "uni-toronto",
    type: "UNIVERSITY",
    title: "University of Toronto",
    subtitle: "Toronto, ON, Canada",
    slug: "university-of-toronto",
    aliases: ["toronto", "uoft", "u of t", "university of toronto", "toronto university", "torontosu"],
    popularityScore: 97,
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
    popularityScore: 95,
    countryIso2: "CA",
    countryName: "Canada",
    badge: "Canada Top 2",
    officialUrl: "https://www.ubc.ca",
  },
  {
    id: "uni-mcgill",
    type: "UNIVERSITY",
    title: "McGill University",
    subtitle: "Montreal, QC, Canada",
    slug: "mcgill-university",
    aliases: ["mcgill", "mcgill university"],
    popularityScore: 94,
    countryIso2: "CA",
    countryName: "Canada",
    badge: "Canada Top 3",
    officialUrl: "https://www.mcgill.ca",
  },
  {
    id: "uni-bocconi",
    type: "UNIVERSITY",
    title: "Bocconi University",
    subtitle: "Milan, Italy",
    slug: "bocconi-university",
    aliases: ["bocconi", "bocconi university", "unibocconi", "bokoni", "universita bocconi"],
    popularityScore: 93,
    countryIso2: "IT",
    countryName: "Italy",
    badge: "Business",
    officialUrl: "https://www.unibocconi.it",
  },
  {
    id: "uni-unimi",
    type: "UNIVERSITY",
    title: "University of Milan",
    subtitle: "Milan, Italy",
    slug: "university-of-milan",
    aliases: ["unimi", "university of milan", "milan university"],
    popularityScore: 89,
    countryIso2: "IT",
    countryName: "Italy",
    badge: "Italy Medicine",
    officialUrl: "https://www.unimi.it",
  },
  {
    id: "uni-sapienza",
    type: "UNIVERSITY",
    title: "Sapienza University of Rome",
    subtitle: "Rome, Italy",
    slug: "sapienza-university-of-rome",
    aliases: ["sapienza", "sapienza university of rome", "uniroma1"],
    popularityScore: 90,
    countryIso2: "IT",
    countryName: "Italy",
    badge: "Italy Public",
    officialUrl: "https://www.uniroma1.it",
  },
  {
    id: "uni-polimi",
    type: "UNIVERSITY",
    title: "Politecnico di Milano",
    subtitle: "Milan, Italy",
    slug: "politecnico-di-milano",
    aliases: ["polimi", "politecnico di milano", "milan polytechnic"],
    popularityScore: 92,
    countryIso2: "IT",
    countryName: "Italy",
    badge: "Architecture & STEM",
    officialUrl: "https://www.polimi.it",
  },
  {
    id: "uni-eth",
    type: "UNIVERSITY",
    title: "ETH Zurich",
    subtitle: "Zurich, Switzerland",
    slug: "eth-zurich",
    aliases: ["eth", "eth zurich", "eth zürich", "swiss federal institute of technology", "zurih teknik"],
    popularityScore: 97,
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
    aliases: ["epfl", "ecole polytechnique federale de lausanne"],
    popularityScore: 95,
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
    aliases: ["tum", "tu munich", "technical university of munich", "tu münchen", "tu munchen", "technische universität münchen", "munih teknik"],
    popularityScore: 96,
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
    aliases: ["tu delft", "delft", "delft university of technology", "tudelft"],
    popularityScore: 93,
    countryIso2: "NL",
    countryName: "Netherlands",
    badge: "Engineering",
    officialUrl: "https://www.tudelft.nl",
  },
  {
    id: "uni-uva",
    type: "UNIVERSITY",
    title: "University of Amsterdam",
    subtitle: "Amsterdam, Netherlands",
    slug: "university-of-amsterdam",
    aliases: ["uva", "university of amsterdam", "amsterdam university"],
    popularityScore: 92,
    countryIso2: "NL",
    countryName: "Netherlands",
    badge: "Netherlands Top 1",
    officialUrl: "https://www.uva.nl",
  },
  {
    id: "uni-erasmus",
    type: "UNIVERSITY",
    title: "Erasmus University Rotterdam",
    subtitle: "Rotterdam, Netherlands",
    slug: "erasmus-university-rotterdam",
    aliases: ["erasmus", "erasmus university rotterdam", "eur"],
    popularityScore: 91,
    countryIso2: "NL",
    countryName: "Netherlands",
    badge: "Business & Economics",
    officialUrl: "https://www.eur.nl",
  },
  {
    id: "uni-insead",
    type: "UNIVERSITY",
    title: "INSEAD",
    subtitle: "Fontainebleau, France",
    slug: "insead",
    aliases: ["insead"],
    popularityScore: 94,
    countryIso2: "FR",
    countryName: "France",
    badge: "Top Global MBA",
    officialUrl: "https://www.insead.edu",
  },
  {
    id: "uni-lbs",
    type: "UNIVERSITY",
    title: "London Business School",
    subtitle: "London, United Kingdom",
    slug: "london-business-school",
    aliases: ["lbs", "london business school"],
    popularityScore: 93,
    countryIso2: "GB",
    countryName: "United Kingdom",
    badge: "Business",
    officialUrl: "https://www.london.edu",
  },

  // COUNTRIES
  {
    id: "country-gb",
    type: "COUNTRY",
    title: "United Kingdom",
    subtitle: "Europe",
    slug: "united-kingdom",
    aliases: ["uk", "united kingdom", "great britain", "england", "britain", "ingiltere", "birlesik krallik"],
    popularityScore: 99,
    countryIso2: "GB",
    countryName: "United Kingdom",
  },
  {
    id: "country-us",
    type: "COUNTRY",
    title: "United States",
    subtitle: "North America",
    slug: "united-states",
    aliases: ["usa", "united states", "us", "america", "amerika", "abd"],
    popularityScore: 99,
    countryIso2: "US",
    countryName: "United States",
  },
  {
    id: "country-ca",
    type: "COUNTRY",
    title: "Canada",
    subtitle: "North America",
    slug: "canada",
    aliases: ["canada", "kanada"],
    popularityScore: 94,
    countryIso2: "CA",
    countryName: "Canada",
  },
  {
    id: "country-it",
    type: "COUNTRY",
    title: "Italy",
    subtitle: "Europe",
    slug: "italy",
    aliases: ["italy", "italia", "italya"],
    popularityScore: 92,
    countryIso2: "IT",
    countryName: "Italy",
  },
  {
    id: "country-nl",
    type: "COUNTRY",
    title: "Netherlands",
    subtitle: "Europe",
    slug: "netherlands",
    aliases: ["netherlands", "holland", "dutch", "hollanda"],
    popularityScore: 90,
    countryIso2: "NL",
    countryName: "Netherlands",
  },
  {
    id: "country-de",
    type: "COUNTRY",
    title: "Germany",
    subtitle: "Europe",
    slug: "germany",
    aliases: ["germany", "deutschland", "almanya"],
    popularityScore: 91,
    countryIso2: "DE",
    countryName: "Germany",
  },
  {
    id: "country-ch",
    type: "COUNTRY",
    title: "Switzerland",
    subtitle: "Europe",
    slug: "switzerland",
    aliases: ["switzerland", "swiss", "isvicre", "schweiz"],
    popularityScore: 92,
    countryIso2: "CH",
    countryName: "Switzerland",
  },
  {
    id: "country-fr",
    type: "COUNTRY",
    title: "France",
    subtitle: "Europe",
    slug: "france",
    aliases: ["france", "fransa"],
    popularityScore: 90,
    countryIso2: "FR",
    countryName: "France",
  },

  // 18 CANONICAL QUALIFICATIONS
  {
    id: "qual-ib",
    type: "QUALIFICATION",
    title: "International Baccalaureate (IB)",
    subtitle: "International Curriculum / Diploma",
    slug: "ib",
    aliases: ["ib", "ib diploma", "international baccalaureate", "ib dp", "ib bakalorya"],
    popularityScore: 99,
    officialUrl: "https://www.ibo.org",
    badge: "Diploma",
  },
  {
    id: "qual-ap",
    type: "QUALIFICATION",
    title: "Advanced Placement (AP)",
    subtitle: "International Curriculum / Diploma",
    slug: "ap",
    aliases: ["ap", "advanced placement", "ap exam", "ap exams", "ap sinavi"],
    popularityScore: 98,
    officialUrl: "https://apstudents.collegeboard.org",
    badge: "Curriculum",
  },
  {
    id: "qual-igcse",
    type: "QUALIFICATION",
    title: "International GCSE (IGCSE)",
    subtitle: "International Curriculum / Diploma",
    slug: "igcse",
    aliases: ["igcse", "gcse", "international gcse", "cambridge igcse"],
    popularityScore: 94,
    officialUrl: "https://www.cambridgeinternational.org",
    badge: "Curriculum",
  },
  {
    id: "qual-alevel",
    type: "QUALIFICATION",
    title: "GCE A-Level",
    subtitle: "International Curriculum / Diploma",
    slug: "a-level",
    aliases: ["a-level", "a level", "a levels", "a-levels", "gce a level", "alevel"],
    popularityScore: 97,
    officialUrl: "https://www.cambridgeinternational.org",
    badge: "Curriculum",
  },
  {
    id: "qual-sat",
    type: "QUALIFICATION",
    title: "Digital SAT",
    subtitle: "International Curriculum / Diploma",
    slug: "sat",
    aliases: ["sat", "digital sat", "sats", "sat test", "sat exam", "sat reasoning", "sat sinavi"],
    popularityScore: 99,
    officialUrl: "https://satsuite.collegeboard.org",
    badge: "Admissions Test",
  },
  {
    id: "qual-act",
    type: "QUALIFICATION",
    title: "ACT",
    subtitle: "International Curriculum / Diploma",
    slug: "act",
    aliases: ["act", "act test", "american college testing"],
    popularityScore: 93,
    officialUrl: "https://www.act.org",
    badge: "Admissions Test",
  },
  {
    id: "qual-esat",
    type: "QUALIFICATION",
    title: "Engineering and Science Admissions Test (ESAT)",
    subtitle: "Admission / Program-Specific",
    slug: "esat",
    aliases: ["esat", "engineering and science admissions test", "cambridge esat", "imperial esat"],
    popularityScore: 92,
    officialUrl: "https://esat-admissions.org.uk",
    badge: "UK STEM",
  },
  {
    id: "qual-tmua",
    type: "QUALIFICATION",
    title: "Test of Mathematics for University Admission (TMUA)",
    subtitle: "Admission / Program-Specific",
    slug: "tmua",
    aliases: ["tmua", "test of mathematics for university admission", "cambridge tmua"],
    popularityScore: 93,
    officialUrl: "https://www.tmua.org.uk",
    badge: "UK Math",
  },
  {
    id: "qual-tara",
    type: "QUALIFICATION",
    title: "Test of Academic Reasoning for Admissions (TARA)",
    subtitle: "Admission / Program-Specific",
    slug: "tara",
    aliases: ["tara", "test of academic reasoning for admissions", "academic reasoning admissions test"],
    popularityScore: 88,
    officialUrl: "https://esat-tmua.ac.uk/about-the-tests/tara/",
    badge: "Academic Reasoning",
  },
  {
    id: "qual-ucat",
    type: "QUALIFICATION",
    title: "University Clinical Aptitude Test (UCAT)",
    subtitle: "Admission / Program-Specific",
    slug: "ucat",
    aliases: ["ucat", "ukcat", "university clinical aptitude test", "uk clinical aptitude test", "ucat anz"],
    popularityScore: 96,
    officialUrl: "https://www.ucat.ac.uk",
    badge: "Medical Aptitude",
  },
  {
    id: "qual-lnat",
    type: "QUALIFICATION",
    title: "National Admissions Test for Law (LNAT)",
    subtitle: "Admission / Program-Specific",
    slug: "lnat",
    aliases: ["lnat", "national admissions test for law", "law national aptitude test", "hukuk kabul sinavi"],
    popularityScore: 91,
    officialUrl: "https://lnat.ac.uk",
    badge: "Law Test",
  },
  {
    id: "qual-imat",
    type: "QUALIFICATION",
    title: "International Medical Admissions Test (IMAT)",
    subtitle: "Admission / Program-Specific",
    slug: "imat",
    aliases: ["imat", "international medical admissions test", "italy medicine test", "italya tip sinavi"],
    popularityScore: 94,
    officialUrl: "https://www.universitaly.it",
    badge: "Italy Medicine",
  },
  {
    id: "qual-gamsat",
    type: "QUALIFICATION",
    title: "Graduate Medical School Admissions Test (GAMSAT)",
    subtitle: "Admission / Program-Specific",
    slug: "gamsat",
    aliases: ["gamsat", "graduate medical school admissions test"],
    popularityScore: 89,
    officialUrl: "https://gamsat.acer.org",
    badge: "Graduate Medicine",
  },
  {
    id: "qual-mcat",
    type: "QUALIFICATION",
    title: "Medical College Admission Test (MCAT)",
    subtitle: "Admission / Program-Specific",
    slug: "mcat",
    aliases: ["mcat", "medical college admission test", "amerika tip sinavi"],
    popularityScore: 95,
    officialUrl: "https://students-residents.aamc.org/mcat",
    badge: "US / CA Medicine",
  },
  {
    id: "qual-lsat",
    type: "QUALIFICATION",
    title: "Law School Admission Test (LSAT)",
    subtitle: "Admission / Program-Specific",
    slug: "lsat",
    aliases: ["lsat", "law school admission test", "lsat exam"],
    popularityScore: 94,
    officialUrl: "https://www.lsac.org/lsat",
    badge: "JD Law",
  },
  {
    id: "qual-gre",
    type: "QUALIFICATION",
    title: "Graduate Record Examination (GRE)",
    subtitle: "Admission / Program-Specific",
    slug: "gre",
    aliases: ["gre", "graduate record examination", "graduate record examinations", "gre general test"],
    popularityScore: 95,
    officialUrl: "https://www.ets.org/gre",
    badge: "Graduate Entry",
  },
  {
    id: "qual-gmat",
    type: "QUALIFICATION",
    title: "GMAT Exam",
    subtitle: "Admission / Program-Specific",
    slug: "gmat",
    aliases: ["gmat", "gmat focus", "graduate management admission test", "gmat focus edition"],
    popularityScore: 95,
    officialUrl: "https://www.mba.com/exams/gmat-exam",
    badge: "MBA Test",
  },
  {
    id: "qual-ompt",
    type: "QUALIFICATION",
    title: "Online Mathematics Placement Test (OMPT)",
    subtitle: "Admission / Program-Specific",
    slug: "ompt",
    aliases: ["ompt", "ompt-a", "ompt-b", "ompt-c", "ompt-d", "ompt-e", "ompt-f", "online math placement test", "hollanda matematik sinavi"],
    popularityScore: 90,
    officialUrl: "https://www.omptest.org",
    badge: "Math Placement",
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
