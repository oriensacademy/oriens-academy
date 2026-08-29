-- Migration: 20260830000001_featured_universities_and_ai_layer.sql
-- Description: Country-specific featured universities, verified evidence-aware chips, and AI admission facts cache

CREATE TABLE IF NOT EXISTS public.featured_universities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name_tr TEXT NOT NULL,
  country_name_en TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  official_url TEXT NOT NULL,
  admissions_url TEXT,
  source_url TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  display_order INTEGER NOT NULL DEFAULT 1,
  exam_chips JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for country lookups
CREATE INDEX IF NOT EXISTS idx_featured_universities_country ON public.featured_universities(country_code, display_order);

-- AI Admission Fact Cache Table (Grounded with official sources)
CREATE TABLE IF NOT EXISTS public.admission_fact_cache (
  id TEXT PRIMARY KEY, -- Hash of university_id + exam_code + program
  university_id TEXT NOT NULL,
  exam_code TEXT NOT NULL,
  program_name TEXT,
  requirement_summary_tr TEXT NOT NULL,
  requirement_summary_en TEXT NOT NULL,
  evidence_excerpt TEXT NOT NULL,
  official_source_url TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admission_fact_cache_uni_exam ON public.admission_fact_cache(university_id, exam_code);

-- Seed Verified Top 3 Featured Universities per Target Country
INSERT INTO public.featured_universities (
  id, name, country_code, country_name_tr, country_name_en, city, latitude, longitude, official_url, admissions_url, source_url, verified_at, display_order, exam_chips
) VALUES
-- UK (GBR)
(
  'oxford', 'University of Oxford', 'GBR', 'Birleşik Krallık', 'United Kingdom', 'Oxford', 51.7548, -1.2544,
  'https://www.ox.ac.uk', 'https://www.ox.ac.uk/admissions/undergraduate', 'https://www.ox.ac.uk/admissions/undergraduate/applying-to-oxford/tests',
  '2026-08-30T00:00:00Z', 1,
  '[
    {"exam": "A-Level", "relationship": "required", "label_tr": "A-Level · İsteniyor", "label_en": "A-Level · Required", "evidence": "Standard conditional offer benchmark"},
    {"exam": "LNAT", "relationship": "program_specific", "label_tr": "LNAT · Hukuk için zorunlu", "label_en": "LNAT · Mandatory for Law", "evidence": "Required for BA Jurisprudence"},
    {"exam": "TMUA", "relationship": "program_specific", "label_tr": "TMUA · Matematik & Bilgisayar", "label_en": "TMUA · Math & Computer Science", "evidence": "Mandatory admissions test"},
    {"exam": "UCAT", "relationship": "program_specific", "label_tr": "UCAT · Tıp için zorunlu", "label_en": "UCAT · Mandatory for Medicine", "evidence": "Required for Medicine A100"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Kabul ediliyor (38-40+)", "label_en": "IB · Accepted (38-40+)", "evidence": "Minimum 38-40 points with 6s/7s at HL"}
  ]'::jsonb
),
(
  'cambridge', 'University of Cambridge', 'GBR', 'Birleşik Krallık', 'United Kingdom', 'Cambridge', 52.2043, 0.1149,
  'https://www.cam.ac.uk', 'https://www.undergraduate.study.cam.ac.uk', 'https://www.undergraduate.study.cam.ac.uk/apply/how/admission-tests',
  '2026-08-30T00:00:00Z', 2,
  '[
    {"exam": "A-Level", "relationship": "required", "label_tr": "A-Level · İsteniyor", "label_en": "A-Level · Required", "evidence": "Typical offer A*A*A to A*AA"},
    {"exam": "ESAT", "relationship": "program_specific", "label_tr": "ESAT · Mühendislik & Doğa Bilimleri", "label_en": "ESAT · Engineering & NatSci", "evidence": "Mandatory admissions test from 2024"},
    {"exam": "TMUA", "relationship": "program_specific", "label_tr": "TMUA · Matematik & Ekonomi", "label_en": "TMUA · Math & Economics", "evidence": "Mandatory test for Computer Science & Economics"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Kabul ediliyor (40-42+)", "label_en": "IB · Accepted (40-42+)", "evidence": "40-42 points with 7,7,6 at HL"}
  ]'::jsonb
),
(
  'imperial', 'Imperial College London', 'GBR', 'Birleşik Krallık', 'United Kingdom', 'London', 51.4988, -0.1749,
  'https://www.imperial.ac.uk', 'https://www.imperial.ac.uk/study/apply/undergraduate', 'https://www.imperial.ac.uk/study/apply/undergraduate/process/admissions-tests',
  '2026-08-30T00:00:00Z', 3,
  '[
    {"exam": "A-Level", "relationship": "required", "label_tr": "A-Level · İsteniyor", "label_en": "A-Level · Required", "evidence": "Minimum entry requirements A*A*A - AAA"},
    {"exam": "ESAT", "relationship": "program_specific", "label_tr": "ESAT · Mühendislik & Fen Bilimleri", "label_en": "ESAT · Engineering & Sciences", "evidence": "Required for Engineering and Physics"},
    {"exam": "TMUA", "relationship": "program_specific", "label_tr": "TMUA · Bilgisayar & Ekonomi", "label_en": "TMUA · Computing & Economics", "evidence": "Required for Computing and EFDS"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Kabul ediliyor (38-42)", "label_en": "IB · Accepted (38-42)", "evidence": "38-42 points with 6/7 in HL subjects"}
  ]'::jsonb
),

-- USA (USA)
(
  'mit', 'Massachusetts Institute of Technology (MIT)', 'USA', 'Amerika Birleşik Devletleri', 'United States', 'Cambridge, MA', 42.3601, -71.0942,
  'https://www.mit.edu', 'https://mitadmissions.org', 'https://mitadmissions.org/apply/firstyear/tests-scores',
  '2026-08-30T00:00:00Z', 1,
  '[
    {"exam": "SAT", "relationship": "required", "label_tr": "SAT · Zorunlu (Math odaklı)", "label_en": "SAT · Required (Math focus)", "evidence": "Standardized testing required (SAT Math typically 780-800)"},
    {"exam": "ACT", "relationship": "required", "label_tr": "ACT · Alternatif kabul (35-36)", "label_en": "ACT · Alternative accepted", "evidence": "ACT with Math/Science component"},
    {"exam": "AP", "relationship": "considered", "label_tr": "AP · Kredi ve yerleştirme", "label_en": "AP · Credit & Placement", "evidence": "Scores of 5 earn course credit in Calculus/Physics"},
    {"exam": "IB", "relationship": "considered", "label_tr": "IB · HL Kredi transferi", "label_en": "IB · HL Credit transfer", "evidence": "HL 7 earns credit in select STEM subjects"}
  ]'::jsonb
),
(
  'harvard', 'Harvard University', 'USA', 'Amerika Birleşik Devletleri', 'United States', 'Cambridge, MA', 42.3770, -71.1167,
  'https://www.harvard.edu', 'https://college.harvard.edu/admissions', 'https://college.harvard.edu/admissions/apply/first-year-applicants/testing-policy',
  '2026-08-30T00:00:00Z', 2,
  '[
    {"exam": "SAT", "relationship": "required", "label_tr": "SAT · Zorunlu test politikası", "label_en": "SAT · Required testing policy", "evidence": "Standardized test scores required starting Class of 2029"},
    {"exam": "ACT", "relationship": "required", "label_tr": "ACT · Kabul ediliyor", "label_en": "ACT · Accepted", "evidence": "Standardized test score requirement"},
    {"exam": "AP", "relationship": "considered", "label_tr": "AP · Akademik güç göstergesi", "label_en": "AP · Academic rigor", "evidence": "AP Exam scores evaluated holistically"},
    {"exam": "IB", "relationship": "considered", "label_tr": "IB · Diploma değerlendirmesi", "label_en": "IB · Diploma considered", "evidence": "Predictive and final IB results reviewed holistically"}
  ]'::jsonb
),
(
  'stanford', 'Stanford University', 'USA', 'Amerika Birleşik Devletleri', 'United States', 'Stanford, CA', 37.4275, -122.1697,
  'https://www.stanford.edu', 'https://admission.stanford.edu', 'https://admission.stanford.edu/apply/first-year/testing.html',
  '2026-08-30T00:00:00Z', 3,
  '[
    {"exam": "SAT", "relationship": "required", "label_tr": "SAT · Zorunlu (2025+)", "label_en": "SAT · Required (2025+)", "evidence": "Standardized testing reinstated for undergraduate admissions"},
    {"exam": "ACT", "relationship": "required", "label_tr": "ACT · Kabul ediliyor", "label_en": "ACT · Accepted", "evidence": "Standardized testing requirement"},
    {"exam": "AP", "relationship": "considered", "label_tr": "AP · Kredi ve muafiyet", "label_en": "AP · Credit & exemption", "evidence": "Scores of 4 or 5 receive university units in qualifying disciplines"},
    {"exam": "IB", "relationship": "considered", "label_tr": "IB · HL Kredi değerlendirmesi", "label_en": "IB · HL Credit evaluation", "evidence": "Higher Level scores 5-7 granted credit"}
  ]'::jsonb
),

