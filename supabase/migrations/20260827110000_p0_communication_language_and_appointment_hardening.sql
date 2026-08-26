-- Oriens Academy Database Migration: Communication, Language & Appointment Hardening
-- Migration ID: 20260827110000_p0_communication_language_and_appointment_hardening.sql

-- ============================================================================
-- 1. NOTIFICATION DELIVERIES SCHEMA HARDENING
-- ============================================================================

-- Add optional subject column to notification_deliveries if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_deliveries'
      and column_name = 'subject'
  ) then
    alter table public.notification_deliveries add column subject text;
  end if;
end $$;

-- ============================================================================
-- 2. STUDENT PROFILES PREFERRED LANGUAGE ENFORCEMENT
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_profiles'
      and column_name = 'preferred_language'
  ) then
    alter table public.student_profiles add column preferred_language text not null default 'tr';
  end if;
end $$;

-- Enforce preferred_language constraint ('tr', 'en')
alter table public.student_profiles
  drop constraint if exists check_student_preferred_language;

alter table public.student_profiles
  add constraint check_student_preferred_language
  check (preferred_language in ('tr', 'en'));

-- ============================================================================
-- 3. SAVE STUDENT PREFERENCES RPC (WITH PREFERRED LANGUAGE SUPPORT)
-- ============================================================================

create or replace function public.save_student_preferences(
  p_student_id uuid,
  p_exams text[],
  p_countries text[],
  p_mark_onboarding_completed boolean default true,
  p_language text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_updated_profile record;
  v_target_exam text := null;
  v_target_country text := null;
  v_lang text := null;
begin
  if v_caller is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if v_caller <> p_student_id and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_exams is not null and array_length(p_exams, 1) > 0 then
    v_target_exam := p_exams[1];
  end if;

  if p_countries is not null and array_length(p_countries, 1) > 0 then
    v_target_country := p_countries[1];
  end if;

  if p_language in ('tr', 'en') then
    v_lang := p_language;
  end if;

  update public.student_profiles
  set
    target_exams = coalesce(p_exams, target_exams),
    target_countries = coalesce(p_countries, target_countries),
    target_exam = coalesce(v_target_exam, target_exam),
    target_country = coalesce(v_target_country, target_country),
    preferred_language = coalesce(v_lang, preferred_language, 'tr'),
    onboarding_completed = case
      when p_mark_onboarding_completed then true
      else onboarding_completed
    end,
    updated_at = now()
  where id = p_student_id
  returning * into v_updated_profile;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'STUDENT_NOT_FOUND',
      'message', 'Öğrenci profili bulunamadı.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'profile', row_to_json(v_updated_profile)
  );
end;
$$;

revoke execute on function public.save_student_preferences(uuid, text[], text[], boolean, text) from public, anon;
grant execute on function public.save_student_preferences(uuid, text[], text[], boolean, text) to authenticated;

-- ============================================================================
-- 4. ATOMIC ADMIN EVENT UPDATE RPC (APPOINTMENT & LESSON RESCHEDULING)
-- ============================================================================

