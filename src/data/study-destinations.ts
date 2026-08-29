import { examMapProfiles } from "@/data/exam-university-map";
import { examRecords, type ExamCode } from "@/content/exams";
import { getVerifiedOfficialUniversityUrl } from "@/data/official-universities";
import type { StudyCountry, StudyRegion, StudyUniversity, ExamEvidenceChip } from "@/components/discovery/globe-types";

export interface FeaturedCountrySeed {
  id: string;
  iso3: string;
  labelTr: string;
  labelEn: string;
  focus: { lat: number; lng: number; altitude?: number };
  examCodes: ExamCode[];
  topUniversities: Array<{
    id: string;
    name: string;
    city: string;
    lat: number;
    lng: number;
    officialUrl: string;
    admissionsUrl: string;
    sourceUrl: string;
    verifiedAt: string;
    examChips: ExamEvidenceChip[];
  }>;
}

export const FEATURED_COUNTRY_SEEDS: FeaturedCountrySeed[] = [
  // 1. United Kingdom (GBR)
  {
    id: "uk",
    iso3: "GBR",
    labelTr: "Birleşik Krallık",
    labelEn: "United Kingdom",
    focus: { lat: 53.5, lng: -2.0, altitude: 1.25 },
    examCodes: ["A-Level", "IB", "ESAT", "TMUA", "UCAT", "LNAT", "GAMSAT", "IGCSE", "GRE", "GMAT"],
    topUniversities: [
      {
        id: "oxford",
        name: "University of Oxford",
        city: "Oxford",
        lat: 51.7548,
        lng: -1.2544,
        officialUrl: "https://www.ox.ac.uk",
        admissionsUrl: "https://www.ox.ac.uk/admissions/undergraduate",
        sourceUrl: "https://www.ox.ac.uk/admissions/undergraduate/applying-to-oxford/tests",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "A-Level", relationship: "required", labelTr: "A-Level · İsteniyor", labelEn: "A-Level · Required", evidence: "Standard conditional offer benchmark" },
          { exam: "LNAT", relationship: "program_specific", labelTr: "LNAT · Hukuk için zorunlu", labelEn: "LNAT · Mandatory for Law", evidence: "Required for BA Jurisprudence" },
          { exam: "TMUA", relationship: "program_specific", labelTr: "TMUA · Matematik & Bilgisayar", labelEn: "TMUA · Math & Computer Science", evidence: "Mandatory admissions test" },
          { exam: "UCAT", relationship: "program_specific", labelTr: "UCAT · Tıp için zorunlu", labelEn: "UCAT · Mandatory for Medicine", evidence: "Required for Medicine A100" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Kabul ediliyor (38-40+)", labelEn: "IB · Accepted (38-40+)", evidence: "Minimum 38-40 points with 6s/7s at HL" },
        ],
      },
      {
        id: "cambridge",
        name: "University of Cambridge",
        city: "Cambridge",
        lat: 52.2043,
        lng: 0.1149,
        officialUrl: "https://www.cam.ac.uk",
        admissionsUrl: "https://www.undergraduate.study.cam.ac.uk",
        sourceUrl: "https://www.undergraduate.study.cam.ac.uk/apply/how/admission-tests",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "A-Level", relationship: "required", labelTr: "A-Level · İsteniyor", labelEn: "A-Level · Required", evidence: "Typical offer A*A*A to A*AA" },
          { exam: "ESAT", relationship: "program_specific", labelTr: "ESAT · Mühendislik & Doğa Bilimleri", labelEn: "ESAT · Engineering & NatSci", evidence: "Mandatory test from 2024" },
          { exam: "TMUA", relationship: "program_specific", labelTr: "TMUA · Matematik & Ekonomi", labelEn: "TMUA · Math & Economics", evidence: "Mandatory test for Computer Science & Economics" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Kabul ediliyor (40-42+)", labelEn: "IB · Accepted (40-42+)", evidence: "40-42 points with 7,7,6 at HL" },
        ],
      },
      {
        id: "imperial",
        name: "Imperial College London",
        city: "London",
        lat: 51.4988,
        lng: -0.1749,
        officialUrl: "https://www.imperial.ac.uk",
        admissionsUrl: "https://www.imperial.ac.uk/study/apply/undergraduate",
        sourceUrl: "https://www.imperial.ac.uk/study/apply/undergraduate/process/admissions-tests",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "A-Level", relationship: "required", labelTr: "A-Level · İsteniyor", labelEn: "A-Level · Required", evidence: "Minimum entry requirements A*A*A - AAA" },
          { exam: "ESAT", relationship: "program_specific", labelTr: "ESAT · Mühendislik & Fen", labelEn: "ESAT · Engineering & Science", evidence: "Required for Engineering and Physics" },
          { exam: "TMUA", relationship: "program_specific", labelTr: "TMUA · Bilgisayar & Ekonomi", labelEn: "TMUA · Computing & Economics", evidence: "Required for Computing and EFDS" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Kabul ediliyor (38-42)", labelEn: "IB · Accepted (38-42)", evidence: "38-42 points with 6/7 in HL subjects" },
        ],
      },
    ],
  },

  // 2. United States (USA)
  {
    id: "us",
    iso3: "USA",
    labelTr: "Amerika Birleşik Devletleri",
    labelEn: "United States",
    focus: { lat: 39.0, lng: -98.0, altitude: 1.15 },
    examCodes: ["SAT", "ACT", "AP", "IB", "MCAT", "LSAT", "GRE", "GMAT"],
    topUniversities: [
      {
        id: "mit",
        name: "Massachusetts Institute of Technology (MIT)",
        city: "Cambridge, MA",
        lat: 42.3601,
        lng: -71.0942,
        officialUrl: "https://www.mit.edu",
        admissionsUrl: "https://mitadmissions.org",
        sourceUrl: "https://mitadmissions.org/apply/firstyear/tests-scores",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "SAT", relationship: "required", labelTr: "SAT · Zorunlu (Math odaklı)", labelEn: "SAT · Required (Math focus)", evidence: "Standardized testing required (SAT Math 780-800 typical)" },
          { exam: "ACT", relationship: "required", labelTr: "ACT · Alternatif kabul (35-36)", labelEn: "ACT · Alternative accepted", evidence: "ACT with Math/Science component" },
          { exam: "AP", relationship: "considered", labelTr: "AP · Kredi ve yerleştirme", labelEn: "AP · Credit & Placement", evidence: "Scores of 5 earn course credit in STEM" },
          { exam: "IB", relationship: "considered", labelTr: "IB · HL Kredi transferi", labelEn: "IB · HL Credit transfer", evidence: "HL 7 earns credit in select disciplines" },
        ],
      },
      {
        id: "harvard",
        name: "Harvard University",
        city: "Cambridge, MA",
        lat: 42.377,
        lng: -71.1167,
        officialUrl: "https://www.harvard.edu",
        admissionsUrl: "https://college.harvard.edu/admissions",
        sourceUrl: "https://college.harvard.edu/admissions/apply/first-year-applicants/testing-policy",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "SAT", relationship: "required", labelTr: "SAT · Zorunlu test politikası", labelEn: "SAT · Required testing policy", evidence: "Standardized test scores required from Class of 2029" },
          { exam: "ACT", relationship: "required", labelTr: "ACT · Kabul ediliyor", labelEn: "ACT · Accepted", evidence: "Standardized test score requirement" },
          { exam: "AP", relationship: "considered", labelTr: "AP · Akademik güç göstergesi", labelEn: "AP · Academic rigor", evidence: "AP Exam scores evaluated holistically" },
          { exam: "IB", relationship: "considered", labelTr: "IB · Diploma değerlendirmesi", labelEn: "IB · Diploma considered", evidence: "Predictive and final IB results reviewed holistically" },
        ],
      },
      {
        id: "stanford",
        name: "Stanford University",
        city: "Stanford, CA",
        lat: 37.4275,
        lng: -122.1697,
        officialUrl: "https://www.stanford.edu",
        admissionsUrl: "https://admission.stanford.edu",
        sourceUrl: "https://admission.stanford.edu/apply/first-year/testing.html",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "SAT", relationship: "required", labelTr: "SAT · Zorunlu (2025+)", labelEn: "SAT · Required (2025+)", evidence: "Standardized testing reinstated for undergraduate admissions" },
          { exam: "ACT", relationship: "required", labelTr: "ACT · Kabul ediliyor", labelEn: "ACT · Accepted", evidence: "Standardized testing requirement" },
          { exam: "AP", relationship: "considered", labelTr: "AP · Kredi ve muafiyet", labelEn: "AP · Credit & exemption", evidence: "Scores of 4 or 5 receive university credit in qualifying subjects" },
          { exam: "IB", relationship: "considered", labelTr: "IB · HL Kredi değerlendirmesi", labelEn: "IB · HL Credit evaluation", evidence: "Higher Level scores 5-7 granted credit" },
        ],
      },
    ],
  },

  // 3. Canada (CAN)
  {
    id: "canada",
    iso3: "CAN",
    labelTr: "Kanada",
    labelEn: "Canada",
    focus: { lat: 56.0, lng: -106.0, altitude: 1.15 },
    examCodes: ["IB", "AP", "SAT", "ACT", "MCAT", "LSAT", "GRE"],
    topUniversities: [
      {
        id: "toronto",
        name: "University of Toronto",
        city: "Toronto, ON",
        lat: 43.6629,
        lng: -79.3957,
        officialUrl: "https://www.utoronto.ca",
        admissionsUrl: "https://future.utoronto.ca/apply",
        sourceUrl: "https://future.utoronto.ca/apply/requirements/international-high-school-systems",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · Doğrudan kabul (28-36+)", labelEn: "IB · Direct admission (28-36+)", evidence: "Full diploma with HL Math for Engineering/CS" },
          { exam: "AP", relationship: "accepted", labelTr: "AP · Transfer kredisi (4-5)", labelEn: "AP · Transfer credit (4-5)", evidence: "Minimum 4 on eligible AP exams for transfer credit" },
          { exam: "SAT", relationship: "accepted", labelTr: "SAT · ABD müfredatı başvuruları", labelEn: "SAT · US curriculum applicants", evidence: "Competitive scores (1350+) for US diploma holders" },
        ],
      },
      {
        id: "ubc",
        name: "University of British Columbia (UBC)",
        city: "Vancouver, BC",
        lat: 49.2606,
        lng: -123.246,
        officialUrl: "https://www.ubc.ca",
        admissionsUrl: "https://you.ubc.ca/applying-ubc",
        sourceUrl: "https://you.ubc.ca/applying-ubc/requirements/international-high-schools",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · Kabul (30-36+)", labelEn: "IB · Accepted (30-36+)", evidence: "Full IB diploma with prerequisites at HL/SL" },
          { exam: "AP", relationship: "accepted", labelTr: "AP · Kredi ve yerleştirme", labelEn: "AP · Credit & placement", evidence: "Grade of 4 or 5 grants first-year course credits" },
          { exam: "SAT", relationship: "accepted", labelTr: "SAT · Ek yeterlilik", labelEn: "SAT · Additional credential", evidence: "Evaluated for international and US-patterned applicants" },
        ],
      },
      {
        id: "mcgill",
        name: "McGill University",
        city: "Montreal, QC",
        lat: 45.5048,
        lng: -73.5772,
        officialUrl: "https://www.mcgill.ca",
        admissionsUrl: "https://www.mcgill.ca/undergraduate-admissions",
        sourceUrl: "https://www.mcgill.ca/undergraduate-admissions/apply/requirements/international",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · Kabul (33-38+)", labelEn: "IB · Accepted (33-38+)", evidence: "Programme-specific HL subject requirements" },
          { exam: "AP", relationship: "accepted", labelTr: "AP · İleri seviye yerleştirme", labelEn: "AP · Advanced standing", evidence: "Credit given for AP exams with scores of 4 or 5" },
          { exam: "SAT", relationship: "accepted", labelTr: "SAT · Test kabulü", labelEn: "SAT · Test acceptance", evidence: "Competitive test results evaluated alongside transcripts" },
        ],
      },
    ],
  },

  // 4. Italy (ITA)
  {
    id: "italy",
    iso3: "ITA",
    labelTr: "İtalya",
    labelEn: "Italy",
    focus: { lat: 42.5, lng: 12.5, altitude: 1.25 },
    examCodes: ["IMAT", "TARA", "SAT", "IB", "ACT", "GMAT", "GRE"],
    topUniversities: [
      {
        id: "bocconi",
        name: "Bocconi University",
        city: "Milan",
        lat: 45.4486,
        lng: 9.19,
        officialUrl: "https://www.unibocconi.it",
        admissionsUrl: "https://www.unibocconi.eu/wps/wcm/connect/bocconi/sitopubblico_en/navigation+tree/home/programs/bachelor+of+science/admissions",
        sourceUrl: "https://www.unibocconi.eu/wps/wcm/connect/bocconi/sitopubblico_en/navigation+tree/home/programs/bachelor+of+science/admissions",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "SAT", relationship: "accepted", labelTr: "SAT · Bocconi Test alternatifi (1350+)", labelEn: "SAT · Bocconi Test alternative (1350+)", evidence: "Direct selection based on SAT or Bocconi Online Test" },
          { exam: "ACT", relationship: "accepted", labelTr: "ACT · Kabul ediliyor (29+)", labelEn: "ACT · Accepted (29+)", evidence: "Official ACT composite score considered" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Diploma yeterliliği", labelEn: "IB · Diploma eligibility", evidence: "Recognized secondary qualification" },
        ],
      },
      {
        id: "unimi",
        name: "University of Milan (UniMi)",
        city: "Milan",
        lat: 45.4601,
        lng: 9.195,
        officialUrl: "https://www.unimi.it",
        admissionsUrl: "https://www.unimi.it/en/study/bachelor-and-single-cycle-degrees",
        sourceUrl: "https://www.unimi.it/en/study/bachelor-and-single-cycle-degrees/international-medical-school",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IMAT", relationship: "required", labelTr: "IMAT · İngilizce Tıp (IMS) için zorunlu", labelEn: "IMAT · Mandatory for IMS Medicine", evidence: "Single ranking based solely on official IMAT score" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Mezuniyet denkliği", labelEn: "IB · Graduation equivalency", evidence: "Declaration of Value / CIMEA statement required" },
          { exam: "TARA", relationship: "program_specific", labelTr: "TARA · İtalyan mimarlık giriş sınavı", labelEn: "TARA · Architecture entrance test", evidence: "Required for national Architecture programmes" },
        ],
      },
      {
        id: "polimi",
        name: "Politecnico di Milano",
        city: "Milan",
        lat: 45.4781,
        lng: 9.2274,
        officialUrl: "https://www.polimi.it",
        admissionsUrl: "https://www.polimi.it/en/international-prospective-students",
        sourceUrl: "https://www.polimi.it/en/international-prospective-students/how-to-apply/laurea-programmes/admissions-tests",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "TARA", relationship: "required", labelTr: "TARA / TEST-ARCHED · Mimarlık zorunlu", labelEn: "TARA / TEST-ARCHED · Architecture mandatory", evidence: "National admission test for Architectural Design in English" },
          { exam: "SAT", relationship: "accepted", labelTr: "SAT · Mühendislik giriş muafiyeti", labelEn: "SAT · Engineering test exemption", evidence: "SAT with Math >= 550 allows TOL test waiver" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Diploma denkliği", labelEn: "IB · Diploma equivalency", evidence: "Eligible diploma for enrollment" },
        ],
      },
    ],
  },

  // 5. Netherlands (NLD)
  {
    id: "netherlands",
    iso3: "NLD",
    labelTr: "Hollanda",
    labelEn: "Netherlands",
    focus: { lat: 52.3, lng: 5.3, altitude: 1.25 },
    examCodes: ["OMPT", "IB", "AP", "A-Level", "GMAT", "GRE"],
    topUniversities: [
      {
        id: "tudelft",
        name: "Delft University of Technology (TU Delft)",
        city: "Delft",
        lat: 52.0022,
        lng: 4.3697,
        officialUrl: "https://www.tudelft.nl",
        admissionsUrl: "https://www.tudelft.nl/en/education/admission-and-application",
        sourceUrl: "https://www.tudelft.nl/en/education/admission-and-application/bsc-international/admission-requirements/mathematics-tests",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "OMPT", relationship: "required", labelTr: "OMPT · Matematik yeterlilik sınavı", labelEn: "OMPT · Math placement test", evidence: "OMPT-D required for Aerospace & Computer Science deficiency waiver" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · HL Math AA (5+)", labelEn: "IB · HL Math AA (5+)", evidence: "Direct admission requirement for STEM degrees" },
          { exam: "AP", relationship: "accepted", labelTr: "AP · Calculus BC (4+)", labelEn: "AP · Calculus BC (4+)", evidence: "Meets Dutch VWO Mathematics B equivalency" },
        ],
      },
      {
        id: "uva",
        name: "University of Amsterdam (UvA)",
        city: "Amsterdam",
        lat: 52.3558,
        lng: 4.9556,
        officialUrl: "https://www.uva.nl",
        admissionsUrl: "https://www.uva.nl/en/education/bachelor-s/how-to-apply",
        sourceUrl: "https://www.uva.nl/en/education/bachelor-s/how-to-apply/entry-requirements/mathematics.html",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "OMPT", relationship: "required", labelTr: "OMPT · Ekonomi & İşletme için OMPT-A/F", labelEn: "OMPT · OMPT-A/F for Econ/Business", evidence: "OMPT-A (60%+) or OMPT-B (65%+) for entrance deficiencies" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Diploma kabulü", labelEn: "IB · Diploma acceptance", evidence: "IB Diploma with standard/higher math modules" },
          { exam: "AP", relationship: "accepted", labelTr: "AP · VWO seviye denkliği", labelEn: "AP · VWO level equivalency", evidence: "4 AP exams with scores of 3-5" },
        ],
      },
      {
        id: "erasmus",
        name: "Erasmus University Rotterdam",
        city: "Rotterdam",
        lat: 51.918,
        lng: 4.526,
        officialUrl: "https://www.eur.nl",
        admissionsUrl: "https://www.eur.nl/en/bachelor/admission",
        sourceUrl: "https://www.eur.nl/en/rsm/bachelor/international-business-administration/admission",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "OMPT", relationship: "required", labelTr: "OMPT · IBA Matematik tamamlama", labelEn: "OMPT · IBA Math deficiency test", evidence: "OMPT-A score >= 75% for International Business Administration" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Kabul (30+)", labelEn: "IB · Accepted (30+)", evidence: "Recognized diploma for selective admissions" },
          { exam: "GMAT", relationship: "accepted", labelTr: "GMAT · RSM Master kabulü (600+)", labelEn: "GMAT · RSM Master admission (600+)", evidence: "GMAT Focus score evaluated for RSM graduate programmes" },
        ],
      },
    ],
  },

  // 6. Germany (DEU)
  {
    id: "germany",
    iso3: "DEU",
    labelTr: "Almanya",
    labelEn: "Germany",
    focus: { lat: 51.1, lng: 10.4, altitude: 1.25 },
    examCodes: ["IB", "A-Level", "AP", "GRE", "GMAT"],
    topUniversities: [
      {
        id: "tum",
        name: "Technical University of Munich (TUM)",
        city: "Munich",
        lat: 48.1497,
        lng: 11.5679,
        officialUrl: "https://www.tum.de",
        admissionsUrl: "https://www.tum.de/en/studies/applying",
        sourceUrl: "https://www.tum.de/en/studies/international-students",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · KMK Direkt Giriş (HZB)", labelEn: "IB · KMK Direct Admission (HZB)", evidence: "Meets German Hochschulzugangsberechtigung with Math/Sciences" },
          { exam: "A-Level", relationship: "accepted", labelTr: "A-Level · 3 AL ders denkliği", labelEn: "A-Level · 3 AL subject equivalence", evidence: "Math + natural science A-Levels required for STEM" },
          { exam: "AP", relationship: "accepted", labelTr: "AP · 4 AP ders kombinasyonu", labelEn: "AP · 4 AP subject combination", evidence: "Specific AP subject combination evaluated via anabin" },
          { exam: "GRE", relationship: "accepted", labelTr: "GRE · Master başvuruları", labelEn: "GRE · Master admissions", evidence: "GRE General Test required/recommended for select international MSc" },
        ],
      },
      {
        id: "lmu",
        name: "LMU Munich",
        city: "Munich",
        lat: 48.1508,
        lng: 11.5802,
        officialUrl: "https://www.lmu.de",
        admissionsUrl: "https://www.lmu.de/en/study/degree-students/applications-for-admission",
        sourceUrl: "https://www.lmu.de/en/study/international-degree-students",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · Doğrudan HZB denkliği", labelEn: "IB · Direct HZB equivalency", evidence: "IB diploma fulfilling German KMK criteria" },
          { exam: "A-Level", relationship: "accepted", labelTr: "A-Level · Kabul ediliyor", labelEn: "A-Level · Accepted", evidence: "Subject-specific A-Level prerequisites" },
          { exam: "AP", relationship: "accepted", labelTr: "AP · Lisans denkliği", labelEn: "AP · Undergraduate equivalency", evidence: "Standard AP subject distribution" },
        ],
      },
      {
        id: "heidelberg",
        name: "Heidelberg University",
        city: "Heidelberg",
        lat: 49.4101,
        lng: 8.7063,
        officialUrl: "https://www.uni-heidelberg.de",
        admissionsUrl: "https://www.uni-heidelberg.de/en/study/management-studies/international-applications",
        sourceUrl: "https://www.uni-heidelberg.de/en/study/management-studies/international-applications",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · Uluslararası diploma kabulü", labelEn: "IB · International diploma acceptance", evidence: "Official IB transcript processed via Uni-Assist" },
          { exam: "A-Level", relationship: "accepted", labelTr: "A-Level · Lisans kabulü", labelEn: "A-Level · Undergraduate acceptance", evidence: "A-Level combination satisfying ZAB criteria" },
        ],
      },
    ],
  },

  // 7. Switzerland (CHE)
  {
    id: "switzerland",
    iso3: "CHE",
    labelTr: "İsviçre",
    labelEn: "Switzerland",
    focus: { lat: 46.8, lng: 8.2, altitude: 1.25 },
    examCodes: ["IB", "AP", "A-Level", "GRE", "GMAT"],
    topUniversities: [
      {
        id: "eth-zurich",
        name: "ETH Zurich",
        city: "Zurich",
        lat: 47.3763,
        lng: 8.5477,
        officialUrl: "https://ethz.ch",
        admissionsUrl: "https://ethz.ch/en/studies/bachelor/application.html",
        sourceUrl: "https://ethz.ch/en/studies/bachelor/application/international-qualifications.html",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · Yüksek başarı (38-42+)", labelEn: "IB · High academic standing (38-42+)", evidence: "Direct admission with HL Math AA, Physics, Chemistry (scores 6-7)" },
          { exam: "A-Level", relationship: "accepted", labelTr: "A-Level · 3 A-Level (Math + Physics)", labelEn: "A-Level · 3 A-Levels (Math + Physics)", evidence: "3 A-Levels with minimum AAA or A*AA" },
          { exam: "AP", relationship: "accepted", labelTr: "AP · İleri düzey STEM", labelEn: "AP · Advanced STEM", evidence: "Evaluated alongside high school diploma" },
        ],
      },
      {
        id: "epfl",
        name: "EPFL",
        city: "Lausanne",
        lat: 46.5191,
        lng: 6.5668,
        officialUrl: "https://www.epfl.ch",
        admissionsUrl: "https://www.epfl.ch/education/admission",
        sourceUrl: "https://www.epfl.ch/education/admission/admission-criteria",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · 38/42 (HL Math & Physics 6+)", labelEn: "IB · 38/42 (HL Math & Physics 6+)", evidence: "Strict minimum 38/42 with 6s in HL Math AA and Physics" },
          { exam: "A-Level", relationship: "accepted", labelTr: "A-Level · 3 A-Level (A/A*)", labelEn: "A-Level · 3 A-Levels (A/A*)", evidence: "3 A-Levels including Mathematics and Physics with high grades" },
        ],
      },
      {
        id: "uzh",
        name: "University of Zurich",
        city: "Zurich",
        lat: 47.3747,
        lng: 8.5488,
        officialUrl: "https://www.uzh.ch",
        admissionsUrl: "https://www.uzh.ch/en/studies/application.html",
        sourceUrl: "https://www.uzh.ch/en/studies/application/generaladmission/international.html",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · Genel lise denkliği", labelEn: "IB · General high school equivalency", evidence: "IB Diploma with standard swiss admission prerequisites" },
          { exam: "A-Level", relationship: "accepted", labelTr: "A-Level · 3 A-Level kabulü", labelEn: "A-Level · 3 A-Levels accepted", evidence: "General Swissuniversities criteria" },
        ],
      },
    ],
  },

  // 8. France (FRA)
  {
    id: "france",
    iso3: "FRA",
    labelTr: "Fransa",
    labelEn: "France",
    focus: { lat: 46.5, lng: 2.5, altitude: 1.25 },
    examCodes: ["GMAT", "GRE", "IB", "A-Level", "AP", "SAT"],
    topUniversities: [
      {
        id: "insead",
        name: "INSEAD",
        city: "Fontainebleau",
        lat: 48.4069,
        lng: 2.7016,
        officialUrl: "https://www.insead.edu",
        admissionsUrl: "https://www.insead.edu/master-programmes/mba/admissions",
        sourceUrl: "https://www.insead.edu/master-programmes/mba/admissions",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "GMAT", relationship: "required", labelTr: "GMAT Focus · 665+ (Eski 700+)", labelEn: "GMAT Focus · 665+ (Old 700+)", evidence: "Competitive GMAT Focus / GRE score mandatory for MBA/MIM" },
          { exam: "GRE", relationship: "accepted", labelTr: "GRE · Alternatif kabul (165+ V/Q)", labelEn: "GRE · Alternative accepted (165+ V/Q)", evidence: "Evaluated on equal footing with GMAT" },
        ],
      },
      {
        id: "sorbonne",
        name: "Sorbonne University",
        city: "Paris",
        lat: 48.8509,
        lng: 2.3436,
        officialUrl: "https://www.sorbonne-universite.fr",
        admissionsUrl: "https://www.sorbonne-universite.fr/en/study-at-sorbonne-universite",
        sourceUrl: "https://www.sorbonne-universite.fr/en/study-at-sorbonne-universite/admissions",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · Fransız Bakalorya denkliği", labelEn: "IB · French Baccalaureate equivalency", evidence: "Direct admission for Parcoursup / international applicants" },
          { exam: "A-Level", relationship: "accepted", labelTr: "A-Level · Lisans kabulü", labelEn: "A-Level · Undergraduate acceptance", evidence: "Evaluated via national application portals" },
        ],
      },
      {
        id: "polytechnique",
        name: "École Polytechnique",
        city: "Palaiseau",
        lat: 48.7138,
        lng: 2.2104,
        officialUrl: "https://www.polytechnique.edu",
        admissionsUrl: "https://programmes.polytechnique.edu/en/bachelor/admissions",
        sourceUrl: "https://programmes.polytechnique.edu/en/bachelor/admissions",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IB", relationship: "accepted", labelTr: "IB · Bachelor (HL Math 7)", labelEn: "IB · Bachelor (HL Math 7)", evidence: "Bachelor of Science requires high honors in IB Mathematics AA" },
          { exam: "AP", relationship: "accepted", labelTr: "AP · Calculus BC & Physics", labelEn: "AP · Calculus BC & Physics", evidence: "Scores of 5 in Calculus BC and Physics C required" },
        ],
      },
    ],
  },

  // 9. Egypt (EGY)
  {
    id: "egypt",
    iso3: "EGY",
    labelTr: "Mısır",
    labelEn: "Egypt",
    focus: { lat: 26.8, lng: 30.8, altitude: 1.25 },
    examCodes: ["SAT", "IB", "ACT", "IGCSE"],
    topUniversities: [
      {
        id: "auc-egypt",
        name: "The American University in Cairo (AUC)",
        city: "Cairo",
        lat: 30.0194,
        lng: 31.4994,
        officialUrl: "https://www.aucegypt.edu",
        admissionsUrl: "https://www.aucegypt.edu/admissions/undergraduate",
        sourceUrl: "https://www.aucegypt.edu/admissions/undergraduate/requirements",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "SAT", relationship: "accepted", labelTr: "SAT · Kabul ediliyor (1200+)", labelEn: "SAT · Accepted (1200+)", evidence: "Official SAT score submitted for placement and scholarship" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Diploma kabulü (30+)", labelEn: "IB · Diploma accepted (30+)", evidence: "IB Diploma with credits granted for HL courses 5+" },
          { exam: "ACT", relationship: "accepted", labelTr: "ACT · Alternatif kabul (25+)", labelEn: "ACT · Alternative accepted (25+)", evidence: "Official ACT composite accepted" },
        ],
      },
      {
        id: "cairo-uni",
        name: "Cairo University",
        city: "Giza",
        lat: 30.0261,
        lng: 31.2117,
        officialUrl: "https://cu.edu.eg",
        admissionsUrl: "https://cu.edu.eg/en/Admissions",
        sourceUrl: "https://cu.edu.eg/en/Admissions",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IGCSE", relationship: "accepted", labelTr: "IGCSE · 8 O-Level / AL", labelEn: "IGCSE · 8 O-Levels / AL", evidence: "Egyptian Ministry of Higher Education foreign certificate requirements" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Diploma denkliği", labelEn: "IB · Diploma equivalency", evidence: "Evaluated via national admissions coordination bureau" },
        ],
      },
      {
        id: "ain-shams",
        name: "Ain Shams University",
        city: "Cairo",
        lat: 30.0772,
        lng: 31.2853,
        officialUrl: "https://www.asu.edu.eg",
        admissionsUrl: "https://www.asu.edu.eg/en/page/admissions",
        sourceUrl: "https://www.asu.edu.eg/en/page/admissions",
        verifiedAt: "2026-08-30",
        examChips: [
          { exam: "IGCSE", relationship: "accepted", labelTr: "IGCSE · O-Level & AL kabulü", labelEn: "IGCSE · O-Level & AL accepted", evidence: "Ministry coordination bureau standards" },
          { exam: "IB", relationship: "accepted", labelTr: "IB · Uluslararası diploma", labelEn: "IB · International diploma", evidence: "Standard international qualification requirements" },
        ],
      },
    ],
  },
];

