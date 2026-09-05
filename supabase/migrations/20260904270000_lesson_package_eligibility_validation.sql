-- Migration: 20260904270000_lesson_package_eligibility_validation.sql
-- Forensic audit item 1 (LESSON PLANNING — PACKAGE ELIGIBILITY).
--
-- admin_upsert_student_lesson currently only checks that a given
-- p_package_purchase_id exists and belongs to the student -- it does not
-- check the package's own status or remaining lesson rights. That let a
-- lesson be scheduled against a completed/expired/refunded/refund_pending
-- package, or one with zero lessons remaining. UI-side filtering is not a
-- substitute for a server-side invariant (the RPC is the actual trust
-- boundary), so this is enforced here.
--
-- Scope: the new eligibility check applies only when scheduling a lesson
-- (p_status = 'scheduled'), which is the actual "planning" action the audit
-- describes. Administrative status corrections (marking an existing lesson
-- cancelled/no_show) are left alone -- those don't consume a new lesson
-- right and must keep working even if the package has since become
-- inactive/exhausted.

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
