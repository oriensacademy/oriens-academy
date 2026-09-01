-- University search v2 production hardening and bounded execution.
-- Forward-only: RLS remains enabled and public eligibility is enforced again
-- inside every SECURITY DEFINER function.

-- The existing prefix index is used in production, but requires heap reads for
-- the candidate payload. This covering variant supports exact/prefix staging.
create index if not exists idx_university_search_terms_prefix_cover_v2
  on public.university_search_terms
    (normalized_term text_pattern_ops, term_type, trust_score desc)
  include (university_id, country_scope);

-- The reviewed LSE acronym already exists in imported data. Correct only the
-- canonical London institution's false-negative eligibility classification;
-- the Lahore alias/history is deliberately left untouched and remains hidden.
update public.universities
set eligibility_status = 'eligible',
    manual_eligibility_override = 'eligible',
    university_confidence = greatest(coalesce(university_confidence, 0), 0.98),
    degree_granting = true,
    institution_class = 'university',
    eligibility_evidence = coalesce(eligibility_evidence, '{}'::jsonb) || jsonb_build_object(
      'manual_review', 'London School of Economics and Political Science',
      'review_reason', 'Reviewed high-value public university identity'
    ),
    eligibility_model_version = 'oriens-university-manual-review-2026-09-01',
    reviewed_at = now(),
    reviewed_by = 'migration:20260901140000'
where ror_id in ('0090zs177', 'https://ror.org/0090zs177')
  and normalized_name = 'london school of economics and political science';

insert into public.search_aliases (
  entity_type, entity_id, alias, normalized_alias, language, priority, source,
  alias_type, trust_score, country_scope, normalization_version, reviewed_at,
  reviewed_by, manual_override
)
select
  'UNIVERSITY', u.id, 'LSE', 'lse', 'en', 150,
  'Oriens reviewed university identity set 2026-09-01', 'acronym', 1.00, 'GB',
  'oriens-university-normalization-v2', now(),
  'migration:20260901140000', true
from public.universities u
where u.ror_id in ('0090zs177', 'https://ror.org/0090zs177')
  and u.normalized_name = 'london school of economics and political science'
on conflict (entity_type, entity_id, normalized_alias) do update set
  alias = excluded.alias,
  language = excluded.language,
  priority = greatest(public.search_aliases.priority, excluded.priority),
  source = excluded.source,
  alias_type = excluded.alias_type,
  trust_score = excluded.trust_score,
  country_scope = excluded.country_scope,
  normalization_version = excluded.normalization_version,
  reviewed_at = excluded.reviewed_at,
  reviewed_by = excluded.reviewed_by,
  manual_override = true,
  updated_at = now();

