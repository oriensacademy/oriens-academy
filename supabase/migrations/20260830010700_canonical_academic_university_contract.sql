-- Canonical academic/university contract. Additive and backward-compatible.
-- Scope guard: this migration does not touch student, payment, package or lesson rows.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  slug text not null unique,
  canonical_name text not null,
  display_name_tr text not null,
  display_name_en text not null,
  entity_kind text not null check (entity_kind in ('programme_or_qualification', 'admission_test')),
  customer_group smallint not null check (customer_group in (1, 2)),
  purpose text not null,
  category text not null,
  official_body text not null,
  official_url text not null check (official_url ~ '^https://'),
  short_description_tr text not null,
  short_description_en text not null,
  active boolean not null default true,
  supported_public boolean not null default true,
  display_order smallint not null,
  current_spec_version text not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (display_order)
);

create table if not exists public.exam_aliases (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  alias_type text not null check (alias_type in ('acronym', 'legacy', 'variant', 'typo')),
  language text not null default 'und',
  priority integer not null default 50,
  active boolean not null default true,
  valid_from date,
  valid_to date,
  source text not null,
  created_at timestamptz not null default now(),
  unique (exam_id, normalized_alias)
);

create index if not exists idx_exam_aliases_exact on public.exam_aliases (normalized_alias) where active;
create index if not exists idx_exam_aliases_prefix on public.exam_aliases (normalized_alias text_pattern_ops) where active;
create index if not exists idx_exam_aliases_trgm on public.exam_aliases using gin (normalized_alias public.gin_trgm_ops) where active;

create table if not exists public.exam_practice_questions (
  id text primary key,
  exam_id uuid not null references public.exams(id) on delete restrict,
  topic text not null,
  question text not null,
  options jsonb not null check (jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
  correct_answer text not null check (correct_answer in ('a','b','c','d')),
  explanation text not null,
  solution text not null,
  difficulty text not null check (difficulty in ('foundation','intermediate','advanced')),
  source_type text not null check (source_type='ORIENS_ORIGINAL_PRACTICE'),
  active boolean not null default true,
  display_order smallint not null check (display_order between 1 and 6),
  syllabus_version text not null,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, display_order)
);

