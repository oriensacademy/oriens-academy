-- Oriens Academy Live Lesson System & Lesson Tracking Migration
-- Supports Live Meeting URLs (Google Meet, Zoom), Lesson History, and Idempotent Lesson Completion.

-- 1. Extend student_lessons table with meeting and completion tracking
alter table public.student_lessons
  add column if not exists live_meeting_url text check (live_meeting_url is null or live_meeting_url ~* '^https?://'),
  add column if not exists meeting_link_sent_at timestamptz,
  add column if not exists completed_at timestamptz;

-- 2. Extend bookings table with meeting URL
alter table public.bookings
  add column if not exists live_meeting_url text check (live_meeting_url is null or live_meeting_url ~* '^https?://'),
  add column if not exists meeting_link_sent_at timestamptz;

create index if not exists idx_student_lessons_status_date
  on public.student_lessons(student_user_id, status, lesson_date desc);

-- 3. RPC: admin_upsert_student_lesson
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

-- 4. RPC: admin_complete_student_lesson (Idempotent completion & safe package deduction)
create or replace function public.admin_complete_student_lesson(
  p_lesson_id uuid,
  p_package_purchase_id uuid default null,
  p_teacher_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson public.student_lessons%rowtype;
  v_purchase public.student_package_purchases%rowtype;
  v_profile public.student_profiles%rowtype;
  v_package_title text;
  v_lessons_remaining integer;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select * into v_lesson from public.student_lessons where id = p_lesson_id for update;
  if v_lesson.id is null then
    return jsonb_build_object('success', false, 'error_code', 'LESSON_NOT_FOUND');
  end if;

  select * into v_profile from public.student_profiles where id = v_lesson.student_user_id;

  -- If lesson is already completed, return idempotent response without re-deducting
  if v_lesson.status = 'completed' then
    if v_lesson.package_purchase_id is not null then
      select * into v_purchase from public.student_package_purchases where id = v_lesson.package_purchase_id;
      v_lessons_remaining := greatest(0, coalesce(v_purchase.lesson_count, 0) - coalesce(v_purchase.lessons_used, 0));
    else
      v_lessons_remaining := 0;
    end if;

    return jsonb_build_object(
      'success', true,
      'already_completed', true,
      'lesson_id', v_lesson.id,
      'student_name', v_profile.full_name,
      'student_email', v_profile.email,
      'preferred_language', coalesce(v_profile.preferred_language, 'tr'),
      'remaining_lessons', v_lessons_remaining,
      'total_lessons', coalesce(v_purchase.lesson_count, 0),
      'is_package_completed', coalesce(v_purchase.status, '') = 'completed'
    );
  end if;

  -- Determine package purchase
  if p_package_purchase_id is not null then
    select * into v_purchase from public.student_package_purchases
      where id = p_package_purchase_id and student_user_id = v_lesson.student_user_id
      for update;
    if v_purchase.id is null then
      return jsonb_build_object('success', false, 'error_code', 'PACKAGE_NOT_FOUND');
    end if;
  elsif v_lesson.package_purchase_id is not null then
    select * into v_purchase from public.student_package_purchases
      where id = v_lesson.package_purchase_id
      for update;
  else
    -- Try to find active package for student
    select * into v_purchase from public.student_package_purchases
      where student_user_id = v_lesson.student_user_id and status = 'active' and lessons_used < lesson_count
      order by created_at desc limit 1
      for update;
  end if;

  -- Update lesson to completed
  update public.student_lessons
  set
    status = 'completed',
    package_purchase_id = coalesce(v_purchase.id, package_purchase_id),
    teacher_note = coalesce(nullif(btrim(p_teacher_note), ''), teacher_note),
    completed_at = now()
  where id = p_lesson_id;

  -- If attached to booking, mark booking completed as well
  if v_lesson.booking_id is not null then
    update public.bookings set status = 'completed', updated_at = now() where id = v_lesson.booking_id;
  end if;

  -- Refetch updated purchase to get accurate balance after trigger execution
  if v_purchase.id is not null then
    select * into v_purchase from public.student_package_purchases where id = v_purchase.id;
    select coalesce(name_tr, name_en, v_purchase.package_id) into v_package_title
      from public.pricing_packages where id = v_purchase.package_id;
    v_lessons_remaining := greatest(0, coalesce(v_purchase.lesson_count, 0) - coalesce(v_purchase.lessons_used, 0));
  else
    v_package_title := 'Birebir Ders';
    v_lessons_remaining := 0;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'lesson.completed', 'student_lesson', p_lesson_id::text,
    jsonb_build_object(
      'student_user_id', v_lesson.student_user_id,
      'package_purchase_id', v_purchase.id,
      'lesson_title', v_lesson.title,
      'remaining_lessons', v_lessons_remaining
    )
  );

  return jsonb_build_object(
    'success', true,
    'already_completed', false,
    'lesson_id', p_lesson_id,
    'student_name', v_profile.full_name,
    'student_email', v_profile.email,
    'preferred_language', coalesce(v_profile.preferred_language, 'tr'),
    'lesson_title', v_lesson.title,
    'lesson_date', v_lesson.lesson_date,
    'package_name', coalesce(v_package_title, 'Birebir Ders Paketi'),
    'remaining_lessons', v_lessons_remaining,
    'total_lessons', coalesce(v_purchase.lesson_count, 0),
    'is_package_completed', coalesce(v_purchase.status, '') = 'completed'
  );