-- Canada (CAN)
(
  'toronto', 'University of Toronto', 'CAN', 'Kanada', 'Canada', 'Toronto, ON', 43.6629, -79.3957,
  'https://www.utoronto.ca', 'https://future.utoronto.ca/apply', 'https://future.utoronto.ca/apply/requirements/international-high-school-systems',
  '2026-08-30T00:00:00Z', 1,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Doğrudan kabul (28-36+)", "label_en": "IB · Direct admission (28-36+)", "evidence": "Full diploma with HL Math for Engineering/CS"},
    {"exam": "AP", "relationship": "accepted", "label_tr": "AP · Transfer kredisi (4-5)", "label_en": "AP · Transfer credit (4-5)", "evidence": "Minimum 4 on eligible AP exams for transfer credit"},
    {"exam": "SAT", "relationship": "accepted", "label_tr": "SAT · ABD müfredatı başvuruları", "label_en": "SAT · US curriculum applicants", "evidence": "Competitive scores (1350+) for US diploma holders"}
  ]'::jsonb
),
(
  'ubc', 'University of British Columbia (UBC)', 'CAN', 'Kanada', 'Canada', 'Vancouver, BC', 49.2606, -123.2460,
  'https://www.ubc.ca', 'https://you.ubc.ca/applying-ubc', 'https://you.ubc.ca/applying-ubc/requirements/international-high-schools',
  '2026-08-30T00:00:00Z', 2,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Kabul (30-36+)", "label_en": "IB · Accepted (30-36+)", "evidence": "Full IB diploma with prerequisites at HL/SL"},
    {"exam": "AP", "relationship": "accepted", "label_tr": "AP · Kredi ve yerleştirme", "label_en": "AP · Credit & placement", "evidence": "Grade of 4 or 5 grants first-year course credits"},
    {"exam": "SAT", "relationship": "accepted", "label_tr": "SAT · Ek yeterlilik", "label_en": "SAT · Additional credential", "evidence": "Evaluated for international and US-patterned applicants"}
  ]'::jsonb
),
(
  'mcgill', 'McGill University', 'CAN', 'Kanada', 'Canada', 'Montreal, QC', 45.5048, -73.5772,
  'https://www.mcgill.ca', 'https://www.mcgill.ca/undergraduate-admissions', 'https://www.mcgill.ca/undergraduate-admissions/apply/requirements/international',
  '2026-08-30T00:00:00Z', 3,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Kabul (33-38+)", "label_en": "IB · Accepted (33-38+)", "evidence": "Programme-specific HL subject requirements"},
    {"exam": "AP", "relationship": "accepted", "label_tr": "AP · İleri seviye yerleştirme", "label_en": "AP · Advanced standing", "evidence": "Credit given for AP exams with scores of 4 or 5"},
    {"exam": "SAT", "relationship": "accepted", "label_tr": "SAT · Test kabulü", "label_en": "SAT · Test acceptance", "evidence": "Competitive test results evaluated alongside transcripts"}
  ]'::jsonb
),