insert into public.exams (
  code, slug, canonical_name, display_name_tr, display_name_en, entity_kind,
  customer_group, purpose, category, official_body, official_url,
  short_description_tr, short_description_en, active, supported_public,
  display_order, current_spec_version, verified_at
)
values
('IB','ib','International Baccalaureate Diploma Programme (DP)','International Baccalaureate (IB)','International Baccalaureate (IB)','programme_or_qualification',1,'International secondary curriculum and diploma','INTERNATIONAL_CURRICULUM','International Baccalaureate Organization','https://www.ibo.org/programmes/diploma-programme/','IB Diploma Programme için disiplinler arası akademik hazırlık.','Interdisciplinary academic preparation for the IB Diploma Programme.',true,true,1,'DP current at 2026-08-30','2026-08-30'),
('AP','ap','Advanced Placement Program / AP Exams','Advanced Placement (AP)','Advanced Placement (AP)','programme_or_qualification',1,'Advanced secondary curriculum and subject examinations','INTERNATIONAL_CURRICULUM','College Board','https://apstudents.collegeboard.org/','AP dersleri ve konu bazlı sınavlar için akademik hazırlık.','Academic preparation for AP courses and subject examinations.',true,true,2,'AP current at 2026-08-30','2026-08-30'),
('IGCSE','igcse','International General Certificate of Secondary Education','IGCSE','IGCSE','programme_or_qualification',1,'International secondary qualification','INTERNATIONAL_CURRICULUM','Multiple awarding organisations, including Cambridge International Education and Pearson Edexcel','https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/','Farklı sağlayıcıların IGCSE dersleri için konu ve sınav hazırlığı.','Subject and exam preparation for provider-specific IGCSE qualifications.',true,true,3,'Provider-specific specifications current at 2026-08-30','2026-08-30'),
('A-Level','a-level','General Certificate of Education Advanced Level (GCE A level)','A-Level','A-Level','programme_or_qualification',1,'Advanced secondary qualification and curriculum','INTERNATIONAL_CURRICULUM','Multiple awarding organisations and regulators','https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/','A-Level ve sağlayıcıya özgü uluslararası varyantlar için hazırlık.','Preparation for A levels and provider-specific international variants.',true,true,4,'Provider-specific specifications current at 2026-08-30','2026-08-30'),
('SAT','sat','SAT','SAT','SAT','admission_test',1,'Undergraduate university admission test','INTERNATIONAL_CURRICULUM','College Board','https://satsuite.collegeboard.org/sat','Dijital SAT için Reading and Writing ile Math hazırlığı.','Reading and Writing and Math preparation for the digital SAT.',true,true,5,'Digital SAT current at 2026-08-30','2026-08-30'),
('ACT','act','ACT','ACT','ACT','admission_test',1,'Undergraduate university admission test','INTERNATIONAL_CURRICULUM','ACT, Inc.','https://www.act.org/content/act/en/products-and-services/the-act.html','ACT bölümleri için hız, doğruluk ve akademik muhakeme hazırlığı.','Speed, accuracy and academic reasoning preparation for the ACT.',true,true,6,'ACT current at 2026-08-30','2026-08-30'),
('ESAT','esat','Engineering and Science Admissions Test','ESAT','ESAT','admission_test',2,'Programme-specific engineering and science admission test','ADMISSION_SPECIFIC','UAT-UK; delivered by Pearson VUE','https://esat-tmua.ac.uk/about-the-tests/esat/','Programa göre seçilen ESAT modülleri için muhakeme odaklı hazırlık.','Reasoning-led preparation for programme-specific ESAT modules.',true,true,7,'UAT-UK current at 2026-08-30','2026-08-30'),
('TMUA','tmua','Test of Mathematics for University Admission','TMUA','TMUA','admission_test',2,'Programme-specific mathematics admission test','ADMISSION_SPECIFIC','UAT-UK; delivered by Pearson VUE','https://esat-tmua.ac.uk/about-the-tests/tmua/','TMUA için ileri matematiksel düşünme ve muhakeme hazırlığı.','Advanced mathematical thinking and reasoning preparation for TMUA.',true,true,8,'UAT-UK current at 2026-08-30','2026-08-30'),
('TARA','tara','Test of Academic Reasoning for Admissions','TARA','TARA','admission_test',2,'Programme-specific academic reasoning admission test','ADMISSION_SPECIFIC','UAT-UK; delivered by Pearson VUE','https://esat-tmua.ac.uk/about-the-tests/tara/','Critical Thinking, Problem Solving ve Writing Task odaklı TARA hazırlığı.','TARA preparation across Critical Thinking, Problem Solving and the Writing Task.',true,true,9,'UAT-UK format first offered October 2025','2026-08-30'),
('UCAT','ucat','University Clinical Aptitude Test','UCAT','UCAT','admission_test',2,'Medicine and dentistry admission test','ADMISSION_SPECIFIC','UCAT Consortium; delivered by Pearson VUE','https://www.ucat.ac.uk/','UCAT güncel dört alt testi için zaman yönetimi ve muhakeme hazırlığı.','Timing and reasoning preparation for the four current UCAT subtests.',true,true,10,'Four-subtest format current at 2026-08-30','2026-08-30'),
('LNAT','lnat','National Admissions Test for Law','LNAT','LNAT','admission_test',2,'Programme-specific law admission test','ADMISSION_SPECIFIC','LNAT Consortium; delivered by Pearson VUE','https://lnat.ac.uk/','LNAT çoktan seçmeli bölüm ve essay için eleştirel okuma hazırlığı.','Critical reading preparation for the LNAT multiple-choice section and essay.',true,true,11,'LNAT current at 2026-08-30','2026-08-30'),
('IMAT','imat','International Medical Admissions Test (IMAT)','IMAT','IMAT','admission_test',2,'Cycle-specific admission to English-taught medical programmes in Italy','ADMISSION_SPECIFIC','Italian Ministry of University and Research (MUR)','https://www.mur.gov.it/it/atti-e-normativa/decreto-ministeriale-n-1005-del-06-08-2026','İtalya İngilizce tıp programları için döngüye özgü IMAT hazırlığı.','Cycle-aware IMAT preparation for English-taught medical programmes in Italy.',true,true,12,'2026 MUR cycle','2026-08-30'),
('GAMSAT','gamsat','GAMSAT','GAMSAT','GAMSAT','admission_test',2,'Graduate-entry health and medical admission test','ADMISSION_SPECIFIC','Australian Council for Educational Research (ACER)','https://gamsat.acer.org/','GAMSAT için beşerî bilimler, yazılı iletişim ve bilimsel muhakeme hazırlığı.','Humanities, written communication and scientific reasoning preparation for GAMSAT.',true,true,13,'ACER current at 2026-08-30','2026-08-30'),
('MCAT','mcat','Medical College Admission Test','MCAT','MCAT','admission_test',2,'Medical school admission test','ADMISSION_SPECIFIC','Association of American Medical Colleges (AAMC)','https://students-residents.aamc.org/about-mcat-exam/about-mcat-exam','MCAT için bilimsel bilgi, veri yorumlama ve eleştirel analiz hazırlığı.','Scientific knowledge, data interpretation and critical analysis preparation for MCAT.',true,true,14,'AAMC current at 2026-08-30','2026-08-30'),
('LSAT','lsat','Law School Admission Test','LSAT','LSAT','admission_test',2,'Law school admission test','ADMISSION_SPECIFIC','Law School Admission Council (LSAC)','https://www.lsac.org/lsat/about','Güncel LSAT için Logical Reasoning ve Reading Comprehension hazırlığı.','Logical Reasoning and Reading Comprehension preparation for the current LSAT.',true,true,15,'LSAC current at 2026-08-30','2026-08-30'),
('GRE','gre','GRE General Test','GRE General Test','GRE General Test','admission_test',2,'Graduate admission test','ADMISSION_SPECIFIC','Educational Testing Service (ETS)','https://www.ets.org/gre/test-takers/general-test/about.html','GRE General Test için Verbal, Quantitative ve Analytical Writing hazırlığı.','Verbal, Quantitative and Analytical Writing preparation for the GRE General Test.',true,true,16,'GRE General Test current at 2026-08-30','2026-08-30'),
('GMAT','gmat','GMAT Exam','GMAT Exam','GMAT Exam','admission_test',2,'Graduate business admission test','ADMISSION_SPECIFIC','Graduate Management Admission Council (GMAC)','https://www.mba.com/exams/gmat-exam','GMAT Exam için Quantitative, Verbal ve Data Insights hazırlığı.','Quantitative, Verbal and Data Insights preparation for the GMAT Exam.',true,true,17,'GMAT Exam current at 2026-08-30','2026-08-30'),
('OMPT','ompt','Online Mathematics Placement Test','OMPT','OMPT','admission_test',2,'Programme-specific mathematics placement and admission test','ADMISSION_SPECIFIC','SOWISO','https://www.omptest.org/','Programa özgü OMPT varyantları için çevrim içi matematik hazırlığı.','Online mathematics preparation for programme-specific OMPT variants.',true,true,18,'OMPT variants current at 2026-08-30','2026-08-30')
on conflict (code) do update set
  slug=excluded.slug, canonical_name=excluded.canonical_name,
  display_name_tr=excluded.display_name_tr, display_name_en=excluded.display_name_en,
  entity_kind=excluded.entity_kind, customer_group=excluded.customer_group,
  purpose=excluded.purpose, category=excluded.category, official_body=excluded.official_body,
  official_url=excluded.official_url, short_description_tr=excluded.short_description_tr,
  short_description_en=excluded.short_description_en, active=excluded.active,
  supported_public=excluded.supported_public, display_order=excluded.display_order,
  current_spec_version=excluded.current_spec_version, verified_at=excluded.verified_at,
  updated_at=now();