const supportedExamCodes = new Set<ExamCode>(examRecords.map((exam) => exam.code));

function convertFeaturedSeedToStudyRegion(seed: FeaturedCountrySeed): StudyRegion {
  const universities: StudyUniversity[] = seed.topUniversities.slice(0, 3).map((u) => {
    const verifiedOfficialUrl = getVerifiedOfficialUniversityUrl(u.name) || u.officialUrl;
    return {
      id: u.id,
      name: u.name,
      city: u.city,
      country: seed.labelEn,
      countryCode: seed.iso3,
      lat: u.lat,
      lng: u.lng,
      officialUrl: verifiedOfficialUrl,
      admissionsUrl: u.admissionsUrl,
      sourceUrl: u.sourceUrl,
      verifiedAt: u.verifiedAt,
      // Legacy seed chips are deliberately not exposed. Public requirement chips
      // now come only from verified, scoped database evidence for the active cycle.
      examChips: [],
      examRelations: [],
    };
  });

  const country: StudyCountry = {
    id: seed.id,
    iso3: seed.iso3,
    nameTr: seed.labelTr,
    nameEn: seed.labelEn,
    lat: seed.focus.lat,
    lng: seed.focus.lng,
    universities,
  };

  const validExamCodes = seed.examCodes.filter((c) => supportedExamCodes.has(c));

  return {
    id: seed.id,
    countryCode: seed.iso3,
    labelTr: seed.labelTr,
    labelEn: seed.labelEn,
    focus: seed.focus,
    countries: [country],
    examIds: validExamCodes,
    hasDirectExams: validExamCodes.length > 0,
    noMatchMessageTr: "Bu ülke için Oriens’in desteklediği uluslararası sınavlardan doğrudan ülke-geneli bir eşleşme bulunamadı. Üniversite ve program koşulları kuruma göre değişebilir. Hedef kurumunuz için bireysel hazırlık rotası oluşturabiliriz.",
    noMatchMessageEn: "No direct country-wide match was found for Oriens-supported international exams for this destination. University and programme requirements vary by institution. We can build an individualized preparation roadmap for your target university.",
  };
}

