-- Patch 3: quarantine polluted program records and make quality decisions auditable.

alter table public.programs
  add column if not exists data_quality_status text not null default 'AMBIGUOUS_NEEDS_REVIEW',
  add column if not exists data_quality_reason text,
  add column if not exists data_quality_signals jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_at timestamptz;

alter table public.programs drop constraint if exists programs_data_quality_status_check;
alter table public.programs add constraint programs_data_quality_status_check check (
  data_quality_status in (
    'VALID_PROGRAM',
    'LIKELY_VALID_PROGRAM',
    'INVALID_NAVIGATION_PAGE',
    'INVALID_INFORMATION_PAGE',
    'INVALID_ADMISSIONS_PAGE',
    'INVALID_EVENT_PAGE',
    'INVALID_NEWS_PAGE',
    'INVALID_CATEGORY_PAGE',
    'INVALID_SEARCH_PAGE',
    'DUPLICATE_PROGRAM',
    'AMBIGUOUS_NEEDS_REVIEW'
  )
);

create table if not exists public.program_quality_audits (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  run_label text not null,
  previous_active boolean not null,
  classification text not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  audited_at timestamptz not null default now(),
  constraint unique_program_quality_audit_run unique (program_id, run_label)
);

create index if not exists idx_programs_data_quality_status on public.programs(data_quality_status);
create index if not exists idx_program_quality_audits_program on public.program_quality_audits(program_id);

