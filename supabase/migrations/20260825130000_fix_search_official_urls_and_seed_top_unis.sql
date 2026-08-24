-- Migration: 20260825130000_fix_search_official_urls_and_seed_top_unis.sql
-- Description: Prioritizes canonical institution website in search_autocomplete_entities RPC and seeds top global universities (Stanford, Toronto, UBC, EPFL, TUM).

-- 1. Ensure Country records exist for new universities
insert into public.countries (iso2, iso3, name, slug, region, aliases, active)
values
  ('CA', 'CAN', 'Canada', 'canada', 'North America', array['Canada', 'CAN'], true),
  ('DE', 'DEU', 'Germany', 'germany', 'Europe', array['Germany', 'Deutschland', 'DEU', 'DE'], true)
on conflict (iso2) do update set
  iso3 = excluded.iso3,
  name = excluded.name,
  slug = excluded.slug,
  region = excluded.region,
  aliases = excluded.aliases,
  active = true,
  updated_at = now();

-- 2. Upsert Core & Extended Universities with verified canonical homepages
insert into public.universities (
  name,
  normalized_name,
  slug,
  country_id,
  city,
  state_or_region,
  website,
  admissions_url,
  institution_type,
  popularity_score,
  active
)
select
  seed.name,
  seed.normalized_name,
  seed.slug,
  country.id as country_id,
  seed.city,
  seed.state_or_region,
  seed.website,
  seed.admissions_url,
  seed.institution_type,
  seed.popularity_score,
  true
from (values
  ('University of Oxford', 'university of oxford', 'university-of-oxford', 'GB', 'Oxford', 'Oxfordshire', 'https://www.ox.ac.uk', 'https://www.ox.ac.uk/admissions', 'PUBLIC', 99),
  ('University of Cambridge', 'university of cambridge', 'university-of-cambridge', 'GB', 'Cambridge', 'Cambridgeshire', 'https://www.cam.ac.uk', 'https://www.undergraduate.study.cam.ac.uk', 'PUBLIC', 98),
  ('Imperial College London', 'imperial college london', 'imperial-college-london', 'GB', 'London', 'Greater London', 'https://www.imperial.ac.uk', 'https://www.imperial.ac.uk/study', 'PUBLIC', 94),
  ('University College London', 'university college london', 'university-college-london', 'GB', 'London', 'Greater London', 'https://www.ucl.ac.uk', 'https://www.ucl.ac.uk/prospective-students', 'PUBLIC', 95),
  ('London School of Economics and Political Science', 'london school of economics and political science', 'london-school-of-economics-and-political-science', 'GB', 'London', 'Greater London', 'https://www.lse.ac.uk', 'https://www.lse.ac.uk/study-at-lse', 'PUBLIC', 93),
  ('London Business School', 'london business school', 'london-business-school', 'GB', 'London', 'Greater London', 'https://www.london.edu', 'https://www.london.edu/masters-degrees', 'PUBLIC', 91),
  ('Massachusetts Institute of Technology', 'massachusetts institute of technology', 'massachusetts-institute-of-technology', 'US', 'Cambridge', 'MA', 'https://www.mit.edu', 'https://mitadmissions.org', 'PRIVATE', 100),
  ('Harvard University', 'harvard university', 'harvard-university', 'US', 'Cambridge', 'MA', 'https://www.harvard.edu', 'https://college.harvard.edu/admissions', 'PRIVATE', 99),
  ('Stanford University', 'stanford university', 'stanford-university', 'US', 'Stanford', 'CA', 'https://www.stanford.edu', 'https://admission.stanford.edu', 'PRIVATE', 99),
  ('University of Toronto', 'university of toronto', 'university-of-toronto', 'CA', 'Toronto', 'Ontario', 'https://www.utoronto.ca', 'https://future.utoronto.ca', 'PUBLIC', 96),
  ('University of British Columbia', 'university of british columbia', 'university-of-british-columbia', 'CA', 'Vancouver', 'British Columbia', 'https://www.ubc.ca', 'https://you.ubc.ca', 'PUBLIC', 93),
  ('EPFL', 'epfl', 'epfl', 'CH', 'Lausanne', 'Vaud', 'https://www.epfl.ch', 'https://www.epfl.ch/education/admission', 'PUBLIC', 94),
  ('Technical University of Munich', 'technical university of munich', 'technical-university-of-munich', 'DE', 'Munich', 'Bavaria', 'https://www.tum.de', 'https://www.tum.de/en/studies/applying', 'PUBLIC', 95),
  ('Bocconi University', 'bocconi university', 'bocconi-university', 'IT', 'Milan', 'Lombardy', 'https://www.unibocconi.it', 'https://www.unibocconi.it/admissions', 'PRIVATE', 90),
  ('University of Bologna', 'university of bologna', 'university-of-bologna', 'IT', 'Bologna', 'Emilia-Romagna', 'https://www.unibo.it', 'https://www.unibo.it/en/admissions', 'PUBLIC', 85),
  ('University of Milan', 'university of milan', 'university-of-milan', 'IT', 'Milan', 'Lombardy', 'https://www.unimi.it', 'https://www.unimi.it/en/study', 'PUBLIC', 82),
  ('Sapienza University of Rome', 'sapienza university of rome', 'sapienza-university-of-rome', 'IT', 'Rome', 'Lazio', 'https://www.uniroma1.it', 'https://www.uniroma1.it/en/admissions', 'PUBLIC', 80),
  ('ETH Zurich', 'eth zurich', 'eth-zurich', 'CH', 'Zurich', 'Zurich', 'https://ethz.ch', 'https://ethz.ch/en/studies.html', 'PUBLIC', 93),
  ('Delft University of Technology', 'delft university of technology', 'tu-delft', 'NL', 'Delft', 'South Holland', 'https://www.tudelft.nl', 'https://www.tudelft.nl/en/education/admission-and-application', 'PUBLIC', 88),
  ('INSEAD', 'insead', 'insead', 'FR', 'Fontainebleau', 'Île-de-France', 'https://www.insead.edu', 'https://www.insead.edu/master-programmes', 'PRIVATE', 89)
) as seed(name, normalized_name, slug, country_iso2, city, state_or_region, website, admissions_url, institution_type, popularity_score)
join public.countries as country on country.iso2 = seed.country_iso2
on conflict (slug) do update set
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  country_id = excluded.country_id,
  city = excluded.city,
  state_or_region = excluded.state_or_region,
  website = excluded.website,
  admissions_url = excluded.admissions_url,
  institution_type = excluded.institution_type,
  popularity_score = excluded.popularity_score,
  active = true,
  updated_at = now();