-- Italy (ITA)
(
  'bocconi', 'Bocconi University', 'ITA', 'İtalya', 'Italy', 'Milan', 45.4486, 9.1900,
  'https://www.unibocconi.it', 'https://www.unibocconi.eu/wps/wcm/connect/bocconi/sitopubblico_en/navigation+tree/home/programs/bachelor+of+science/admissions',
  'https://www.unibocconi.eu/wps/wcm/connect/bocconi/sitopubblico_en/navigation+tree/home/programs/bachelor+of+science/admissions',
  '2026-08-30T00:00:00Z', 1,
  '[
    {"exam": "SAT", "relationship": "accepted", "label_tr": "SAT · Bocconi Test alternatifi (1350+)", "label_en": "SAT · Bocconi Test alternative (1350+)", "evidence": "Direct selection based on SAT or Bocconi Online Test"},
    {"exam": "ACT", "relationship": "accepted", "label_tr": "ACT · Kabul ediliyor (29+)", "label_en": "ACT · Accepted (29+)", "evidence": "Official ACT composite score considered"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Diploma yeterliliği", "label_en": "IB · Diploma eligibility", "evidence": "Recognized secondary qualification"}
  ]'::jsonb
),
(
  'unimi', 'University of Milan (UniMi)', 'ITA', 'İtalya', 'Italy', 'Milan', 45.4601, 9.1950,
  'https://www.unimi.it', 'https://www.unimi.it/en/study/bachelor-and-single-cycle-degrees', 'https://www.unimi.it/en/study/bachelor-and-single-cycle-degrees/international-medical-school',
  '2026-08-30T00:00:00Z', 2,
  '[
    {"exam": "IMAT", "relationship": "required", "label_tr": "IMAT · İngilizce Tıp (IMS) için zorunlu", "label_en": "IMAT · Mandatory for IMS Medicine", "evidence": "Single ranking based solely on official IMAT score"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Mezuniyet denkliği", "label_en": "IB · Graduation equivalency", "evidence": "Declaration of Value / CIMEA statement required"},
    {"exam": "TARA", "relationship": "program_specific", "label_tr": "TARA · İtalyan mimarlık giriş sınavı", "label_en": "TARA · Architecture entrance test", "evidence": "Required for national Architecture programmes"}
  ]'::jsonb
),
(
  'polimi', 'Politecnico di Milano', 'ITA', 'İtalya', 'Italy', 'Milan', 45.4781, 9.2274,
  'https://www.polimi.it', 'https://www.polimi.it/en/international-prospective-students', 'https://www.polimi.it/en/international-prospective-students/how-to-apply/laurea-programmes/admissions-tests',
  '2026-08-30T00:00:00Z', 3,
  '[
    {"exam": "TARA", "relationship": "required", "label_tr": "TARA / TEST-ARCHED · Mimarlık zorunlu", "label_en": "TARA / TEST-ARCHED · Architecture mandatory", "evidence": "National admission test for Architectural Design in English"},
    {"exam": "SAT", "relationship": "accepted", "label_tr": "SAT · Mühendislik giriş muafiyeti", "label_en": "SAT · Engineering test exemption", "evidence": "SAT with Math >= 550 allows TOL test waiver"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Diploma denkliği", "label_en": "IB · Diploma equivalency", "evidence": "Eligible diploma for enrollment"}
  ]'::jsonb
),

