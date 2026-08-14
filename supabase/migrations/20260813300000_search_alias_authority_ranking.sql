-- Patch 2: search alias provenance, authority and deterministic ranking.
-- Keeps legitimate ambiguous aliases while ensuring curated institutional
-- abbreviations outrank low-confidence OpenAlex acronym collisions.

alter table public.search_aliases
  add column if not exists source text not null default 'LEGACY';

create index if not exists idx_search_aliases_source
  on public.search_aliases (source);

-- Classify the existing import by its known ingestion signature. Only the
-- acronym tier is demoted; source-provided alternate names keep priority 60.
update public.search_aliases as alias
set
  source = case
    when alias.priority = 90 then 'OPENALEX_ACRONYM'
    else 'OPENALEX_ALTERNATE_NAME'
  end,
  priority = case when alias.priority = 90 then 40 else alias.priority end,
  updated_at = now()
from public.universities as university
where alias.entity_type = 'UNIVERSITY'
  and alias.entity_id = university.id
  and university.external_source = 'OPENALEX'
  and alias.language = 'und'
  and alias.priority in (60, 90)
  and alias.source = 'LEGACY';

update public.search_aliases
set source = 'CURATED_COMMON_ALIAS', updated_at = now()
where priority >= 100 and source = 'LEGACY';

-- Resolve the five legacy field aliases to their existing canonical rows.
update public.search_aliases as alias
set
  entity_id = field.id,
  source = 'CURATED_COMMON_ALIAS',
  updated_at = now()
from public.fields_of_study as field
where alias.entity_type = 'FIELD_OF_STUDY'
  and alias.entity_id is null
  and (
    (alias.normalized_alias in ('cs', 'comp sci', 'computer sciences') and field.slug = 'computer-science')
    or (alias.normalized_alias = 'engineering' and field.slug = 'engineering')
    or (alias.normalized_alias = 'medicine' and field.slug = 'medicine')
  );

-- Canonical, institution-supported abbreviations. The entity is resolved by
-- canonical DB identity rather than hard-coded UUIDs.
insert into public.search_aliases (
  entity_type,
  entity_id,
  alias,
  normalized_alias,
  language,
  priority,
  source
)
select
  'UNIVERSITY',
  university.id,
  curated.alias,
  curated.normalized_alias,
  'en',
  curated.priority,
  'EXPLICIT_OFFICIAL_ALIAS'
from (values
  ('University College London', 'UCL', 'ucl', 200),
  ('Massachusetts Institute of Technology', 'MIT', 'mit', 200),
  ('University of Oxford', 'Oxford', 'oxford', 180),
  ('University of Cambridge', 'Cambridge', 'cambridge', 180),
  ('London School of Economics and Political Science', 'LSE', 'lse', 180),
  ('ETH Zurich', 'ETH', 'eth', 180)
) as curated(canonical_name, alias, normalized_alias, priority)
join public.universities as university
  on university.name = curated.canonical_name and university.active
on conflict (entity_type, entity_id, normalized_alias) do update
set
  alias = excluded.alias,
  language = excluded.language,
  priority = greatest(public.search_aliases.priority, excluded.priority),
  source = excluded.source,
  updated_at = now();

-- Preserve the existing broad retrieval function as the long-tail candidate
-- source. The wrapper below supplements it with authority-aware aliases.
do $$
begin
  if to_regprocedure('public.search_autocomplete_entities_base(text,integer)') is null then
    alter function public.search_autocomplete_entities(text, integer)
      rename to search_autocomplete_entities_base;
  end if;
end;
$$;

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
base_results as (
  select *
  from public.search_autocomplete_entities_base(p_query, 10)
),
alias_scores as (
  select
    alias.entity_id,
    min(case
      when alias.normalized_alias = input.query then 2
      when alias.normalized_alias like input.query || '%' then 3
      else 4
    end) as match_layer,
    max(case
      when alias.normalized_alias = input.query
        then case
          when alias.source = 'EXPLICIT_OFFICIAL_ALIAS' then 1000 + alias.priority
          else 950 + alias.priority
        end
      when alias.normalized_alias like input.query || '%'
        then 700 + alias.priority
          + (80.0 / (1 + abs(length(alias.normalized_alias) - length(input.query))))
      else 350 + alias.priority
        + public.similarity(alias.normalized_alias, input.query) * 250
        - least(abs(length(alias.normalized_alias) - length(input.query)) * 8, 120)
    end) as score
  from public.search_aliases as alias
  cross join input
  where alias.entity_type = 'UNIVERSITY'
    and alias.entity_id is not null
    and (
      alias.normalized_alias = input.query
      or (
        alias.source in ('EXPLICIT_OFFICIAL_ALIAS', 'CURATED_COMMON_ALIAS')
        and alias.normalized_alias like input.query || '%'
      )
      or (
        alias.source in ('EXPLICIT_OFFICIAL_ALIAS', 'CURATED_COMMON_ALIAS')
        and
        length(input.query) >= 3
        and public.similarity(alias.normalized_alias, input.query) >= 0.35
      )
      or (
        alias.source in ('EXPLICIT_OFFICIAL_ALIAS', 'CURATED_COMMON_ALIAS')
        and
        length(input.query) >= 5
        and abs(length(alias.normalized_alias) - length(input.query)) <= 2
        and public.levenshtein_less_equal(alias.normalized_alias, input.query, 2) <= 2
      )
    )
  group by alias.entity_id
),
authority_results as (
  select
    university.id as entity_id,
    'UNIVERSITY'::text as entity_type,
    university.name as title,
    concat_ws(', ', nullif(university.city, ''), country.name) as subtitle,
    university.slug,
    authority.match_layer,
    authority.score + least(coalesce(university.popularity_score, 0), 100) * 0.2 as score,
    country.iso2 as country_iso2,
    country.name as country_name,
    university.institution_type as badge,
    coalesce(university.admissions_url, university.website) as official_url
  from alias_scores as authority
  join public.universities as university
    on university.id = authority.entity_id and university.active
  left join public.countries as country
    on country.id = university.country_id and country.active
),
combined as (
  select * from base_results
  union all
  select * from authority_results
),
deduplicated as (
  select
    combined.*,
    row_number() over (
      partition by combined.entity_type, combined.entity_id
      order by combined.match_layer, combined.score desc, combined.title, combined.entity_id
    ) as entity_rank
  from combined
),
ranked as (
  select
    deduplicated.*,
    row_number() over (
      partition by deduplicated.entity_type
      order by deduplicated.match_layer, deduplicated.score desc,
        deduplicated.title, deduplicated.entity_id
    ) as rank_in_type
  from deduplicated
  where deduplicated.entity_rank = 1
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
where ranked.rank_in_type <= input.result_limit
order by ranked.match_layer, ranked.score desc, ranked.title, ranked.entity_id;
$$;

grant execute on function public.search_autocomplete_entities(text, integer)
  to anon, authenticated, service_role;
