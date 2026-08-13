-- Oriens Academy Database Migration: Admission Engine Foundation Schema, RLS, Indexes & Seed Data
-- Migration ID: 20260813170000_admission_engine_foundation.sql

-- Enable pg_trgm extension for fuzzy trigram search if available
create extension if not exists pg_trgm;

-- ============================================================================
-- 1. TABLES & CONSTRAINTS
-- ============================================================================

-- 1.1 COUNTRIES
create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 text not null unique check (length(iso2) = 2),
  iso3 text not null unique check (length(iso3) = 3),
  name text not null,
  slug text not null unique,
  region text,
  aliases text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.2 UNIVERSITIES
create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  slug text not null unique,
  country_id uuid not null references public.countries(id) on delete cascade,
  city text,
  state_or_region text,
  website text,
  admissions_url text,
  logo_url text,
  institution_type text not null default 'PUBLIC' check (institution_type in ('PUBLIC', 'PRIVATE', 'OTHER')),
  ranking_value integer check (ranking_value is null or ranking_value > 0),
  popularity_score numeric check (popularity_score is null or popularity_score >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.3 PROGRAMS
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  slug text not null,
  degree_level text not null default 'UNDERGRADUATE' check (degree_level in ('FOUNDATION', 'UNDERGRADUATE', 'POSTGRADUATE', 'MBA', 'PHD', 'OTHER')),
  faculty text,
  field_of_study text,
  duration text,
  language text not null default 'English',
  application_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_program_slug_per_university unique (university_id, slug)
);

-- 1.4 QUALIFICATIONS
create table if not exists public.qualifications (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  short_name text not null,
  category text not null check (category in (
    'DIPLOMA',
    'SECONDARY_QUALIFICATION',
    'SUBJECT_EXAM',
    'ADMISSION_TEST',
    'ENGLISH_LANGUAGE_TEST',
    'GRADUATE_ADMISSION_TEST',
    'PLACEMENT_TEST',
    'OTHER'
  )),
  description text,
  country_scope text,
  score_type text,
  minimum_possible_score numeric,
  maximum_possible_score numeric,
  official_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.5 ADMISSION SOURCES
create table if not exists public.admission_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text not null,
  source_type text not null check (source_type in (
    'OFFICIAL_UNIVERSITY_PAGE',
    'GOVERNMENT_DATABASE',
    'OFFICIAL_ADMISSIONS_PORTAL',
    'RECOGNIZED_ADMISSIONS_DATABASE',
    'MANUALLY_VERIFIED'
  )),
  retrieved_at timestamptz not null default now(),
  verified_at timestamptz not null default now(),
  academic_year integer not null default 2026,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.6 ADMISSION REQUIREMENT GROUPS (Supports Logical AND/OR & Nesting)
create table if not exists public.admission_requirement_groups (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  parent_group_id uuid references public.admission_requirement_groups(id) on delete cascade,
  logical_operator text not null default 'AND' check (logical_operator in ('AND', 'OR')),
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.7 ADMISSION REQUIREMENTS
create table if not exists public.admission_requirements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.admission_requirement_groups(id) on delete cascade,
  qualification_id uuid not null references public.qualifications(id) on delete restrict,
  requirement_type text not null default 'REQUIRED' check (requirement_type in (
    'REQUIRED',
    'RECOMMENDED',
    'OPTIONAL',
    'ALTERNATIVE',
    'COMPETITIVE'
  )),
  minimum_score numeric,
  recommended_score numeric,
  exact_grade text,
  subject_requirement text,
  level_requirement text,
  notes text,
  academic_year integer not null default 2026,
  source_id uuid references public.admission_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.8 SEARCH ALIASES
create table if not exists public.search_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'UNIVERSITY',
    'COUNTRY',
    'PROGRAM',
    'QUALIFICATION',
    'FIELD_OF_STUDY'
  )),
  entity_id uuid,
  alias text not null,
  normalized_alias text not null,
  language text not null default 'en',
  priority integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. TRIGGERS FOR AUTOMATIC updated_at
