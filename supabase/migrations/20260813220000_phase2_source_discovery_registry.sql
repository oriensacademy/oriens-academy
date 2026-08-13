-- Oriens Academy Database Migration: Phase 2 Official Program Source Discovery & Registry Schema
-- Migration ID: 20260813220000_phase2_source_discovery_registry.sql

-- ============================================================================
-- 1. UNIVERSITY DOMAINS TABLE
-- ============================================================================

create table if not exists public.university_domains (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  domain text not null,
  root_domain text not null,
  source_url text,
  is_primary boolean not null default true,
  verification_status text not null default 'UNKNOWN' check (
    verification_status in ('VERIFIED', 'LIKELY_OFFICIAL', 'NEEDS_REVIEW', 'REJECTED', 'UNKNOWN')
  ),
  verification_method text check (
    verification_method in ('HOME_PAGE_HEURISTIC', 'OPENALEX_CANONICAL', 'GOVERNMENT_REGISTRY', 'MANUAL')
  ),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_university_domain unique (university_id, domain)
);

-- ============================================================================
-- 2. HARDENED UNIVERSITY SOURCE REGISTRY TABLE
-- ============================================================================

alter table public.university_source_registry drop constraint if exists university_source_registry_source_type_check;

alter table public.university_source_registry add constraint university_source_registry_source_type_check check (
  source_type in (
    'MAIN_WEBSITE',
    'PROGRAM_CATALOG',
    'UNDERGRADUATE_PROGRAMS',
    'POSTGRADUATE_PROGRAMS',
    'PHD_PROGRAMS',
    'MBA_PROGRAMS',
    'INTERNATIONAL_ADMISSIONS',
    'UNDERGRADUATE_ADMISSIONS',
    'POSTGRADUATE_ADMISSIONS',
    'ENTRY_REQUIREMENTS',
    'COUNTRY_REQUIREMENTS',
    'ENGLISH_LANGUAGE_REQUIREMENTS',
    'TUITION_FEES',
    'APPLICATION_GUIDE',
    'OFFICIAL_CATALOG_PDF',
    'OTHER'
  )
);

alter table public.university_source_registry add column if not exists canonical_url text;
alter table public.university_source_registry add column if not exists domain text;
alter table public.university_source_registry add column if not exists page_title text;
alter table public.university_source_registry add column if not exists language text default 'en';
alter table public.university_source_registry add column if not exists is_official boolean not null default true;
alter table public.university_source_registry add column if not exists provenance_type text not null default 'OFFICIAL_UNIVERSITY_DOMAIN';
alter table public.university_source_registry add column if not exists verification_status text not null default 'VERIFIED';
alter table public.university_source_registry add column if not exists http_status integer;
alter table public.university_source_registry add column if not exists content_type text not null default 'HTML';
alter table public.university_source_registry add column if not exists notes text;

alter table public.university_source_registry drop constraint if exists university_source_registry_provenance_check;
alter table public.university_source_registry add constraint university_source_registry_provenance_check check (
  provenance_type in (
    'OFFICIAL_UNIVERSITY_DOMAIN',
    'OFFICIAL_DELEGATED_PLATFORM',
    'GOVERNMENT',
    'NATIONAL_ADMISSIONS_PLATFORM',
    'THIRD_PARTY'
  )
);

alter table public.university_source_registry drop constraint if exists university_source_registry_verification_check;
alter table public.university_source_registry add constraint university_source_registry_verification_check check (
  verification_status in ('VERIFIED', 'HIGH_CONFIDENCE', 'NEEDS_REVIEW', 'REJECTED')
);

alter table public.university_source_registry drop constraint if exists university_source_registry_content_type_check;
alter table public.university_source_registry add constraint university_source_registry_content_type_check check (
  content_type in ('HTML', 'PDF', 'JSON', 'XML', 'OTHER')
);

-- ============================================================================
-- 3. TRIGGERS FOR UPDATED_AT
-- ============================================================================

create trigger trg_university_domains_updated_at
  before update on public.university_domains
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

create index if not exists idx_university_domains_univ_id on public.university_domains(university_id);
create index if not exists idx_university_domains_domain on public.university_domains(domain);
create index if not exists idx_university_domains_status on public.university_domains(verification_status);

create index if not exists idx_source_registry_domain on public.university_source_registry(domain);
create index if not exists idx_source_registry_provenance on public.university_source_registry(provenance_type);
create index if not exists idx_source_registry_verification on public.university_source_registry(verification_status);

-- ============================================================================
-- 5. RLS POLICIES & PRIVILEGES
-- ============================================================================

alter table public.university_domains enable row level security;

create policy "Public university domains policy" on public.university_domains for select using (true);
create policy "Admin university domains policy" on public.university_domains for all using (public.is_admin()) with check (public.is_admin());

grant select on table public.university_domains to anon, authenticated;
grant select, insert, update, delete on table public.university_domains to service_role;
