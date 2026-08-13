-- Oriens Academy Database Migration: Phase 2 Program & Admission Foundation Schema Hardening
-- Migration ID: 20260813210000_phase2_program_admission_foundation.sql

-- ============================================================================
-- 1. FIELDS OF STUDY (Normalized Hierarchy Taxonomy)
-- ============================================================================

create table if not exists public.fields_of_study (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  code text unique,
  parent_id uuid references public.fields_of_study(id) on delete cascade,
  aliases text[] not null default '{}',
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. PROGRAM EXTERNAL IDENTIFIERS (UCAS, OpenAlex, University Registries)
-- ============================================================================

create table if not exists public.program_external_identifiers (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  source_type text not null,
  external_id text not null,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_program_external_id unique (program_id, source_type, external_id)
);

-- ============================================================================
-- 3. HARDENED PROGRAMS TABLE
-- ============================================================================

-- Drop existing degree_level constraint to update enum values
alter table public.programs drop constraint if exists programs_degree_level_check;

alter table public.programs add constraint programs_degree_level_check check (
  degree_level in (
    'FOUNDATION',
    'UNDERGRADUATE',
    'POSTGRADUATE',
    'POSTGRADUATE_TAUGHT',
    'POSTGRADUATE_RESEARCH',
    'MBA',
    'PHD',
    'PROFESSIONAL',
    'OTHER'
  )
);

alter table public.programs add column if not exists degree_title text;
alter table public.programs add column if not exists field_of_study_id uuid references public.fields_of_study(id) on delete set null;
alter table public.programs add column if not exists faculty_or_department text;
alter table public.programs add column if not exists country_id uuid references public.countries(id) on delete cascade;
alter table public.programs add column if not exists campus text;
alter table public.programs add column if not exists study_mode text default 'FULL_TIME';
alter table public.programs add column if not exists duration_value numeric;
alter table public.programs add column if not exists duration_unit text;
alter table public.programs add column if not exists official_program_url text;
alter table public.programs add column if not exists source_id uuid;

alter table public.programs drop constraint if exists programs_study_mode_check;
alter table public.programs add constraint programs_study_mode_check check (
  study_mode is null or study_mode in ('FULL_TIME', 'PART_TIME', 'DISTANCE', 'HYBRID', 'FLEXIBLE', 'OTHER')
);

alter table public.programs drop constraint if exists programs_duration_unit_check;
alter table public.programs add constraint programs_duration_unit_check check (
  duration_unit is null or duration_unit in ('YEARS', 'MONTHS', 'WEEKS', 'TERMS', 'SEMESTERS', 'OTHER')
);

-- ============================================================================
-- 4. HARDENED ADMISSION SOURCES TABLE & SNAPSHOTS
-- ============================================================================

alter table public.admission_sources drop constraint if exists admission_sources_source_type_check;

alter table public.admission_sources add constraint admission_sources_source_type_check check (
  source_type in (
    'OFFICIAL_PROGRAM_PAGE',
    'OFFICIAL_ADMISSIONS_PAGE',
    'OFFICIAL_INTERNATIONAL_REQUIREMENTS_PAGE',
    'OFFICIAL_COUNTRY_REQUIREMENTS_PAGE',
    'OFFICIAL_PDF',
    'OFFICIAL_CATALOG',
    'GOVERNMENT',
    'OFFICIAL_ADMISSIONS_PLATFORM',
    'GOVERNMENT_DATABASE',
    'RECOGNIZED_ADMISSIONS_DATABASE',
    'MANUALLY_VERIFIED',
    'OTHER'
  )
);

alter table public.admission_sources add column if not exists university_id uuid references public.universities(id) on delete cascade;
alter table public.admission_sources add column if not exists program_id uuid references public.programs(id) on delete cascade;
alter table public.admission_sources add column if not exists canonical_url text;
alter table public.admission_sources add column if not exists page_title text;
alter table public.admission_sources add column if not exists publisher text;
alter table public.admission_sources add column if not exists content_hash text;
alter table public.admission_sources add column if not exists http_status integer;
alter table public.admission_sources add column if not exists language text default 'en';
alter table public.admission_sources add column if not exists is_official boolean not null default true;
alter table public.admission_sources add column if not exists active boolean not null default true;

-- Add foreign key constraint for programs.source_id to admission_sources.id if missing
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_programs_source_id' and table_name = 'programs'
  ) then
    alter table public.programs add constraint fk_programs_source_id foreign key (source_id) references public.admission_sources(id) on delete set null;
  end if;