-- ============================================================================

create trigger trg_countries_updated_at
  before update on public.countries
  for each row execute function public.set_updated_at();

create trigger trg_universities_updated_at
  before update on public.universities
  for each row execute function public.set_updated_at();

create trigger trg_programs_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

create trigger trg_qualifications_updated_at
  before update on public.qualifications
  for each row execute function public.set_updated_at();

create trigger trg_admission_sources_updated_at
  before update on public.admission_sources
  for each row execute function public.set_updated_at();

create trigger trg_admission_requirement_groups_updated_at
  before update on public.admission_requirement_groups
  for each row execute function public.set_updated_at();

create trigger trg_admission_requirements_updated_at
  before update on public.admission_requirements
  for each row execute function public.set_updated_at();

create trigger trg_search_aliases_updated_at
  before update on public.search_aliases
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. INDEXES & SEARCH OPTIMIZATION
-- ============================================================================

-- Primary B-tree indexes
create index if not exists idx_countries_iso2 on public.countries(iso2);
create index if not exists idx_countries_iso3 on public.countries(iso3);
create index if not exists idx_countries_active on public.countries(active);

create index if not exists idx_universities_country_id on public.universities(country_id);
create index if not exists idx_universities_normalized_name on public.universities(normalized_name);
create index if not exists idx_universities_slug on public.universities(slug);
create index if not exists idx_universities_active on public.universities(active);

create index if not exists idx_programs_university_id on public.programs(university_id);
create index if not exists idx_programs_normalized_name on public.programs(normalized_name);
create index if not exists idx_programs_degree_level on public.programs(degree_level);
create index if not exists idx_programs_field_of_study on public.programs(field_of_study);
create index if not exists idx_programs_active on public.programs(active);

create index if not exists idx_qualifications_code on public.qualifications(code);
create index if not exists idx_qualifications_category on public.qualifications(category);
create index if not exists idx_qualifications_active on public.qualifications(active);

create index if not exists idx_requirement_groups_program_id on public.admission_requirement_groups(program_id);
create index if not exists idx_requirement_groups_parent_id on public.admission_requirement_groups(parent_group_id);

create index if not exists idx_admission_requirements_group_id on public.admission_requirements(group_id);
create index if not exists idx_admission_requirements_qualification_id on public.admission_requirements(qualification_id);

create index if not exists idx_search_aliases_normalized_alias on public.search_aliases(normalized_alias);
create index if not exists idx_search_aliases_entity_type on public.search_aliases(entity_type);
create index if not exists idx_search_aliases_entity_id on public.search_aliases(entity_id);

-- Trigram GIN indexes for fuzzy text search
create index if not exists idx_trgm_universities_name on public.universities using gin (normalized_name gin_trgm_ops);
create index if not exists idx_trgm_programs_name on public.programs using gin (normalized_name gin_trgm_ops);
create index if not exists idx_trgm_qualifications_code on public.qualifications using gin (code gin_trgm_ops);
create index if not exists idx_trgm_search_aliases on public.search_aliases using gin (normalized_alias gin_trgm_ops);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES & PRIVILEGES
-- ============================================================================

alter table public.countries enable row level security;
alter table public.universities enable row level security;
alter table public.programs enable row level security;
alter table public.qualifications enable row level security;
alter table public.admission_sources enable row level security;
alter table public.admission_requirement_groups enable row level security;
alter table public.admission_requirements enable row level security;
alter table public.search_aliases enable row level security;

-- Public SELECT policies for active rows
create policy "Public active countries policy" on public.countries for select using (active = true);
create policy "Public active universities policy" on public.universities for select using (active = true);
create policy "Public active programs policy" on public.programs for select using (active = true);
create policy "Public active qualifications policy" on public.qualifications for select using (active = true);
create policy "Public admission sources policy" on public.admission_sources for select using (true);
create policy "Public requirement groups policy" on public.admission_requirement_groups for select using (true);
create policy "Public requirements policy" on public.admission_requirements for select using (true);
create policy "Public search aliases policy" on public.search_aliases for select using (true);