create or replace function public.search_university_strong_candidates_v2(
  p_query text,
  p_limit integer default 10,
  p_country_iso2 text default null
)
returns table(
  entity_id uuid,
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
security definer
set search_path = public, extensions
as $$
with input as (
  select
    public.normalize_university_search_text(coalesce(p_query, '')) as q,
    greatest(1, least(coalesce(p_limit, 10), 10)) as lim,
    nullif(upper(trim(coalesce(p_country_iso2, ''))), '') as country_filter
), term_hits as materialized (
  select t.*
  from input i
  join public.university_search_terms t
    on i.q <> '' and t.normalized_term = i.q
  union all
  select t.*
  from input i
  join public.university_search_terms t
    on length(i.q) >= 3
    and t.normalized_term like i.q || '%'
    and t.normalized_term <> i.q
), matches as materialized (
  select
    t.university_id,
    min(case
      when t.term_type = 'canonical' and t.normalized_term = i.q then 1
      when t.term_type = 'alias' and t.normalized_term = i.q then 2
      when t.term_type = 'canonical' and t.normalized_term like i.q || '%' then 3
      when t.term_type = 'alias' and t.normalized_term like i.q || '%' then 4
      when t.term_type = 'canonical_token' and t.normalized_term = i.q then 5
      else 6
    end) as layer,
    max(case
      when t.term_type = 'canonical' and t.normalized_term = i.q then 1000
      when t.term_type = 'alias' and t.normalized_term = i.q then
        case when t.trust_score >= 0.95 then 1450 else 1000 + 200 * t.trust_score end
      when t.term_type = 'canonical' and t.normalized_term like i.q || '%' then 835
      when t.term_type = 'alias' and t.normalized_term like i.q || '%' then 790 + 80 * t.trust_score
      when t.term_type = 'canonical_token' and t.normalized_term = i.q then 720 + 80 * t.trust_score
      else 0
    end)::numeric as match_score
  from input i
  join term_hits t on true
  group by t.university_id
), ranked as (
  select
    u.id as entity_id,
    u.name as title,
    concat_ws(' · ', nullif(u.city, ''), c.name) as subtitle,
    u.slug,
    case
      when m.layer = 5 and u.normalized_name in ('university of ' || i.q, i.q || ' university', 'the university of ' || i.q) then 3
      else m.layer
    end as match_layer,
    (
      m.match_score
      + coalesce(u.university_confidence, 0) * 450
      + case when u.degree_granting then 85 else 0 end
      + least(greatest(coalesce(u.manual_search_priority, 0), -100), 150)
      + least(coalesce(u.search_priority, 0), 200) * 0.80
      + case when m.layer = 5 and u.normalized_name in ('university of ' || i.q, i.q || ' university', 'the university of ' || i.q) then 190 else 0 end
      + case when i.country_filter is not null and c.iso2 = i.country_filter then 140 when i.country_filter is not null then -80 else 0 end
      + case when u.institution_class in ('research_only', 'non_higher_education') then -600 else 0 end
    )::numeric as score,
    c.iso2 as country_iso2,
    c.name as country_name,
    case when cf.manual_rank is not null then 'Featured' end as badge,
    case when u.url_verification_status in ('verified', 'redirect_verified') then u.verified_official_url end as official_url
  from matches m
  cross join input i
  join public.universities u on u.id = m.university_id
    and u.active
    and u.eligibility_status = 'eligible'
    and (u.manual_eligibility_override = 'eligible' or coalesce(u.university_confidence, 0) >= 0.65)
  join public.countries c on c.id = u.country_id and c.active
    and (i.country_filter is null or c.iso2 = i.country_filter)
  left join public.country_featured_universities cf on cf.university_id = u.id and cf.active
)
select
  r.entity_id, r.title, r.subtitle, r.slug, r.match_layer, r.score,
  r.country_iso2, r.country_name, r.badge, r.official_url
from ranked r
cross join input i
order by r.score desc, r.match_layer, r.title
limit (select lim from input);
$$;

create or replace function public.search_university_fuzzy_candidates_v2(
  p_query text,
  p_limit integer default 10,
  p_country_iso2 text default null
)
returns table(
  entity_id uuid,
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
security definer
set search_path = public, extensions
set pg_trgm.similarity_threshold = '0.45'
as $$
with input as (
  select
    public.normalize_university_search_text(coalesce(p_query, '')) as q,
    greatest(1, least(coalesce(p_limit, 10), 10)) as lim,
    nullif(upper(trim(coalesce(p_country_iso2, ''))), '') as country_filter
), raw_term_hits as materialized (
  select
    t.university_id,
    public.similarity(t.normalized_term, i.q) as similarity_score
  from input i
  join public.university_search_terms t
    on length(i.q) >= 4
    and t.normalized_term operator(public.%) i.q
    and length(t.normalized_term) between greatest(3, length(i.q) - 3) and length(i.q) + 8
  order by public.similarity(t.normalized_term, i.q) desc, t.trust_score desc
  limit (select greatest(24, least(80, lim * 8)) from input)
), eligible_term_hits as materialized (
  select h.university_id, h.similarity_score
  from raw_term_hits h
  cross join input i
  join public.universities u on u.id = h.university_id
    and u.active
    and u.eligibility_status = 'eligible'
    and (u.manual_eligibility_override = 'eligible' or coalesce(u.university_confidence, 0) >= 0.65)
  join public.countries c on c.id = u.country_id and c.active
    and (i.country_filter is null or c.iso2 = i.country_filter)
), bounded_universities as (
  select university_id, max(similarity_score) as similarity_score
  from eligible_term_hits
  group by university_id
), ranked as (
  select
    u.id as entity_id,
    u.name as title,
    concat_ws(' · ', nullif(u.city, ''), c.name) as subtitle,
    u.slug,
    6 as match_layer,
    (
      520
      + b.similarity_score * 330
      + coalesce(u.university_confidence, 0) * 450
      + case when u.degree_granting then 85 else 0 end
      + least(greatest(coalesce(u.manual_search_priority, 0), -100), 150)
      + least(coalesce(u.search_priority, 0), 200) * 0.65
      + case when i.country_filter is not null and c.iso2 = i.country_filter then 140 when i.country_filter is not null then -80 else 0 end
      + case when u.institution_class in ('research_only', 'non_higher_education') then -600 else 0 end
    )::numeric as score,
    c.iso2 as country_iso2,
    c.name as country_name,
    case when cf.manual_rank is not null then 'Featured' end as badge,
    case when u.url_verification_status in ('verified', 'redirect_verified') then u.verified_official_url end as official_url
  from bounded_universities b
  cross join input i
  join public.universities u on u.id = b.university_id
    and u.active
    and u.eligibility_status = 'eligible'
    and (u.manual_eligibility_override = 'eligible' or coalesce(u.university_confidence, 0) >= 0.65)
  join public.countries c on c.id = u.country_id and c.active
    and (i.country_filter is null or c.iso2 = i.country_filter)
  left join public.country_featured_universities cf on cf.university_id = u.id and cf.active
)
select
  r.entity_id, r.title, r.subtitle, r.slug, r.match_layer, r.score,
  r.country_iso2, r.country_name, r.badge, r.official_url
from ranked r
cross join input i
order by r.score desc, r.title
limit (select lim from input);
$$;

create or replace function public.search_autocomplete_entities_v2(
  p_query text,
  p_limit integer default 10,
  p_country_iso2 text default null
)
returns table(
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
security definer
set search_path = public, extensions
as $$
with input as (
  select
    public.normalize_university_search_text(coalesce(p_query, '')) as q,
    greatest(1, least(coalesce(p_limit, 10), 10)) as lim,
    nullif(upper(trim(coalesce(p_country_iso2, ''))), '') as country_filter
), exam_candidates as materialized (
  select distinct on (e.id)
    e.id as entity_id,
    'QUALIFICATION'::text as entity_type,
    e.display_name_en as title,
    e.purpose as subtitle,
    e.slug,
    case
      when lower(e.code) = i.q or public.normalize_university_search_text(e.canonical_name) = i.q then 1
      when a.normalized_alias = i.q then 2
      when lower(e.code) like i.q || '%' then 3
      else 4
    end as match_layer,
    (2200 + coalesce(a.priority, 0))::numeric as score,
    null::text as country_iso2,
    null::text as country_name,
    'Supported by Oriens'::text as badge,
    e.official_url
  from input i
  join public.exams e on e.active and e.supported_public and i.q <> ''
  left join public.exam_aliases a on a.exam_id = e.id and a.active
    and (a.normalized_alias = i.q or a.normalized_alias like i.q || '%')
  where lower(e.code) = i.q
    or public.normalize_university_search_text(e.canonical_name) = i.q
    or lower(e.code) like i.q || '%'
    or public.normalize_university_search_text(e.canonical_name) like i.q || '%'
    or a.id is not null
  order by e.id, match_layer, score desc
), strong_candidates as materialized (
  select s.*
  from input i
  cross join lateral public.search_university_strong_candidates_v2(i.q, i.lim, i.country_filter) s
), strong_meta as (
  select count(*)::integer as strong_count from strong_candidates
), fuzzy_candidates as materialized (
  select f.*
  from input i
  cross join strong_meta sm
  cross join lateral public.search_university_fuzzy_candidates_v2(
    i.q,
    least(10, greatest(1, i.lim - sm.strong_count + 4)),
    i.country_filter
  ) f
  where sm.strong_count < i.lim
), university_candidates as (
  select s.* from strong_candidates s
  union all
  select f.* from fuzzy_candidates f
  where not exists (
    select 1 from strong_candidates s where s.entity_id = f.entity_id
  )
), combined as (
  select
    e.entity_id, e.entity_type, e.title, e.subtitle, e.slug, e.match_layer,
    e.score, e.country_iso2, e.country_name, e.badge, e.official_url
  from exam_candidates e
  union all
  select
    u.entity_id, 'UNIVERSITY'::text, u.title, u.subtitle, u.slug, u.match_layer,
    u.score, u.country_iso2, u.country_name, u.badge, u.official_url
  from university_candidates u
), ranked as (
  select
    c.*,
    row_number() over (
      partition by c.entity_type
      order by c.score desc, c.match_layer, c.title
    ) as rn
  from combined c
)
select
  r.entity_id, r.entity_type, r.title, r.subtitle, r.slug, r.match_layer,
  r.score, r.country_iso2, r.country_name, r.badge, r.official_url
from ranked r
cross join input i
where r.rn <= i.lim
order by r.score desc, r.match_layer, r.title;
$$;

alter function public.search_university_strong_candidates_v2(text, integer, text) owner to postgres;
alter function public.search_university_fuzzy_candidates_v2(text, integer, text) owner to postgres;
alter function public.search_autocomplete_entities_v2(text, integer, text) owner to postgres;

revoke all on function public.search_university_strong_candidates_v2(text, integer, text) from public;
revoke all on function public.search_university_fuzzy_candidates_v2(text, integer, text) from public;
revoke all on function public.search_autocomplete_entities_v2(text, integer, text) from public;
grant execute on function public.search_university_strong_candidates_v2(text, integer, text) to anon, authenticated, service_role;
grant execute on function public.search_university_fuzzy_candidates_v2(text, integer, text) to anon, authenticated, service_role;
grant execute on function public.search_autocomplete_entities_v2(text, integer, text) to anon, authenticated, service_role;

comment on function public.search_autocomplete_entities_v2(text, integer, text) is
  'Public eligible academic entity search. Strong candidates materialize once; fuzzy fallback is conditional and bounded.';
