-- Exact code/name/alias queries should never pay the fuzzy-candidate cost.
do $$
begin
  if to_regprocedure('public.search_autocomplete_entities_canonical_v2(text,integer)') is null then
    alter function public.search_autocomplete_entities(text,integer)
      rename to search_autocomplete_entities_canonical_v2;
  end if;
end $$;

create or replace function public.search_autocomplete_entities(p_query text,p_limit integer default 5)
returns table(entity_id uuid,entity_type text,title text,subtitle text,slug text,
  match_layer integer,score numeric,country_iso2 text,country_name text,badge text,official_url text)
language plpgsql stable security invoker set search_path=''
as $$
declare q text:=public.normalize_university_search_text(coalesce(p_query,''));
declare lim integer:=greatest(1,least(coalesce(p_limit,5),10));
declare exact_count integer;
begin
  return query
  with exact_rows as (
    select e.id as id,'QUALIFICATION'::text as entity_type,e.display_name_en as title,e.purpose as subtitle,e.slug as slug,
      case when lower(e.code)=q or public.normalize_university_search_text(e.canonical_name)=q then 1 else 2 end as match_layer,
      (2500+coalesce(a.priority,0))::numeric as score,null::text as country_iso2,null::text as country_name,'Supported by Oriens'::text as badge,e.official_url as official_url
    from public.exams e left join public.exam_aliases a on a.exam_id=e.id and a.active and a.normalized_alias=q
    where e.active and e.supported_public and
      (lower(e.code)=q or public.normalize_university_search_text(e.canonical_name)=q or a.id is not null)
    union all
    select u.id,'UNIVERSITY'::text,u.name,concat_ws(' · ',nullif(u.city,''),c.name),u.slug,
      case when u.normalized_name=q then 1 else 2 end,
      (1800+coalesce(sa.priority,0)+least(u.search_priority,200))::numeric,c.iso2,c.name,
      case when cf.manual_rank is not null then 'Featured' end,
      case when u.url_verification_status='verified' then coalesce(u.website,u.admissions_url) end
    from public.universities u join public.countries c on c.id=u.country_id and c.active
    left join public.search_aliases sa on sa.entity_type='UNIVERSITY' and sa.entity_id=u.id and sa.normalized_alias=q
    left join public.country_featured_universities cf on cf.university_id=u.id and cf.active
    where u.active and u.eligibility_status='eligible' and (u.normalized_name=q or sa.id is not null)
  ), dedup as (
    select distinct on (x.entity_type,x.id) x.* from exact_rows x
    order by x.entity_type,x.id,x.match_layer,x.score desc
  ), ranked as (
    select d.*,row_number() over(partition by d.entity_type order by d.match_layer,d.score desc,d.title) rn from dedup d
  )
  select r.id,r.entity_type,r.title,r.subtitle,r.slug,r.match_layer,r.score,
    r.country_iso2,r.country_name,r.badge,r.official_url from ranked r where r.rn<=lim
  order by r.match_layer,r.score desc,r.title;
  get diagnostics exact_count=row_count;
  if exact_count>0 then return; end if;

  return query select * from public.search_autocomplete_entities_canonical_v2(p_query,lim);
end;
$$;

grant execute on function public.search_autocomplete_entities(text,integer) to anon,authenticated,service_role;
