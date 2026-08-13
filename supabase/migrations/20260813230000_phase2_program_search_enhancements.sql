-- Phase 2 Prompt 3: Program Search RPC Enhancements
-- Ensures official_url on program search results falls back to official_program_url

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
    lower(regexp_replace(trim(coalesce(p_query, '')), '\s+', ' ', 'g')) as query,
    greatest(1, least(coalesce(p_limit, 5), 10)) as result_limit
),
university_term_candidates as (
  select canonical.id, canonical.normalized_name as term, 1 as source_layer, 0 as alias_priority
  from (
    select university.id, university.normalized_name
    from public.universities as university, input
    where university.active
    order by university.normalized_name operator(public.<->) input.query
    limit 60
  ) as canonical
  union all
  select alias.entity_id, alias.normalized_alias, 2, alias.priority
  from (
    select search_alias.entity_id, search_alias.normalized_alias, search_alias.priority
    from public.search_aliases as search_alias, input
    where search_alias.entity_type = 'UNIVERSITY'
      and search_alias.entity_id is not null
    order by search_alias.normalized_alias operator(public.<->) input.query
    limit 60
  ) as alias
),
university_scores as (
  select
    candidate.id,
    case
      when bool_or(candidate.source_layer = 1 and candidate.term = input.query) then 1
      when bool_or(candidate.source_layer = 2 and candidate.term = input.query) then 2
      when bool_or(candidate.term like input.query || '%') then 3
      else 4
    end as match_layer,
    max(
      case
        when candidate.source_layer = 1 and candidate.term = input.query then 1200
        when candidate.source_layer = 2 and candidate.term = input.query then 950 + candidate.alias_priority
        when candidate.term like input.query || '%' then 650
        else 300 + greatest(public.similarity(candidate.term, input.query), 0.01) * 200
      end
    ) as layer_score
  from university_term_candidates as candidate
  cross join input
  where candidate.term = input.query
    or candidate.term like input.query || '%'
    or (length(input.query) >= 2 and public.similarity(candidate.term, input.query) >= 0.38)
    or (
      length(input.query) >= 5
      and abs(length(candidate.term) - length(input.query)) <= 2
      and public.levenshtein_less_equal(candidate.term, input.query, 2) <= 2
    )
  group by candidate.id
),
university_results as (
  select
    university.id as entity_id,
    'UNIVERSITY'::text as entity_type,
    university.name as title,
    coalesce(university.city, '') || case when university.city is not null and country.name is not null then ', ' else '' end || coalesce(country.name, '') as subtitle,
    university.slug,
    univ_score.match_layer,
    univ_score.layer_score as score,
    country.iso2 as country_iso2,
    country.name as country_name,
    university.institution_type as badge,
    coalesce(university.admissions_url, university.website) as official_url
  from university_scores as univ_score
  join public.universities as university on university.id = univ_score.id and university.active
  left join public.countries as country on country.id = university.country_id and country.active
),
program_term_candidates as (
  select canonical.id, canonical.normalized_name as term, 1 as source_layer, 0 as alias_priority
  from (
    select program.id, program.normalized_name
    from public.programs as program, input
    where program.active
    order by program.normalized_name operator(public.<->) input.query
    limit 60
  ) as canonical
  union all
  select alias.entity_id, alias.normalized_alias, 2, alias.priority
  from (
    select search_alias.entity_id, search_alias.normalized_alias, search_alias.priority
    from public.search_aliases as search_alias, input
    where search_alias.entity_type = 'PROGRAM'
      and search_alias.entity_id is not null
    order by search_alias.normalized_alias operator(public.<->) input.query
    limit 60
  ) as alias
),
program_scores as (
  select
    candidate.id,
    case
      when bool_or(candidate.source_layer = 1 and candidate.term = input.query) then 1
      when bool_or(candidate.source_layer = 2 and candidate.term = input.query) then 2
      when bool_or(candidate.term like input.query || '%') then 3
      else 4
    end as match_layer,
    max(
      case
        when candidate.source_layer = 1 and candidate.term = input.query then 1200
        when candidate.source_layer = 2 and candidate.term = input.query then 950 + candidate.alias_priority
        when candidate.term like input.query || '%' then 650
        else 300 + greatest(public.similarity(candidate.term, input.query), 0.01) * 200
      end
    ) as layer_score
  from program_term_candidates as candidate
  cross join input
  where candidate.term = input.query
    or candidate.term like input.query || '%'
    or candidate.term like '%' || input.query || '%'
    or (length(input.query) >= 3 and public.similarity(candidate.term, input.query) >= 0.35)
    or (
      length(input.query) >= 5
      and abs(length(candidate.term) - length(input.query)) <= 2
      and public.levenshtein_less_equal(candidate.term, input.query, 2) <= 2
    )
  group by candidate.id
),
program_results as (
  select
    program.id as entity_id,
    'PROGRAM'::text as entity_type,
    program.name as title,
    university.name || ' • ' || replace(program.degree_level, '_', ' ') as subtitle,
    program.slug,
    program_score.match_layer,
    program_score.layer_score as score,
    country.iso2 as country_iso2,
    country.name as country_name,
    program.degree_level as badge,
    coalesce(program.official_program_url, program.application_url) as official_url
  from program_scores as program_score
  join public.programs as program on program.id = program_score.id and program.active
  join public.universities as university on university.id = program.university_id and university.active
  join public.countries as country on country.id = university.country_id and country.active
),
qualification_terms as (
  select
    qualification.id,
    term.value as term,
    1 as source_layer,
    0 as alias_priority
  from public.qualifications as qualification
  cross join lateral unnest(array[
    lower(qualification.code),
    lower(qualification.name),
    lower(qualification.short_name)
  ]) as term(value)
  where qualification.active
  union all
  select alias.entity_id, alias.normalized_alias, 2, alias.priority
  from public.search_aliases as alias
  where alias.entity_type = 'QUALIFICATION' and alias.entity_id is not null
),
qualification_scores as (
  select
    candidate.id,
    case
      when bool_or(candidate.source_layer = 1 and candidate.term = input.query) then 1
      when bool_or(candidate.source_layer = 2 and candidate.term = input.query) then 2
      when bool_or(candidate.term like input.query || '%') then 3
      else 4
    end as match_layer,
    max(
      case
        when candidate.source_layer = 1 and candidate.term = input.query then 1200
        when candidate.source_layer = 2 and candidate.term = input.query then 950 + candidate.alias_priority
        when candidate.term like input.query || '%' then 650
        else 300 + greatest(public.similarity(candidate.term, input.query), 0.01) * 200
      end
    ) as layer_score
  from qualification_terms as candidate
  cross join input
  where candidate.term = input.query
    or candidate.term like input.query || '%'
    or (length(input.query) >= 2 and public.similarity(candidate.term, input.query) >= 0.45)
  group by candidate.id
),
qualification_results as (
  select
    qualification.id as entity_id,
    'QUALIFICATION'::text as entity_type,
    qualification.name || ' (' || qualification.code || ')' as title,
    replace(qualification.category, '_', ' ') || ' • ' || coalesce(qualification.country_scope, 'Global') as subtitle,
    lower(qualification.code) as slug,
    qualification_score.match_layer,
    qualification_score.layer_score as score,
    null::text as country_iso2,
    null::text as country_name,
    qualification.category as badge,
    qualification.official_url as official_url
  from qualification_scores as qualification_score
  join public.qualifications as qualification on qualification.id = qualification_score.id and qualification.active
),
country_terms as (
  select
    country.id,
    term.value as term,
    1 as source_layer,
    0 as alias_priority
  from public.countries as country
  cross join lateral unnest(array[
    lower(country.iso2),
    lower(country.iso3),
    lower(country.name)
  ]) as term(value)
  where country.active
  union all
  select alias.entity_id, alias.normalized_alias, 2, alias.priority
  from public.search_aliases as alias
  where alias.entity_type = 'COUNTRY' and alias.entity_id is not null
),
country_scores as (
  select
    candidate.id,
    case
      when bool_or(candidate.source_layer = 1 and candidate.term = input.query) then 1
      when bool_or(candidate.source_layer = 2 and candidate.term = input.query) then 2
      when bool_or(candidate.term like input.query || '%') then 3
      else 4
    end as match_layer,
    max(
      case
        when candidate.source_layer = 1 and candidate.term = input.query then 1200
        when candidate.source_layer = 2 and candidate.term = input.query then 950 + candidate.alias_priority
        when candidate.term like input.query || '%' then 650
        else 300 + greatest(public.similarity(candidate.term, input.query), 0.01) * 200
      end
    ) as layer_score
  from country_terms as candidate
  cross join input
  where candidate.term = input.query
    or candidate.term like input.query || '%'
    or (length(input.query) >= 2 and public.similarity(candidate.term, input.query) >= 0.45)
  group by candidate.id
),
country_results as (
  select
    country.id as entity_id,
    'COUNTRY'::text as entity_type,
    country.name as title,
    country.region as subtitle,
    lower(country.iso2) as slug,
    country_score.match_layer,
    country_score.layer_score as score,
    country.iso2 as country_iso2,
    country.name as country_name,
    country.iso3 as badge,
    null::text as official_url
  from country_scores as country_score
  join public.countries as country on country.id = country_score.id and country.active
),
combined as (
  select * from university_results
  union all
  select * from program_results
  union all
  select * from qualification_results
  union all
  select * from country_results
),
ranked as (
  select
    c.*,
    row_number() over (
      partition by c.entity_type
      order by c.match_layer asc, c.score desc, c.title asc
    ) as rank_in_type
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
from ranked r, input
where r.rank_in_type <= input.result_limit
order by r.match_layer asc, r.score desc, r.title asc;
$$;
