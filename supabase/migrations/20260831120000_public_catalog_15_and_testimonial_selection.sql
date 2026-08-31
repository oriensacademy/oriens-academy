-- Forward-only public catalog and testimonial editorial selection transition.
-- Historical exams, questions, attempts, preferences and testimonial rows are retained.

do $$
declare
  v_public_exams integer;
  v_public_questions integer;
  v_targeted_testimonials integer;
begin
  select count(*) into v_public_exams
  from public.exams
  where active and supported_public;

  select count(*) into v_public_questions
  from public.exam_practice_questions q
  join public.exams e on e.id = q.exam_id
  where q.active and e.active and e.supported_public;

  if v_public_exams <> 18 or v_public_questions <> 108 then
    raise exception 'Unexpected catalog baseline: % public exams / % public questions (expected 18 / 108)', v_public_exams, v_public_questions;
  end if;

  select count(*) into v_targeted_testimonials
  from public.testimonials
  where source_hash in (
    '8cd6bb5f583f4a142164110e54b02087cff9705b92b1f07ef991080333a86209',
    '726ef8b6076fe9caecada6b975d9c4ad0d2bb1b2c5179010460bd85c0c888308',
    '9bac00063b83476c05565cb6e2509014b21d1d489ef30167d6d7268aab242dae',
    'e5ec44467f8dfd2af1a1dae1683491373f4e1dee346a09d67e254c0e5c8fa01c',
    '8ad9a08be5c7df18da0d9f5932c454ea9ffe9e9f0d1c66802fd277c5df30c1ba'
  );
  if v_targeted_testimonials <> 5 then
    raise exception 'Expected five exact Doğuhan-associated testimonial source rows, found %', v_targeted_testimonials;
  end if;
end $$;

-- Move every row out of the unique display-order range before assigning the
-- canonical 1..15 order. Removed records remain active for history but are
-- explicitly unsupported in the current public catalog.
update public.exams set display_order = display_order + 100, updated_at = now();

update public.exams
set supported_public = false, updated_at = now()
where code in ('LNAT', 'GAMSAT', 'LSAT');

update public.exams e
set supported_public = true, active = true, display_order = kept.display_order, updated_at = now()
from (values
  ('IB',1::smallint),('AP',2::smallint),('IGCSE',3::smallint),('A-Level',4::smallint),('SAT',5::smallint),
  ('ACT',6::smallint),('ESAT',7::smallint),('TMUA',8::smallint),('TARA',9::smallint),('UCAT',10::smallint),
  ('IMAT',11::smallint),('MCAT',12::smallint),('GRE',13::smallint),('GMAT',14::smallint),('OMPT',15::smallint)
) as kept(code, display_order)
where e.code = kept.code;

update public.exam_practice_questions q
set active = false, updated_at = now()
from public.exams e
where q.exam_id = e.id and e.code in ('LNAT', 'LSAT', 'GAMSAT') and q.active;

update public.qualifications
set active = false, supported_public = false, updated_at = now()
where upper(code) in ('LNAT', 'LSAT', 'GAMSAT');

update public.testimonials
set featured = false, updated_at = now()
where source_hash in (
  '8cd6bb5f583f4a142164110e54b02087cff9705b92b1f07ef991080333a86209',
  '726ef8b6076fe9caecada6b975d9c4ad0d2bb1b2c5179010460bd85c0c888308',
  '9bac00063b83476c05565cb6e2509014b21d1d489ef30167d6d7268aab242dae',
  'e5ec44467f8dfd2af1a1dae1683491373f4e1dee346a09d67e254c0e5c8fa01c',
  '8ad9a08be5c7df18da0d9f5932c454ea9ffe9e9f0d1c66802fd277c5df30c1ba'
);

create or replace function public.enforce_public_testimonial_featured_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if new.featured and new.active and new.verified and new.archived_at is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public_testimonial_featured_cap'));
    select count(*) into v_count
    from public.testimonials t
    where t.featured and t.active and t.verified and t.archived_at is null
      and t.id <> new.id;
    if v_count >= 20 then
      raise exception using errcode = 'P0001', message = 'PUBLIC_TESTIMONIAL_FEATURED_LIMIT_20';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_public_testimonial_featured_cap on public.testimonials;
create trigger trg_enforce_public_testimonial_featured_cap
  before insert or update of featured, active, verified, archived_at on public.testimonials
  for each row execute function public.enforce_public_testimonial_featured_cap();

create or replace function public.set_testimonial_featured(p_testimonial_id uuid, p_featured boolean)
returns public.testimonials
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.testimonials;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public_testimonial_featured_cap'));
  update public.testimonials
  set featured = p_featured, updated_by = auth.uid(), updated_at = now()
  where id = p_testimonial_id
  returning * into v_row;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'TESTIMONIAL_NOT_FOUND';
  end if;
  return v_row;
end;
$$;

revoke all on function public.set_testimonial_featured(uuid, boolean) from public, anon;
grant execute on function public.set_testimonial_featured(uuid, boolean) to authenticated, service_role;

drop policy if exists "Public active and verified testimonials policy" on public.testimonials;
create policy "Public featured testimonials policy"
  on public.testimonials for select
  using (active = true and verified = true and archived_at is null and featured = true);

create index if not exists idx_testimonials_public_featured_order
  on public.testimonials (pin_order, pinned_at desc, display_order, created_at, id)
  where active = true and verified = true and archived_at is null and featured = true;

do $$
declare
  v_public_exams integer;
  v_public_questions integer;
  v_wrong_distribution integer;
begin
  select count(*) into v_public_exams from public.exams where active and supported_public;
  select count(*) into v_public_questions
  from public.exam_practice_questions q join public.exams e on e.id = q.exam_id
  where q.active and e.active and e.supported_public;
  select count(*) into v_wrong_distribution from (
    select e.id from public.exams e left join public.exam_practice_questions q on q.exam_id=e.id and q.active
    where e.active and e.supported_public group by e.id having count(q.id) <> 6
  ) distribution;
  if v_public_exams <> 15 or v_public_questions <> 90 or v_wrong_distribution <> 0 then
    raise exception 'Catalog transition validation failed: exams %, questions %, wrong distributions %', v_public_exams, v_public_questions, v_wrong_distribution;
  end if;
end $$;
