-- Fix column aliases in university search candidates and autocomplete v2 functions

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
security invoker
set search_path = ''
as $$
with input as (
  select
    public.normalize_university_search_text(coalesce(p_query, '')) as q,
    greatest(1, least(coalesce(p_limit, 10), 10)) as lim,
    nullif(upper(trim(coalesce(p_country_iso2, ''))), '') as country_filter
), matches as (
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
  join public.university_search_terms t
    on i.q <> '' and (
      t.normalized_term = i.q
      or (length(i.q) >= 3 and t.normalized_term like i.q || '%')
    )
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
  join public.universities u on u.id = m.university_id and u.active and u.eligibility_status = 'eligible'
    and (u.manual_eligibility_override = 'eligible' or coalesce(u.university_confidence, 0) >= 0.65)
  join public.countries c on c.id = u.country_id and c.active
  left join public.country_featured_universities cf on cf.university_id = u.id and cf.active
)
select
  r.entity_id,
  r.title,
  r.subtitle,
  r.slug,
  r.match_layer,
  r.score,
  r.country_iso2,
  r.country_name,
  r.badge,
  r.official_url
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
security invoker
set search_path = ''
as $$
with input as (
  select
    public.normalize_university_search_text(coalesce(p_query, '')) as q,
    greatest(1, least(coalesce(p_limit, 10), 10)) as lim,
    nullif(upper(trim(coalesce(p_country_iso2, ''))), '') as country_filter
), bounded_terms as (
  select
    t.university_id,
    max(public.similarity(t.normalized_term, i.q)) as similarity_score
  from input i
  join public.university_search_terms t
    on length(i.q) >= 4 and t.normalized_term operator(public.%) i.q
  where length(t.normalized_term) between greatest(3, length(i.q) - 3) and length(i.q) + 8
  group by t.university_id
  order by similarity_score desc
  limit 80
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
    )::numeric as score,
    c.iso2 as country_iso2,
    c.name as country_name,
    case when cf.manual_rank is not null then 'Featured' end as badge,
    case when u.url_verification_status in ('verified', 'redirect_verified') then u.verified_official_url end as official_url
  from bounded_terms b
  cross join input i
  join public.universities u on u.id = b.university_id and u.active and u.eligibility_status = 'eligible'
    and (u.manual_eligibility_override = 'eligible' or coalesce(u.university_confidence, 0) >= 0.65)
  join public.countries c on c.id = u.country_id and c.active
  left join public.country_featured_universities cf on cf.university_id = u.id and cf.active
)
select
  r.entity_id,
  r.title,
  r.subtitle,
  r.slug,
  r.match_layer,
  r.score,
  r.country_iso2,
  r.country_name,
  r.badge,
  r.official_url
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
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  q text := public.normalize_university_search_text(coalesce(p_query, ''));
  lim integer := greatest(1, least(coalesce(p_limit, 10), 10));
  strong_count integer := 0;
begin
  select count(*) into strong_count
  from public.search_university_strong_candidates_v2(q, lim, p_country_iso2);

  return query
  with exam_candidates as (
    select distinct on (e.id)
      e.id as entity_id,
      'QUALIFICATION'::text as entity_type,
      e.display_name_en as title,
      e.purpose as subtitle,
      e.slug,
      case
        when lower(e.code) = q or public.normalize_university_search_text(e.canonical_name) = q then 1
        when a.normalized_alias = q then 2
        when lower(e.code) like q || '%' then 3
        else 4
      end as match_layer,
      (2200 + coalesce(a.priority, 0))::numeric as score,
      null::text as country_iso2,
      null::text as country_name,
      'Supported by Oriens'::text as badge,
      e.official_url
    from public.exams e
    left join public.exam_aliases a on a.exam_id = e.id and a.active
      and (a.normalized_alias = q or a.normalized_alias like q || '%')
    where e.active and e.supported_public and q <> '' and (
      lower(e.code) = q
      or public.normalize_university_search_text(e.canonical_name) = q
      or lower(e.code) like q || '%'
      or public.normalize_university_search_text(e.canonical_name) like q || '%'
      or a.id is not null
    )
    order by e.id, match_layer, score desc
  ), university_candidates as (
    select s.* from public.search_university_strong_candidates_v2(q, lim, p_country_iso2) s
    union all
    select f.* from public.search_university_fuzzy_candidates_v2(q, lim, p_country_iso2) f
    where strong_count < lim and not exists (
      select 1
      from public.search_university_strong_candidates_v2(q, lim, p_country_iso2) s
      where s.entity_id = f.entity_id
    )
  ), combined as (
    select
      e.entity_id,
      e.entity_type,
      e.title,
      e.subtitle,
      e.slug,
      e.match_layer,
      e.score,
      e.country_iso2,
      e.country_name,
      e.badge,
      e.official_url
    from exam_candidates e
    union all
    select
      u.entity_id,
      'UNIVERSITY'::text as entity_type,
      u.title,
      u.subtitle,
      u.slug,
      u.match_layer,
      u.score,
      u.country_iso2,
      u.country_name,
      u.badge,
      u.official_url
    from university_candidates u
  ), ranked as (
    select
      c.entity_id,
      c.entity_type,
      c.title,
      c.subtitle,
      c.slug,
      c.match_layer,
      c.score,
      c.country_iso2,
      c.country_name,
      c.badge,
      c.official_url,
      row_number() over (
        partition by c.entity_type
        order by c.score desc, c.match_layer, c.title
      ) as rn
    from combined c
  )
  select
    r.entity_id,
    r.entity_type,
    r.title,
    r.subtitle,
    r.slug,
    r.match_layer,
    r.score,
    r.country_iso2,
    r.country_name,
    r.badge,
    r.official_url
  from ranked r
  where r.rn <= lim
  order by r.score desc, r.match_layer, r.title;
end;
$$;

grant execute on function public.search_university_strong_candidates_v2(text, integer, text) to anon, authenticated, service_role;
grant execute on function public.search_university_fuzzy_candidates_v2(text, integer, text) to anon, authenticated, service_role;
grant execute on function public.search_autocomplete_entities_v2(text, integer, text) to anon, authenticated, service_role;
