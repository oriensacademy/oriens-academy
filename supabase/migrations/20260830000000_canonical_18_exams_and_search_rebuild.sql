-- Migration: 20260830000000_canonical_18_exams_and_search_rebuild.sql
-- Description: Canonical 18-Exam Catalog, UKCAT -> UCAT Normalization, 2-Category Architecture, and 5-Tier Autocomplete Search RPC Rebuild.

-- 1. Ensure fuzzystrmatch and pg_trgm extensions exist
create extension if not exists fuzzystrmatch;
create extension if not exists pg_trgm;

-- 2. Update Qualifications Category Check Constraint to support canonical categories
alter table public.qualifications drop constraint if exists qualifications_category_check;
alter table public.qualifications add constraint qualifications_category_check check (category in (
  'INTERNATIONAL_CURRICULUM',
  'ADMISSION_SPECIFIC',
  'DIPLOMA',
  'SECONDARY_QUALIFICATION',
  'SUBJECT_EXAM',
  'ADMISSION_TEST',
  'ENGLISH_LANGUAGE_TEST',
  'GRADUATE_ADMISSION_TEST',
  'PLACEMENT_TEST',
  'NATIONAL_ENTRANCE_EXAM',
  'MEDICAL_ADMISSION_TEST',
  'OTHER'
));