with audited as (
  select
    p.id,
    p.active as previous_active,
    case
      when p.id in (
        '2c029c59-1a52-4290-972a-131ef8f69977',
        'fc3a24a7-1454-4521-b474-2d7957e801d9',
        '7a0463f5-44e1-49e5-b0b7-1d334865bbfb',
        '317246e1-19ba-493c-b66a-45d411f21dc4',
        '60a2d1db-2a4b-4a58-83db-ad2a48d0303f',
        '992f3e31-b9ff-45aa-89b9-064ad7501b07',
        '9b64dc54-9164-4702-a23e-e685eddb621d',
        '6d08172d-9020-45bd-907e-deb33e185069',
        '0b0e0282-d3ba-42e1-a283-a4542914fa59',
        '999bd065-0f5d-4c0b-bc54-9d47bdc47e22',
        '97cff0be-8387-4239-a39a-2ef1cd3963b6',
        'a0d3b4d9-8a96-4998-af8f-6f40a92cc39a',
        '4621d6c0-13b2-469e-b59f-fa6c4e1d22f1',
        '484853f7-03da-483d-953b-d33cf3dc9e5e',
        '4231023b-ac08-4667-a9db-8da0ae1d73e0',
        '90ba9fb7-7b33-4ed6-9abb-8433fab45cd2',
        '296bdc26-266e-4b9b-b8a4-c35ce1c2eef2',
        '96c9cd2e-7c04-494b-aa2f-1607c417424e',
        '969e35e1-be2d-4cf2-8382-890ea76bc16e',
        '35d8a044-c7ab-410c-b92f-c5c16e2e2d6d',
        '0df78768-27b7-4a7d-90c5-3022ea9f7753',
        '790e08dc-f882-449e-acba-0fa609075c46',
        'e26a228e-9edf-4433-8e4d-e3c5787f2b3c',
        '77cc977d-7547-4527-b1fe-f6fdb2c37e88',
        '761bb4d3-8aa9-4137-ae0f-01034a993d3c',
        'bffbc9c2-1f95-438b-aea6-11a1e3e180a1',
        'd41e4d06-a034-4e79-9715-41847ad136a8',
        '903d05f7-ef9f-4e69-88e5-a800672bbd50',
        '3b6537df-5742-4e6e-bdc4-f2ded1a3f29f',
        'c7b54911-b77a-4c0d-a80e-52e26776c181',
        '759d9a01-c4a9-4745-a2c1-8949892308a6',
        '827e4244-7926-49a6-9a0a-be9c836921e8',
        '810c20d6-232f-4bbf-b5c5-76cda03b01d7',
        '840ebca7-e798-4b5b-8ab0-583e68c7a8a4',
        '12ff04e1-7e1c-4766-b2d1-810783a6adeb',
        '90ed5c06-cbde-4d47-a85d-62115e2b592b',
        '1d42e3bd-e656-4611-b707-c37d0d685772',
        '893cc831-8cec-4724-ba12-49081dfeea29',
        '24d89ce6-aada-4e14-921d-569b5b801bb4',
        '2540d705-003a-4080-9862-8a6f62037e64',
        '6a01a0f3-dd18-49e7-89ab-f104511e5572',
        '371fbb25-0077-472a-b2a5-8379eef22b92',
        'd11d25cd-6662-46ac-b050-0e1df6420dd5',
        'b7655977-fb63-4202-a99e-3f62530b7064',
        'a3e70446-be93-4cda-a3bc-4496e4059f9b',
        'd9008bb0-534d-44e9-b765-6c58c8df4fed'
      ) then 'VALID_PROGRAM'
      when p.name ~* '(open days?|events?)' then 'INVALID_EVENT_PAGE'
      when p.name ~* '(admissions?|ammissioni|selection criteria|who is eligible|accepting applications|studentships)' then 'INVALID_ADMISSIONS_PAGE'
      when p.name ~* '(find (a|your) course|course search|subject a-z|course listing|degree programs|explore programs|departments offering courses|department directory|research courses|taught courses|postgraduate qualifications|lauree (magistrali|triennali)|master universitari|master specialistici|master.s programs|school of management)' then 'INVALID_CATEGORY_PAGE'
      when p.name ~* '(fees?|fee status|where do i start|changes to courses|choosing what to study|how to choose a course|how you will learn|learning at|personalised learning|careers and graduate prospects|about your studies|recruitment and engagement|housing and dining|key program dates|activities during|benefits of participating|what .* can do for you|what to expect|part-time study at|summer school|opportunit.* internazionali|piano studi|dopo la laurea)' then 'INVALID_INFORMATION_PAGE'
      else 'AMBIGUOUS_NEEDS_REVIEW'
    end as classification
  from public.programs p
), inserted_audit as (
  insert into public.program_quality_audits (
    program_id, run_label, previous_active, classification, reason, evidence
  )
  select
    a.id,
    'PATCH_3_20260813',
    a.previous_active,
    a.classification,
    case
      when a.classification = 'VALID_PROGRAM' then 'Official detail URL and page evidence identify a specific academic award/program.'
      when a.classification = 'AMBIGUOUS_NEEDS_REVIEW' then 'Official page exists but lacks sufficient deterministic evidence for active verified program status.'
      else 'Official page is an index, admissions, event, navigation, or informational page rather than a specific academic award.'
    end,
    jsonb_build_object('audit_scope', 'all existing programs', 'method', 'official URL fetch + deterministic signals + manual review')
  from audited a
  on conflict (program_id, run_label) do nothing
  returning program_id
)
update public.programs p
set
  data_quality_status = a.classification,
  data_quality_reason = case
    when a.classification = 'VALID_PROGRAM' then 'Official detail URL and page evidence identify a specific academic award/program.'
    when a.classification = 'AMBIGUOUS_NEEDS_REVIEW' then 'Insufficient positive evidence for automatic activation; quarantined for manual review.'
    else 'Confirmed non-program page; quarantined with provenance retained.'
  end,
  data_quality_signals = jsonb_build_object('run', 'PATCH_3_20260813', 'classification', a.classification),
  reviewed_at = now(),
  active = (a.classification in ('VALID_PROGRAM', 'LIKELY_VALID_PROGRAM')),
  field_of_study_id = case when a.classification in ('VALID_PROGRAM', 'LIKELY_VALID_PROGRAM') then p.field_of_study_id else null end
from audited a
where p.id = a.id;