-- Admin full access policies
create policy "Admin countries policy" on public.countries for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin universities policy" on public.universities for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin programs policy" on public.programs for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin qualifications policy" on public.qualifications for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin admission sources policy" on public.admission_sources for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin requirement groups policy" on public.admission_requirement_groups for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin requirements policy" on public.admission_requirements for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin search aliases policy" on public.search_aliases for all using (public.is_admin()) with check (public.is_admin());

-- Grants
grant select on table public.countries to anon, authenticated;
grant select on table public.universities to anon, authenticated;
grant select on table public.programs to anon, authenticated;
grant select on table public.qualifications to anon, authenticated;
grant select on table public.admission_sources to anon, authenticated;
grant select on table public.admission_requirement_groups to anon, authenticated;
grant select on table public.admission_requirements to anon, authenticated;
grant select on table public.search_aliases to anon, authenticated;

grant select, insert, update, delete on table public.countries to service_role;
grant select, insert, update, delete on table public.universities to service_role;
grant select, insert, update, delete on table public.programs to service_role;
grant select, insert, update, delete on table public.qualifications to service_role;
grant select, insert, update, delete on table public.admission_sources to service_role;
grant select, insert, update, delete on table public.admission_requirement_groups to service_role;
grant select, insert, update, delete on table public.admission_requirements to service_role;
grant select, insert, update, delete on table public.search_aliases to service_role;

-- ============================================================================
-- 5. INITIAL SEED DATA (Initial 12 Qualifications + Countries + Search Aliases)
-- ============================================================================

-- 5.1 QUALIFICATIONS (The mandatory 12 requested in Prompt 1)
insert into public.qualifications (code, name, short_name, category, description, country_scope, score_type, minimum_possible_score, maximum_possible_score, official_url)
values
  ('IB', 'International Baccalaureate Diploma', 'IB', 'DIPLOMA', 'Global pre-university diploma program awarded by the IBO', 'Global', 'GRADE_POINTS', 24, 45, 'https://www.ibo.org'),
  ('AP', 'Advanced Placement', 'AP', 'SUBJECT_EXAM', 'College Board Advanced Placement college-level courses and exams', 'USA / Global', 'NUMERIC_SCALE', 1, 5, 'https://apstudents.collegeboard.org'),
  ('SAT', 'SAT Reasoning Test', 'SAT', 'ADMISSION_TEST', 'Standardized admissions exam administered by the College Board', 'USA / Global', 'NUMERIC_SCALE', 400, 1600, 'https://satsuite.collegeboard.org'),
  ('ESAT', 'Engineering and Science Admissions Test', 'ESAT', 'ADMISSION_TEST', 'Admissions test for Engineering and Science degree programs in the UK', 'UK', 'NUMERIC_SCALE', 1.0, 9.0, 'https://www.esat-admissions.org.uk'),
  ('TARA', 'Test for Admission to Architecture', 'TARA', 'ADMISSION_TEST', 'Specialized admissions test evaluating architectural aptitude', 'Global', 'NUMERIC_SCALE', 0, 100, 'https://tara-exam.org'),
  ('TMUA', 'Test of Mathematics for University Admission', 'TMUA', 'ADMISSION_TEST', 'Math reasoning test used by select UK universities for CS and Math degrees', 'UK', 'NUMERIC_SCALE', 1.0, 9.0, 'https://www.tmua.org.uk'),
  ('IGCSE', 'International General Certificate of Secondary Education', 'IGCSE', 'SECONDARY_QUALIFICATION', 'International secondary qualification taken prior to A-Levels / IB', 'UK / Global', 'GRADE_POINTS', 1, 9, 'https://www.cambridgeinternational.org'),
  ('GRE', 'Graduate Record Examinations', 'GRE', 'GRADUATE_ADMISSION_TEST', 'Standardized test required for entry to many graduate school programs', 'Global', 'NUMERIC_SCALE', 260, 340, 'https://www.ets.org/gre'),
  ('GMAT', 'Graduate Management Admission Test', 'GMAT', 'GRADUATE_ADMISSION_TEST', 'Computer-adaptive test for graduate business and MBA admissions', 'Global', 'NUMERIC_SCALE', 200, 800, 'https://www.mba.com'),
  ('UCAT', 'University Clinical Aptitude Test', 'UCAT', 'ADMISSION_TEST', 'Admissions test used by UK and ANZ medical and dental schools', 'UK / ANZ', 'NUMERIC_SCALE', 1200, 3600, 'https://www.ucat.ac.uk'),
  ('IMAT', 'International Medical Admissions Test', 'IMAT', 'ADMISSION_TEST', 'Subject-specific admissions test for English-taught Medicine courses in Italy', 'Italy', 'NUMERIC_SCALE', 0, 90, 'https://www.mur.gov.it'),
  ('OMPT', 'Online Math Placement Test', 'OMPT', 'PLACEMENT_TEST', 'Online mathematics entrance test recognized by European universities', 'Netherlands / Europe', 'NUMERIC_SCALE', 0, 100, 'https://www.omptest.org')