-- 3. Upsert the Canonical 18 Qualifications
insert into public.qualifications (
  code,
  name,
  short_name,
  category,
  description,
  country_scope,
  score_type,
  minimum_possible_score,
  maximum_possible_score,
  official_url,
  active
)
values
  -- CATEGORY 1: INTERNATIONAL CURRICULUM / DIPLOMA (6 exams)
  ('IB', 'International Baccalaureate Diploma Programme', 'IB', 'INTERNATIONAL_CURRICULUM', 'Global pre-university diploma program awarded by the IBO', 'Global', 'GRADE_POINTS', 24, 45, 'https://www.ibo.org', true),
  ('AP', 'Advanced Placement', 'AP', 'INTERNATIONAL_CURRICULUM', 'College Board college-level courses and standardized examinations', 'USA / Global', 'NUMERIC_SCALE', 1, 5, 'https://apstudents.collegeboard.org', true),
  ('IGCSE', 'International General Certificate of Secondary Education', 'IGCSE', 'INTERNATIONAL_CURRICULUM', 'International secondary qualification taken prior to A-Levels / IB', 'UK / Global', 'GRADE_POINTS', 1, 9, 'https://www.cambridgeinternational.org', true),
  ('A-LEVEL', 'GCE Advanced Level', 'A-Level', 'INTERNATIONAL_CURRICULUM', 'UK and international subject-based qualification for university entrance', 'UK / Global', 'GRADE_POINTS', 1, 6, 'https://www.cambridgeinternational.org', true),
  ('SAT', 'SAT Reasoning Test', 'SAT', 'INTERNATIONAL_CURRICULUM', 'Digital standardized admissions exam administered by the College Board', 'USA / Global', 'NUMERIC_SCALE', 400, 1600, 'https://satsuite.collegeboard.org', true),
  ('ACT', 'American College Testing', 'ACT', 'INTERNATIONAL_CURRICULUM', 'Standardized test for college admissions in the United States and globally', 'USA / Global', 'NUMERIC_SCALE', 1, 36, 'https://www.act.org', true),

  -- CATEGORY 2: ADMISSION / PROGRAM-SPECIFIC (12 exams)
  ('ESAT', 'Engineering and Science Admissions Test', 'ESAT', 'ADMISSION_SPECIFIC', 'Admissions test for Engineering and Science degree programs at Cambridge, Imperial, and partner universities', 'UK', 'NUMERIC_SCALE', 1.0, 9.0, 'https://esat-admissions.org.uk', true),
  ('TMUA', 'Test of Mathematics for University Admission', 'TMUA', 'ADMISSION_SPECIFIC', 'Mathematics reasoning test used by Cambridge, Imperial, LSE, Warwick, Durham for CS and Math degrees', 'UK', 'NUMERIC_SCALE', 1.0, 9.0, 'https://www.tmua.org.uk', true),
  ('TARA', 'Architecture Admissions Test (TEST-ARCHED)', 'TARA', 'ADMISSION_SPECIFIC', 'National and institutional admissions test evaluating architectural, spatial, and geometric aptitude', 'Italy / Global', 'NUMERIC_SCALE', 0, 100, 'https://www.cisiaonline.it', true),
  ('UCAT', 'University Clinical Aptitude Test', 'UCAT', 'ADMISSION_SPECIFIC', 'Admissions test used by UK and ANZ medical and dental schools (formerly UKCAT)', 'UK / ANZ', 'NUMERIC_SCALE', 1200, 3600, 'https://www.ucat.ac.uk', true),
  ('LNAT', 'National Admissions Test for Law', 'LNAT', 'ADMISSION_SPECIFIC', 'Admissions aptitude test for undergraduate law programmes in the UK and participating universities', 'UK / Global', 'NUMERIC_SCALE', 0, 42, 'https://lnat.ac.uk', true),
  ('IMAT', 'International Medical Admissions Test', 'IMAT', 'ADMISSION_SPECIFIC', 'Subject-specific admissions test for English-taught Medicine and Surgery courses in Italy', 'Italy', 'NUMERIC_SCALE', 0, 90, 'https://www.universitaly.it', true),
  ('GAMSAT', 'Graduate Medical School Admissions Test', 'GAMSAT', 'ADMISSION_SPECIFIC', 'Graduate-entry admissions test for medical, dental, and veterinary schools in Australia, UK, Ireland', 'Australia / UK / Ireland', 'NUMERIC_SCALE', 0, 100, 'https://gamsat.acer.org', true),
  ('MCAT', 'Medical College Admission Test', 'MCAT', 'ADMISSION_SPECIFIC', 'Standardized multiple-choice exam for medical school admissions in the United States and Canada', 'USA / Canada', 'NUMERIC_SCALE', 472, 528, 'https://students-residents.aamc.org/mcat', true),
  ('LSAT', 'Law School Admission Test', 'LSAT', 'ADMISSION_SPECIFIC', 'Standardized test for law school admissions in the United States, Canada, and select global programs', 'USA / Canada / Global', 'NUMERIC_SCALE', 120, 180, 'https://www.lsac.org/lsat', true),
  ('GRE', 'Graduate Record Examinations', 'GRE', 'ADMISSION_SPECIFIC', 'Standardized test required for entry to graduate and business school programs globally', 'Global', 'NUMERIC_SCALE', 260, 340, 'https://www.ets.org/gre', true),
  ('GMAT', 'Graduate Management Admission Test (Focus Edition)', 'GMAT', 'ADMISSION_SPECIFIC', 'Computer-adaptive test for graduate business and MBA admissions', 'Global', 'NUMERIC_SCALE', 205, 805, 'https://www.mba.com', true),
  ('OMPT', 'Online Math Placement Test', 'OMPT', 'ADMISSION_SPECIFIC', 'Online mathematics entrance test recognized by European universities (OMPT-A through F)', 'Netherlands / Europe', 'NUMERIC_SCALE', 0, 100, 'https://www.omptest.org', true)
on conflict (code) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  category = excluded.category,
  description = excluded.description,
  country_scope = excluded.country_scope,
  score_type = excluded.score_type,
  minimum_possible_score = excluded.minimum_possible_score,
  maximum_possible_score = excluded.maximum_possible_score,
  official_url = excluded.official_url,
  active = true,
  updated_at = now();

-- 4. Normalize legacy UKCAT qualifications row to UCAT if any orphan row exists
update public.search_aliases
set entity_id = (select id from public.qualifications where code = 'UCAT')
where entity_type = 'QUALIFICATION' and normalized_alias in ('ukcat', 'uk cat');

