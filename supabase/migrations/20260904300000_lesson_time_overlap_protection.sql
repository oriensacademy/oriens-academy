-- Migration: 20260904300000_lesson_time_overlap_protection.sql
-- Forensic audit item 4 (LESSON TIME OVERLAP PROTECTION).
--
-- Nothing currently stops two overlapping lessons from being scheduled for
-- the same student (e.g. 10:00-11:00 and 10:30-11:30). A UNIQUE constraint
-- on (student_user_id, lesson_date) alone wouldn't catch that -- this uses a
-- real interval overlap check via a PostgreSQL GiST exclusion constraint, so
-- it holds even under concurrent inserts (unlike an application-level
-- check-then-insert, which has a race window). Scoped to status='scheduled'
-- only, so cancelled/no_show lessons never block new scheduling, and a
-- reschedule/update is compared against *other* rows only (an EXCLUDE
-- constraint, like UNIQUE, never conflicts with the row's own previous
-- version during an UPDATE).

create extension if not exists btree_gist;

-- Preflight (read-only): report any pair of currently-scheduled lessons for
-- the same student that already overlap. If this returns rows, the
-- exclusion constraint below will fail to apply and those conflicts need to
-- be resolved (reschedule/cancel one of each pair) before re-running this
-- migration -- it intentionally does not auto-cancel or modify any existing
-- data.
do $$
declare
  v_conflict_count integer;
begin
  select count(*) into v_conflict_count
  from public.student_lessons a
  join public.student_lessons b
    on a.student_user_id = b.student_user_id
    and a.id < b.id
    and a.status = 'scheduled'
    and b.status = 'scheduled'
    and tstzrange(a.lesson_date, a.lesson_date + make_interval(mins => a.duration_minutes), '[)')
        && tstzrange(b.lesson_date, b.lesson_date + make_interval(mins => b.duration_minutes), '[)');

  if v_conflict_count > 0 then
    raise notice 'PREFLIGHT: % existing overlapping scheduled-lesson pair(s) found. The exclusion constraint below will fail to add until these are resolved manually (this migration does not modify existing rows).', v_conflict_count;
  else
    raise notice 'PREFLIGHT: no existing overlapping scheduled lessons found -- safe to add the exclusion constraint.';
  end if;
end;
$$;

-- Note: a GENERATED ALWAYS AS ... STORED column cannot be used here --
-- Postgres marks timestamptz + interval as STABLE (timezone-dependent
-- calendar arithmetic), not IMMUTABLE, which generated-column expressions
-- require. Same restriction applies to a GiST index on the raw expression.
-- Instead, use a plain stored column maintained by a BEFORE trigger, which
-- has no such restriction (triggers may be VOLATILE).
alter table public.student_lessons
  add column if not exists lesson_range tstzrange;

create or replace function public.student_lessons_set_range()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.lesson_range := tstzrange(new.lesson_date, new.lesson_date + make_interval(mins => new.duration_minutes), '[)');
  return new;
end;
$$;

drop trigger if exists trg_student_lessons_set_range on public.student_lessons;
create trigger trg_student_lessons_set_range
  before insert or update on public.student_lessons
  for each row execute function public.student_lessons_set_range();

-- Backfill existing rows (the trigger only fires on future writes).
update public.student_lessons
set lesson_range = tstzrange(lesson_date, lesson_date + make_interval(mins => duration_minutes), '[)')
where lesson_range is null;

alter table public.student_lessons drop constraint if exists student_lessons_no_time_overlap;
alter table public.student_lessons
  add constraint student_lessons_no_time_overlap
  exclude using gist (
    student_user_id with =,
    lesson_range with &&
  ) where (status = 'scheduled');

comment on constraint student_lessons_no_time_overlap on public.student_lessons is
  'Prevents two scheduled lessons with overlapping time ranges for the same student, enforced at the DB level (holds under concurrency). Cancelled/no_show/completed lessons are excluded. See forensic audit item 4.';

