-- Migration: 20260827130000_fifo_lesson_consumption_and_entitlement_summary.sql
-- Description: Canonical FIFO lesson entitlement consumption, concurrency row locking,
-- package purchase linkage on completed lessons, and aggregated multi-package entitlement summary RPC.

-- 1. Aggregated Multi-Package Entitlement Summary RPC
create or replace function public.get_student_entitlement_summary(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_granted integer := 0;
  v_total_used integer := 0;
  v_total_remaining integer := 0;
  v_active_packages jsonb := '[]'::jsonb;
  v_past_packages jsonb := '[]'::jsonb;
begin
  -- Calculate totals across all valid packages
  select
    coalesce(sum(lesson_count), 0),
    coalesce(sum(lessons_used), 0),
    coalesce(sum(case when status = 'active' and (lesson_count - lessons_used) > 0 then (lesson_count - lessons_used) else 0 end), 0)
  into
    v_total_granted,
    v_total_used,
    v_total_remaining
  from public.student_package_purchases
  where student_user_id = p_student_id;

  -- Aggregate active packages
  select coalesce(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
  into v_active_packages
  from (
    select spp.*, pp.name_tr as package_name_tr, pp.name_en as package_name_en
    from public.student_package_purchases spp
    left join public.pricing_packages pp on pp.id = spp.package_id
    where spp.student_user_id = p_student_id
      and spp.status = 'active'
      and (spp.lesson_count - spp.lessons_used) > 0
    order by spp.created_at asc, spp.id asc
  ) p;

  -- Aggregate past packages (completed, expired, cancelled, refunded, or 0 remaining)
  select coalesce(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
  into v_past_packages
  from (
    select spp.*, pp.name_tr as package_name_tr, pp.name_en as package_name_en
    from public.student_package_purchases spp
    left join public.pricing_packages pp on pp.id = spp.package_id
    where spp.student_user_id = p_student_id
      and (spp.status in ('completed', 'expired', 'cancelled', 'refunded') or (spp.lesson_count - spp.lessons_used) <= 0)
    order by spp.created_at desc, spp.id desc
  ) p;

  return jsonb_build_object(
    'student_user_id', p_student_id,
    'total_granted_lessons', v_total_granted,
    'total_used_lessons', v_total_used,
    'total_remaining_lessons', v_total_remaining,
    'active_packages', v_active_packages,
    'past_packages', v_past_packages
  );
end;
$$;

revoke all on function public.get_student_entitlement_summary(uuid) from public, anon;
grant execute on function public.get_student_entitlement_summary(uuid) to authenticated, service_role;

-- 2. Enhanced FIFO Lesson Completion with Row Lock and Package Linkage
create or replace function public.admin_complete_scheduled_event(
  p_event_id uuid,
  p_package_purchase_id uuid default null,
  p_teacher_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson public.student_lessons%rowtype;
  v_booking public.bookings%rowtype;
  v_purchase public.student_package_purchases%rowtype;
  v_target_purchase_id uuid;
  v_event_type text := 'lesson';
  v_consumed boolean := false;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  -- Check if event exists in student_lessons
  select * into v_lesson from public.student_lessons where id = p_event_id for update;

  if v_lesson.id is not null then
    -- Already completed? Idempotent return without double deduction
    if v_lesson.status = 'completed' then
      return jsonb_build_object(
        'success', true,
        'already_completed', true,
        'lesson_id', v_lesson.id,
        'message', 'Event was already completed.'
      );
    end if;

    -- Determine package to deduct from using FIFO (oldest active purchase first)
    v_target_purchase_id := coalesce(p_package_purchase_id, v_lesson.package_purchase_id);
    if v_target_purchase_id is null then
      select id into v_target_purchase_id
      from public.student_package_purchases
      where student_user_id = v_lesson.student_user_id
        and status = 'active'
        and (lesson_count - lessons_used) > 0
      order by created_at asc, id asc
      for update
      limit 1;
    else
      select * into v_purchase
      from public.student_package_purchases
      where id = v_target_purchase_id and (lesson_count - lessons_used) > 0
      for update;
    end if;

    -- Update lesson status & permanently link the package purchase
    update public.student_lessons
    set status = 'completed',
        package_purchase_id = coalesce(v_target_purchase_id, package_purchase_id),
        teacher_note = coalesce(nullif(btrim(p_teacher_note), ''), teacher_note),
        updated_at = now()
    where id = v_lesson.id;

    -- Deduct exactly 1 lesson if valid active package found
    if v_target_purchase_id is not null then
      update public.student_package_purchases
      set lessons_used = lessons_used + 1,
          status = case when lessons_used + 1 >= lesson_count then 'completed' else 'active' end,
          updated_at = now()
      where id = v_target_purchase_id
      returning * into v_purchase;

      v_consumed := true;
    end if;

    return jsonb_build_object(
      'success', true,
      'already_completed', false,
      'lesson_id', v_lesson.id,
      'package_consumed', v_consumed,
      'package_purchase_id', v_target_purchase_id,
      'lessons_remaining', case when v_purchase.id is not null then greatest(0, v_purchase.lesson_count - v_purchase.lessons_used) else null end
    );
  end if;

  -- If not in student_lessons, check bookings table
  select * into v_booking from public.bookings where id = p_event_id for update;
  if v_booking.id is null then
    return jsonb_build_object('success', false, 'error_code', 'EVENT_NOT_FOUND');
  end if;

  if v_booking.status = 'completed' then
    return jsonb_build_object(
      'success', true,
      'already_completed', true,
      'booking_id', v_booking.id,
      'message', 'Booking was already completed.'
    );
  end if;

  -- Mark booking completed
  update public.bookings
  set status = 'completed',
      updated_at = now()
  where id = v_booking.id;

  v_event_type := coalesce(v_booking.event_type, 'other');

  -- ONLY event_type = 'lesson' consumes from package
  if v_event_type = 'lesson' and v_booking.student_user_id is not null then
    v_target_purchase_id := p_package_purchase_id;
    if v_target_purchase_id is null then
      select id into v_target_purchase_id
      from public.student_package_purchases
      where student_user_id = v_booking.student_user_id
        and status = 'active'
        and (lesson_count - lessons_used) > 0
      order by created_at asc, id asc
      for update
      limit 1;
    else
      select * into v_purchase
      from public.student_package_purchases
      where id = v_target_purchase_id and (lesson_count - lessons_used) > 0
      for update;
    end if;

    if v_target_purchase_id is not null then
      update public.student_package_purchases
      set lessons_used = lessons_used + 1,
          status = case when lessons_used + 1 >= lesson_count then 'completed' else 'active' end,
          updated_at = now()
      where id = v_target_purchase_id
      returning * into v_purchase;

      v_consumed := true;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'already_completed', false,
    'booking_id', v_booking.id,
    'event_type', v_event_type,
    'package_consumed', v_consumed,
    'package_purchase_id', v_target_purchase_id,
    'lessons_remaining', case when v_purchase.id is not null then greatest(0, v_purchase.lesson_count - v_purchase.lessons_used) else null end
  );
end;
$$;

revoke all on function public.admin_complete_scheduled_event(uuid, uuid, text) from public, anon;
grant execute on function public.admin_complete_scheduled_event(uuid, uuid, text) to authenticated, service_role;

-- 3. Unified admin_complete_student_appointment wrapper
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
set search_path = public
as $$
begin
  return public.admin_complete_scheduled_event(p_booking_id, p_package_purchase_id, p_teacher_note);
end;
$$;

revoke all on function public.admin_complete_student_appointment(uuid, uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.admin_complete_student_appointment(uuid, uuid, text, text, text, integer, text) to authenticated, service_role;
