-- University discovery v2: explainable eligibility, shared normalization,
-- trusted search terms, staged ranking, and append-only official URL evidence.
-- Forward-only. No payment, auth, checkout, or admission requirement rows change.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_university_search_text(value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(
    replace(replace(replace(replace(replace(replace(replace(
      lower(extensions.unaccent(translate(value, 'İIı', 'iii'))),
      'ß', 'ss'), 'æ', 'ae'), 'œ', 'oe'), 'ø', 'o'), 'ł', 'l'), 'đ', 'd'), '&', ' and '),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

comment on function public.normalize_university_search_text(text) is
  'oriens-university-normalization-v2: NFKD/unaccent-equivalent folds, Turkish I handling, punctuation boundaries, ASCII tokens.';

alter table public.universities
  add column if not exists university_confidence numeric,
  add column if not exists eligibility_evidence jsonb not null default '{}'::jsonb,
  add column if not exists eligibility_model_version text,
  add column if not exists degree_granting boolean,
  add column if not exists institution_class text,
  add column if not exists institution_source text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists manual_eligibility_override text,
  add column if not exists manual_search_priority integer not null default 0,
  add column if not exists normalization_version text,
  add column if not exists normalized_city text,
  add column if not exists verified_official_url text;

alter table public.universities drop constraint if exists universities_university_confidence_check;
alter table public.universities add constraint universities_university_confidence_check
  check (university_confidence is null or university_confidence between 0 and 1);
alter table public.universities drop constraint if exists universities_manual_eligibility_override_check;
alter table public.universities add constraint universities_manual_eligibility_override_check
  check (manual_eligibility_override is null or manual_eligibility_override in ('eligible','needs_review','ineligible'));
alter table public.universities drop constraint if exists universities_verified_official_url_check;
alter table public.universities add constraint universities_verified_official_url_check
  check (verified_official_url is null or verified_official_url ~ '^https://');

alter table public.search_aliases
  add column if not exists alias_type text,
  add column if not exists trust_score numeric,
  add column if not exists country_scope text,
  add column if not exists normalization_version text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists manual_override boolean not null default false;

alter table public.search_aliases drop constraint if exists search_aliases_alias_type_check;
alter table public.search_aliases add constraint search_aliases_alias_type_check
  check (alias_type is null or alias_type in ('acronym','native','english','historic','abbreviation','variant','typo'));
alter table public.search_aliases drop constraint if exists search_aliases_trust_score_check;
alter table public.search_aliases add constraint search_aliases_trust_score_check
  check (trust_score is null or trust_score between 0 and 1);

alter table public.university_url_verifications
  add column if not exists final_url text,
  add column if not exists http_status integer,
  add column if not exists failure_reason text,
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists checked_at timestamptz,
  add column if not exists retry_after timestamptz,
  add column if not exists attempt_count integer not null default 1;

alter table public.university_url_verifications
  drop constraint if exists university_url_verifications_university_id_candidate_url_key;
alter table public.university_url_verifications
  drop constraint if exists university_url_verifications_verification_status_check;
alter table public.university_url_verifications add constraint university_url_verifications_verification_status_check
  check (verification_status in (
    'unverified','source_provided','verified','redirect_verified','broken',
    'wrong_domain','missing','rejected','stale'
  ));
alter table public.universities drop constraint if exists universities_url_verification_status_check;
alter table public.universities add constraint universities_url_verification_status_check
  check (url_verification_status in (
    'unverified','source_provided','verified','redirect_verified','broken',
    'wrong_domain','missing','rejected','stale'
  ));

create index if not exists idx_university_url_verifications_history
  on public.university_url_verifications (university_id, checked_at desc, created_at desc);
create index if not exists idx_university_url_verifications_retry
  on public.university_url_verifications (verification_status, retry_after)
  where verification_status in ('unverified','source_provided','stale');

-- Deterministic normalization backfill. Human review fields and admissions data are untouched.
update public.universities set
  normalized_name = public.normalize_university_search_text(name),
  normalized_city = case when city is null then null else public.normalize_university_search_text(city) end,
  normalization_version = 'oriens-university-normalization-v2';

-- Deduplicate search aliases for the same entity that would collapse to the same normalized_alias under v2
with ranked_aliases as (
  select id,
    row_number() over (
      partition by entity_type, entity_id, public.normalize_university_search_text(alias)
      order by
        case when coalesce(manual_override, false) then 1 else 2 end,
        case when source ~* 'reviewed|manual|oriens' then 1 else 2 end,
        created_at desc,
        id
    ) as rn
  from public.search_aliases
  where entity_type = 'UNIVERSITY'
)
delete from public.search_aliases
where id in (select id from ranked_aliases where rn > 1);

update public.search_aliases set
  normalized_alias = public.normalize_university_search_text(alias),
  normalization_version = 'oriens-university-normalization-v2',
  alias_type = coalesce(alias_type, case
    when alias ~ '^[[:upper:][:digit:].&-]{2,12}$' then 'acronym'
    when language <> 'en' then 'native'
    else 'variant' end),
  trust_score = coalesce(trust_score, case
    when manual_override then 1.00
    when source ~* 'reviewed|manual|oriens' then 0.95
    when alias ~ '^[[:upper:][:digit:].&-]{2,12}$' then 0.88
    else 0.70 end)
where entity_type = 'UNIVERSITY';

-- Explainable model v2 backfill. Explicit/manual prior reviews are protected.
with identity_source as (
  select u.*,
    public.normalize_university_search_text(concat_ws(' ',u.name,array_to_string(u.aliases,' '))) as normalized_identities
  from public.universities u
), signals as (
  select u.id, u.normalized_name,
    coalesce(u.source_metadata->'ror_types' ? 'education', false) as ror_education,
    coalesce(u.source_metadata->'openalex_snapshot'->>'type', '') = 'education' as openalex_education,
    u.normalized_identities ~ '(^| )(university|universite|universitesi|universitat|universita|universidad|universidade|universiteit|universitet|universitas|universitatea|uniwersytet)( |$)' as university_identity,
    u.normalized_identities ~ '(^| )(college|polytechnic|polytechnique|hochschule|business school|graduate school|faculty|ecole|conservatoire|conservatory|institute of technology)( |$)' as hei_identity,
    u.normalized_name ~ '(^| )(science park|research park|school district|middle school|secondary school|high school|elementary school|primary school|training center|training centre|trade association|professional association|professional society|publisher|publishing|government authority|performing arts center|performing arts centre|hospital|clinic|health system|medical center|medical centre|museum)( |$)' as strong_negative,
    u.normalized_name ~ '(^| )(academy of sciences|national laboratory|research center|research centre|research institute|observatory)( |$)' as research_only
  from identity_source u
), scored as (
  select s.*,
    greatest(0::numeric, least(1::numeric,
      0.20
      + case when ror_education then 0.18 else -0.20 end
      + case when openalex_education then 0.16 else 0 end
      + case when university_identity then 0.42 when hei_identity then 0.27 else 0 end
      + case when strong_negative then -0.75 when research_only and not university_identity then -0.50 else 0 end
    )) as confidence
  from signals s
)
update public.universities u set
  university_confidence = case
    when u.manual_eligibility_override='eligible' then greatest(coalesce(u.university_confidence,0),0.95)
    when u.manual_eligibility_override='needs_review' then coalesce(u.university_confidence,0.50)
    when u.manual_eligibility_override='ineligible' then least(coalesce(u.university_confidence,0),0.29)
    else s.confidence end,
  degree_granting = case
    when s.strong_negative or (s.research_only and not s.university_identity) then false
    when s.university_identity and s.ror_education and s.openalex_education then true
    else null end,
  institution_class = case
    when s.strong_negative then 'non_higher_education'
    when s.research_only and not s.university_identity then 'research_only'
    when s.university_identity then 'university'
    when s.hei_identity then 'higher_education_college'
    else 'ambiguous_education_organization' end,
  institution_source = case when s.openalex_education then 'ROR+OpenAlex' else 'ROR' end,
  eligibility_status = case
    when u.manual_eligibility_override is not null then u.manual_eligibility_override
    when s.strong_negative or (s.research_only and not s.university_identity) or s.confidence < 0.30 then 'ineligible'
    when s.confidence < 0.65 then 'needs_review'
    else 'eligible' end,
  eligibility_reason = case
    when u.manual_eligibility_override is not null then coalesce(u.eligibility_reason, 'Manual eligibility override')
    when s.strong_negative then 'Strong evidence indicates a non-higher-education entity'
    when s.research_only and not s.university_identity then 'Research-only organization without degree-granting identity'
    when s.confidence < 0.65 then 'Education organization requires degree-granting review'
    else 'Multi-signal higher-education identity meets the public threshold' end,
  eligibility_evidence = coalesce(u.eligibility_evidence, '{}'::jsonb) || jsonb_build_object(
    'model_version','oriens-university-eligibility-v2.0.0',
    'ror_education',s.ror_education,
    'openalex_education',s.openalex_education,
    'university_identity',s.university_identity,
    'higher_education_identity',s.hei_identity,
    'strong_negative',s.strong_negative,
    'research_only',s.research_only,
    'confidence',s.confidence
  ),
  eligibility_model_version = 'oriens-university-eligibility-v2.0.0',
  eligibility_review_source = case
    when u.manual_eligibility_override is not null then u.eligibility_review_source
    else 'deterministic multi-signal model v2' end
from scored s
where u.id = s.id
  and (u.manual_eligibility_override is not null
    or coalesce(u.eligibility_review_source, '') !~* 'manual|admin');

-- Curated aliases are reviewed identity mappings, not guessed domains or prestige rankings.
with alias_seed(ror_key, university_name, alias, alias_type, language, country_scope) as (values
  ('042nb2s44','Massachusetts Institute of Technology','MIT','acronym','en','US'),
  ('046rm7j60','University of California, Los Angeles','UCLA','acronym','en','US'),
  ('0190ak572','New York University','NYU','acronym','en','US'),
  ('01tgyzw49','National University of Singapore','NUS','acronym','en','SG'),
  ('02e7b5302','Nanyang Technological University','NTU','acronym','en','SG'),
  ('02kkvpp62','Technical University of Munich','TUM','acronym','en','DE'),
  ('05a28rw58','ETH Zurich','ETH','acronym','de','CH'),
  ('02s376052','École Polytechnique Fédérale de Lausanne','EPFL','acronym','fr','CH'),
  ('059636586','Istanbul Technical University','İTÜ','acronym','tr','TR'),
  ('03z9tma90','Boğaziçi University','Boğaziçi','native','tr','TR'),
  ('00jzwgz36','Koç University','Koç','native','tr','TR'),
  ('049asqa32','Sabancı Üniversitesi','Sabancı','native','tr','TR'),
  ('01an7q238','University of California, Berkeley','UC Berkeley','abbreviation','en','US'),
  ('04h9pn542','Seoul National University','Seoul','abbreviation','en','KR')
)
insert into public.search_aliases
  (entity_type,entity_id,alias,normalized_alias,language,priority,source,alias_type,trust_score,country_scope,normalization_version,reviewed_at,reviewed_by,manual_override)
select distinct on (u.id, public.normalize_university_search_text(s.alias))
  'UNIVERSITY',u.id,s.alias,public.normalize_university_search_text(s.alias),s.language,130,
  'Oriens reviewed university identity set 2026-08-31',s.alias_type,0.98,s.country_scope,
  'oriens-university-normalization-v2',now(),'migration:20260831130000',true
from alias_seed s
join public.universities u on u.ror_id in (s.ror_key,'https://ror.org/'||s.ror_key)
on conflict(entity_type,entity_id,normalized_alias) do update set
  alias=excluded.alias,language=excluded.language,priority=greatest(public.search_aliases.priority,excluded.priority),
  source=excluded.source,alias_type=excluded.alias_type,trust_score=excluded.trust_score,
  country_scope=excluded.country_scope,normalization_version=excluded.normalization_version,
  reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by,manual_override=true,updated_at=now();

-- Indexed canonical/token/alias term store makes fuzzy fallback bounded by short terms.
create table if not exists public.university_search_terms (
  university_id uuid not null references public.universities(id) on delete cascade,
  normalized_term text not null,
  term_type text not null check (term_type in ('canonical','canonical_token','alias')),
  trust_score numeric not null default 0.70 check (trust_score between 0 and 1),
  source text not null,
  country_scope text,
  created_at timestamptz not null default now(),
  primary key (university_id, normalized_term, term_type)
);

create index if not exists idx_university_search_terms_exact
  on public.university_search_terms(normalized_term, term_type, trust_score desc);
create index if not exists idx_university_search_terms_prefix
  on public.university_search_terms(normalized_term text_pattern_ops);
create index if not exists idx_university_search_terms_trgm
  on public.university_search_terms using gin(normalized_term public.gin_trgm_ops);
create index if not exists idx_universities_v2_public_rank
  on public.universities(university_confidence desc, manual_search_priority desc, search_priority desc)
  where active and eligibility_status='eligible';
create index if not exists idx_universities_v2_country_public
  on public.universities(country_id, university_confidence desc)
  where active and eligibility_status='eligible';
create index if not exists idx_universities_v2_city
  on public.universities(normalized_city text_pattern_ops)
  where active and eligibility_status='eligible';

create or replace function public.refresh_university_search_terms(p_university_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.university_search_terms where university_id=p_university_id;
  insert into public.university_search_terms(university_id,normalized_term,term_type,trust_score,source,country_scope)
  select u.id,u.normalized_name,'canonical',1.00,'canonical name',c.iso2
  from public.universities u join public.countries c on c.id=u.country_id
  where u.id=p_university_id and nullif(u.normalized_name,'') is not null;

  insert into public.university_search_terms(university_id,normalized_term,term_type,trust_score,source,country_scope)
  select u.id,token,'canonical_token',0.86,'canonical name token',c.iso2
  from public.universities u join public.countries c on c.id=u.country_id
  cross join lateral regexp_split_to_table(u.normalized_name,'\s+') token
  where u.id=p_university_id and length(token)>=3
    and token not in ('the','and','of','for','university','universite','universitesi','college','institute')
  on conflict do nothing;

  insert into public.university_search_terms(university_id,normalized_term,term_type,trust_score,source,country_scope)
  select sa.entity_id,sa.normalized_alias,'alias',coalesce(sa.trust_score,0.70),sa.source,coalesce(sa.country_scope,c.iso2)
  from public.search_aliases sa join public.universities u on u.id=sa.entity_id
  join public.countries c on c.id=u.country_id
  where sa.entity_type='UNIVERSITY' and sa.entity_id=p_university_id and nullif(sa.normalized_alias,'') is not null
  on conflict(university_id,normalized_term,term_type) do update set
    trust_score=greatest(public.university_search_terms.trust_score,excluded.trust_score),source=excluded.source,country_scope=excluded.country_scope;
end;
$$;

revoke all on function public.refresh_university_search_terms(uuid) from public,anon,authenticated;
grant execute on function public.refresh_university_search_terms(uuid) to service_role;

do $$ declare target uuid; begin
  for target in select id from public.universities loop
    perform public.refresh_university_search_terms(target);
  end loop;
end $$;

create or replace function public.sync_university_search_terms_from_university()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then delete from public.university_search_terms where university_id=old.id; return old; end if;
  perform public.refresh_university_search_terms(new.id); return new;
end;
$$;
create or replace function public.sync_university_search_terms_from_alias()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.entity_type='UNIVERSITY' and old.entity_id is not null then perform public.refresh_university_search_terms(old.entity_id); end if;
    return old;
  end if;
  if new.entity_type='UNIVERSITY' and new.entity_id is not null then perform public.refresh_university_search_terms(new.entity_id); end if;
  return new;
end;
$$;
drop trigger if exists trg_sync_university_search_terms on public.universities;
create trigger trg_sync_university_search_terms after insert or update of name,normalized_name,country_id on public.universities
for each row execute function public.sync_university_search_terms_from_university();
drop trigger if exists trg_sync_university_alias_terms on public.search_aliases;
create trigger trg_sync_university_alias_terms after insert or update or delete on public.search_aliases
for each row execute function public.sync_university_search_terms_from_alias();

alter table public.university_search_terms enable row level security;
drop policy if exists "Public eligible university search terms" on public.university_search_terms;
create policy "Public eligible university search terms" on public.university_search_terms for select using (
  exists(select 1 from public.universities u where u.id=university_id and u.active and u.eligibility_status='eligible')
);
grant select on public.university_search_terms to anon,authenticated;
grant all on public.university_search_terms to service_role;
revoke insert,update,delete on public.university_search_terms from anon,authenticated;

-- Direct public reads are limited to approved active entities; admin policy still exposes review queues.
drop policy if exists "Public active universities policy" on public.universities;
drop policy if exists "Public eligible universities v2" on public.universities;
create policy "Public eligible universities v2" on public.universities for select
  using (active and eligibility_status='eligible'
    and (manual_eligibility_override='eligible' or coalesce(university_confidence,0)>=0.65));
drop policy if exists "Public search aliases policy" on public.search_aliases;
drop policy if exists "Public eligible university aliases v2" on public.search_aliases;
create policy "Public eligible university aliases v2" on public.search_aliases for select using (
  entity_type<>'UNIVERSITY' or exists(
    select 1 from public.universities u where u.id=entity_id and u.active
      and u.eligibility_status='eligible'
      and (u.manual_eligibility_override='eligible' or coalesce(u.university_confidence,0)>=0.65)
  )
);

create or replace function public.search_university_strong_candidates_v2(
  p_query text,p_limit integer default 10,p_country_iso2 text default null
)
returns table(entity_id uuid,title text,subtitle text,slug text,match_layer integer,score numeric,country_iso2 text,country_name text,badge text,official_url text)
language sql stable security invoker set search_path='' as $$
with input as (
  select public.normalize_university_search_text(coalesce(p_query,'')) q,
    greatest(1,least(coalesce(p_limit,10),10)) lim,
    nullif(upper(trim(coalesce(p_country_iso2,''))),'') country_filter
), matches as (
  select t.university_id,
    min(case
      when t.term_type='canonical' and t.normalized_term=i.q then 1
      when t.term_type='alias' and t.normalized_term=i.q then 2
      when t.term_type='canonical' and t.normalized_term like i.q||'%' then 3
      when t.term_type='alias' and t.normalized_term like i.q||'%' then 4
      when t.term_type='canonical_token' and t.normalized_term=i.q then 5
      else 6 end) as layer,
    max(case
      when t.term_type='canonical' and t.normalized_term=i.q then 1000
      when t.term_type='alias' and t.normalized_term=i.q then
        case when t.trust_score>=0.95 then 1450 else 1000+200*t.trust_score end
      when t.term_type='canonical' and t.normalized_term like i.q||'%' then 835
      when t.term_type='alias' and t.normalized_term like i.q||'%' then 790+80*t.trust_score
      when t.term_type='canonical_token' and t.normalized_term=i.q then 720+80*t.trust_score
      else 0 end)::numeric as match_score
  from input i join public.university_search_terms t on i.q<>'' and (
    t.normalized_term=i.q or (length(i.q)>=3 and t.normalized_term like i.q||'%')
  )
  group by t.university_id
), ranked as (
  select u.id,u.name,concat_ws(' · ',nullif(u.city,''),c.name) subtitle,u.slug,
    case when m.layer=5 and u.normalized_name in ('university of '||i.q,i.q||' university','the university of '||i.q) then 3 else m.layer end layer,
    (m.match_score
      + coalesce(u.university_confidence,0)*450
      + case when u.degree_granting then 85 else 0 end
      + least(greatest(coalesce(u.manual_search_priority,0),-100),150)
      + least(coalesce(u.search_priority,0),200)*0.80
      + case when m.layer=5 and u.normalized_name in ('university of '||i.q,i.q||' university','the university of '||i.q) then 190 else 0 end
      + case when i.country_filter is not null and c.iso2=i.country_filter then 140 when i.country_filter is not null then -80 else 0 end
      + case when u.institution_class in ('research_only','non_higher_education') then -600 else 0 end
    )::numeric score,c.iso2,c.name country_name,
    case when cf.manual_rank is not null then 'Featured' end badge,
    case when u.url_verification_status in ('verified','redirect_verified') then u.verified_official_url end official_url
  from matches m cross join input i
  join public.universities u on u.id=m.university_id and u.active and u.eligibility_status='eligible'
    and (u.manual_eligibility_override='eligible' or coalesce(u.university_confidence,0)>=0.65)
  join public.countries c on c.id=u.country_id and c.active
  left join public.country_featured_universities cf on cf.university_id=u.id and cf.active
)
select r.id,r.name,r.subtitle,r.slug,r.layer,r.score,r.iso2,r.country_name,r.badge,r.official_url
from ranked r cross join input i order by r.score desc,r.layer,r.name limit (select lim from input);
$$;

create or replace function public.search_university_fuzzy_candidates_v2(
  p_query text,p_limit integer default 10,p_country_iso2 text default null
)
returns table(entity_id uuid,title text,subtitle text,slug text,match_layer integer,score numeric,country_iso2 text,country_name text,badge text,official_url text)
language sql stable security invoker set search_path='' as $$
with input as (
  select public.normalize_university_search_text(coalesce(p_query,'')) q,
    greatest(1,least(coalesce(p_limit,10),10)) lim,
    nullif(upper(trim(coalesce(p_country_iso2,''))),'') country_filter
), bounded_terms as (
  select t.university_id,max(public.similarity(t.normalized_term,i.q)) similarity_score
  from input i join public.university_search_terms t
    on length(i.q)>=4 and t.normalized_term operator(public.%) i.q
  where length(t.normalized_term) between greatest(3,length(i.q)-3) and length(i.q)+8
  group by t.university_id
  order by similarity_score desc limit 80
), ranked as (
  select u.id,u.name,concat_ws(' · ',nullif(u.city,''),c.name) subtitle,u.slug,6 layer,
    (520+b.similarity_score*330+coalesce(u.university_confidence,0)*450
      +case when u.degree_granting then 85 else 0 end
      +least(greatest(coalesce(u.manual_search_priority,0),-100),150)
      +least(coalesce(u.search_priority,0),200)*0.65
      +case when i.country_filter is not null and c.iso2=i.country_filter then 140 when i.country_filter is not null then -80 else 0 end)::numeric score,
    c.iso2,c.name country_name,case when cf.manual_rank is not null then 'Featured' end badge,
    case when u.url_verification_status in ('verified','redirect_verified') then u.verified_official_url end official_url
  from bounded_terms b cross join input i
  join public.universities u on u.id=b.university_id and u.active and u.eligibility_status='eligible'
    and (u.manual_eligibility_override='eligible' or coalesce(u.university_confidence,0)>=0.65)
  join public.countries c on c.id=u.country_id and c.active
  left join public.country_featured_universities cf on cf.university_id=u.id and cf.active
)
select r.id,r.name,r.subtitle,r.slug,r.layer,r.score,r.iso2,r.country_name,r.badge,r.official_url
from ranked r cross join input i order by r.score desc,r.name limit (select lim from input);
$$;

create or replace function public.search_autocomplete_entities_v2(
  p_query text,p_limit integer default 10,p_country_iso2 text default null
)
returns table(entity_id uuid,entity_type text,title text,subtitle text,slug text,
  match_layer integer,score numeric,country_iso2 text,country_name text,badge text,official_url text)
language plpgsql stable security invoker set search_path='' as $$
declare q text:=public.normalize_university_search_text(coalesce(p_query,''));
declare lim integer:=greatest(1,least(coalesce(p_limit,10),10));
declare strong_count integer:=0;
begin
  select count(*) into strong_count from public.search_university_strong_candidates_v2(q,lim,p_country_iso2);

  return query
  with exam_candidates as (
    select distinct on (e.id) e.id,'QUALIFICATION'::text entity_type,e.display_name_en title,e.purpose subtitle,e.slug,
      case when lower(e.code)=q or public.normalize_university_search_text(e.canonical_name)=q then 1
        when a.normalized_alias=q then 2 when lower(e.code) like q||'%' then 3 else 4 end match_layer,
      (2200+coalesce(a.priority,0))::numeric score,null::text country_iso2,null::text country_name,
      'Supported by Oriens'::text badge,e.official_url
    from public.exams e left join public.exam_aliases a on a.exam_id=e.id and a.active
      and (a.normalized_alias=q or a.normalized_alias like q||'%')
    where e.active and e.supported_public and q<>'' and (
      lower(e.code)=q or public.normalize_university_search_text(e.canonical_name)=q
      or lower(e.code) like q||'%' or public.normalize_university_search_text(e.canonical_name) like q||'%' or a.id is not null)
    order by e.id,match_layer,score desc
  ), university_candidates as (
    select s.* from public.search_university_strong_candidates_v2(q,lim,p_country_iso2) s
    union all
    select f.* from public.search_university_fuzzy_candidates_v2(q,lim,p_country_iso2) f
    where strong_count<lim and not exists(
      select 1 from public.search_university_strong_candidates_v2(q,lim,p_country_iso2) s where s.entity_id=f.entity_id)
  ), combined as (
    select e.id,e.entity_type,e.title,e.subtitle,e.slug,e.match_layer,e.score,e.country_iso2,e.country_name,e.badge,e.official_url from exam_candidates e
    union all
    select u.entity_id,'UNIVERSITY',u.title,u.subtitle,u.slug,u.match_layer,u.score,u.country_iso2,u.country_name,u.badge,u.official_url from university_candidates u
  ), ranked as (
    select c.*,row_number() over(partition by c.entity_type order by c.score desc,c.match_layer,c.title) rn from combined c
  )
  select r.entity_id,r.entity_type,r.title,r.subtitle,r.slug,r.match_layer,r.score,r.country_iso2,r.country_name,r.badge,r.official_url
  from ranked r where r.rn<=lim order by r.score desc,r.match_layer,r.title;
end;
$$;

grant execute on function public.search_university_strong_candidates_v2(text,integer,text) to anon,authenticated,service_role;
grant execute on function public.search_university_fuzzy_candidates_v2(text,integer,text) to anon,authenticated,service_role;
grant execute on function public.search_autocomplete_entities_v2(text,integer,text) to anon,authenticated,service_role;

-- Preserve existing strict/manual verified current state and make its provenance
-- auditable. No unverified ROR candidate is promoted by this backfill.
update public.universities set verified_official_url=website
where url_verification_status='verified' and verified_url and website ~ '^https://'
  and (featured_override_verified or (
    jsonb_typeof(source_metadata->'official_domain_evidence')='array'
    and jsonb_array_length(source_metadata->'official_domain_evidence')>0
  ));

insert into public.university_url_verifications
  (university_id,candidate_url,source,retrieved_at,redirect_chain,final_domain,verification_status,
   verified_at,verified_by,final_url,evidence,checked_at,attempt_count)
select u.id,u.verified_official_url,coalesce(u.url_verification_source,'preserved strict source/domain evidence'),
  coalesce(u.url_checked_at,u.verified_at,u.updated_at),'[]'::jsonb,
  regexp_replace(split_part(regexp_replace(u.verified_official_url,'^https://','','i'),'/',1),'^www\.','','i'),
  'verified',coalesce(u.verified_at,u.url_checked_at,u.updated_at),coalesce(u.url_verified_by,'migration: preserved reviewed state'),
  u.verified_official_url,jsonb_build_object('preserved_current_state',true,'http_recheck_required',true,
    'official_domain_evidence',coalesce(u.source_metadata->'official_domain_evidence','[]'::jsonb)),
  coalesce(u.url_checked_at,u.verified_at,u.updated_at),1
from public.universities u
where u.verified_official_url is not null
  and not exists(select 1 from public.university_url_verifications v where v.university_id=u.id);

-- University of Bristol: source IDs and ROR domain evidence are known; the HTTP
-- redirect resolves http://bristol.ac.uk/ to the canonical HTTPS official site.
insert into public.university_url_verifications
  (university_id,candidate_url,source,retrieved_at,redirect_chain,final_domain,verification_status,
   verified_at,verified_by,final_url,http_status,evidence,checked_at,attempt_count)
select u.id,'https://bristol.ac.uk/','ROR 0524sp257 + OpenAlex I36234482 + Wikidata Q459506',now(),
  jsonb_build_array('http://bristol.ac.uk/','https://www.bristol.ac.uk/'),'bristol.ac.uk','redirect_verified',
  now(),'migration: source/domain evidence','https://www.bristol.ac.uk/',200,
  jsonb_build_object('ror_id','0524sp257','openalex_id','I36234482','wikidata_id','Q459506',
    'official_domain_evidence','bristol.ac.uk','identity_match',true),now(),1
from public.universities u
where u.ror_id in ('https://ror.org/0524sp257','0524sp257')
  and not exists(select 1 from public.university_url_verifications v where v.university_id=u.id and v.final_url='https://www.bristol.ac.uk/' and v.verification_status='redirect_verified');

update public.universities set
  verified_official_url='https://www.bristol.ac.uk/',website=coalesce(website,'https://www.bristol.ac.uk/'),
  verified_url=true,verified_at=now(),url_verification_status='redirect_verified',
  url_verification_source='ROR/OpenAlex/Wikidata identity + ROR domain + canonical HTTP redirect',
  url_checked_at=now(),url_verified_by='migration: source/domain evidence'
where ror_id in ('https://ror.org/0524sp257','0524sp257');

drop policy if exists "Public verified university urls" on public.university_url_verifications;
create policy "Public verified university urls" on public.university_url_verifications for select
  using (verification_status in ('verified','redirect_verified'));

create or replace function public.admin_review_university_eligibility(
  p_university_id uuid,p_override text,p_reason text,p_evidence jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_override not in ('eligible','needs_review','ineligible') then raise exception 'INVALID_ELIGIBILITY_OVERRIDE'; end if;
  update public.universities set manual_eligibility_override=p_override,eligibility_status=p_override,
    university_confidence=case when p_override='eligible' then greatest(coalesce(university_confidence,0),0.95)
      when p_override='needs_review' then coalesce(university_confidence,0.50) else least(coalesce(university_confidence,0),0.29) end,
    eligibility_reason=nullif(trim(p_reason),''),eligibility_evidence=coalesce(eligibility_evidence,'{}'::jsonb)||coalesce(p_evidence,'{}'::jsonb),
    reviewed_at=now(),reviewed_by=auth.uid()::text,eligibility_reviewed_at=now(),eligibility_review_source='admin manual override'
  where id=p_university_id;
  if not found then raise exception 'UNIVERSITY_NOT_FOUND'; end if;
end;
$$;

create or replace function public.admin_review_university_official_url(
  p_university_id uuid,p_candidate_url text,p_final_url text,p_status text,p_reason text,p_evidence jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_status not in ('verified','redirect_verified','unverified','broken','wrong_domain','missing','rejected','stale') then raise exception 'INVALID_URL_STATUS'; end if;
  if p_candidate_url is not null and p_candidate_url !~ '^https://' then raise exception 'HTTPS_REQUIRED'; end if;
  if p_final_url is not null and p_final_url !~ '^https://' then raise exception 'HTTPS_REQUIRED'; end if;
  insert into public.university_url_verifications
    (university_id,candidate_url,source,verification_status,verified_at,verified_by,final_url,failure_reason,evidence,checked_at)
  values(p_university_id,coalesce(p_candidate_url,p_final_url), 'admin review',p_status,
    case when p_status in ('verified','redirect_verified') then now() end,auth.uid()::text,p_final_url,p_reason,coalesce(p_evidence,'{}'::jsonb),now());
  update public.universities set verified_official_url=case when p_status in ('verified','redirect_verified') then p_final_url else null end,
    verified_url=p_status in ('verified','redirect_verified'),verified_at=case when p_status in ('verified','redirect_verified') then now() else verified_at end,
    url_verification_status=p_status,url_verification_source='admin review',url_checked_at=now(),url_verified_by=auth.uid()::text,
    reviewed_at=now(),reviewed_by=auth.uid()::text where id=p_university_id;
end;
$$;

revoke all on function public.admin_review_university_eligibility(uuid,text,text,jsonb) from public,anon;
revoke all on function public.admin_review_university_official_url(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function public.admin_review_university_eligibility(uuid,text,text,jsonb) to authenticated,service_role;
grant execute on function public.admin_review_university_official_url(uuid,text,text,text,text,jsonb) to authenticated,service_role;

comment on column public.universities.university_confidence is '0..1 explainable HEI confidence; manual_eligibility_override has precedence.';
comment on column public.universities.verified_official_url is 'Canonical HTTPS URL exposed publicly only after verified or redirect_verified evidence.';
comment on table public.university_url_verifications is 'Append-only URL verification attempts and evidence. A website candidate is not proof of an official URL.';
