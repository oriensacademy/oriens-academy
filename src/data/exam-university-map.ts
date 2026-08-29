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
  // A-Level Mappings
  {
    id: "alevel-cambridge",
    examCode: "A-Level",
    university: {
      name: "University of Cambridge",
      country: "United Kingdom",
      city: "Cambridge",
      latitude: 52.2053,
      longitude: 0.1218,
    },
    relationship: "required",
    programScope: "Undergraduate Admissions (A*A*A – A*AA)",
    source: {
      url: "https://www.undergraduate.study.cam.ac.uk/apply/entrance-requirements",
      title: "University of Cambridge Entrance Requirements",
      verifiedAt: "2026-08-30",
    },
  },
  {
    id: "alevel-oxford",
    examCode: "A-Level",
    university: {
      name: "University of Oxford",
      country: "United Kingdom",
      city: "Oxford",
      latitude: 51.7548,
      longitude: -1.2544,
    },
    relationship: "required",
    programScope: "Undergraduate Admissions (A*A*A – AAA)",
    source: {
      url: "https://www.ox.ac.uk/admissions/undergraduate/applying-to-oxford/guide/admissions-requirements",
      title: "University of Oxford Admission Requirements",
      verifiedAt: "2026-08-30",
    },
  },
  {
    id: "alevel-imperial",
    examCode: "A-Level",
    university: {
      name: "Imperial College London",
      country: "United Kingdom",
      city: "London",
      latitude: 51.4988,
      longitude: -0.1749,
    },
    relationship: "required",
    programScope: "Engineering & Science Degrees (A*A*A – AAA)",
    source: {
      url: "https://www.imperial.ac.uk/study/courses/undergraduate/",
      title: "Imperial College London Course Requirements",
      verifiedAt: "2026-08-30",
    },
  },

  // ACT Mappings
  {
    id: "act-stanford",
    examCode: "ACT",
    university: {
      name: "Stanford University",
      country: "United States",
      city: "Stanford, CA",
      latitude: 37.4275,
      longitude: -122.1697,
    },
    relationship: "accepted",
    programScope: "Undergraduate Admissions",
    source: {
      url: "https://admission.stanford.edu/apply/first-year/testing.html",
      title: "Stanford Testing Policy",
      verifiedAt: "2026-08-30",
    },
  },
  {
    id: "act-mit",
    examCode: "ACT",
    university: {
      name: "Massachusetts Institute of Technology (MIT)",
      country: "United States",
      city: "Cambridge, MA",
      latitude: 42.3601,
      longitude: -71.0942,
    },
    relationship: "required",
    programScope: "Undergraduate Admissions (ACT or SAT)",
    source: {
      url: "https://mitadmissions.org/apply/firstyear/tests/",
      title: "MIT Standardized Testing Policy",
      verifiedAt: "2026-08-30",
    },
  },

  // IGCSE Mappings
  {
    id: "igcse-cambridge",
    examCode: "IGCSE",
    university: {
      name: "University of Cambridge",
      country: "United Kingdom",
      city: "Cambridge",
      latitude: 52.2053,
      longitude: 0.1218,
    },
    relationship: "considered",
    programScope: "Secondary Academic Foundation",
    source: {
      url: "https://www.undergraduate.study.cam.ac.uk/apply/entrance-requirements",
      title: "University of Cambridge Academic Record Policy",
      verifiedAt: "2026-08-30",
    },
  },

  // TARA Mappings
  {
    id: "tara-polimi",
    examCode: "TARA",
    university: {
      name: "Politecnico di Milano",
      country: "Italy",
      city: "Milan",
      latitude: 45.4781,
      longitude: 9.2274,
    },
    relationship: "required",
    programScope: "Laurea in Architectural Design",
    source: {
      url: "https://www.polimi.it/en/international-prospective-students/how-to-apply/laurea-programmes/admissions-test",
      title: "Politecnico di Milano Architecture Admissions",
      verifiedAt: "2026-08-30",
    },
  },
  {
    id: "tara-polito",
    examCode: "TARA",
    university: {
      name: "Politecnico di Torino",
      country: "Italy",
      city: "Turin",
      latitude: 45.0624,
      longitude: 7.6622,
    },
    relationship: "required",
    programScope: "Bachelor in Architecture",
    source: {
      url: "https://www.polito.it/en/education/applying-studying-graduating/admissions-and-enrolment/bachelor-s-degree-programmes",
      title: "Politecnico di Torino Architecture Admissions",
      verifiedAt: "2026-08-30",
    },
  },

  // UCAT Mappings
  {
    id: "ucat-edinburgh",
    examCode: "UCAT",
    university: {
      name: "University of Edinburgh",
      country: "United Kingdom",
      city: "Edinburgh",
      latitude: 55.9445,
      longitude: -3.1892,
    },
    relationship: "required",
    programScope: "MBChB Medicine",
    source: {
      url: "https://www.ed.ac.uk/studying/undergraduate/degrees/index.php?action=view&code=A100",
      title: "University of Edinburgh Medicine Admissions",
      verifiedAt: "2026-08-30",
    },
  },
  {
    id: "ucat-kcl",
    examCode: "UCAT",
    university: {
      name: "King's College London",
      country: "United Kingdom",
      city: "London",
      latitude: 51.5115,
      longitude: -0.116,
    },
    relationship: "required",
    programScope: "MBBS Medicine & BDS Dentistry",
    source: {
      url: "https://www.kcl.ac.uk/study/undergraduate/courses/medicine-mbbs",
      title: "King's College London Medicine Admissions",
      verifiedAt: "2026-08-30",
    },
  },

  // LNAT Mappings
  {
    id: "lnat-oxford",
    examCode: "LNAT",
    university: {
      name: "University of Oxford",
      country: "United Kingdom",
      city: "Oxford",
      latitude: 51.7548,
      longitude: -1.2544,
    },
    relationship: "required",
    programScope: "BA Jurisprudence (Law)",
    source: {
      url: "https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/law-jurisprudence",
      title: "Oxford Law Admissions LNAT Requirement",
      verifiedAt: "2026-08-30",
    },
  },
  {
    id: "lnat-ucl",
    examCode: "LNAT",
    university: {
      name: "University College London (UCL)",
      country: "United Kingdom",
      city: "London",
      latitude: 51.5246,
      longitude: -0.134,
    },
    relationship: "required",
    programScope: "LLB Law",
    source: {
      url: "https://www.ucl.ac.uk/prospective-students/undergraduate/degrees/law-llb",
      title: "UCL Law Admissions",
      verifiedAt: "2026-08-30",
    },
  },

  // GAMSAT Mappings
  {
    id: "gamsat-nottingham",
    examCode: "GAMSAT",
    university: {
      name: "University of Edinburgh",
      country: "United Kingdom",
      city: "Edinburgh",
      latitude: 55.9445,
      longitude: -3.1892,
    },
    relationship: "program_specific",
    programScope: "Graduate Entry Medicine (UK/Australia)",
    source: {
      url: "https://gamsat.acer.org/university-admission",
      title: "ACER GAMSAT Recognized Universities",
      verifiedAt: "2026-08-30",
    },
  },

  // MCAT Mappings
  {
    id: "mcat-harvard",
    examCode: "MCAT",
    university: {
      name: "Harvard University",
      country: "United States",
      city: "Cambridge, MA",
      latitude: 42.377,
      longitude: -71.1167,
    },
    relationship: "required",
    programScope: "MD Program (Harvard Medical School)",
    source: {
      url: "https://meded.hms.harvard.edu/admissions-prereqs",
      title: "Harvard Medical School Admissions",
      verifiedAt: "2026-08-30",
    },
  },
  {
    id: "mcat-toronto",
    examCode: "MCAT",
    university: {
      name: "University of Toronto",
      country: "Canada",
      city: "Toronto, ON",
      latitude: 43.6629,
      longitude: -79.3957,
    },
    relationship: "required",
    programScope: "MD Program (Temerty Faculty of Medicine)",
    source: {
      url: "https://applymd.utoronto.ca/admission-requirements",
      title: "University of Toronto MD Admissions",
      verifiedAt: "2026-08-30",
    },
  },

  // LSAT Mappings
  {
    id: "lsat-harvard",
    examCode: "LSAT",
    university: {
      name: "Harvard University",
      country: "United States",
      city: "Cambridge, MA",
      latitude: 42.377,
      longitude: -71.1167,
    },
    relationship: "required",
    programScope: "JD Program (Harvard Law School)",
    source: {
      url: "https://hls.harvard.edu/jd-admissions/apply-to-harvard-law-school/application-components/",
      title: "Harvard Law School JD Admissions",
      verifiedAt: "2026-08-30",
    },
  },
  {
    id: "lsat-toronto",
    examCode: "LSAT",
    university: {
      name: "University of Toronto",
      country: "Canada",
      city: "Toronto, ON",
      latitude: 43.6629,
      longitude: -79.3957,
    },
    relationship: "required",
    programScope: "JD Program (Faculty of Law)",
    source: {
      url: "https://www.law.utoronto.ca/jd-admissions",
      title: "University of Toronto Faculty of Law Admissions",
      verifiedAt: "2026-08-30",
    },
  },
];