end;
$$;

-- 5. RPC: admin_update_lesson_meeting_url
create or replace function public.admin_update_lesson_meeting_url(
  p_lesson_id uuid,
  p_live_meeting_url text,
  p_mark_sent boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  v_url := nullif(btrim(p_live_meeting_url), '');
  if v_url is not null and v_url !~* '^https?://' then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_URL_SCHEME');
  end if;

  update public.student_lessons
  set
    live_meeting_url = v_url,
    meeting_link_sent_at = case when p_mark_sent then now() else meeting_link_sent_at end
  where id = p_lesson_id;

  if not found then
    return jsonb_build_object('success', false, 'error_code', 'LESSON_NOT_FOUND');
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'lesson.meeting_url_updated', 'student_lesson', p_lesson_id::text,
    jsonb_build_object('has_url', v_url is not null, 'marked_sent', p_mark_sent)
  );

  return jsonb_build_object('success', true);
end;
$$;

-- 6. RPC: admin_cancel_student_lesson
create or replace function public.admin_cancel_student_lesson(
  p_lesson_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  update public.student_lessons
  set
    status = 'cancelled',
    teacher_note = case
      when nullif(btrim(p_reason), '') is not null then
        left(concat_ws(' | İptal: ', teacher_note, btrim(p_reason)), 500)
      else teacher_note
    end
  where id = p_lesson_id
  returning student_user_id into v_student_id;

  if not found then
    return jsonb_build_object('success', false, 'error_code', 'LESSON_NOT_FOUND');
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'lesson.cancelled', 'student_lesson', p_lesson_id::text,
    jsonb_build_object('student_user_id', v_student_id, 'reason', p_reason)
  );

  return jsonb_build_object('success', true);
end;
$$;

-- 7. Revoke & Grants
revoke all on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text) from public, anon;
revoke all on function public.admin_complete_student_lesson(uuid,uuid,text) from public, anon;
revoke all on function public.admin_update_lesson_meeting_url(uuid,text,boolean) from public, anon;
revoke all on function public.admin_cancel_student_lesson(uuid,text) from public, anon;

grant execute on function public.admin_upsert_student_lesson(uuid,uuid,uuid,text,text,text,timestamptz,integer,text,text,text) to authenticated;
grant execute on function public.admin_complete_student_lesson(uuid,uuid,text) to authenticated;
grant execute on function public.admin_update_lesson_meeting_url(uuid,text,boolean) to authenticated;
grant execute on function public.admin_cancel_student_lesson(uuid,text) to authenticated;
