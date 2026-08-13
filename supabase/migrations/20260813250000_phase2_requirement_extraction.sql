-- Oriens Academy Database Migration: Phase 2 Structured Admission Requirement Extraction
-- Migration ID: 20260813250000_phase2_requirement_extraction.sql

-- 1. HARDEN ADMISSION REQUIREMENTS COLUMNS & NULLABILITY
alter table public.admission_requirements alter column group_id drop not null;
alter table public.admission_requirements add column if not exists source_id uuid references public.admission_sources(id) on delete set null;
alter table public.admission_requirements add column if not exists snapshot_id uuid references public.admission_source_snapshots(id) on delete set null;
alter table public.admission_requirements add column if not exists raw_source_text text;
alter table public.admission_requirements add column if not exists level_normalization text default 'DEFAULT';
alter table public.admission_requirements add column if not exists conflict_status text default 'NO_CONFLICT';

alter table public.admission_requirements drop constraint if exists admission_requirements_requirement_type_check;
alter table public.admission_requirements drop constraint if exists admission_requirements_type_check;
alter table public.admission_requirements add constraint admission_requirements_requirement_type_check check (
  requirement_type in (
    'ACADEMIC_QUALIFICATION',
    'ADMISSION_TEST',
    'ENGLISH_LANGUAGE',
    'SUBJECT_REQUIREMENT',
    'GRADE_REQUIREMENT',
    'PORTFOLIO',
    'INTERVIEW',
    'WORK_EXPERIENCE',
    'PERSONAL_STATEMENT',
    'REFERENCE',
    'REQUIRED',
    'RECOMMENDED',
    'OPTIONAL',
    'ALTERNATIVE',
    'COMPETITIVE',
    'OTHER'
  )
);

alter table public.admission_requirements drop constraint if exists admission_requirements_conflict_status_check;
alter table public.admission_requirements add constraint admission_requirements_conflict_status_check check (
  conflict_status in ('NO_CONFLICT', 'POTENTIAL_CONFLICT', 'CONFLICTING')
);

-- 2. SEED CANONICAL ONTOLOGY QUALIFICATIONS IF MISSING
insert into public.qualifications (code, name, short_name, category, description, country_scope, score_type, minimum_possible_score, maximum_possible_score, official_url)
values
  (
    'ALEVEL',
    'GCE Advanced Level (A-Levels)',
    'A-Level',
    'SECONDARY_QUALIFICATION',
    'General Certificate of Education Advanced Level qualifications widely used in the UK and internationally',
    'UK / Global',
    'GRADE_POINTS',
    1,
    3,
    'https://www.cambridgeinternational.org'
  ),
  (
    'IELTS',
    'International English Language Testing System',
    'IELTS',
    'ENGLISH_LANGUAGE_TEST',
    'Standardized English proficiency test assessing Listening, Reading, Writing, and Speaking',
    'Global',
    'NUMERIC_SCALE',
    0.0,
    9.0,
    'https://www.ielts.org'
  ),
  (
    'TOEFL',
    'Test of English as a Foreign Language (iBT)',
    'TOEFL',
    'ENGLISH_LANGUAGE_TEST',
    'Internet-based English language test measuring reading, listening, speaking, and writing',
    'Global',
    'NUMERIC_SCALE',
    0,
    120,
    'https://www.ets.org/toefl'
  ),
  (
    'PTE',
    'Pearson Test of English Academic',
    'PTE',
    'ENGLISH_LANGUAGE_TEST',
    'Computer-based academic English language test for international study and immigration',
    'Global',
    'NUMERIC_SCALE',
    10,
    90,
    'https://www.pearsonpte.com'
  ),
  (
    'ACT',
    'American College Testing',
    'ACT',
    'ADMISSION_TEST',
    'Standardized exam measuring college readiness in English, mathematics, reading, and science',
    'USA / Global',
    'NUMERIC_SCALE',
    1,
    36,
    'https://www.act.org'
  ),
  (
    'DUOLINGO',
    'Duolingo English Test',
    'DET',
    'ENGLISH_LANGUAGE_TEST',
    'Online adaptive English language proficiency assessment for international students',
    'Global',
    'NUMERIC_SCALE',
    10,
    160,
    'https://englishtest.duolingo.com'
  ),
  (
    'BACHELORS',
    'Bachelor Degree / Undergraduate Diploma',
    'Bachelor Degree',
    'DIPLOMA',
    'Undergraduate degree required for entry to postgraduate taught and research programs',
    'Global',
    'GRADE_POINTS',
    2.0,
    4.0,
    'https://www.oriens-academy.com'
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  score_type = excluded.score_type,
  minimum_possible_score = excluded.minimum_possible_score,
  maximum_possible_score = excluded.maximum_possible_score;

-- 3. INDEXES FOR PERFORMANCE & TRAVERSAL
create index if not exists idx_admission_requirements_source_id on public.admission_requirements(source_id);
create index if not exists idx_admission_requirements_snapshot_id on public.admission_requirements(snapshot_id);
create index if not exists idx_admission_requirements_qual_id on public.admission_requirements(qualification_id);
create index if not exists idx_admission_requirements_confidence on public.admission_requirements(data_confidence);
create index if not exists idx_admission_requirements_conflict on public.admission_requirements(conflict_status);
