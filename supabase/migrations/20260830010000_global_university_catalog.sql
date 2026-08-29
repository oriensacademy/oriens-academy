-- Global university catalog, indexed worldwide search, transparent featured ranks,
-- and official-source admission requirements. Additive only: no customer tables touched.

create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_university_search_text(value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(lower(extensions.unaccent(value)), '[^a-z0-9]+', ' ', 'g'));
$$;

alter table public.universities
  add column if not exists openalex_id text,
  add column if not exists wikidata_id text,
  add column if not exists native_name text,
  add column if not exists aliases text[] not null default '{}',
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists verified_url boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists search_priority integer not null default 0,
  add column if not exists featured_country_rank integer,
  add column if not exists featured_score numeric,
  add column if not exists country_display_rank_override integer,
  add column if not exists featured_override_verified boolean not null default false,
  add column if not exists research_works_count bigint,
  add column if not exists research_cited_by_count bigint,
  add column if not exists source_last_seen_at timestamptz,
  add column if not exists source_review_required boolean not null default false,
  add column if not exists search_document tsvector generated always as
    (to_tsvector('simple', coalesce(normalized_name, ''))) stored;

create unique index if not exists idx_universities_ror_id_unique
  on public.universities (ror_id) where ror_id is not null;
create unique index if not exists idx_universities_openalex_id_unique
  on public.universities (openalex_id) where openalex_id is not null;
create index if not exists idx_universities_normalized_prefix
  on public.universities (normalized_name text_pattern_ops) where active;
create index if not exists idx_universities_normalized_trgm
  on public.universities using gin (normalized_name public.gin_trgm_ops) where active;
create index if not exists idx_universities_search_document
  on public.universities using gin (search_document) where active;
create index if not exists idx_universities_country_featured
  on public.universities (country_id, featured_country_rank) where active;
create index if not exists idx_search_aliases_university_prefix
  on public.search_aliases (normalized_alias text_pattern_ops)
  where entity_type = 'UNIVERSITY' and entity_id is not null;
create index if not exists idx_search_aliases_university_trgm
  on public.search_aliases using gin (normalized_alias public.gin_trgm_ops)
  where entity_type = 'UNIVERSITY' and entity_id is not null;

alter table public.universities drop constraint if exists universities_featured_country_rank_check;
alter table public.universities add constraint universities_featured_country_rank_check
  check (featured_country_rank is null or featured_country_rank > 0);
alter table public.universities drop constraint if exists universities_country_display_rank_override_check;
alter table public.universities add constraint universities_country_display_rank_override_check
  check (country_display_rank_override is null or country_display_rank_override > 0);

create table if not exists public.university_catalog_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_version text not null,
  source_date date,
  license text not null,
  retrieved_at timestamptz not null,
  raw_record_count integer not null,
  eligible_record_count integer not null,
  imported_record_count integer not null,
  rejected_record_count integer not null,
  duplicate_merge_count integer not null default 0,
  openalex_match_count integer not null default 0,
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source, source_version)
);

alter table public.university_catalog_import_runs enable row level security;
drop policy if exists "Public catalog import manifests" on public.university_catalog_import_runs;
create policy "Public catalog import manifests" on public.university_catalog_import_runs
  for select using (true);
grant select on public.university_catalog_import_runs to anon, authenticated;
grant select, insert, update on public.university_catalog_import_runs to service_role;
revoke insert, update, delete on public.university_catalog_import_runs from anon, authenticated;