// Built-in country-isolated study destinations
export const studyDestinations: StudyRegion[] = FEATURED_COUNTRY_SEEDS.map(convertFeaturedSeedToStudyRegion);

/**
 * Dynamic resolver for any ISO 3166-1 alpha-3 country clicked on the globe
 */
export function resolveStudyDestination(iso3Code: string, countryNameTr?: string, countryNameEn?: string): StudyRegion {
  const cleanIso = iso3Code.toUpperCase().trim();
  const directMatch = FEATURED_COUNTRY_SEEDS.find((s) => s.iso3 === cleanIso);
  if (directMatch) {
    return convertFeaturedSeedToStudyRegion(directMatch);
  }

  // Check if any canonical exam map profile links to this ISO country
  const mappedExamIds = examMapProfiles
    .filter((profile) => profile.countries.includes(cleanIso))
    .map((profile) => profile.examCode)
    .filter((examCode): examCode is ExamCode => supportedExamCodes.has(examCode as ExamCode));

  const trName = countryNameTr || countryNameEn || iso3Code;
  const enName = countryNameEn || countryNameTr || iso3Code;

  return {
    id: iso3Code.toLowerCase(),
    countryCode: cleanIso,
    labelTr: trName,
    labelEn: enName,
    focus: { lat: 20, lng: 0, altitude: 1.2 },
    countries: [
      {
        id: iso3Code.toLowerCase(),
        iso3: cleanIso,
        nameTr: trName,
        nameEn: enName,
        lat: 20,
        lng: 0,
        universities: [],
      },
    ],
    examIds: mappedExamIds,
    hasDirectExams: mappedExamIds.length > 0,
    noMatchMessageTr: "Bu ülke için Oriens’in desteklediği uluslararası sınavlardan doğrudan ülke-geneli bir eşleşme bulunamadı. Üniversite ve program koşulları kuruma göre değişebilir. Hedef kurumunuz için bireysel hazırlık rotası oluşturabiliriz.",
    noMatchMessageEn: "No direct country-wide match was found for Oriens-supported international exams for this destination. University and programme requirements vary by institution. We can build an individualized preparation roadmap for your target university.",
  };
}

export const studyRouteOrigin = {
  label: "Istanbul",
  lat: 41.0082,
  lng: 28.9784,
};