on conflict (code) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  category = excluded.category,
  description = excluded.description,
  country_scope = excluded.country_scope,
  score_type = excluded.score_type,
  minimum_possible_score = excluded.minimum_possible_score,
  maximum_possible_score = excluded.maximum_possible_score,
  official_url = excluded.official_url;

-- 5.2 COUNTRIES
insert into public.countries (iso2, iso3, name, slug, region, aliases)
values
  ('GB', 'GBR', 'United Kingdom', 'united-kingdom', 'Europe', array['UK', 'Britain', 'Great Britain', 'England', 'Scotland', 'Wales']),
  ('US', 'USA', 'United States', 'united-states', 'North America', array['USA', 'US', 'America', 'United States of America']),
  ('IT', 'ITA', 'Italy', 'italy', 'Europe', array['Italia', 'Italian Republic']),
  ('NL', 'NLD', 'Netherlands', 'netherlands', 'Europe', array['Holland', 'Dutch Republic']),
  ('CH', 'CHE', 'Switzerland', 'switzerland', 'Europe', array['Swiss', 'Swiss Confederation']),
  ('FR', 'FRA', 'France', 'france', 'Europe', array['French Republic'])
on conflict (iso2) do update set
  name = excluded.name,
  slug = excluded.slug,
  region = excluded.region,
  aliases = excluded.aliases;

-- 5.3 INITIAL SEARCH ALIASES
insert into public.search_aliases (entity_type, alias, normalized_alias, language, priority)
values
  ('COUNTRY', 'UK', 'uk', 'en', 100),
  ('COUNTRY', 'Britain', 'britain', 'en', 90),
  ('COUNTRY', 'Great Britain', 'great britain', 'en', 90),
  ('COUNTRY', 'England', 'england', 'en', 80),
  ('COUNTRY', 'USA', 'usa', 'en', 100),
  ('COUNTRY', 'US', 'us', 'en', 90),
  ('UNIVERSITY', 'MIT', 'mit', 'en', 100),
  ('UNIVERSITY', 'UCL', 'ucl', 'en', 100),
  ('UNIVERSITY', 'Cambridge', 'cambridge', 'en', 100),
  ('UNIVERSITY', 'Harvard', 'harvard', 'en', 100),
  ('QUALIFICATION', 'SATs', 'sats', 'en', 80),
  ('QUALIFICATION', 'IB Diploma', 'ib diploma', 'en', 90),
  ('FIELD_OF_STUDY', 'CS', 'cs', 'en', 100),
  ('FIELD_OF_STUDY', 'computer sciences', 'computer sciences', 'en', 90),
  ('FIELD_OF_STUDY', 'comp sci', 'comp sci', 'en', 90),
  ('FIELD_OF_STUDY', 'Medicine', 'medicine', 'en', 100),
  ('FIELD_OF_STUDY', 'Engineering', 'engineering', 'en', 100)
on conflict do nothing;
