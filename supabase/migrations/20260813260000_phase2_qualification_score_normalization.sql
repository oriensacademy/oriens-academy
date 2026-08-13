-- Oriens Academy Database Migration: Phase 2 Qualification Normalization & Score Schemas
-- Migration ID: 20260813260000_phase2_qualification_score_normalization.sql

-- 1. HARDEN QUALIFICATIONS CATEGORIES & SCORE SCHEMAS
alter table public.qualifications drop constraint if exists qualifications_category_check;
alter table public.qualifications add constraint qualifications_category_check check (
  category in (
    'DIPLOMA',
    'SECONDARY_QUALIFICATION',
    'SUBJECT_EXAM',
    'ADMISSION_TEST',
    'UNDERGRADUATE_ADMISSION_TEST',
    'GRADUATE_ADMISSION_TEST',
    'MEDICAL_ADMISSION_TEST',
    'ENGLISH_LANGUAGE_TEST',
    'PLACEMENT_TEST',
    'NATIONAL_ENTRANCE_EXAM',
    'PROFESSIONAL_TEST',
    'OTHER'
  )
);

alter table public.qualifications add column if not exists score_increment numeric;
alter table public.qualifications add column if not exists component_schema jsonb not null default '{}'::jsonb;
alter table public.qualifications add column if not exists score_conversion_policy text default 'NO_CROSS_CONVERSION';

-- 2. HARDEN ADMISSION REQUIREMENTS SCORE & COMPONENT COLUMNS
alter table public.admission_requirements add column if not exists score_components jsonb not null default '{}'::jsonb;
alter table public.admission_requirements add column if not exists score_type text default 'COMPOSITE';
alter table public.admission_requirements add column if not exists normalization_confidence text default 'HIGH_CONFIDENCE';
alter table public.admission_requirements add column if not exists unresolved_reason text;

alter table public.admission_requirements drop constraint if exists admission_requirements_normalization_confidence_check;
alter table public.admission_requirements add constraint admission_requirements_normalization_confidence_check check (
  normalization_confidence in ('EXACT', 'CANONICAL_ALIAS', 'DETERMINISTIC_RULE', 'HIGH_CONFIDENCE', 'NEEDS_REVIEW', 'UNRESOLVED')
);

-- 3. SEED ADDITIONAL CANONICAL QUALIFICATIONS & COMPONENT SCHEMAS
insert into public.qualifications (code, name, short_name, category, description, country_scope, score_type, minimum_possible_score, maximum_possible_score, score_increment, component_schema, official_url)
values
  (
    'ABITUR',
    'Zeugnis der Allgemeinen Hochschulreife (Abitur)',
    'Abitur',
    'SECONDARY_QUALIFICATION',
    'German secondary school leaving certificate and university entrance qualification',
    'Germany',
    'DECIMAL',
    1.0,
    6.0,
    0.1,
    '{"min": 1.0, "max": 6.0, "bestScore": 1.0}'::jsonb,
    'https://www.kmk.org'
  ),
  (
    'FRENCH_BAC',
    'Diplôme du Baccalauréat Général',
    'French Bac',
    'SECONDARY_QUALIFICATION',
    'French national academic qualification obtained at the end of secondary education',
    'France',
    'NUMERIC_SCALE',
    0,
    20,
    0.1,
    '{"min": 0, "max": 20, "pass": 10}'::jsonb,
    'https://www.education.gouv.fr'
  ),
  (
    'EURO_BAC',
    'European Baccalaureate',
    'Euro Bac',
    'SECONDARY_QUALIFICATION',
    'Diploma awarded upon completion of studies at European Schools',
    'Europe',
    'NUMERIC_SCALE',
    0,
    100,
    0.1,
    '{"min": 0, "max": 100, "pass": 60}'::jsonb,
    'https://www.eursc.eu'
  ),
  (
    'TURKISH_LISA',
    'Lise Diploması (Turkish High School Diploma)',
    'Lise Diploması',
    'SECONDARY_QUALIFICATION',
    'National upper secondary school diploma awarded in Turkey',
    'Turkey',
    'NUMERIC_SCALE',
    0,
    100,
    0.1,
    '{"min": 0, "max": 100, "pass": 50}'::jsonb,
    'https://www.meb.gov.tr'
  ),
  (
    'YKS',
    'Yükseköğretim Kurumları Sınavı (YKS - TYT/AYT)',
    'YKS',
    'NATIONAL_ENTRANCE_EXAM',
    'Turkish national central university entrance examination administered by ÖSYM',
    'Turkey',
    'NUMERIC_SCALE',
    100,
    500,
    0.1,
    '{"min": 100, "max": 500, "sections": ["TYT", "AYT_SAY", "AYT_EA", "AYT_SOZ"]}'::jsonb,
    'https://www.osym.gov.tr'
  ),
  (
    'GAOKAO',
    'National College Entrance Examination (Gaokao)',
    'Gaokao',
    'NATIONAL_ENTRANCE_EXAM',
    'Standardized college entrance examination held annually in mainland China',
    'China',
    'NUMERIC_SCALE',
    0,
    750,
    1,
    '{"min": 0, "max": 750}'::jsonb,
    'https://www.moe.gov.cn'
  ),
  (
    'JEE',
    'Joint Entrance Examination (JEE Main & Advanced)',
    'JEE',
    'NATIONAL_ENTRANCE_EXAM',
    'All-India standardized engineering entrance assessment for top engineering institutes',
    'India',
    'NUMERIC_SCALE',
    0,
    360,
    1,
    '{"min": 0, "max": 360}'::jsonb,
    'https://jeemain.nta.nic.in'
  ),
  (
    'NEET',
    'National Eligibility cum Entrance Test (NEET UG)',
    'NEET',
    'MEDICAL_ADMISSION_TEST',
    'All-India pre-medical entrance exam for students seeking undergraduate medical degrees',
    'India',
    'NUMERIC_SCALE',
    0,
    720,
    1,
    '{"min": 0, "max": 720}'::jsonb,
    'https://neet.nta.nic.in'
  ),
  (
    'AS_LEVEL',
    'GCE Advanced Subsidiary Level (AS-Level)',
    'AS-Level',
    'SECONDARY_QUALIFICATION',
    'UK post-16 qualification forming the first half of a full A-Level',
    'UK / Global',
    'GRADE_PROFILE',
    1,
    5,
    1,
    '{"grades": ["a", "b", "c", "d", "e"]}'::jsonb,
    'https://www.cambridgeinternational.org'
  ),
  (
    'CAMBRIDGE_ENG',
    'Cambridge English C1 Advanced / C2 Proficiency',
    'Cambridge English',
    'ENGLISH_LANGUAGE_TEST',
    'In-depth, high-level English qualification for academic study',
    'Global',
    'NUMERIC_SCALE',
    160,
    230,
    1,
    '{"min": 160, "max": 230, "c1Min": 180, "c2Min": 200}'::jsonb,
    'https://www.cambridgeenglish.org'
  )
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  component_schema = excluded.component_schema;