export const examMapProfiles: ExamMapProfile[] = [
  {
    examCode: "SAT",
    label: "Digital SAT",
    focus: { latitude: 38, longitude: -50, zoom: 1.1 },
    countries: ["USA", "ITA", "GBR", "CAN"],
    relations: examUniversityRelations.filter((r) => r.examCode === "SAT"),
  },
  {
    examCode: "ACT",
    label: "ACT",
    focus: { latitude: 38, longitude: -90, zoom: 1.1 },
    countries: ["USA", "CAN"],
    relations: examUniversityRelations.filter((r) => r.examCode === "ACT"),
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
    examCode: "A-Level",
    label: "A-Level",
    focus: { latitude: 53, longitude: -2, zoom: 1.8 },
    countries: ["GBR"],
    relations: examUniversityRelations.filter((r) => r.examCode === "A-Level"),
  },
  {
    examCode: "IGCSE",
    label: "Cambridge IGCSE",
    focus: { latitude: 53, longitude: -2, zoom: 1.8 },
    countries: ["GBR"],
    relations: examUniversityRelations.filter((r) => r.examCode === "IGCSE"),
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
    examCode: "TARA",
    label: "TARA / TEST-ARCHED",
    focus: { latitude: 45, longitude: 9, zoom: 1.8 },
    countries: ["ITA"],
    relations: examUniversityRelations.filter((r) => r.examCode === "TARA"),
  },
  {
    examCode: "UCAT",
    label: "UCAT",
    focus: { latitude: 54, longitude: -3, zoom: 1.8 },
    countries: ["GBR", "AUS"],
    relations: examUniversityRelations.filter((r) => r.examCode === "UCAT"),
  },
  {
    examCode: "LNAT",
    label: "LNAT",
    focus: { latitude: 53, longitude: -2, zoom: 1.8 },
    countries: ["GBR"],
    relations: examUniversityRelations.filter((r) => r.examCode === "LNAT"),
  },
  {
    examCode: "IMAT",
    label: "IMAT",
    focus: { latitude: 42, longitude: 12, zoom: 1.8 },
    countries: ["ITA"],
    relations: examUniversityRelations.filter((r) => r.examCode === "IMAT"),
  },
  {
    examCode: "GAMSAT",
    label: "GAMSAT",
    focus: { latitude: 53, longitude: -2, zoom: 1.8 },
    countries: ["GBR", "AUS", "IRL"],
    relations: examUniversityRelations.filter((r) => r.examCode === "GAMSAT"),
  },
  {
    examCode: "MCAT",
    label: "MCAT",
    focus: { latitude: 45, longitude: -85, zoom: 1.2 },
    countries: ["USA", "CAN"],
    relations: examUniversityRelations.filter((r) => r.examCode === "MCAT"),
  },
  {
    examCode: "LSAT",
    label: "LSAT",
    focus: { latitude: 45, longitude: -85, zoom: 1.2 },
    countries: ["USA", "CAN"],
    relations: examUniversityRelations.filter((r) => r.examCode === "LSAT"),
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
    label: "GMAT Focus",
    focus: { latitude: 50, longitude: 0, zoom: 1.3 },
    countries: ["GBR", "FRA", "USA"],
    relations: examUniversityRelations.filter((r) => r.examCode === "GMAT"),
  },
];