-- 5. Seed Comprehensive Search Aliases for the 18 Exams
insert into public.search_aliases (entity_type, entity_id, alias, normalized_alias, language, priority, source)
select
  'QUALIFICATION',
  q.id,
  curated.alias,
  curated.normalized_alias,
  curated.lang,
  curated.priority,
  'EXPLICIT_OFFICIAL_ALIAS'
from (values
  ('IB', 'IB', 'ib', 'en', 200),
  ('IB', 'IB Diploma', 'ib diploma', 'en', 190),
  ('IB', 'International Baccalaureate', 'international baccalaureate', 'en', 180),
  ('IB', 'IB DP', 'ib dp', 'en', 180),
  ('IB', 'IB Bakalorya', 'ib bakalorya', 'tr', 160),

  ('AP', 'AP', 'ap', 'en', 200),
  ('AP', 'Advanced Placement', 'advanced placement', 'en', 190),
  ('AP', 'AP Exam', 'ap exam', 'en', 180),
  ('AP', 'AP Sınavı', 'ap sinavi', 'tr', 160),

  ('IGCSE', 'IGCSE', 'igcse', 'en', 200),
  ('IGCSE', 'GCSE', 'gcse', 'en', 180),
  ('IGCSE', 'Cambridge IGCSE', 'cambridge igcse', 'en', 180),
  ('IGCSE', 'International GCSE', 'international gcse', 'en', 170),

  ('A-LEVEL', 'A-Level', 'a-level', 'en', 200),
  ('A-LEVEL', 'A Level', 'a level', 'en', 200),
  ('A-LEVEL', 'A Levels', 'a levels', 'en', 190),
  ('A-LEVEL', 'GCE A Level', 'gce a level', 'en', 180),
  ('A-LEVEL', 'Alevel', 'alevel', 'en', 170),

  ('SAT', 'SAT', 'sat', 'en', 200),
  ('SAT', 'Digital SAT', 'digital sat', 'en', 190),
  ('SAT', 'SAT Reasoning Test', 'sat reasoning test', 'en', 180),
  ('SAT', 'SAT Test', 'sat test', 'en', 170),
  ('SAT', 'SAT Sınavı', 'sat sinavi', 'tr', 160),

  ('ACT', 'ACT', 'act', 'en', 200),
  ('ACT', 'ACT Test', 'act test', 'en', 190),
  ('ACT', 'American College Testing', 'american college testing', 'en', 180),

  ('ESAT', 'ESAT', 'esat', 'en', 200),
  ('ESAT', 'Engineering and Science Admissions Test', 'engineering and science admissions test', 'en', 190),
  ('ESAT', 'Cambridge ESAT', 'cambridge esat', 'en', 180),
  ('ESAT', 'Imperial ESAT', 'imperial esat', 'en', 180),

  ('TMUA', 'TMUA', 'tmua', 'en', 200),
  ('TMUA', 'Test of Mathematics for University Admission', 'test of mathematics for university admission', 'en', 190),
  ('TMUA', 'Cambridge TMUA', 'cambridge tmua', 'en', 180),

  ('TARA', 'TARA', 'tara', 'en', 200),
  ('TARA', 'Test Arched', 'test arched', 'en', 190),
  ('TARA', 'Test di Ammissione ad Architettura', 'test di ammissione ad architettura', 'it', 180),
  ('TARA', 'Architecture Admission Test', 'architecture admission test', 'en', 180),
  ('TARA', 'Mimarlık Kabul Sınavı', 'mimarlik kabul sinavi', 'tr', 170),

  ('UCAT', 'UCAT', 'ucat', 'en', 200),
  ('UCAT', 'UKCAT', 'ukcat', 'en', 200), -- Legacy search support
  ('UCAT', 'University Clinical Aptitude Test', 'university clinical aptitude test', 'en', 190),
  ('UCAT', 'UK Clinical Aptitude Test', 'uk clinical aptitude test', 'en', 180),

  ('LNAT', 'LNAT', 'lnat', 'en', 200),
  ('LNAT', 'National Admissions Test for Law', 'national admissions test for law', 'en', 190),
  ('LNAT', 'Law National Aptitude Test', 'law national aptitude test', 'en', 180),
  ('LNAT', 'Hukuk Kabul Sınavı', 'hukuk kabul sinavi', 'tr', 160),

  ('IMAT', 'IMAT', 'imat', 'en', 200),
  ('IMAT', 'International Medical Admissions Test', 'international medical admissions test', 'en', 190),
  ('IMAT', 'Italy Medicine Test', 'italy medicine test', 'en', 180),
  ('IMAT', 'İtalya Tıp Sınavı', 'italya tip sinavi', 'tr', 180),

  ('GAMSAT', 'GAMSAT', 'gamsat', 'en', 200),
  ('GAMSAT', 'Graduate Medical School Admissions Test', 'graduate medical school admissions test', 'en', 190),

  ('MCAT', 'MCAT', 'mcat', 'en', 200),
  ('MCAT', 'Medical College Admission Test', 'medical college admission test', 'en', 190),
  ('MCAT', 'Amerika Tıp Sınavı', 'amerika tip sinavi', 'tr', 160),

  ('LSAT', 'LSAT', 'lsat', 'en', 200),
  ('LSAT', 'Law School Admission Test', 'law school admission test', 'en', 190),

  ('GRE', 'GRE', 'gre', 'en', 200),
  ('GRE', 'Graduate Record Examinations', 'graduate record examinations', 'en', 190),
  ('GRE', 'GRE General Test', 'gre general test', 'en', 180),

  ('GMAT', 'GMAT', 'gmat', 'en', 200),
  ('GMAT', 'GMAT Focus', 'gmat focus', 'en', 190),
  ('GMAT', 'Graduate Management Admission Test', 'graduate management admission test', 'en', 180),
  ('GMAT', 'GMAT Focus Edition', 'gmat focus edition', 'en', 180),

  ('OMPT', 'OMPT', 'ompt', 'en', 200),
  ('OMPT', 'Online Math Placement Test', 'online math placement test', 'en', 190),
  ('OMPT', 'OMPT-A', 'ompt-a', 'en', 180),
  ('OMPT', 'OMPT-B', 'ompt-b', 'en', 180),
  ('OMPT', 'Hollanda Matematik Sınavı', 'hollanda matematik sinavi', 'tr', 160)
) as curated(code, alias, normalized_alias, lang, priority)
join public.qualifications q on q.code = curated.code
on conflict (entity_type, entity_id, normalized_alias) do update set
  alias = excluded.alias,
  language = excluded.language,
  priority = greatest(public.search_aliases.priority, excluded.priority),
  source = excluded.source,
  updated_at = now();