end $$;

-- 4.1 ADMISSION SOURCE SNAPSHOTS
create table if not exists public.admission_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.admission_sources(id) on delete cascade,
  content_hash text not null,
  snapshot_excerpt text,
  raw_payload jsonb not null default '{}'::jsonb,
  http_headers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 5. HARDENED ADMISSION REQUIREMENTS TABLE
-- ============================================================================

alter table public.admission_requirements add column if not exists program_id uuid references public.programs(id) on delete cascade;
alter table public.admission_requirements add column if not exists requirement_status text not null default 'REQUIRED';
alter table public.admission_requirements add column if not exists minimum_numeric_score numeric;
alter table public.admission_requirements add column if not exists maximum_numeric_score numeric;
alter table public.admission_requirements add column if not exists recommended_numeric_score numeric;
alter table public.admission_requirements add column if not exists grade_text text;
alter table public.admission_requirements add column if not exists subject_id uuid references public.fields_of_study(id) on delete set null;
alter table public.admission_requirements add column if not exists subject_name text;
alter table public.admission_requirements add column if not exists subject_minimum_score text;
alter table public.admission_requirements add column if not exists admission_cycle text not null default '2026/2027';
alter table public.admission_requirements add column if not exists intake_term text;
alter table public.admission_requirements add column if not exists effective_from timestamptz;
alter table public.admission_requirements add column if not exists effective_until timestamptz;
alter table public.admission_requirements add column if not exists applicant_type text not null default 'INTERNATIONAL';
alter table public.admission_requirements add column if not exists applicant_country_id uuid references public.countries(id) on delete set null;
alter table public.admission_requirements add column if not exists applicant_curriculum text;
alter table public.admission_requirements add column if not exists data_confidence text not null default 'UNVERIFIED';
alter table public.admission_requirements add column if not exists raw_evidence jsonb not null default '{}'::jsonb;

-- Constraints
alter table public.admission_requirements drop constraint if exists admission_requirements_status_check;
alter table public.admission_requirements add constraint admission_requirements_status_check check (
  requirement_status in (
    'REQUIRED',
    'RECOMMENDED',
    'OPTIONAL',
    'ACCEPTED',
    'ALTERNATIVE',
    'COMPETITIVE',
    'NOT_ACCEPTED',
    'UNKNOWN'
  )
);

