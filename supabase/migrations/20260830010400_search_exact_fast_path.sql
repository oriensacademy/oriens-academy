-- Exact canonical/alias/exam matches must not execute the fuzzy candidate plan.
-- Preserve the indexed global candidate function as the unresolved-query fallback.

do $$
begin
  if to_regprocedure('public.search_autocomplete_entities_global_candidates(text,integer)') is null then
    alter function public.search_autocomplete_entities(text, integer)
      rename to search_autocomplete_entities_global_candidates;
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
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  exact_count integer;
begin
  return query
  with input as (
    select public.normalize_university_search_text(coalesce(p_query, '')) as query,
      greatest(1, least(coalesce(p_limit, 5), 10)) as result_limit
  ),
  exact_universities as (
    select u.id, 1 as layer, 1500::numeric as exact_score
    from public.universities u cross join input
    where u.active and input.query <> '' and u.normalized_name = input.query
    union all
    select sa.entity_id, 2, (1400 + sa.priority)::numeric
    from public.search_aliases sa cross join input
    where sa.entity_type = 'UNIVERSITY' and sa.entity_id is not null
      and input.query <> '' and sa.normalized_alias = input.query
  ),
  university_scores as (
    select id, min(layer) as layer, max(exact_score) as exact_score
    from exact_universities group by id
  ),
  university_results as (
    select u.id as entity_id, 'UNIVERSITY'::text as entity_type, u.name as title,
      concat_ws(' · ', nullif(u.city, ''), c.name) as subtitle, u.slug,
      scores.layer as match_layer,
      (scores.exact_score + least(coalesce(u.search_priority, 0), 200))::numeric as score,
      c.iso2 as country_iso2, c.name as country_name,
      case when u.featured_country_rank <= 3 then 'Featured' else null end as badge,
      case when u.verified_url then coalesce(u.website, u.admissions_url) else null end as official_url
    from university_scores scores
    join public.universities u on u.id = scores.id and u.active
    join public.countries c on c.id = u.country_id and c.active
  ),
  exact_qualifications as (
    select q.id, 1 as layer, 1600::numeric as exact_score
    from public.qualifications q cross join input
    where q.active and input.query in (
      public.normalize_university_search_text(q.code),
      public.normalize_university_search_text(q.name),
      public.normalize_university_search_text(q.short_name)
    )
    union all
    select sa.entity_id, 2, (1500 + sa.priority)::numeric
    from public.search_aliases sa cross join input
    where sa.entity_type = 'QUALIFICATION' and sa.entity_id is not null
      and input.query <> '' and sa.normalized_alias = input.query
  ),
  qualification_scores as (
    select id, min(layer) as layer, max(exact_score) as exact_score
    from exact_qualifications group by id
  ),
  qualification_results as (
    select q.id as entity_id, 'QUALIFICATION'::text as entity_type,
      q.name || ' (' || q.code || ')' as title,
      replace(q.category, '_', ' ') || ' · ' || coalesce(q.country_scope, 'Global') as subtitle,
      lower(q.code) as slug, scores.layer as match_layer, scores.exact_score as score,
      null::text as country_iso2, null::text as country_name, q.code as badge,
      q.official_url as official_url
    from qualification_scores scores
    join public.qualifications q on q.id = scores.id and q.active
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
  select ranked.entity_id, ranked.entity_type, ranked.title, ranked.subtitle,
    ranked.slug, ranked.match_layer, ranked.score, ranked.country_iso2,
    ranked.country_name, ranked.badge, ranked.official_url
  from ranked cross join input
  where ranked.rank_in_type <= input.result_limit
  order by ranked.match_layer, ranked.score desc, ranked.title;

  get diagnostics exact_count = row_count;
  if exact_count = 0 then
    return query
    select candidates.entity_id, candidates.entity_type, candidates.title,
      candidates.subtitle, candidates.slug, candidates.match_layer, candidates.score,
      candidates.country_iso2, candidates.country_name, candidates.badge,
      candidates.official_url
    from public.search_autocomplete_entities_global_candidates(p_query, p_limit) candidates;
  end if;
end;
$$;

revoke all on function public.search_autocomplete_entities_global_candidates(text, integer)
  from public;
grant execute on function public.search_autocomplete_entities_global_candidates(text, integer)
  to anon, authenticated, service_role;
grant execute on function public.search_autocomplete_entities(text, integer)
  to anon, authenticated, service_role;