-- Update component schemas for core English qualifications
update public.qualifications set
  component_schema = '{"overallMin": 0.0, "overallMax": 9.0, "components": ["Listening", "Reading", "Writing", "Speaking"]}'::jsonb
where code = 'IELTS';

update public.qualifications set
  component_schema = '{"overallMin": 0, "overallMax": 120, "components": ["Reading", "Listening", "Speaking", "Writing"]}'::jsonb
where code = 'TOEFL';

-- 4. SEED CANONICAL SUBJECT TAXONOMY IN FIELDS_OF_STUDY
insert into public.fields_of_study (name, slug, code, aliases, description)
values
  ('Further Mathematics', 'further-mathematics', 'FURTHER_MATH', array['Further Math', 'FM', 'Further Maths', 'Advanced Mathematics'], 'Advanced mathematics extension covering complex numbers, matrices, and mechanics'),
  ('English Literature', 'english-literature', 'ENG_LIT', array['English Lit', 'Literature in English'], 'Study of literary texts, prose, poetry, and drama'),
  ('History', 'history', 'HIST', array['Modern History', 'Ancient History', 'European History'], 'Study of past events, human societies, and historical research'),
  ('Geography', 'geography', 'GEOG', array['Physical Geography', 'Human Geography'], 'Study of places, physical environments, and relationships between people and environments'),
  ('IB Mathematics AA', 'ib-math-aa', 'IB_MATH_AA', array['IB Math AA', 'Mathematics Analysis and Approaches', 'Math AA HL', 'Math AA SL'], 'IB Mathematics Analysis and Approaches course emphasizing calculus and algebraic methods'),
  ('IB Mathematics AI', 'ib-math-ai', 'IB_MATH_AI', array['IB Math AI', 'Mathematics Applications and Interpretation', 'Math AI HL', 'Math AI SL'], 'IB Mathematics Applications and Interpretation course emphasizing statistics and modeling')
on conflict (slug) do update set
  aliases = excluded.aliases,
  description = excluded.description;

-- 5. INDEXES FOR PERFORMANCE
create index if not exists idx_admission_requirements_score_type on public.admission_requirements(score_type);
create index if not exists idx_admission_requirements_norm_conf on public.admission_requirements(normalization_confidence);