with alias_values(code, alias, alias_type, priority) as (values
  ('IB','IBDP','acronym',90),('IB','IB Diploma','variant',85),('IB','International Baccalaureate','variant',95),
  ('AP','Advanced Placement','variant',95),('AP','AP Exams','variant',85),
  ('IGCSE','International GCSE','variant',90),('IGCSE','Cambridge IGCSE','variant',85),('IGCSE','Edexcel International GCSE','variant',80),
  ('A-Level','A Level','variant',95),('A-Level','ALEVEL','legacy',90),('A-Level','GCE A level','variant',85),
  ('SAT','SAT Reasoning Test','legacy',70),('SAT','Digital SAT','variant',90),
  ('ACT','American College Testing','legacy',65),('ACT','the ACT test','variant',85),
  ('TARA','Test of Academic Reasoning for Admissions','variant',95),
  ('UCAT','UKCAT','legacy',100),
  ('GAMSAT','Graduate Medical School Admissions Test','legacy',75),
  ('GRE','Graduate Record Examinations','legacy',70),('GRE','GRE revised General Test','legacy',65),
  ('GMAT','GMAT Focus Edition','legacy',80),('GMAT','Graduate Management Admission Test','legacy',70),
  ('OMPT','Online Math Placement Test','legacy',80),('OMPT','OMPT-A','variant',75),('OMPT','OMPT-B','variant',75),
  ('OMPT','OMPT-C','variant',75),('OMPT','OMPT-D','variant',75),('OMPT','OMPT-E','variant',75),('OMPT','OMPT-F','variant',75)
)
insert into public.exam_aliases (exam_id, alias, normalized_alias, alias_type, priority, source)
select e.id, a.alias, public.normalize_university_search_text(a.alias), a.alias_type, a.priority,
  'Oriens canonical review 2026-08-30'