-- Netherlands (NLD)
(
  'tudelft', 'Delft University of Technology (TU Delft)', 'NLD', 'Hollanda', 'Netherlands', 'Delft', 52.0022, 4.3697,
  'https://www.tudelft.nl', 'https://www.tudelft.nl/en/education/admission-and-application', 'https://www.tudelft.nl/en/education/admission-and-application/bsc-international/admission-requirements/mathematics-tests',
  '2026-08-30T00:00:00Z', 1,
  '[
    {"exam": "OMPT", "relationship": "required", "label_tr": "OMPT · Matematik yeterlilik sınavı", "label_en": "OMPT · Math placement test", "evidence": "OMPT-D required for Aerospace & Computer Science deficiency waiver"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · HL Math AA (5+)", "label_en": "IB · HL Math AA (5+)", "evidence": "Direct admission requirement for STEM degrees"},
    {"exam": "AP", "relationship": "accepted", "label_tr": "AP · Calculus BC (4+)", "label_en": "AP · Calculus BC (4+)", "evidence": "Meets Dutch VWO Mathematics B equivalency"}
  ]'::jsonb
),
(
  'uva', 'University of Amsterdam (UvA)', 'NLD', 'Hollanda', 'Netherlands', 'Amsterdam', 52.3558, 4.9556,
  'https://www.uva.nl', 'https://www.uva.nl/en/education/bachelor-s/how-to-apply', 'https://www.uva.nl/en/education/bachelor-s/how-to-apply/entry-requirements/mathematics.html',
  '2026-08-30T00:00:00Z', 2,
  '[
    {"exam": "OMPT", "relationship": "required", "label_tr": "OMPT · Ekonomi & İşletme için OMPT-A/F", "label_en": "OMPT · OMPT-A/F for Econ/Business", "evidence": "OMPT-A (60%+) or OMPT-B (65%+) for entrance deficiencies"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Diploma kabulü", "label_en": "IB · Diploma acceptance", "evidence": "IB Diploma with standard/higher math modules"},
    {"exam": "AP", "relationship": "accepted", "label_tr": "AP · VWO seviye denkliği", "label_en": "AP · VWO level equivalency", "evidence": "4 AP exams with scores of 3-5"}
  ]'::jsonb
),
(
  'erasmus', 'Erasmus University Rotterdam', 'NLD', 'Hollanda', 'Netherlands', 'Rotterdam', 51.9180, 4.5260,
  'https://www.eur.nl', 'https://www.eur.nl/en/bachelor/admission', 'https://www.eur.nl/en/rsm/bachelor/international-business-administration/admission',
  '2026-08-30T00:00:00Z', 3,
  '[
    {"exam": "OMPT", "relationship": "required", "label_tr": "OMPT · IBA Matematik tamamlama", "label_en": "OMPT · IBA Math deficiency test", "evidence": "OMPT-A score >= 75% for International Business Administration"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Kabul (30+)", "label_en": "IB · Accepted (30+)", "evidence": "Recognized diploma for selective admissions"},
    {"exam": "GMAT", "relationship": "accepted", "label_tr": "GMAT · RSM Master kabulü (600+)", "label_en": "GMAT · RSM Master admission (600+)", "evidence": "GMAT Focus score evaluated for RSM graduate programmes"}
  ]'::jsonb
),

