export type AdmissionRelationship =
  | "required"
  | "accepted"
  | "considered"
  | "program_specific"
  | "recommended";

export interface ExamUniversityRelation {
  id: string;
  examCode: string;
  university: {
    name: string;
    country: string;
    city?: string;
    latitude: number;
    longitude: number;
  };
  relationship: AdmissionRelationship;
  programScope?: string;
  source: {
    url: string;
    title: string;
    verifiedAt: string;
  };
}

export interface ExamMapProfile {
  examCode: string;
  label: string;
  focus: {
    latitude: number;
    longitude: number;
    zoom?: number;
  };
  countries: string[]; // ISO 3166-1 alpha-3 codes
  relations: ExamUniversityRelation[];
}

export const examUniversityRelations: ExamUniversityRelation[] = [
  // SAT Mappings
  {
    id: "sat-mit",
    examCode: "SAT",
    university: {
      name: "Massachusetts Institute of Technology (MIT)",
      country: "United States",
      city: "Cambridge, MA",
      latitude: 42.3601,
      longitude: -71.0942,
    },
    relationship: "required",
    programScope: "Undergraduate Admissions",
    source: {
      url: "https://mitadmissions.org/apply/firstyear/tests/",
      title: "MIT Standardized Testing Policy",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "sat-harvard",
    examCode: "SAT",
    university: {
      name: "Harvard University",
      country: "United States",
      city: "Cambridge, MA",
      latitude: 42.377,
      longitude: -71.1167,
    },
    relationship: "accepted",
    programScope: "First-Year Admissions",
    source: {
      url: "https://college.harvard.edu/admissions/apply/first-year-applicants",
      title: "Harvard Application Requirements",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "sat-bocconi",
    examCode: "SAT",
    university: {
      name: "Bocconi University",
      country: "Italy",
      city: "Milan",
      latitude: 45.4486,
      longitude: 9.19,
    },
    relationship: "accepted",
    programScope: "BSc Programs",
    source: {
      url: "https://www.unibocconi.it/en/admissions/undergraduate-programs",
      title: "Bocconi Selection Test Equivalencies",
      verifiedAt: "2026-08-12",
    },
  },

  // IB Mappings
  {
    id: "ib-oxford",
    examCode: "IB",
    university: {
      name: "University of Oxford",
      country: "United Kingdom",
      city: "Oxford",
      latitude: 51.7548,
      longitude: -1.2544,
    },
    relationship: "accepted",
    programScope: "Undergraduate Courses",
    source: {
      url: "https://www.ox.ac.uk/admissions/undergraduate/courses/admission-requirements/international-qualifications",
      title: "Oxford International Qualifications",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "ib-cambridge",
    examCode: "IB",
    university: {
      name: "University of Cambridge",
      country: "United Kingdom",
      city: "Cambridge",
      latitude: 52.2053,
      longitude: 0.1218,
    },
    relationship: "accepted",
    programScope: "Undergraduate Courses",
    source: {
      url: "https://www.undergraduate.study.cam.ac.uk/apply/before/accepted-qualifications",
      title: "Cambridge IB Entry Requirements",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "ib-eth",
    examCode: "IB",
    university: {
      name: "ETH Zurich",
      country: "Switzerland",
      city: "Zurich",
      latitude: 47.3769,
      longitude: 8.5477,
    },
    relationship: "accepted",
    programScope: "Bachelor Studies",
    source: {
      url: "https://ethz.ch/en/studies/bachelor/application/international-qualifications/ib.html",
      title: "ETH Zurich IB Requirements",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "ib-tudelft",
    examCode: "IB",
    university: {
      name: "Delft University of Technology (TU Delft)",
      country: "Netherlands",
      city: "Delft",
      latitude: 52.0006,
      longitude: 4.3716,
    },
    relationship: "accepted",
    programScope: "BSc Engineering Programs",
    source: {
      url: "https://www.tudelft.nl/en/education/admission-and-application/bachelor-with-international-diploma",
      title: "TU Delft IB Admission Requirements",
      verifiedAt: "2026-08-12",
    },
  },

  // AP Mappings
  {
    id: "ap-imperial",
    examCode: "AP",
    university: {
      name: "Imperial College London",
      country: "United Kingdom",
      city: "London",
      latitude: 51.4988,
      longitude: -0.1749,
    },
    relationship: "accepted",
    programScope: "STEM Undergraduate Courses",
    source: {
      url: "https://www.imperial.ac.uk/study/apply/undergraduate/entry-requirements/accepted-qualifications/",
      title: "Imperial AP Accepted Qualifications",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "ap-edinburgh",
    examCode: "AP",
    university: {
      name: "University of Edinburgh",
      country: "United Kingdom",
      city: "Edinburgh",
      latitude: 55.9445,
      longitude: -3.1892,
    },
    relationship: "accepted",
    programScope: "Undergraduate Entry Pathway",
    source: {
      url: "https://www.ed.ac.uk/studying/undergraduate/entry-requirements/international-entry-requirements/usa",
      title: "Edinburgh USA Qualifications Requirements",
      verifiedAt: "2026-08-12",
    },
  },

  // TMUA / ESAT Mappings
  {
    id: "tmua-cambridge",
    examCode: "TMUA",
    university: {
      name: "University of Cambridge",
      country: "United Kingdom",
      city: "Cambridge",
      latitude: 52.2053,
      longitude: 0.1218,
    },
    relationship: "required",
    programScope: "Computer Science & Economics",
    source: {
      url: "https://www.undergraduate.study.cam.ac.uk/apply/after/admission-tests",
      title: "Cambridge Admission Tests",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "esat-cambridge",
    examCode: "ESAT",
    university: {
      name: "University of Cambridge",
      country: "United Kingdom",
      city: "Cambridge",
      latitude: 52.2053,
      longitude: 0.1218,
    },
    relationship: "required",
    programScope: "Engineering & Natural Sciences",
    source: {
      url: "https://www.undergraduate.study.cam.ac.uk/apply/after/admission-tests",
      title: "Cambridge Admission Tests",
      verifiedAt: "2026-08-12",
    },
  },

  // IMAT Mappings
  {
    id: "imat-unimi",
    examCode: "IMAT",
    university: {
      name: "University of Milan (UniMi)",
      country: "Italy",
      city: "Milan",
      latitude: 45.4607,
      longitude: 9.1939,
    },
    relationship: "required",
    programScope: "Medicine and Surgery (English)",
    source: {
      url: "https://www.unimi.it/en/education/single-cycle-degree-programme/medicine-and-surgery-single-cycle",
      title: "Milan International Medical Admissions",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "imat-sapienza",
    examCode: "IMAT",
    university: {
      name: "Sapienza University of Rome",
      country: "Italy",
      city: "Rome",
      latitude: 41.9038,
      longitude: 12.5153,
    },
    relationship: "required",
    programScope: "Medicine and Surgery F",
    source: {
      url: "https://www.uniroma1.it/en/pagina/medicine-and-surgery-f",
      title: "Sapienza Medicine and Surgery Admissions",
      verifiedAt: "2026-08-12",
    },
  },

  // OMPT Mappings
  {
    id: "ompt-uva",
    examCode: "OMPT",
    university: {
      name: "University of Amsterdam (UvA)",
      country: "Netherlands",
      city: "Amsterdam",
      latitude: 52.3559,
      longitude: 4.9551,
    },
    relationship: "program_specific",
    programScope: "Business Analytics & Econometrics",
    source: {
      url: "https://www.omptest.org/universities/university-of-amsterdam",
      title: "OMPT Recognized Institutions - Amsterdam",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "ompt-erasmus",
    examCode: "OMPT",
    university: {
      name: "Erasmus University Rotterdam",
      country: "Netherlands",
      city: "Rotterdam",
      latitude: 51.9172,
      longitude: 4.4841,
    },
    relationship: "program_specific",
    programScope: "International Business Administration",
    source: {
      url: "https://www.omptest.org/universities/erasmus-university-rotterdam",
      title: "OMPT Recognized Institutions - Erasmus",
      verifiedAt: "2026-08-12",
    },
  },

  // GRE & GMAT Mappings
  {
    id: "gre-insead",
    examCode: "GRE",
    university: {
      name: "INSEAD",
      country: "France",
      city: "Fontainebleau",
      latitude: 48.4064,
      longitude: 2.6978,
    },
    relationship: "accepted",
    programScope: "MBA & Master in Management",
    source: {
      url: "https://www.insead.edu/master-programmes/mba/admissions",
      title: "INSEAD Master Admissions",
      verifiedAt: "2026-08-12",
    },
  },
  {
    id: "gmat-lbs",
    examCode: "GMAT",
    university: {
      name: "London Business School (LBS)",
      country: "United Kingdom",
      city: "London",
      latitude: 51.5262,
      longitude: -0.1588,
    },
    relationship: "accepted",
    programScope: "MBA & Graduate Programs",
    source: {
      url: "https://www.london.edu/masters-degrees/mba/apply",
      title: "LBS Admissions Requirements",
      verifiedAt: "2026-08-12",
    },
  },
];

export const examMapProfiles: ExamMapProfile[] = [
  {
    examCode: "SAT",
    label: "SAT",
    focus: { latitude: 38, longitude: -50, zoom: 1.1 },
    countries: ["USA", "ITA", "GBR", "CAN"],
    relations: examUniversityRelations.filter((r) => r.examCode === "SAT"),
  },
  {
    examCode: "IB",
    label: "IB (International Baccalaureate)",
    focus: { latitude: 50, longitude: 10, zoom: 1.3 },
    countries: ["GBR", "NLD", "CHE", "DEU", "USA", "CAN"],
    relations: examUniversityRelations.filter((r) => r.examCode === "IB"),
  },
  {
    examCode: "AP",
    label: "AP (Advanced Placement)",
    focus: { latitude: 50, longitude: -20, zoom: 1.2 },
    countries: ["USA", "GBR", "CAN"],
    relations: examUniversityRelations.filter((r) => r.examCode === "AP"),
  },
  {
    examCode: "ESAT",
    label: "ESAT",
    focus: { latitude: 53, longitude: -2, zoom: 1.8 },
    countries: ["GBR"],
    relations: examUniversityRelations.filter((r) => r.examCode === "ESAT"),
  },
  {
    examCode: "TMUA",
    label: "TMUA",
    focus: { latitude: 53, longitude: -2, zoom: 1.8 },
    countries: ["GBR"],
    relations: examUniversityRelations.filter((r) => r.examCode === "TMUA"),
  },
  {
    examCode: "IMAT",
    label: "IMAT",
    focus: { latitude: 42, longitude: 12, zoom: 1.8 },
    countries: ["ITA"],
    relations: examUniversityRelations.filter((r) => r.examCode === "IMAT"),
  },
  {
    examCode: "OMPT",
    label: "OMPT",
    focus: { latitude: 52, longitude: 5, zoom: 1.8 },
    countries: ["NLD"],
    relations: examUniversityRelations.filter((r) => r.examCode === "OMPT"),
  },
  {
    examCode: "GRE",
    label: "GRE",
    focus: { latitude: 48, longitude: 5, zoom: 1.3 },
    countries: ["FRA", "GBR", "USA"],
    relations: examUniversityRelations.filter((r) => r.examCode === "GRE"),
  },
  {
    examCode: "GMAT",
    label: "GMAT",
    focus: { latitude: 50, longitude: 0, zoom: 1.3 },
    countries: ["GBR", "FRA", "USA"],
    relations: examUniversityRelations.filter((r) => r.examCode === "GMAT"),
  },
];