from alias_values a join public.exams e on e.code=a.code
on conflict (exam_id, normalized_alias) do update set
  alias=excluded.alias, alias_type=excluded.alias_type, priority=excluded.priority,
  active=true, source=excluded.source;

alter table public.qualifications
  add column if not exists supported_public boolean not null default false,
  add column if not exists canonical_exam_id uuid references public.exams(id) on delete set null,
  add column if not exists deprecated_replaced_by uuid references public.qualifications(id) on delete set null;

update public.qualifications q set
  canonical_exam_id=e.id, supported_public=true,
  name=e.canonical_name, short_name=e.code, official_url=e.official_url
from public.exams e
where (q.code=e.code or (q.code='A-LEVEL' and e.code='A-Level')) and q.code <> 'ALEVEL';

do $$
declare canonical_a_level uuid; duplicate_a_level uuid;
begin
  select id into canonical_a_level from public.qualifications where code='A-LEVEL' order by created_at limit 1;
  select id into duplicate_a_level from public.qualifications where code='ALEVEL' order by created_at limit 1;
  if canonical_a_level is not null and duplicate_a_level is not null then
    update public.admission_requirements set qualification_id=canonical_a_level where qualification_id=duplicate_a_level;
    update public.admission_sources set qualification_id=canonical_a_level where qualification_id=duplicate_a_level;
    update public.qualifications set active=false, supported_public=false,
      deprecated_replaced_by=canonical_a_level,
      canonical_exam_id=(select id from public.exams where code='A-Level')
    where id=duplicate_a_level;
  end if;
end $$;

update public.qualifications q set active=false, supported_public=false
where q.code='UKCAT';