-- Germany (DEU)
(
  'tum', 'Technical University of Munich (TUM)', 'DEU', 'Almanya', 'Germany', 'Munich', 48.1497, 11.5679,
  'https://www.tum.de', 'https://www.tum.de/en/studies/applying', 'https://www.tum.de/en/studies/international-students',
  '2026-08-30T00:00:00Z', 1,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · KMK Direkt Giriş (HZB)", "label_en": "IB · KMK Direct Admission (HZB)", "evidence": "Meets German Hochschulzugangsberechtigung with Math/Sciences"},
    {"exam": "A-Level", "relationship": "accepted", "label_tr": "A-Level · 3 AL ders denkliği", "label_en": "A-Level · 3 AL subject equivalence", "evidence": "Math + natural science A-Levels required for STEM"},
    {"exam": "AP", "relationship": "accepted", "label_tr": "AP · 4 AP ders kombinasyonu", "label_en": "AP · 4 AP subject combination", "evidence": "Specific AP subject combination evaluated via anabin"},
    {"exam": "GRE", "relationship": "accepted", "label_tr": "GRE · Master başvuruları", "label_en": "GRE · Master admissions", "evidence": "GRE General Test required/recommended for select international MSc"}
  ]'::jsonb
),
(
  'lmu', 'LMU Munich', 'DEU', 'Almanya', 'Germany', 'Munich', 48.1508, 11.5802,
  'https://www.lmu.de', 'https://www.lmu.de/en/study/degree-students/applications-for-admission', 'https://www.lmu.de/en/study/international-degree-students',
  '2026-08-30T00:00:00Z', 2,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Doğrudan HZB denkliği", "label_en": "IB · Direct HZB equivalency", "evidence": "IB diploma fulfilling German KMK criteria"},
    {"exam": "A-Level", "relationship": "accepted", "label_tr": "A-Level · Kabul ediliyor", "label_en": "A-Level · Accepted", "evidence": "Subject-specific A-Level prerequisites"},
    {"exam": "AP", "relationship": "accepted", "label_tr": "AP · Lisans denkliği", "label_en": "AP · Undergraduate equivalency", "evidence": "Standard AP subject distribution"}
  ]'::jsonb
),
(
  'heidelberg', 'Heidelberg University', 'DEU', 'Almanya', 'Germany', 'Heidelberg', 49.4101, 8.7063,
  'https://www.uni-heidelberg.de', 'https://www.uni-heidelberg.de/en/study/management-studies/international-applications', 'https://www.uni-heidelberg.de/en/study/management-studies/international-applications',
  '2026-08-30T00:00:00Z', 3,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Uluslararası diploma kabulü", "label_en": "IB · International diploma acceptance", "evidence": "Official IB transcript processed via Uni-Assist"},
    {"exam": "A-Level", "relationship": "accepted", "label_tr": "A-Level · Lisans kabulü", "label_en": "A-Level · Undergraduate acceptance", "evidence": "A-Level combination satisfying ZAB criteria"}
  ]'::jsonb
),