create or replace function public.admin_update_booking_event(
  p_booking_id uuid,
  p_event_type text default null,
  p_subject text default null,
  p_exam text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_live_meeting_url text default null,
  p_notes text default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_slot public.availability_slots%rowtype;
  v_actor uuid := auth.uid();
  v_meaningfully_changed boolean := false;
  v_prev_starts_at timestamptz := null;
  v_new_starts_at timestamptz := null;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if v_booking.id is null then
    return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND');
  end if;

  if p_status is not null and p_status not in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS');
  end if;

  -- Lock slot if associated
  if v_booking.slot_id is not null then
    select * into v_slot
    from public.availability_slots
    where id = v_booking.slot_id
    for update;

    v_prev_starts_at := v_slot.starts_at;
  end if;

  -- If time is updated and slot exists, update slot
  if p_starts_at is not null and p_ends_at is not null then
    if p_ends_at <= p_starts_at then
      return jsonb_build_object('success', false, 'error_code', 'INVALID_TIMESPAN');
    end if;

    v_new_starts_at := p_starts_at;

    if v_booking.slot_id is not null then
      update public.availability_slots
      set
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        updated_at = now()
      where id = v_booking.slot_id;
    else
      -- Allocate new slot for booking if missing
      insert into public.availability_slots (starts_at, ends_at, status, created_by)
      values (p_starts_at, p_ends_at, 'booked', v_actor)
      returning * into v_slot;

      v_booking.slot_id := v_slot.id;
    end if;

    if v_prev_starts_at is null or v_prev_starts_at <> p_starts_at then
      v_meaningfully_changed := true;
    end if;
  end if;

  -- Check meaningful change on meeting url or event type or subject
  if p_live_meeting_url is not null and p_live_meeting_url <> coalesce(v_booking.live_meeting_url, '') then
    v_meaningfully_changed := true;
  end if;
  if p_event_type is not null and p_event_type <> coalesce(v_booking.event_type, '') then
    v_meaningfully_changed := true;
  end if;
  if p_subject is not null and p_subject <> coalesce(v_booking.appointment_subject, '') then
    v_meaningfully_changed := true;
  end if;

  -- Update booking record
  update public.bookings
  set
    slot_id = coalesce(v_booking.slot_id, slot_id),
    event_type = coalesce(p_event_type, event_type),
    appointment_subject = coalesce(nullif(btrim(p_subject), ''), appointment_subject),
    custom_exam = coalesce(nullif(btrim(p_exam), ''), custom_exam),
    live_meeting_url = case when p_live_meeting_url is not null then nullif(btrim(p_live_meeting_url), '') else live_meeting_url end,
    notes = case when p_notes is not null then nullif(btrim(p_notes), '') else notes end,
    status = coalesce(p_status, status),
    updated_at = now()
  where id = p_booking_id;

  -- Update slot status if booking status was updated
  if p_status is not null and v_booking.slot_id is not null then
    update public.availability_slots
    set
      status = case when p_status = 'cancelled' then 'available' else 'booked' end,
      updated_at = now()
    where id = v_booking.slot_id;
  end if;

  -- Audit log
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'admin.booking.update_event',
    'booking',
    p_booking_id::text,
    jsonb_build_object(
      'previous_status', v_booking.status,
      'new_status', coalesce(p_status, v_booking.status),
      'previous_starts_at', v_prev_starts_at,
      'new_starts_at', v_new_starts_at,
      'meaningfully_changed', v_meaningfully_changed
    )
  );

  return jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'meaningfully_changed', v_meaningfully_changed,
    'previous_starts_at', v_prev_starts_at,
    'new_starts_at', coalesce(v_new_starts_at, v_prev_starts_at)
  );
end;
$$;

revoke execute on function public.admin_update_booking_event(uuid, text, text, text, timestamptz, timestamptz, text, text, text) from public, anon;
grant execute on function public.admin_update_booking_event(uuid, text, text, text, timestamptz, timestamptz, text, text, text) to authenticated;

-- ============================================================================
-- 5. SAFE FINANCIAL PERMISSIONS & DEMO CLEANUP
-- ============================================================================

grant delete on public.payment_transactions to service_role;

-- Backfill default preferred_language for existing students without overwriting
update public.student_profiles
set preferred_language = 'tr'
where preferred_language is null;

-- Safe demo cleanup RPC (strictly deletes only non-paid synthetic/test entries)
create or replace function public.admin_cleanup_demo_financial_records()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count int := 0;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  -- Strictly delete only non-paid mock/demo/synthetic test entries
  with deleted as (
    delete from public.payment_transactions
    where status <> 'paid'
      and (
        provider in ('bank_virtual_pos', 'manual_test', 'mock')
        or lower(coalesce(payer_email, '')) like '%test@%'
        or lower(coalesce(payer_email, '')) like '%@example.com%'
        or lower(coalesce(payer_email, '')) like '%demo@%'
        or lower(coalesce(payer_name, '')) in ('test', 'demo', 'john doe', 'test user')
      )
    returning id
  )
  select count(*) into v_deleted_count from deleted;

  return jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count
  );
end;
$$;

revoke execute on function public.admin_cleanup_demo_financial_records() from public, anon;
grant execute on function public.admin_cleanup_demo_financial_records() to authenticated, service_role;