-- No old TARA architecture relationship is allowed to remain publicly usable.
delete from public.admission_fact_cache where exam_code='TARA';

alter table public.universities
  add column if not exists eligibility_status text not null default 'eligible',
  add column if not exists eligibility_reason text,
  add column if not exists eligibility_review_source text,
  add column if not exists eligibility_reviewed_at timestamptz,
  add column if not exists url_verification_status text not null default 'source_provided',
  add column if not exists url_verification_source text,
  add column if not exists url_checked_at timestamptz,
  add column if not exists url_verified_by text;

alter table public.universities drop constraint if exists universities_eligibility_status_check;
alter table public.universities add constraint universities_eligibility_status_check
  check (eligibility_status in ('eligible','ineligible','needs_review'));
alter table public.universities drop constraint if exists universities_url_verification_status_check;
alter table public.universities add constraint universities_url_verification_status_check
  check (url_verification_status in ('unverified','source_provided','verified','rejected','stale'));

update public.universities set
  eligibility_status='ineligible', eligibility_reason='Name indicates a school or training organisation rather than a higher-education institution',
  eligibility_review_source='deterministic eligibility rules v1', eligibility_reviewed_at=now()
where active and normalized_name ~ '(^| )(primary|secondary|elementary|high) school( |$)|(^| )(training centre|training center)( |$)'
   or (active and normalized_name='international baccalaureate');

update public.universities set
  eligibility_status='needs_review', eligibility_reason='Organisation type requires degree-granting review',
  eligibility_review_source='deterministic eligibility rules v1', eligibility_reviewed_at=now()
where active and eligibility_status='eligible'
  and normalized_name ~ '(^| )(seminary|academy|hospital|clinic|publisher|corporation|company)( |$)';

-- A source-provided website is not verification. Only imported official-domain
-- evidence or a reviewed Oriens override can retain the public verified flag.
update public.universities set
  url_verification_status = case
    when featured_override_verified or nullif(source_metadata->>'official_domain_evidence','') is not null then 'verified'
    when website is not null then 'source_provided' else 'unverified' end,
  verified_url = featured_override_verified or nullif(source_metadata->>'official_domain_evidence','') is not null,
  url_verification_source = case when featured_override_verified then 'reviewed Oriens override'
    when nullif(source_metadata->>'official_domain_evidence','') is not null then 'imported official-domain evidence'
    else null end,
  url_checked_at = case when featured_override_verified or nullif(source_metadata->>'official_domain_evidence','') is not null
    then coalesce(verified_at, now()) else null end;

create index if not exists idx_universities_eligible_search
  on public.universities (normalized_name text_pattern_ops)
  where active and eligibility_status='eligible';
create index if not exists idx_universities_eligible_country
  on public.universities (country_id, featured_country_rank)
  where active and eligibility_status='eligible';

create table if not exists public.university_url_verifications (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  candidate_url text not null check (candidate_url ~ '^https://'),
  source text not null,
  retrieved_at timestamptz,
  redirect_chain jsonb not null default '[]',
  final_domain text,
  verification_status text not null check (verification_status in ('unverified','source_provided','verified','rejected','stale')),
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz not null default now(),
  unique (university_id, candidate_url)
);

create table if not exists public.country_featured_universities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  manual_rank smallint check (manual_rank between 1 and 3),
  computed_score numeric,
  score_version text not null default 'ror-open-metadata-v1',
  override_reason text,
  override_actor text,
  override_expiry timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, university_id)
);
create unique index if not exists idx_country_featured_manual_rank
  on public.country_featured_universities(country_id, manual_rank)
  where active and manual_rank is not null;

insert into public.country_featured_universities
  (country_id, university_id, manual_rank, computed_score, score_version, override_reason, override_actor, active)
select u.country_id, u.id,
  case when u.country_display_rank_override between 1 and 3 then u.country_display_rank_override end,
  u.featured_score, 'legacy-featured-score-v1', 'Reviewed legacy featured override', 'migration', true