-- 3. Seed Aliases for new & core universities
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
  ('Stanford University', 'Stanford', 'stanford', 200),
  ('Stanford University', 'Stanford University', 'stanford university', 180),
  ('University of Toronto', 'Toronto', 'toronto', 190),
  ('University of Toronto', 'University of Toronto', 'university of toronto', 200),
  ('University of Toronto', 'U of T', 'u of t', 180),
  ('University of Toronto', 'UofT', 'uoft', 180),
  ('University of British Columbia', 'UBC', 'ubc', 200),
  ('University of British Columbia', 'University of British Columbia', 'university of british columbia', 190),
  ('University of British Columbia', 'British Columbia', 'british columbia', 150),
  ('EPFL', 'EPFL', 'epfl', 200),
  ('EPFL', 'École Polytechnique Fédérale de Lausanne', 'ecole polytechnique federale de lausanne', 180),
  ('EPFL', 'Swiss Federal Institute of Technology Lausanne', 'swiss federal institute of technology lausanne', 160),
  ('Technical University of Munich', 'TUM', 'tum', 200),
  ('Technical University of Munich', 'TU Munich', 'tu munich', 200),
  ('Technical University of Munich', 'Technical University of Munich', 'technical university of munich', 190),
  ('Technical University of Munich', 'Technische Universität München', 'technische universitat munchen', 180)
) as curated(canonical_name, alias, normalized_alias, priority)
join public.universities as university
  on university.name = curated.canonical_name and university.active
where not exists (
  select 1 from public.search_aliases existing
  where existing.entity_type = 'UNIVERSITY'
    and existing.entity_id = university.id
    and existing.normalized_alias = curated.normalized_alias
);

-- 4. Update Autocomplete Search RPC to prioritize canonical website over admissions URL
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
    coalesce(university.website, university.admissions_url) as official_url
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
