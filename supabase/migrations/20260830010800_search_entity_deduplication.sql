-- Preserve the applied canonical v1 function and add identity-level deduplication.
do $$
begin
  if to_regprocedure('public.search_autocomplete_entities_canonical_v1(text,integer)') is null then
    alter function public.search_autocomplete_entities(text,integer)
      rename to search_autocomplete_entities_canonical_v1;
  end if;
end $$;

create or replace function public.search_autocomplete_entities(p_query text,p_limit integer default 5)
returns table(entity_id uuid,entity_type text,title text,subtitle text,slug text,
  match_layer integer,score numeric,country_iso2 text,country_name text,badge text,official_url text)
language sql stable security invoker set search_path=''
as $$
with input as (select greatest(1,least(coalesce(p_limit,5),10)) lim),
deduplicated as (
  select distinct on (r.entity_type,r.entity_id)
    r.entity_id,r.entity_type,r.title,r.subtitle,r.slug,r.match_layer,r.score,
    r.country_iso2,r.country_name,r.badge,r.official_url
  from public.search_autocomplete_entities_canonical_v1(p_query,10) r
  order by r.entity_type,r.entity_id,r.match_layer,r.score desc
),ranked as (
  select d.*,row_number() over(partition by d.entity_type order by d.match_layer,d.score desc,d.title) rn
  from deduplicated d
)
select r.entity_id,r.entity_type,r.title,r.subtitle,r.slug,r.match_layer,r.score,
  r.country_iso2,r.country_name,r.badge,r.official_url
from ranked r cross join input i where r.rn<=i.lim
order by r.match_layer,r.score desc,r.title;
$$;

grant execute on function public.search_autocomplete_entities(text,integer) to anon,authenticated,service_role;