from public.universities u
where u.active and u.eligibility_status='eligible'
  and (u.featured_override_verified or u.featured_country_rank <= 3)
on conflict (country_id, university_id) do update set
  manual_rank=excluded.manual_rank, computed_score=excluded.computed_score,
  score_version=excluded.score_version, active=true, updated_at=now();

alter table public.university_admission_requirements
  add column if not exists exam_id uuid references public.exams(id) on delete restrict,
  add column if not exists relationship text,
  add column if not exists programme_id text,
  add column if not exists faculty_name text,
  add column if not exists faculty_id text,
  add column if not exists source_retrieved_at timestamptz,
  add column if not exists verification_status text,
  add column if not exists verified_by text,
  add column if not exists supersedes_id uuid references public.university_admission_requirements(id) on delete set null;

update public.university_admission_requirements r set
  exam_id=e.id,
  relationship=case when r.status='not_required' then 'unknown' else r.status end,
  verification_status=case when r.confidence='verified' then 'verified' else 'needs_review' end,
  source_retrieved_at=coalesce(r.verified_at, r.created_at),
  verified_by=coalesce(r.verified_by, 'migration: source-reviewed seed')
from public.exams e where upper(r.exam_code)=upper(e.code);

alter table public.university_admission_requirements
  alter column exam_id set not null,
  alter column relationship set not null,
  alter column verification_status set not null;
alter table public.university_admission_requirements drop constraint if exists university_requirements_relationship_check;
alter table public.university_admission_requirements add constraint university_requirements_relationship_check
  check (relationship in ('required','accepted','recommended','alternative','unknown'));
alter table public.university_admission_requirements drop constraint if exists university_requirements_verification_status_check;
alter table public.university_admission_requirements add constraint university_requirements_verification_status_check
  check (verification_status in ('needs_review','verified','stale','rejected','superseded'));

drop policy if exists "Public verified university requirements" on public.university_admission_requirements;
create policy "Public verified university requirements" on public.university_admission_requirements
  for select using (verification_status='verified' and (expires_at is null or expires_at >= now()));

alter table public.exams enable row level security;
alter table public.exam_aliases enable row level security;
alter table public.exam_practice_questions enable row level security;
alter table public.university_url_verifications enable row level security;
alter table public.country_featured_universities enable row level security;
create policy "Public supported exams" on public.exams for select using (active and supported_public);
create policy "Public active exam aliases" on public.exam_aliases for select using (active);
create policy "Public active practice questions" on public.exam_practice_questions for select using (active);
create policy "Public verified university urls" on public.university_url_verifications for select using (verification_status='verified');
create policy "Public active featured overlay" on public.country_featured_universities for select using (active);
create policy "Admin manages exams" on public.exams for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages exam aliases" on public.exam_aliases for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages practice questions" on public.exam_practice_questions for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages university urls" on public.university_url_verifications for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin manages featured overlay" on public.country_featured_universities for all using (public.is_admin()) with check (public.is_admin());
grant select on public.exams, public.exam_aliases, public.exam_practice_questions, public.university_url_verifications, public.country_featured_universities to anon, authenticated;
grant all on public.exams, public.exam_aliases, public.exam_practice_questions, public.university_url_verifications, public.country_featured_universities to service_role;
revoke insert, update, delete on public.exams, public.exam_aliases, public.exam_practice_questions, public.university_url_verifications, public.country_featured_universities from anon, authenticated;

-- Curated aliases solve high-value city intent without creating a second university catalog.
insert into public.search_aliases (entity_type, entity_id, alias, normalized_alias, language, priority, source)
select 'UNIVERSITY', u.id, v.alias, public.normalize_university_search_text(v.alias), 'en', 100, 'reviewed search intent 2026-08-30'
from (values
  ('University of Cape Town','Cape Town'),
  ('The University of Tokyo','Tokyo')
) v(university_name, alias)
join public.universities u on u.name=v.university_name
on conflict (entity_type, entity_id, normalized_alias) do update set priority=excluded.priority, source=excluded.source;

