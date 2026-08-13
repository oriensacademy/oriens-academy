-- Request-time, database-backed autocomplete retrieval.
-- Keeps candidate selection and fuzzy matching inside PostgreSQL so the
-- application never loads the full entity tables into Node memory.

create extension if not exists fuzzystrmatch;

create index if not exists idx_gist_universities_normalized_name
  on public.universities using gist (normalized_name gist_trgm_ops);
create index if not exists idx_gist_programs_normalized_name
  on public.programs using gist (normalized_name gist_trgm_ops);
create index if not exists idx_gist_search_aliases_normalized_alias
  on public.search_aliases using gist (normalized_alias gist_trgm_ops);

-- Link seed aliases that have an unambiguous canonical database entity.
update public.search_aliases as alias
set entity_id = country.id
from public.countries as country
where alias.entity_type = 'COUNTRY'
  and alias.entity_id is null
  and (
    alias.normalized_alias = lower(country.iso2)
    or alias.normalized_alias = lower(country.iso3)
    or alias.normalized_alias = any (
      select lower(value) from unnest(country.aliases) as value
    )
  );

update public.search_aliases as alias
set entity_id = qualification.id
from public.qualifications as qualification
where alias.entity_type = 'QUALIFICATION'
  and alias.entity_id is null
  and alias.normalized_alias in (
    lower(qualification.code),
    lower(qualification.name),
    lower(qualification.short_name),
    lower(qualification.code || 's'),
    lower(qualification.code || ' diploma')
  );

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
    or (length(input.query) >= 3 and public.similarity(candidate.term, input.query) >= 0.45)
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
    concat_ws(', ', nullif(university.city, ''), country.name) as subtitle,
    university.slug,
    university_score.match_layer,
    university_score.layer_score + least(coalesce(university.popularity_score, 0), 100) * 0.1 as score,
    country.iso2 as country_iso2,
    country.name as country_name,
    null::text as badge,
    coalesce(university.website, university.admissions_url) as official_url
  from university_scores as university_score
  join public.universities as university on university.id = university_score.id and university.active
  join public.countries as country on country.id = university.country_id and country.active
),
program_term_candidates as (
  select canonical.id, canonical.term, 1 as source_layer, 0 as alias_priority
  from (
    select program.id, program.normalized_name as term
    from public.programs as program, input
    where program.active
    order by program.normalized_name operator(public.<->) input.query
    limit 50
  ) as canonical
  union all
  select alias.entity_id, alias.normalized_alias, 2, alias.priority
  from (
    select search_alias.entity_id, search_alias.normalized_alias, search_alias.priority
    from public.search_aliases as search_alias, input
    where search_alias.entity_type = 'PROGRAM'
      and search_alias.entity_id is not null
    order by search_alias.normalized_alias operator(public.<->) input.query
    limit 50
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
    or (length(input.query) >= 3 and public.similarity(candidate.term, input.query) >= 0.45)
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
    program.application_url as official_url
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
    qualification.code as badge,
    qualification.official_url as official_url
  from qualification_scores as qualification_score
  join public.qualifications as qualification on qualification.id = qualification_score.id and qualification.active
),
country_terms as (
  select country.id, term.value as term, 1 as source_layer, 0 as alias_priority
  from public.countries as country
  cross join lateral unnest(array[lower(country.name), lower(country.iso2), lower(country.iso3)]) as term(value)
  where country.active
  union all
  select country.id, lower(alias_value), 2, 0
  from public.countries as country
  cross join lateral unnest(country.aliases) as alias_value
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
    or (length(input.query) >= 3 and public.similarity(candidate.term, input.query) >= 0.5)
  group by candidate.id
),
country_results as (
  select
    country.id as entity_id,
    'COUNTRY'::text as entity_type,
    country.name as title,
    coalesce(country.region, 'Global') as subtitle,
    country.slug,
    country_score.match_layer,
    country_score.layer_score as score,
    country.iso2 as country_iso2,
    country.name as country_name,
    country.iso2 as badge,
    null::text as official_url
  from country_scores as country_score
  join public.countries as country on country.id = country_score.id and country.active
),
combined as (
  select * from university_results
  union all select * from program_results
  union all select * from qualification_results
  union all select * from country_results
),
ranked as (
  select
    combined.*,
    row_number() over (partition by combined.entity_type order by combined.match_layer, combined.score desc, combined.title) as type_rank
  from combined
)
select
  ranked.entity_id,
  ranked.entity_type,
  ranked.title,
  ranked.subtitle,
  ranked.slug,
  ranked.match_layer,
  ranked.score,
  ranked.country_iso2,
  ranked.country_name,
  ranked.badge,
  ranked.official_url
from ranked
cross join input
where ranked.type_rank <= input.result_limit
order by ranked.match_layer, ranked.score desc, ranked.title;
$$;

revoke all on function public.search_autocomplete_entities(text, integer) from public;
grant execute on function public.search_autocomplete_entities(text, integer) to anon, authenticated, service_role;