create table if not exists public.university_admission_requirements (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  exam_code text not null,
  status text not null check (status in ('required', 'accepted', 'recommended', 'alternative', 'not_required', 'unknown')),
  scope text not null check (scope in ('university', 'faculty', 'programme')),
  programme_name text,
  academic_year text,
  admissions_cycle text,
  summary_tr text not null,
  summary_en text not null,
  official_source_url text not null check (official_source_url ~ '^https://'),
  source_title text not null,
  verified_at timestamptz not null,
  expires_at timestamptz,
  confidence text not null check (confidence in ('verified', 'needs_review')),
  source_excerpt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_university_requirements_public
  on public.university_admission_requirements (university_id, confidence, expires_at);
create index if not exists idx_university_requirements_review
  on public.university_admission_requirements (confidence, verified_at);
create unique index if not exists idx_university_requirements_identity
  on public.university_admission_requirements (
    university_id, exam_code, scope, coalesce(programme_name, ''), coalesce(admissions_cycle, '')
  );

alter table public.university_admission_requirements enable row level security;
drop policy if exists "Public verified university requirements" on public.university_admission_requirements;
create policy "Public verified university requirements" on public.university_admission_requirements
  for select using (confidence = 'verified');
drop policy if exists "Admin university requirements" on public.university_admission_requirements;
create policy "Admin university requirements" on public.university_admission_requirements
  for all using (public.is_admin()) with check (public.is_admin());
grant select on public.university_admission_requirements to anon, authenticated;
grant select, insert, update, delete on public.university_admission_requirements to service_role;
revoke insert, update, delete on public.university_admission_requirements from anon, authenticated;

drop trigger if exists trg_university_admission_requirements_updated_at on public.university_admission_requirements;
create trigger trg_university_admission_requirements_updated_at
  before update on public.university_admission_requirements
  for each row execute function public.set_updated_at();

-- Preserve the deployed search behavior for qualifications/programs/countries, while
-- replacing only university retrieval with bounded indexed candidate stages.
do $$
begin
  if to_regprocedure('public.search_autocomplete_entities_pre_global(text,integer)') is null then
    alter function public.search_autocomplete_entities(text, integer)
      rename to search_autocomplete_entities_pre_global;
  end if;
end $$;

create or replace function public.search_autocomplete_entities(
  p_query text,
  p_limit integer default 5
)
returns table (
  entity_id uuid,
  entity_type text,
  title text,
  subtitle text,
  slug text,
  match_layer integer,
  score numeric,
  country_iso2 text,
  country_name text,
  badge text,
  official_url text
)
language sql
stable
security invoker
set search_path = ''
as $$
with input as (
  select
    public.normalize_university_search_text(coalesce(p_query, '')) as query,
    greatest(1, least(coalesce(p_limit, 5), 10)) as result_limit
),
canonical_candidates as (
  select * from (
    select u.id, u.normalized_name as term, 1 as source_kind, 0 as alias_priority,
      case
        when u.normalized_name = input.query then 1
        when u.normalized_name like input.query || '%' then 3
        when u.search_document @@ pg_catalog.plainto_tsquery('simple', input.query) then 5
        else 6
      end as layer,
      case
        when u.normalized_name = input.query then 1400
        when u.normalized_name like input.query || '%' then 900
        when u.search_document @@ pg_catalog.plainto_tsquery('simple', input.query) then 620
        else 380 + public.similarity(u.normalized_name, input.query) * 180
      end::numeric as base_score
    from public.universities u cross join input
    where u.active and input.query <> '' and (
      u.normalized_name = input.query
      or u.normalized_name like input.query || '%'
      or u.search_document @@ pg_catalog.plainto_tsquery('simple', input.query)
      or (length(input.query) >= 3 and u.normalized_name OPERATOR(public.%) input.query)
    )
    order by layer, base_score desc
    limit 500
  ) bounded
),
alias_candidates as (
  select * from (
    select sa.entity_id as id, sa.normalized_alias as term, 2 as source_kind,
      sa.priority as alias_priority,
      case
        when sa.normalized_alias = input.query then 2
        when sa.normalized_alias like input.query || '%' then 4
        else 6
      end as layer,
      case
        when sa.normalized_alias = input.query then 1250 + sa.priority
        when sa.normalized_alias like input.query || '%' then 800 + sa.priority
        else 370 + sa.priority * 0.5 + public.similarity(sa.normalized_alias, input.query) * 180
      end::numeric as base_score
    from public.search_aliases sa cross join input
    where sa.entity_type = 'UNIVERSITY' and sa.entity_id is not null and input.query <> '' and (
      sa.normalized_alias = input.query
      or sa.normalized_alias like input.query || '%'
      or (length(input.query) >= 3 and sa.normalized_alias OPERATOR(public.%) input.query)
    )
    order by layer, base_score desc
    limit 500
  ) bounded
),
all_university_candidates as (
  select * from canonical_candidates
  union all
  select * from alias_candidates
),
university_scores as (
  select id, min(layer) as match_layer, max(base_score) as layer_score
  from all_university_candidates
  group by id
),
university_results as (
  select u.id as entity_id, 'UNIVERSITY'::text as entity_type, u.name as title,
    concat_ws(' · ', nullif(u.city, ''), c.name) as subtitle,
    u.slug, s.match_layer,
    (s.layer_score + least(coalesce(u.search_priority, 0), 200) +
      least(coalesce(u.popularity_score, 0), 100) * 0.2)::numeric as score,
    c.iso2 as country_iso2, c.name as country_name,
    case when u.featured_country_rank <= 3 then 'Featured' else null end as badge,
    case when u.verified_url then coalesce(u.website, u.admissions_url) else null end as official_url
  from university_scores s
  join public.universities u on u.id = s.id and u.active
  join public.countries c on c.id = u.country_id and c.active
),
legacy_results as (
  select legacy.*
  from public.search_autocomplete_entities_pre_global(p_query, p_limit) legacy
  where legacy.entity_type <> 'UNIVERSITY'
),
combined as (
  select * from university_results
  union all
  select * from legacy_results
),
ranked as (
  select combined.*, row_number() over (
    partition by entity_type order by match_layer, score desc, title
  ) as rank_in_type
  from combined
)
select r.entity_id, r.entity_type, r.title, r.subtitle, r.slug, r.match_layer,
  r.score, r.country_iso2, r.country_name, r.badge, r.official_url
from ranked r cross join input
where r.rank_in_type <= input.result_limit
order by r.match_layer, r.score desc, r.title;
$$;

grant execute on function public.search_autocomplete_entities(text, integer)
  to anon, authenticated, service_role;

create or replace function public.refresh_university_featured_ranks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  -- Existing verified Oriens curation remains authoritative where a global row matches.
  if to_regclass('public.featured_universities') is not null then
    update public.universities u
    set country_display_rank_override = f.display_order,
        featured_override_verified = true,
        website = coalesce(u.website, f.official_url),
        admissions_url = coalesce(u.admissions_url, f.admissions_url),
        verified_url = u.verified_url or f.official_url is not null,
        verified_at = greatest(u.verified_at, f.verified_at),
        updated_at = now()
    from public.featured_universities f
    join public.countries c on c.iso3 = f.country_code
    where u.country_id = c.id
      and u.normalized_name = public.normalize_university_search_text(f.name);
  end if;

  with metrics as (
    select u.id, u.country_id,
      ln(1 + coalesce(u.research_works_count, 0)) as works_log,
      ln(1 + coalesce(u.research_cited_by_count, 0)) as cites_log,
      case when u.ror_id is not null then 0.4 else 0 end +
      case when u.openalex_id is not null then 0.3 else 0 end +
      case when u.verified_url then 0.3 else 0 end as quality
    from public.universities u where u.active
  ), normalized as (
    select m.*,
      case when max(works_log) over (partition by country_id) = min(works_log) over (partition by country_id)
        then 0.5 else (works_log - min(works_log) over (partition by country_id)) /
          nullif(max(works_log) over (partition by country_id) - min(works_log) over (partition by country_id), 0) end as works_norm,
      case when max(cites_log) over (partition by country_id) = min(cites_log) over (partition by country_id)
        then 0.5 else (cites_log - min(cites_log) over (partition by country_id)) /
          nullif(max(cites_log) over (partition by country_id) - min(cites_log) over (partition by country_id), 0) end as cites_norm
    from metrics m
  ), scored as (
    select n.id, n.country_id,
      (0.45 * n.works_norm + 0.45 * n.cites_norm + 0.10 * n.quality)::numeric as score
    from normalized n
  ), ranked as (
    select s.id, s.score,
      row_number() over (partition by s.country_id order by
        case when u.featured_override_verified and u.country_display_rank_override is not null then 0 else 1 end,
        case when u.featured_override_verified then u.country_display_rank_override end nulls last,
        s.score desc, u.name, u.id)::integer as country_rank
    from scored s join public.universities u on u.id = s.id
  )
  update public.universities u
  set featured_score = r.score, featured_country_rank = r.country_rank, updated_at = now()
  from ranked r where r.id = u.id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.refresh_university_featured_ranks() from public, anon, authenticated;
grant execute on function public.refresh_university_featured_ranks() to service_role;

create or replace function public.get_featured_universities_by_country(p_iso3 text)
returns table (
  id uuid,
  name text,
  city text,
  country_name text,
  country_iso2 text,
  country_iso3 text,
  latitude double precision,
  longitude double precision,
  official_url text,
  admissions_url text,
  verified_at timestamptz,
  featured_rank integer,
  requirements jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.id, u.name, u.city, c.name, c.iso2, c.iso3, u.latitude, u.longitude,
    case when u.verified_url then u.website else null end,
    u.admissions_url, u.verified_at, u.featured_country_rank,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'exam', r.exam_code,
        'status', r.status,
        'scope', r.scope,
        'programme_name', r.programme_name,
        'summary_tr', r.summary_tr,
        'summary_en', r.summary_en,
        'official_source_url', r.official_source_url,
        'verified_at', r.verified_at,
        'admissions_cycle', r.admissions_cycle
      ) order by r.exam_code, r.programme_name)
      from public.university_admission_requirements r
      where r.university_id = u.id and r.confidence = 'verified'
        and (r.expires_at is null or r.expires_at >= now())
    ), '[]'::jsonb) as requirements
  from public.universities u
  join public.countries c on c.id = u.country_id
  where u.active and c.active and c.iso3 = upper(trim(p_iso3))
    and u.featured_country_rank <= 3
  order by u.featured_country_rank
  limit 3;
$$;

grant execute on function public.get_featured_universities_by_country(text)
  to anon, authenticated, service_role;

-- Public catalog access remains SELECT-only. Browser writes are explicitly denied.
revoke insert, update, delete on public.universities from anon, authenticated;
revoke insert, update, delete on public.search_aliases from anon, authenticated;

comment on column public.universities.featured_score is
  'Oriens open-metadata heuristic: 45% country-normalized log works, 45% country-normalized log citations, 10% data quality. Not an external ranking.';
comment on column public.universities.country_display_rank_override is
  'Verified Oriens manual featured ordering; takes priority over the open-metadata heuristic.';