-- Correct degree levels only after a row has passed program-page validation.
update public.programs
set degree_level = 'POSTGRADUATE_TAUGHT'
where active and id in (
  '9b64dc54-9164-4702-a23e-e685eddb621d',
  '6d08172d-9020-45bd-907e-deb33e185069',
  '0b0e0282-d3ba-42e1-a283-a4542914fa59',
  '999bd065-0f5d-4c0b-bc54-9d47bdc47e22',
  '97cff0be-8387-4239-a39a-2ef1cd3963b6',
  'a0d3b4d9-8a96-4998-af8f-6f40a92cc39a',
  '4621d6c0-13b2-469e-b59f-fa6c4e1d22f1',
  '484853f7-03da-483d-953b-d33cf3dc9e5e',
  '4231023b-ac08-4667-a9db-8da0ae1d73e0',
  '90ba9fb7-7b33-4ed6-9abb-8433fab45cd2',
  '296bdc26-266e-4b9b-b8a4-c35ce1c2eef2',
  '96c9cd2e-7c04-494b-aa2f-1607c417424e',
  '969e35e1-be2d-4cf2-8382-890ea76bc16e',
  '903d05f7-ef9f-4e69-88e5-a800672bbd50',
  '1d42e3bd-e656-4611-b707-c37d0d685772',
  '893cc831-8cec-4724-ba12-49081dfeea29',
  '2540d705-003a-4080-9862-8a6f62037e64'
);

update public.programs
set degree_level = 'UNDERGRADUATE'
where active and id in (
  '3b6537df-5742-4e6e-bdc4-f2ded1a3f29f',
  'c7b54911-b77a-4c0d-a80e-52e26776c181',
  '759d9a01-c4a9-4745-a2c1-8949892308a6',
  '827e4244-7926-49a6-9a0a-be9c836921e8'
);

update public.programs
set degree_level = 'POSTGRADUATE_TAUGHT', degree_title = 'MSc'
where active and official_program_url like '%unibocconi.it/%/corsi-di-studio/lauree-magistrali/%';

-- Quarantined pages must not retain apparently production-ready admission data.
update public.admission_requirements ar
set data_confidence = 'NEEDS_REVIEW', updated_at = now()
from public.programs p
where p.id = ar.program_id and not p.active;

update public.admission_sources s
set active = false, updated_at = now()
from public.programs p
where p.source_id = s.id and not p.active;

-- Recover provenance for any retained row whose historical importer dropped
-- source_id even though an exact official URL source already exists.
update public.programs p
set source_id = s.id, updated_at = now()
from public.admission_sources s
where p.active
  and p.source_id is null
  and s.url = p.official_program_url
  and s.is_official = true;

update public.admission_sources s
set active = true, updated_at = now()
from public.programs p
where p.active and p.source_id = s.id;

-- Canonical identities prevent repeated ingestion from creating another row.
create unique index if not exists uq_programs_university_official_url
  on public.programs(university_id, official_program_url)
  where official_program_url is not null;

create unique index if not exists uq_program_external_source_identity
  on public.program_external_identifiers(source_type, external_id);

create or replace function public.program_quality_duplicate_url_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from (
    select university_id, official_program_url
    from public.programs
    where official_program_url is not null
    group by university_id, official_program_url
    having count(*) > 1
  ) duplicates;
$$;

grant execute on function public.program_quality_duplicate_url_count() to anon, authenticated, service_role;

insert into public.ingestion_runs (
  run_type, source, started_at, finished_at, status,
  records_discovered, records_inserted, records_updated, records_skipped, records_failed,
  error_summary
)
select
  'PROGRAM_QUALITY_CLEANUP',
  'PATCH_3_DETERMINISTIC_AUDIT',
  now(), now(), 'COMPLETED',
  count(*), 0, count(*), count(*) filter (where not active), 0,
  jsonb_build_object(
    'valid', count(*) filter (where data_quality_status = 'VALID_PROGRAM'),
    'quarantined', count(*) filter (where not active),
    'deleted', 0
  )
from public.programs
where not exists (
  select 1 from public.ingestion_runs
  where run_type = 'PROGRAM_QUALITY_CLEANUP' and source = 'PATCH_3_DETERMINISTIC_AUDIT'
);

alter table public.program_quality_audits enable row level security;
drop policy if exists "Public program quality audit policy" on public.program_quality_audits;
create policy "Public program quality audit policy" on public.program_quality_audits for select using (true);
grant select on public.program_quality_audits to anon, authenticated;
grant select, insert, update, delete on public.program_quality_audits to service_role;
