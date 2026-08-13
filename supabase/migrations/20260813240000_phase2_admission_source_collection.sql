-- Phase 2 Prompt 4: Official Program Admission Source Collection Schema Migration

-- 1. ADD PROGRAM COVERAGE STATUS COLUMN & CONSTRAINT
alter table public.programs add column if not exists coverage_status text not null default 'NO_ADMISSION_SOURCE';

alter table public.programs drop constraint if exists programs_coverage_status_check;
alter table public.programs add constraint programs_coverage_status_check check (
  coverage_status in (
    'NO_ADMISSION_SOURCE',
    'PROGRAM_SOURCE_ONLY',
    'GENERAL_REQUIREMENTS_FOUND',
    'PROGRAM_REQUIREMENTS_FOUND',
    'INTERNATIONAL_REQUIREMENTS_FOUND',
    'ENGLISH_REQUIREMENTS_FOUND',
    'FULL_SOURCE_COVERAGE',
    'NEEDS_REVIEW'
  )
);

-- 2. EXPAND ADMISSION SOURCES TABLE COLUMNS & CONSTRAINTS
alter table public.admission_sources add column if not exists source_scope text not null default 'PROGRAM';
alter table public.admission_sources add column if not exists authority_level text not null default 'OFFICIAL_PROGRAM_PAGE';
alter table public.admission_sources add column if not exists admission_cycle text;
alter table public.admission_sources add column if not exists discovered_from_id uuid references public.admission_sources(id) on delete set null;
alter table public.admission_sources add column if not exists country_id uuid references public.countries(id) on delete set null;
alter table public.admission_sources add column if not exists qualification_id uuid references public.qualifications(id) on delete set null;
alter table public.admission_sources add column if not exists conflict_status text not null default 'NO_CONFLICT';
alter table public.admission_sources add column if not exists raw_excerpt text;
alter table public.admission_sources add column if not exists sanitized_content text;
alter table public.admission_sources add column if not exists retrieval_metadata jsonb not null default '{}'::jsonb;

-- Constraints
alter table public.admission_sources drop constraint if exists admission_sources_source_scope_check;
alter table public.admission_sources add constraint admission_sources_source_scope_check check (
  source_scope in (
    'PROGRAM',
    'UNIVERSITY',
    'FACULTY',
    'COUNTRY',
    'QUALIFICATION',
    'LANGUAGE_REQUIREMENT',
    'GENERAL_ADMISSIONS',
    'OTHER'
  )
);

alter table public.admission_sources drop constraint if exists admission_sources_authority_level_check;
alter table public.admission_sources add constraint admission_sources_authority_level_check check (
  authority_level in (
    'OFFICIAL_PROGRAM_PAGE',
    'OFFICIAL_UNIVERSITY_PAGE',
    'OFFICIAL_FACULTY_PAGE',
    'OFFICIAL_DEPARTMENT_PAGE',
    'OFFICIAL_DELEGATED_PLATFORM',
    'GOVERNMENT',
    'NATIONAL_ADMISSIONS_PLATFORM',
    'THIRD_PARTY'
  )
);

alter table public.admission_sources drop constraint if exists admission_sources_conflict_status_check;
alter table public.admission_sources add constraint admission_sources_conflict_status_check check (
  conflict_status in ('NO_CONFLICT', 'POTENTIAL_CONFLICT', 'RESOLVED')
);

alter table public.admission_sources drop constraint if exists admission_sources_source_type_check;
alter table public.admission_sources add constraint admission_sources_source_type_check check (
  source_type in (
    'PROGRAM_ENTRY_REQUIREMENTS',
    'PROGRAM_ADMISSIONS',
    'UNDERGRADUATE_ENTRY_REQUIREMENTS',
    'POSTGRADUATE_ENTRY_REQUIREMENTS',
    'INTERNATIONAL_ENTRY_REQUIREMENTS',
    'COUNTRY_SPECIFIC_REQUIREMENTS',
    'QUALIFICATION_SPECIFIC_REQUIREMENTS',
    'ENGLISH_LANGUAGE_REQUIREMENTS',
    'ADMISSION_TEST_REQUIREMENTS',
    'FACULTY_REQUIREMENTS',
    'APPLICATION_REQUIREMENTS',
    'OFFICIAL_CATALOG',
    'OFFICIAL_PDF',
    'OFFICIAL_DELEGATED_PLATFORM',
    'OFFICIAL_PROGRAM_PAGE',
    'OFFICIAL_ADMISSIONS_PAGE',
    'OFFICIAL_INTERNATIONAL_REQUIREMENTS_PAGE',
    'OFFICIAL_COUNTRY_REQUIREMENTS_PAGE',
    'GOVERNMENT',
    'OFFICIAL_ADMISSIONS_PLATFORM',
    'GOVERNMENT_DATABASE',
    'RECOGNIZED_ADMISSIONS_DATABASE',
    'MANUALLY_VERIFIED',
    'OTHER'
  )
);

-- 3. INDEXES FOR PERFORMANCE & UNIQUE UPSERTS
create unique index if not exists idx_admission_sources_url_unique on public.admission_sources(url);
create index if not exists idx_admission_sources_program_id on public.admission_sources(program_id);
create index if not exists idx_admission_sources_univ_id on public.admission_sources(university_id);
create index if not exists idx_admission_sources_scope on public.admission_sources(source_scope);
create index if not exists idx_admission_sources_authority on public.admission_sources(authority_level);
create index if not exists idx_programs_coverage_status on public.programs(coverage_status);
