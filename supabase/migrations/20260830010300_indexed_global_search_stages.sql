-- Force independent indexed candidate stages for global autocomplete. The
-- previous OR-based predicate could choose a broad scan under concurrency.

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
  select public.normalize_university_search_text(coalesce(p_query, '')) as query,
    greatest(1, least(coalesce(p_limit, 5), 10)) as result_limit
),
canonical_exact as (
  select u.id, 1 as match_layer, 1400::numeric as base_score
  from public.universities u cross join input
  where u.active and input.query <> '' and u.normalized_name = input.query
  limit 50
),
canonical_prefix as (
  select u.id, 3 as match_layer,
    (900 + 80.0 / (1 + abs(length(u.normalized_name) - length(input.query))))::numeric as base_score
  from public.universities u cross join input
  where u.active and input.query <> '' and u.normalized_name like input.query || '%'
    and u.normalized_name <> input.query
  order by length(u.normalized_name), u.search_priority desc
  limit 100
),
canonical_tokens as (
  select u.id, 5 as match_layer,
    (620 + pg_catalog.ts_rank(u.search_document, pg_catalog.plainto_tsquery('simple', input.query)) * 100)::numeric as base_score
  from public.universities u cross join input
  where u.active and input.query <> ''
    and u.search_document @@ pg_catalog.plainto_tsquery('simple', input.query)
    and u.normalized_name <> input.query
    and u.normalized_name not like input.query || '%'
  order by base_score desc, u.search_priority desc
  limit 150
),
canonical_fuzzy as (
  select u.id, 6 as match_layer,
    (380 + public.similarity(u.normalized_name, input.query) * 180)::numeric as base_score
  from public.universities u cross join input
  where u.active and length(input.query) >= 3
    and u.normalized_name OPERATOR(public.%) input.query
    and u.normalized_name <> input.query
    and u.normalized_name not like input.query || '%'
  order by public.similarity(u.normalized_name, input.query) desc, u.search_priority desc
  limit 150
),
alias_exact as (
  select sa.entity_id as id, 2 as match_layer, (1250 + sa.priority)::numeric as base_score
  from public.search_aliases sa cross join input
  where sa.entity_type = 'UNIVERSITY' and sa.entity_id is not null
    and input.query <> '' and sa.normalized_alias = input.query
  order by sa.priority desc
  limit 100
),
alias_prefix as (
  select sa.entity_id as id, 4 as match_layer,
    (800 + sa.priority + 60.0 / (1 + abs(length(sa.normalized_alias) - length(input.query))))::numeric as base_score
  from public.search_aliases sa cross join input
  where sa.entity_type = 'UNIVERSITY' and sa.entity_id is not null
    and input.query <> '' and sa.normalized_alias like input.query || '%'
    and sa.normalized_alias <> input.query
  order by sa.priority desc, length(sa.normalized_alias)
  limit 150
),
alias_fuzzy as (
  select sa.entity_id as id, 6 as match_layer,
    (370 + sa.priority * 0.5 + public.similarity(sa.normalized_alias, input.query) * 180)::numeric as base_score
  from public.search_aliases sa cross join input
  where sa.entity_type = 'UNIVERSITY' and sa.entity_id is not null
    and length(input.query) >= 3 and sa.normalized_alias OPERATOR(public.%) input.query
    and sa.normalized_alias <> input.query
    and sa.normalized_alias not like input.query || '%'
  order by public.similarity(sa.normalized_alias, input.query) desc, sa.priority desc
  limit 150
),
all_university_candidates as (
  select * from canonical_exact union all
  select * from canonical_prefix union all
  select * from canonical_tokens union all
  select * from canonical_fuzzy union all
  select * from alias_exact union all
  select * from alias_prefix union all
  select * from alias_fuzzy
),
university_scores as (
  select id, min(match_layer) as match_layer, max(base_score) as layer_score
  from all_university_candidates group by id
),
university_results as (
  select u.id as entity_id, 'UNIVERSITY'::text as entity_type, u.name as title,
    concat_ws(' · ', nullif(u.city, ''), c.name) as subtitle, u.slug, s.match_layer,
    (s.layer_score + least(coalesce(u.search_priority, 0), 200) + least(coalesce(u.popularity_score, 0), 100) * 0.2)::numeric as score,
    c.iso2 as country_iso2, c.name as country_name,
    case when u.featured_country_rank <= 3 then 'Featured' else null end as badge,
    case when u.verified_url then coalesce(u.website, u.admissions_url) else null end as official_url
  from university_scores s
  join public.universities u on u.id = s.id and u.active
  join public.countries c on c.id = u.country_id and c.active
),
qualification_terms as (
  select q.id, term.value as term, 1 as source_layer, 0 as alias_priority
  from public.qualifications q
  cross join lateral unnest(array[
    public.normalize_university_search_text(q.code),
    public.normalize_university_search_text(q.name),
    public.normalize_university_search_text(q.short_name)
  ]) term(value)
  where q.active
  union all
  select sa.entity_id, sa.normalized_alias, 2, sa.priority
  from public.search_aliases sa
  where sa.entity_type = 'QUALIFICATION' and sa.entity_id is not null
),
qualification_scores as (
  select terms.id,
    case when bool_or(terms.source_layer = 1 and terms.term = input.query) then 1
      when bool_or(terms.source_layer = 2 and terms.term = input.query) then 2
      when bool_or(terms.term like input.query || '%') then 3 else 6 end as match_layer,
    max(case when terms.source_layer = 1 and terms.term = input.query then 1500
      when terms.source_layer = 2 and terms.term = input.query then 1400 + terms.alias_priority
      when terms.term like input.query || '%' then 850
      else 400 + public.similarity(terms.term, input.query) * 200 end)::numeric as layer_score
  from qualification_terms terms cross join input
  where terms.term = input.query or terms.term like input.query || '%'
    or (length(input.query) >= 2 and public.similarity(terms.term, input.query) >= 0.35)
    or (length(input.query) >= 4 and abs(length(terms.term) - length(input.query)) <= 2
      and public.levenshtein_less_equal(terms.term, input.query, 2) <= 2)
  group by terms.id
),
qualification_results as (
  select q.id as entity_id, 'QUALIFICATION'::text as entity_type,
    q.name || ' (' || q.code || ')' as title,
    replace(q.category, '_', ' ') || ' · ' || coalesce(q.country_scope, 'Global') as subtitle,
    lower(q.code) as slug, scores.match_layer, scores.layer_score as score,
    null::text as country_iso2, null::text as country_name, q.code as badge,
    q.official_url as official_url
  from qualification_scores scores join public.qualifications q on q.id = scores.id and q.active
),
combined as (
  select * from university_results union all select * from qualification_results
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