-- 6. Rebuild search_autocomplete_entities RPC with 5-Tier Deterministic Ranking
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
  -- 1. Canonical names
  select
    u.id,
    u.normalized_name as term,
    1 as source_layer,
    0 as alias_priority
  from public.universities u, input
  where u.active
    and (
      u.normalized_name = input.query
      or u.normalized_name like input.query || '%'
      or (length(input.query) >= 3 and public.similarity(u.normalized_name, input.query) >= 0.30)
      or (
        length(input.query) >= 5
        and abs(length(u.normalized_name) - length(input.query)) <= 2
        and public.levenshtein_less_equal(u.normalized_name, input.query, 2) <= 2
      )
    )
  union all
  -- 2. Official and Curated Aliases
  select
    sa.entity_id as id,
    sa.normalized_alias as term,
    2 as source_layer,
    sa.priority as alias_priority
  from public.search_aliases sa, input
  where sa.entity_type = 'UNIVERSITY'
    and sa.entity_id is not null
    and (
      sa.normalized_alias = input.query
      or sa.normalized_alias like input.query || '%'
      or (length(input.query) >= 3 and public.similarity(sa.normalized_alias, input.query) >= 0.30)
      or (
        length(input.query) >= 5
        and abs(length(sa.normalized_alias) - length(input.query)) <= 2
        and public.levenshtein_less_equal(sa.normalized_alias, input.query, 2) <= 2
      )
    )
),
university_scores as (
  select
    c.id,
    case
      when bool_or(c.source_layer = 1 and c.term = input.query) then 1
      when bool_or(c.source_layer = 2 and c.term = input.query) then 2
      when bool_or(c.term like input.query || '%') then 3
      else 4
    end as match_layer,
    max(
      case
        when c.source_layer = 1 and c.term = input.query then 1200
        when c.source_layer = 2 and c.term = input.query then 950 + c.alias_priority
        when c.term like input.query || '%' then 650 + c.alias_priority * 0.5 + (80.0 / (1 + abs(length(c.term) - length(input.query))))
        else 300 + c.alias_priority * 0.2 + greatest(public.similarity(c.term, input.query), 0.01) * 200
      end
    ) as layer_score
  from university_term_candidates c
  cross join input
  group by c.id
),
university_results as (
  select
    u.id as entity_id,
    'UNIVERSITY'::text as entity_type,
    u.name as title,
    coalesce(u.city, '') || case when u.city is not null and co.name is not null then ', ' else '' end || coalesce(co.name, '') as subtitle,
    u.slug,
    us.match_layer,
    us.layer_score + least(coalesce(u.popularity_score, 0), 100) * 0.2 as score,
    co.iso2 as country_iso2,
    co.name as country_name,
    u.institution_type as badge,
    coalesce(u.website, u.admissions_url) as official_url
  from university_scores us
  join public.universities u on u.id = us.id and u.active
  left join public.countries co on co.id = u.country_id and co.active
),
qualification_terms as (
  select
    q.id,
    term.value as term,
    1 as source_layer,
    0 as alias_priority
  from public.qualifications q
  cross join lateral unnest(array[
    lower(q.code),
    lower(q.name),
    lower(q.short_name)
  ]) as term(value)
  where q.active
  union all
  select
    sa.entity_id as id,
    sa.normalized_alias as term,
    2 as source_layer,
    sa.priority as alias_priority
  from public.search_aliases sa
  where sa.entity_type = 'QUALIFICATION' and sa.entity_id is not null
),
qualification_scores as (
  select
    c.id,
    case
      when bool_or(c.source_layer = 1 and c.term = input.query) then 1
      when bool_or(c.source_layer = 2 and c.term = input.query) then 2
      when bool_or(c.term like input.query || '%') then 3
      else 4
    end as match_layer,
    max(
      case
        when c.source_layer = 1 and c.term = input.query then 1300
        when c.source_layer = 2 and c.term = input.query then 1000 + c.alias_priority
        when c.term like input.query || '%' then 700 + (80.0 / (1 + abs(length(c.term) - length(input.query))))
        else 350 + greatest(public.similarity(c.term, input.query), 0.01) * 200
      end
    ) as layer_score
  from qualification_terms c
  cross join input
  where c.term = input.query
    or c.term like input.query || '%'
    or (length(input.query) >= 2 and public.similarity(c.term, input.query) >= 0.35)
    or (
      length(input.query) >= 4
      and abs(length(c.term) - length(input.query)) <= 2
      and public.levenshtein_less_equal(c.term, input.query, 2) <= 2
    )
  group by c.id
),
qualification_results as (
  select
    q.id as entity_id,
    'QUALIFICATION'::text as entity_type,
    q.name || ' (' || q.code || ')' as title,
    replace(q.category, '_', ' ') || ' • ' || coalesce(q.country_scope, 'Global') as subtitle,
    lower(q.code) as slug,
    qs.match_layer,
    qs.layer_score as score,
    null::text as country_iso2,
    null::text as country_name,
    q.code as badge,
    q.official_url as official_url
  from qualification_scores qs
  join public.qualifications q on q.id = qs.id and q.active
),
combined as (
  select * from university_results
  union all
  select * from qualification_results
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

grant execute on function public.search_autocomplete_entities(text, integer) to anon, authenticated, service_role;