-- admin_upsert_student_lesson: convert the raw exclusion-constraint violation
-- (SQLSTATE 23P01) into the same jsonb error-code shape as every other
-- validation failure in this function, instead of letting a bare Postgres
-- error reach the frontend.
create or replace function public.admin_upsert_student_lesson(
  p_student_id uuid,
  p_lesson_id uuid default null,
  p_package_purchase_id uuid default null,
  p_title text default 'Birebir Canlı Ders',
  p_subject text default 'Akademik Danışmanlık',
  p_exam_code text default null,
  p_lesson_date timestamptz default now(),
  p_duration_minutes integer default 60,
  p_live_meeting_url text default null,
  p_teacher_note text default null,
  p_status text default 'scheduled'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson_id uuid;
  v_action text;
  v_url text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if nullif(btrim(p_title), '') is null or nullif(btrim(p_subject), '') is null then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_TITLE_OR_SUBJECT');
  end if;

  if p_duration_minutes < 1 or p_duration_minutes > 600 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_DURATION');
  end if;

  if p_status not in ('scheduled', 'completed', 'cancelled', 'no_show') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS');
  end if;

  v_url := nullif(btrim(p_live_meeting_url), '');
  if v_url is not null and v_url !~* '^https?://' then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_URL_SCHEME');
  end if;

  perform 1 from public.student_profiles where id = p_student_id;
  if not found then
    return jsonb_build_object('success', false, 'error_code', 'STUDENT_NOT_FOUND');
  end if;

  if p_package_purchase_id is not null then
    perform 1 from public.student_package_purchases
      where id = p_package_purchase_id and student_user_id = p_student_id;
    if not found then
      return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND');
    end if;

    if p_status = 'scheduled' then
      perform 1 from public.student_package_purchases
        where id = p_package_purchase_id
          and student_user_id = p_student_id
          and status = 'active'
          and lesson_count > lessons_used;
      if not found then
        return jsonb_build_object('success', false, 'error_code', 'PACKAGE_INACTIVE_OR_EXHAUSTED');
      end if;
    end if;
  end if;

  begin
    if p_lesson_id is not null then
      update public.student_lessons
      set
        package_purchase_id = p_package_purchase_id,
        title = left(btrim(p_title), 160),
        subject = left(btrim(p_subject), 160),
        exam_code = left(nullif(btrim(p_exam_code), ''), 80),
        lesson_date = p_lesson_date,
        duration_minutes = p_duration_minutes,
        live_meeting_url = v_url,
        teacher_note = nullif(btrim(p_teacher_note), ''),
        status = p_status,
        completed_at = case when p_status = 'completed' and completed_at is null then now() else completed_at end
      where id = p_lesson_id and student_user_id = p_student_id
      returning id into v_lesson_id;

      if v_lesson_id is null then
        return jsonb_build_object('success', false, 'error_code', 'LESSON_NOT_FOUND');
      end if;
      v_action := 'lesson.updated';
    else
      insert into public.student_lessons (
        student_user_id, package_purchase_id, title, subject, exam_code,
        lesson_date, duration_minutes, live_meeting_url, teacher_note, status,
        completed_at
      ) values (
        p_student_id, p_package_purchase_id, left(btrim(p_title), 160), left(btrim(p_subject), 160),
        left(nullif(btrim(p_exam_code), ''), 80), p_lesson_date, p_duration_minutes, v_url,
        nullif(btrim(p_teacher_note), ''), p_status,
        case when p_status = 'completed' then now() else null end
      ) returning id into v_lesson_id;
      v_action := 'lesson.created';
    end if;
  exception
    when exclusion_violation then
      return jsonb_build_object('success', false, 'error_code', 'LESSON_TIME_OVERLAP');
  end;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), v_action, 'student_lesson', v_lesson_id::text,
    jsonb_build_object(
      'student_user_id', p_student_id,
      'title', p_title,
      'lesson_date', p_lesson_date,
      'has_meeting_url', v_url is not null,
      'status', p_status
    )
  );

  return jsonb_build_object(
    'success', true,
    'lesson_id', v_lesson_id,
    'action', v_action
  );
end;
$$;

revoke all on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text) from public, anon;
grant execute on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text) to authenticated;
