-- Migration: 20260905160000_unify_appointment_completion_into_canonical_path.sql
--
-- Removes the last parallel lesson-completion path.
--
-- public.admin_complete_scheduled_event (last redefined in
-- 20260903150000_account_deletion_reminders_phone_cleanup.sql) is what the admin
-- "Dersi Tamamla (Paketten 1 Ders Düş)" button reaches, via
-- admin_complete_student_appointment. It decremented
-- student_package_purchases.lessons_used with its own inline UPDATE instead of
-- going through public.admin_record_completed_lesson, which means for that path:
--
--   * no student_package_adjustments ledger row was written,
--   * no audit_logs 'lesson.completed' entry was written,
--   * no student_lessons row was created for a booking-based lesson,
--   * MAIL-040 (remaining lesson rights) never fired,
--   * and since 20260904280000 added the completion-bypass trigger, its
--     student_lessons branch would now be rejected outright with
--     LESSON_COMPLETION_BYPASS_BLOCKED.
--
-- Both functions are re-created as thin delegations to the canonical path, so
-- admin_record_completed_lesson is the single producer of lesson completion,
-- ledger movement, audit entries and MAIL-040.

-- ==============================================================================
-- 1. APPOINTMENT COMPLETION -> CANONICAL COMPLETION
-- ==============================================================================

create or replace function public.admin_complete_student_appointment(
  p_booking_id uuid,
  p_package_purchase_id uuid default null,
  p_title text default null,
  p_subject text default null,
  p_exam_code text default null,
  p_duration_minutes integer default 60,
  p_teacher_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_booking public.bookings%rowtype;
  v_slot public.availability_slots%rowtype;
  v_purchase_id uuid;
  v_lesson_date timestamptz;
  v_duration integer;
  v_title text;
  v_subject text;
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    return jsonb_build_object('success', false, 'error_code', 'EVENT_NOT_FOUND');
  end if;
  if v_booking.status = 'completed' then
    return jsonb_build_object('success', true, 'already_completed', true, 'booking_id', v_booking.id);
  end if;

  -- Only an actual lesson consumes a lesson right; consultations/discovery calls
  -- are simply closed out.
  if coalesce(v_booking.event_type, 'other') <> 'lesson' or v_booking.student_user_id is null then
    update public.bookings set status = 'completed', updated_at = now() where id = v_booking.id;
    return jsonb_build_object('success', true, 'already_completed', false, 'booking_id', v_booking.id,
      'event_type', coalesce(v_booking.event_type, 'other'), 'package_consumed', false);
  end if;

  v_purchase_id := p_package_purchase_id;
  if v_purchase_id is null then
    select id into v_purchase_id
    from public.student_package_purchases
    where student_user_id = v_booking.student_user_id
      and status = 'active' and (lesson_count - lessons_used) > 0
    order by created_at asc, id asc
    limit 1;
  end if;

  -- No usable package: preserve the existing "completed without consuming a
  -- lesson right" behaviour rather than blocking the admin.
  if v_purchase_id is null then
    update public.bookings set status = 'completed', updated_at = now() where id = v_booking.id;
    return jsonb_build_object('success', true, 'already_completed', false, 'booking_id', v_booking.id,
      'event_type', 'lesson', 'package_consumed', false, 'error_code', null);
  end if;

  select * into v_slot from public.availability_slots where id = v_booking.slot_id;
  v_lesson_date := coalesce(v_slot.starts_at, v_booking.created_at);
  v_duration := case
    when v_slot.starts_at is not null and v_slot.ends_at is not null
      then greatest(1, least(600, (extract(epoch from (v_slot.ends_at - v_slot.starts_at)) / 60)::integer))
    else greatest(1, least(600, coalesce(p_duration_minutes, 60)))
  end;
  v_title := left(nullif(btrim(coalesce(p_title, v_booking.appointment_subject, 'Birebir Canlı Ders')), ''), 160);
  v_subject := left(nullif(btrim(coalesce(
    p_subject, p_exam_code, v_booking.exam_code, v_booking.custom_exam, 'Genel akademik çalışma')), ''), 160);

  -- Canonical path: creates the completed student_lessons row, decrements the
  -- package, writes the adjustment ledger row + audit entry, and enqueues MAIL-040.
  v_result := public.admin_record_completed_lesson(
    v_booking.student_user_id, v_lesson_date, v_duration, v_title, v_subject,
    p_teacher_note, v_purchase_id, null, 'scheduled', 'booking:' || p_booking_id::text, false
  );

  if coalesce((v_result ->> 'success')::boolean, false) is not true then
    return v_result;
  end if;

  update public.bookings set status = 'completed', updated_at = now() where id = v_booking.id;

  return v_result
    || jsonb_build_object('booking_id', v_booking.id, 'event_type', 'lesson', 'package_consumed', true);
end;
$fn$;

revoke all on function public.admin_complete_student_appointment(uuid, uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.admin_complete_student_appointment(uuid, uuid, text, text, text, integer, text) to authenticated, service_role;

-- ==============================================================================
-- 2. SCHEDULED-EVENT COMPLETION -> CANONICAL COMPLETION
-- ==============================================================================

create or replace function public.admin_complete_scheduled_event(
  p_event_id uuid,
  p_package_purchase_id uuid default null,
  p_teacher_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;

  if exists (select 1 from public.student_lessons where id = p_event_id) then
    return public.admin_complete_student_lesson(p_event_id, p_package_purchase_id, p_teacher_note, false);
  end if;

  if exists (select 1 from public.bookings where id = p_event_id) then
    return public.admin_complete_student_appointment(
      p_event_id, p_package_purchase_id, null, null, null, 60, p_teacher_note);
  end if;

  return jsonb_build_object('success', false, 'error_code', 'EVENT_NOT_FOUND');
end;
$fn$;

revoke all on function public.admin_complete_scheduled_event(uuid, uuid, text) from public, anon;
grant execute on function public.admin_complete_scheduled_event(uuid, uuid, text) to authenticated, service_role;

comment on function public.admin_complete_scheduled_event(uuid, uuid, text) is
  'Delegates to the canonical completion path (admin_record_completed_lesson). Never mutates student_lessons or student_package_purchases directly.';