create or replace function public.search_autocomplete_entities(p_query text, p_limit integer default 5)
returns table (entity_id uuid, entity_type text, title text, subtitle text, slug text,
  match_layer integer, score numeric, country_iso2 text, country_name text, badge text, official_url text)
language sql stable security invoker set search_path=''
as $$
with input as (
  select public.normalize_university_search_text(coalesce(p_query,'')) q,
    greatest(1,least(coalesce(p_limit,5),10)) lim
),
exam_candidates as (
  select e.id, 'QUALIFICATION'::text entity_type, e.display_name_en title,
    e.purpose subtitle, e.slug,
    case when lower(e.code)=i.q or public.normalize_university_search_text(e.canonical_name)=i.q then 1
         when a.normalized_alias=i.q then 2
         when lower(e.code) like i.q||'%' or public.normalize_university_search_text(e.canonical_name) like i.q||'%' then 3
         when a.normalized_alias like i.q||'%' then 4 else 6 end match_layer,
    (2000 + case when lower(e.code)=i.q then 500 else 0 end + coalesce(a.priority,0))::numeric score,
    null::text country_iso2, null::text country_name, 'Supported by Oriens'::text badge, e.official_url
  from input i join public.exams e on e.active and e.supported_public and i.q<>''
  left join public.exam_aliases a on a.exam_id=e.id and a.active and
    (a.normalized_alias=i.q or a.normalized_alias like i.q||'%' or (length(i.q)>=4 and a.normalized_alias operator(public.%) i.q))
  where lower(e.code)=i.q
     or public.normalize_university_search_text(e.canonical_name)=i.q
     or lower(e.code) like i.q||'%'
     or public.normalize_university_search_text(e.canonical_name) like i.q||'%'
     or a.id is not null
  order by match_layer, score desc limit 30
),
university_exact as (
  select u.id, 1 layer, 1600::numeric base from input i join public.universities u
    on u.active and u.eligibility_status='eligible' and u.normalized_name=i.q where i.q<>'' limit 30
),
university_alias_exact as (
  select u.id, 2 layer, (1500+sa.priority)::numeric base from input i
  join public.search_aliases sa on sa.entity_type='UNIVERSITY' and sa.normalized_alias=i.q
  join public.universities u on u.id=sa.entity_id and u.active and u.eligibility_status='eligible'
  where i.q<>'' order by sa.priority desc limit 30
),
university_prefix as (
  select u.id, 3 layer, (1100+least(u.search_priority,200))::numeric base from input i join public.universities u
    on u.active and u.eligibility_status='eligible' and u.normalized_name like i.q||'%' where i.q<>''
  order by u.search_priority desc,u.name limit 40
),
university_alias_prefix as (
  select u.id, 4 layer, (1000+sa.priority)::numeric base from input i
  join public.search_aliases sa on sa.entity_type='UNIVERSITY' and sa.normalized_alias like i.q||'%'
  join public.universities u on u.id=sa.entity_id and u.active and u.eligibility_status='eligible'
  where i.q<>'' order by sa.priority desc limit 40
),
university_token as (
  select u.id, 5 layer, (750+least(u.search_priority,200))::numeric base from input i join public.universities u
    on u.active and u.eligibility_status='eligible' and u.search_document @@ pg_catalog.plainto_tsquery('simple',i.q)
  where length(i.q)>=3 order by u.search_priority desc,u.name limit 40
),
university_fuzzy as (
  select u.id, 6 layer, (500+public.similarity(u.normalized_name,i.q)*300+least(u.search_priority,200))::numeric base
  from input i join public.universities u on u.active and u.eligibility_status='eligible' and u.normalized_name operator(public.%) i.q
  where length(i.q)>=4 order by public.similarity(u.normalized_name,i.q) desc limit 40
),
university_ids as (
  select id,min(layer) layer,max(base) base from (
    select * from university_exact union all select * from university_alias_exact
    union all select * from university_prefix union all select * from university_alias_prefix
    union all select * from university_token union all select * from university_fuzzy
  ) s group by id
),
university_candidates as (
  select u.id,'UNIVERSITY'::text,u.name,concat_ws(' · ',nullif(u.city,''),c.name),u.slug,
    s.layer,(s.base+least(coalesce(u.popularity_score,0),100)*0.2)::numeric,c.iso2,c.name,
    case when cf.manual_rank is not null then 'Featured' end,
    case when u.url_verification_status='verified' then coalesce(u.website,u.admissions_url) end
  from university_ids s join public.universities u on u.id=s.id
  join public.countries c on c.id=u.country_id and c.active
  left join public.country_featured_universities cf on cf.university_id=u.id and cf.active
), combined as (
  select * from exam_candidates union all select * from university_candidates
), ranked as (
  select c.*,row_number() over(partition by c.entity_type order by c.match_layer,c.score desc,c.title) rn from combined c
)
select r.id,r.entity_type,r.title,r.subtitle,r.slug,r.match_layer,r.score,
  r.country_iso2,r.country_name,r.badge,r.official_url