-- Switzerland (CHE)
(
  'eth-zurich', 'ETH Zurich', 'CHE', 'İsviçre', 'Switzerland', 'Zurich', 47.3763, 8.5477,
  'https://ethz.ch', 'https://ethz.ch/en/studies/bachelor/application.html', 'https://ethz.ch/en/studies/bachelor/application/international-qualifications.html',
  '2026-08-30T00:00:00Z', 1,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Yüksek başarı (38-42+)", "label_en": "IB · High academic standing (38-42+)", "evidence": "Direct admission with HL Math AA, Physics, Chemistry (scores 6-7)"},
    {"exam": "A-Level", "relationship": "accepted", "label_tr": "A-Level · 3 A-Level (Math + Physics)", "label_en": "A-Level · 3 A-Levels (Math + Physics)", "evidence": "3 A-Levels with minimum AAA or A*AA"},
    {"exam": "AP", "relationship": "accepted", "label_tr": "AP · İleri düzey STEM", "label_en": "AP · Advanced STEM", "evidence": "Evaluated alongside high school diploma"}
  ]'::jsonb
),
(
  'epfl', 'EPFL', 'CHE', 'İsviçre', 'Switzerland', 'Lausanne', 46.5191, 6.5668,
  'https://www.epfl.ch', 'https://www.epfl.ch/education/admission', 'https://www.epfl.ch/education/admission/admission-criteria',
  '2026-08-30T00:00:00Z', 2,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · 38/42 (HL Math & Physics 6+)", "label_en": "IB · 38/42 (HL Math & Physics 6+)", "evidence": "Strict minimum 38/42 with 6s in HL Math AA and Physics"},
    {"exam": "A-Level", "relationship": "accepted", "label_tr": "A-Level · 3 A-Level (A/A*)", "label_en": "A-Level · 3 A-Levels (A/A*)", "evidence": "3 A-Levels including Mathematics and Physics with high grades"}
  ]'::jsonb
),
(
  'uzh', 'University of Zurich', 'CHE', 'İsviçre', 'Switzerland', 'Zurich', 47.3747, 8.5488,
  'https://www.uzh.ch', 'https://www.uzh.ch/en/studies/application.html', 'https://www.uzh.ch/en/studies/application/generaladmission/international.html',
  '2026-08-30T00:00:00Z', 3,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Genel lise denkliği", "label_en": "IB · General high school equivalency", "evidence": "IB Diploma with standard swiss admission prerequisites"},
    {"exam": "A-Level", "relationship": "accepted", "label_tr": "A-Level · 3 A-Level kabulü", "label_en": "A-Level · 3 A-Levels accepted", "evidence": "General Swissuniversities criteria"}
  ]'::jsonb
),

-- France (FRA)
(
  'insead', 'INSEAD', 'FRA', 'Fransa', 'France', 'Fontainebleau', 48.4069, 2.7016,
  'https://www.insead.edu', 'https://www.insead.edu/master-programmes/mba/admissions', 'https://www.insead.edu/master-programmes/mba/admissions',
  '2026-08-30T00:00:00Z', 1,
  '[
    {"exam": "GMAT", "relationship": "required", "label_tr": "GMAT Focus · 665+ (Eski 700+)", "label_en": "GMAT Focus · 665+ (Old 700+)", "evidence": "Competitive GMAT Focus / GRE score mandatory for MBA/MIM"},
    {"exam": "GRE", "relationship": "accepted", "label_tr": "GRE · Alternatif kabul (165+ V/Q)", "label_en": "GRE · Alternative accepted (165+ V/Q)", "evidence": "Evaluated on equal footing with GMAT"}
  ]'::jsonb
),
(
  'sorbonne', 'Sorbonne University', 'FRA', 'Fransa', 'France', 'Paris', 48.8509, 2.3436,
  'https://www.sorbonne-universite.fr', 'https://www.sorbonne-universite.fr/en/study-at-sorbonne-universite', 'https://www.sorbonne-universite.fr/en/study-at-sorbonne-universite/admissions',
  '2026-08-30T00:00:00Z', 2,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Fransız Bakalorya denkliği", "label_en": "IB · French Baccalaureate equivalency", "evidence": "Direct admission for Parcoursup / international applicants"},
    {"exam": "A-Level", "relationship": "accepted", "label_tr": "A-Level · Lisans kabulü", "label_en": "A-Level · Undergraduate acceptance", "evidence": "Evaluated via national application portals"}
  ]'::jsonb
),
(
  'polytechnique', 'École Polytechnique', 'FRA', 'Fransa', 'France', 'Palaiseau', 48.7138, 2.2104,
  'https://www.polytechnique.edu', 'https://programmes.polytechnique.edu/en/bachelor/admissions', 'https://programmes.polytechnique.edu/en/bachelor/admissions',
  '2026-08-30T00:00:00Z', 3,
  '[
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Bachelor programı (HL Math 7)", "label_en": "IB · Bachelor programme (HL Math 7)", "evidence": "Bachelor of Science in English requires high honors in IB Mathematics AA"},
    {"exam": "AP", "relationship": "accepted", "label_tr": "AP · Calculus BC & Physics", "label_en": "AP · Calculus BC & Physics", "evidence": "Scores of 5 in Calculus BC and Physics C required"}
  ]'::jsonb
),