alter table public.admission_requirements drop constraint if exists admission_requirements_type_check;
alter table public.admission_requirements add constraint admission_requirements_type_check check (
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

alter table public.admission_requirements drop constraint if exists admission_requirements_applicant_type_check;
alter table public.admission_requirements add constraint admission_requirements_applicant_type_check check (
  applicant_type in ('DOMESTIC', 'INTERNATIONAL', 'EU', 'NON_EU', 'OTHER')
);

alter table public.admission_requirements drop constraint if exists admission_requirements_data_confidence_check;
alter table public.admission_requirements add constraint admission_requirements_data_confidence_check check (
  data_confidence in ('VERIFIED', 'HIGH_CONFIDENCE', 'NEEDS_REVIEW', 'CONFLICTING', 'STALE', 'UNVERIFIED')
);

-- Qualification ID is nullable for non-qualification requirements (e.g. Portfolio, Interview, Work Experience)
alter table public.admission_requirements alter column qualification_id drop not null;

-- ============================================================================
-- 6. UNIVERSITY SOURCE REGISTRY TABLE
-- ============================================================================

create table if not exists public.university_source_registry (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  source_type text not null check (source_type in (
    'PROGRAM_CATALOG',
    'UNDERGRADUATE_PROGRAMS',
    'POSTGRADUATE_PROGRAMS',
    'INTERNATIONAL_ADMISSIONS',
    'ENTRY_REQUIREMENTS',
    'COUNTRY_REQUIREMENTS',
    'ENGLISH_REQUIREMENTS',
    'OTHER'
  )),
  url text not null,
  priority integer not null default 10,
  discovered_at timestamptz not null default now(),
  last_checked_at timestamptz,
  status text not null default 'DISCOVERED' check (status in ('DISCOVERED', 'PENDING', 'ACTIVE', 'FAILED', 'ARCHIVED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_university_source_registry_url unique (university_id, url)
);

-- ============================================================================
-- 7. INGESTION JOB TRACKING TABLE
-- ============================================================================

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL_SUCCESS')),
  records_discovered integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_skipped integer not null default 0,
  records_failed integer not null default 0,
  error_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- ============================================================================

create trigger trg_fields_of_study_updated_at
  before update on public.fields_of_study
  for each row execute function public.set_updated_at();

create trigger trg_program_external_identifiers_updated_at
  before update on public.program_external_identifiers
  for each row execute function public.set_updated_at();

create trigger trg_university_source_registry_updated_at
  before update on public.university_source_registry
  for each row execute function public.set_updated_at();

create trigger trg_ingestion_runs_updated_at
  before update on public.ingestion_runs
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 9. INDEXES
-- ============================================================================

create index if not exists idx_fields_of_study_slug on public.fields_of_study(slug);
create index if not exists idx_fields_of_study_parent_id on public.fields_of_study(parent_id);
create index if not exists idx_fields_of_study_active on public.fields_of_study(active);

create index if not exists idx_program_ext_id_program_id on public.program_external_identifiers(program_id);
create index if not exists idx_program_ext_id_source_ext on public.program_external_identifiers(source_type, external_id);

create index if not exists idx_programs_country_id on public.programs(country_id);
create index if not exists idx_programs_field_of_study_id on public.programs(field_of_study_id);
create index if not exists idx_programs_source_id on public.programs(source_id);

create index if not exists idx_admission_sources_university_id on public.admission_sources(university_id);
create index if not exists idx_admission_sources_program_id on public.admission_sources(program_id);

create index if not exists idx_admission_source_snapshots_source_id on public.admission_source_snapshots(source_id);

create index if not exists idx_admission_requirements_program_id on public.admission_requirements(program_id);
create index if not exists idx_admission_requirements_status on public.admission_requirements(requirement_status);
create index if not exists idx_admission_requirements_applicant_country on public.admission_requirements(applicant_country_id);
create index if not exists idx_admission_requirements_cycle on public.admission_requirements(admission_cycle);

create index if not exists idx_university_source_registry_univ_id on public.university_source_registry(university_id);
create index if not exists idx_university_source_registry_status on public.university_source_registry(status);

create index if not exists idx_ingestion_runs_status on public.ingestion_runs(status);

-- Trigram index for fields_of_study search
create index if not exists idx_trgm_fields_of_study_name on public.fields_of_study using gin (name gin_trgm_ops);

-- ============================================================================
-- 10. RLS POLICIES & PRIVILEGES
-- ============================================================================

alter table public.fields_of_study enable row level security;
alter table public.program_external_identifiers enable row level security;
alter table public.admission_source_snapshots enable row level security;
alter table public.university_source_registry enable row level security;
alter table public.ingestion_runs enable row level security;

-- Public SELECT policies
create policy "Public fields of study policy" on public.fields_of_study for select using (active = true);
create policy "Public program external ids policy" on public.program_external_identifiers for select using (true);
create policy "Public source snapshots policy" on public.admission_source_snapshots for select using (true);
create policy "Public source registry policy" on public.university_source_registry for select using (true);
create policy "Public ingestion runs policy" on public.ingestion_runs for select using (true);

-- Admin policies
create policy "Admin fields of study policy" on public.fields_of_study for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin program external ids policy" on public.program_external_identifiers for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin source snapshots policy" on public.admission_source_snapshots for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin source registry policy" on public.university_source_registry for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin ingestion runs policy" on public.ingestion_runs for all using (public.is_admin()) with check (public.is_admin());

-- Grants
grant select on table public.fields_of_study to anon, authenticated;
grant select on table public.program_external_identifiers to anon, authenticated;
grant select on table public.admission_source_snapshots to anon, authenticated;
grant select on table public.university_source_registry to anon, authenticated;
grant select on table public.ingestion_runs to anon, authenticated;

grant select, insert, update, delete on table public.fields_of_study to service_role;
grant select, insert, update, delete on table public.program_external_identifiers to service_role;
grant select, insert, update, delete on table public.admission_source_snapshots to service_role;
grant select, insert, update, delete on table public.university_source_registry to service_role;
grant select, insert, update, delete on table public.ingestion_runs to service_role;

-- ============================================================================
-- 11. INITIAL SEED TAXONOMY FOR FIELDS OF STUDY
-- ============================================================================

insert into public.fields_of_study (name, slug, code, aliases, description)
values
  ('Engineering', 'engineering', 'ENG', array['Engineering Sciences', 'Tech Engineering'], 'Broad field encompassing design, building, and use of engines, machines, and structures'),
  ('Computer Science', 'computer-science', 'CS', array['CS', 'Computer Sciences', 'Comp Sci', 'Software Engineering', 'Informatics'], 'Study of computation, information processing, algorithms, and software systems'),
  ('Medicine', 'medicine', 'MED', array['Medical Sciences', 'Pre-Med', 'Clinical Medicine', 'MBBS', 'MB BChir'], 'Field dedicated to diagnosing, treating, and preventing disease'),
  ('Dentistry', 'dentistry', 'DENT', array['Dental Medicine', 'BDS', 'Dental Surgery'], 'Branch of medicine dealing with teeth and oral cavity disorders'),
  ('Mathematics', 'mathematics', 'MATH', array['Math', 'Mathematical Sciences', 'Applied Mathematics'], 'Science of numbers, quantity, space, and structure'),
  ('Physics', 'physics', 'PHYS', array['Physical Sciences', 'Theoretical Physics'], 'Natural science studying matter, fundamental constituents, motion, and energy'),
  ('Chemistry', 'chemistry', 'CHEM', array['Chemical Sciences', 'Biochemistry'], 'Scientific discipline concerned with elements and compounds composed of atoms, molecules, and ions'),
  ('Biology', 'biology', 'BIOL', array['Biological Sciences', 'Life Sciences'], 'Natural science concerned with the study of life and living organisms'),
  ('Economics', 'economics', 'ECON', array['Economics and Finance', 'Econometrics'], 'Social science concerned with production, distribution, and consumption of goods and services'),
  ('Business', 'business', 'BUS', array['Business Administration', 'Management', 'Commerce'], 'Study of organizational management, commerce, and financial operations'),
  ('Law', 'law', 'LAW', array['Legal Studies', 'Jurisprudence', 'LLB'], 'System of rules created and enforced through social or governmental institutions'),
  ('Architecture', 'architecture', 'ARCH', array['Architectural Design', 'Urban Design'], 'Art and science of designing and constructing buildings and structures'),
  ('Psychology', 'psychology', 'PSYCH', array['Psychological Sciences', 'Cognitive Psychology'], 'Scientific study of mind and behavior')
on conflict (slug) do update set
  aliases = excluded.aliases,
  description = excluded.description;

-- Insert Sub-Fields of Engineering with Parent Pointer
insert into public.fields_of_study (name, slug, code, parent_id, aliases, description)
select sub.name, sub.slug, sub.code, eng.id, sub.aliases, sub.description
from public.fields_of_study eng
cross join (values
  ('Mechanical Engineering', 'mechanical-engineering', 'MECH_ENG', array['Mechanical Eng', 'Thermal Engineering'], 'Engineering branch combining engineering physics and mathematics with materials science'),
  ('Electrical Engineering', 'electrical-engineering', 'ELEC_ENG', array['Electrical & Electronic Engineering', 'EEE', 'Electronics'], 'Engineering discipline concerned with study and application of electricity, electronics, and electromagnetism'),
  ('Civil Engineering', 'civil-engineering', 'CIVIL_ENG', array['Civil and Environmental Engineering', 'Structural Engineering'], 'Professional engineering discipline dealing with design and construction of built environment'),
  ('Chemical Engineering', 'chemical-engineering', 'CHEM_ENG', array['Chemical & Biomolecular Engineering'], 'Engineering branch using principles of chemistry, physics, math, biology, and economics to produce energy and materials')
) as sub(name, slug, code, aliases, description)
where eng.slug = 'engineering'
on conflict (slug) do update set
  parent_id = excluded.parent_id,
  aliases = excluded.aliases,
  description = excluded.description;