from ranked r cross join input i where r.rn<=i.lim
order by r.match_layer,r.score desc,r.title;
$$;

create or replace function public.get_featured_universities_by_country(p_iso3 text)
returns table (id uuid,name text,city text,country_name text,country_iso2 text,country_iso3 text,
  latitude double precision,longitude double precision,official_url text,admissions_url text,
  verified_at timestamptz,featured_rank integer,requirements jsonb)
language sql stable security invoker set search_path=''
as $$
  select u.id,u.name,u.city,c.name,c.iso2,c.iso3,u.latitude,u.longitude,
    case when u.url_verification_status='verified' then u.website end,
    case when u.url_verification_status='verified' then u.admissions_url end,
    u.verified_at,
    coalesce(cf.manual_rank,row_number() over(order by cf.manual_rank nulls last,
      coalesce(cf.computed_score,u.featured_score,0) desc,u.name,u.id)::integer),
    coalesce((select jsonb_agg(jsonb_build_object(
      'exam',e.code,'relationship',r.relationship,'status',r.relationship,'scope',r.scope,
      'programme_name',r.programme_name,'faculty_name',r.faculty_name,
      'summary_tr',r.summary_tr,'summary_en',r.summary_en,
      'official_source_url',r.official_source_url,'verified_at',r.verified_at,
      'admissions_cycle',r.admissions_cycle) order by e.display_order,r.programme_name)
      from public.university_admission_requirements r join public.exams e on e.id=r.exam_id
      where r.university_id=u.id and r.verification_status='verified'
        and (r.expires_at is null or r.expires_at>=now())), '[]'::jsonb)
  from public.universities u join public.countries c on c.id=u.country_id and c.active
  left join public.country_featured_universities cf on cf.university_id=u.id and cf.country_id=c.id
    and cf.active and (cf.override_expiry is null or cf.override_expiry>=now())
  where u.active and u.eligibility_status='eligible' and c.iso3=upper(trim(p_iso3))
  order by cf.manual_rank nulls last,coalesce(cf.computed_score,u.featured_score,0) desc,u.name,u.id limit 3;
$$;

grant execute on function public.search_autocomplete_entities(text,integer) to anon,authenticated,service_role;
grant execute on function public.get_featured_universities_by_country(text) to anon,authenticated,service_role;

comment on table public.exams is 'Canonical reviewed Oriens supported exam catalog; exactly 18 active public records.';
comment on table public.country_featured_universities is 'Country-scoped discovery overlay. Scores are discovery heuristics, not quality rankings.';
comment on table public.featured_universities is 'DEPRECATED: retained for rollback only; no public production caller should use this duplicate university model.';