-- Egypt (EGY)
(
  'auc-egypt', 'The American University in Cairo (AUC)', 'EGY', 'Mısır', 'Egypt', 'Cairo', 30.0194, 31.4994,
  'https://www.aucegypt.edu', 'https://www.aucegypt.edu/admissions/undergraduate', 'https://www.aucegypt.edu/admissions/undergraduate/requirements',
  '2026-08-30T00:00:00Z', 1,
  '[
    {"exam": "SAT", "relationship": "accepted", "label_tr": "SAT · Kabul ediliyor (1200+)", "label_en": "SAT · Accepted (1200+)", "evidence": "Official SAT score submitted for placement and scholarship"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Diploma kabulü (30+)", "label_en": "IB · Diploma accepted (30+)", "evidence": "IB Diploma with credits granted for HL courses 5+"},
    {"exam": "ACT", "relationship": "accepted", "label_tr": "ACT · Alternatif kabul (25+)", "label_en": "ACT · Alternative accepted (25+)", "evidence": "Official ACT composite accepted"}
  ]'::jsonb
),
(
  'cairo-uni', 'Cairo University', 'EGY', 'Mısır', 'Egypt', 'Giza', 30.0261, 31.2117,
  'https://cu.edu.eg', 'https://cu.edu.eg/en/Admissions', 'https://cu.edu.eg/en/Admissions',
  '2026-08-30T00:00:00Z', 2,
  '[
    {"exam": "IGCSE", "relationship": "accepted", "label_tr": "IGCSE · 8 O-Level / AL", "label_en": "IGCSE · 8 O-Levels / AL", "evidence": "Egyptian Ministry of Higher Education foreign certificate requirements"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Diploma denkliği", "label_en": "IB · Diploma equivalency", "evidence": "Evaluated via national admissions coordination bureau"}
  ]'::jsonb
),
(
  'ain-shams', 'Ain Shams University', 'EGY', 'Mısır', 'Egypt', 'Cairo', 30.0772, 31.2853,
  'https://www.asu.edu.eg', 'https://www.asu.edu.eg/en/page/admissions', 'https://www.asu.edu.eg/en/page/admissions',
  '2026-08-30T00:00:00Z', 3,
  '[
    {"exam": "IGCSE", "relationship": "accepted", "label_tr": "IGCSE · O-Level & AL kabulü", "label_en": "IGCSE · O-Level & AL accepted", "evidence": "Ministry coordination bureau standards"},
    {"exam": "IB", "relationship": "accepted", "label_tr": "IB · Uluslararası diploma", "label_en": "IB · International diploma", "evidence": "Standard international qualification requirements"}
  ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  country_name_tr = EXCLUDED.country_name_tr,
  country_name_en = EXCLUDED.country_name_en,
  city = EXCLUDED.city,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  official_url = EXCLUDED.official_url,
  admissions_url = EXCLUDED.admissions_url,
  source_url = EXCLUDED.source_url,
  verified_at = EXCLUDED.verified_at,
  display_order = EXCLUDED.display_order,
  exam_chips = EXCLUDED.exam_chips;
