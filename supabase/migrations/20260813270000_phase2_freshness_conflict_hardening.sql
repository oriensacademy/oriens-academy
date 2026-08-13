-- Oriens Academy Database Migration: Phase 2 Freshness, Conflict Safety & Production Hardening
-- Migration ID: 20260813270000_phase2_freshness_conflict_hardening.sql

-- 1. HARDEN ADMISSION SOURCES FRESHNESS & HEALTH COLUMNS
alter table public.admission_sources add column if not exists freshness_status text default 'CURRENT';
alter table public.admission_sources add column if not exists re_extraction_status text default 'UP_TO_DATE';
alter table public.admission_sources add column if not exists http_status integer default 200;
alter table public.admission_sources add column if not exists content_hash text;
alter table public.admission_sources add column if not exists last_checked_at timestamptz default now();

alter table public.admission_sources drop constraint if exists admission_sources_freshness_status_check;
alter table public.admission_sources add constraint admission_sources_freshness_status_check check (
  freshness_status in ('CURRENT', 'AGING', 'STALE', 'UNKNOWN', 'SUPERSEDED')
);

alter table public.admission_sources drop constraint if exists admission_sources_re_extraction_status_check;
alter table public.admission_sources add constraint admission_sources_re_extraction_status_check check (
  re_extraction_status in ('UP_TO_DATE', 'QUEUED', 'IN_REVIEW', 'SUPERSEDED')
);

-- 2. HARDEN CONFLICT STATUS CHECK CONSTRAINT ON ADMISSION REQUIREMENTS
alter table public.admission_requirements drop constraint if exists admission_requirements_conflict_status_check;
alter table public.admission_requirements add constraint admission_requirements_conflict_status_check check (
  conflict_status in ('NO_CONFLICT', 'POTENTIAL_CONFLICT', 'CONFIRMED_CONFLICT', 'RESOLVED_BY_SCOPE', 'SUPERSEDED', 'NEEDS_REVIEW')
);

-- 3. CREATE RE-EXTRACTION REVIEW QUEUE VIEW
create or replace view public.v_re_extraction_review_queue as
select
  s.id as source_id,
  s.university_id,
  u.name as university_name,
  s.url,
  s.source_scope,
  s.freshness_status,
  s.re_extraction_status,
  s.http_status,
  s.last_checked_at,
  count(r.id) as requirement_count
from public.admission_sources s
left join public.universities u on s.university_id = u.id
left join public.admission_requirements r on r.source_id = s.id
where s.freshness_status in ('STALE', 'SUPERSEDED')
   or s.re_extraction_status in ('QUEUED', 'IN_REVIEW')
group by s.id, u.name;

-- 4. PERFORMANCE & QA INDEXES
create index if not exists idx_admission_sources_freshness on public.admission_sources(freshness_status);
create index if not exists idx_admission_sources_re_extraction on public.admission_sources(re_extraction_status);
create index if not exists idx_admission_requirements_conflict on public.admission_requirements(conflict_status);
