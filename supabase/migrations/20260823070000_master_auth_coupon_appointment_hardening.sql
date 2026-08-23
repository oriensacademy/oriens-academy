-- Migration: Master Auth, Coupon Grants, Appointment Student Linking & Live Lesson Hardening
-- Migration ID: 20260823070000_master_auth_coupon_appointment_hardening.sql

-- ============================================================================
-- 1. DISCOUNT COUPONS TABLE PRIVILEGES & RLS GRANTS
-- ============================================================================

grant select, insert, update, delete on public.discount_coupons to authenticated;
grant select, insert, update, delete on public.discount_coupon_packages to authenticated;
grant select, insert, update, delete on public.discount_coupon_redemptions to authenticated;

grant all on public.discount_coupons, public.discount_coupon_packages, public.discount_coupon_redemptions to service_role;

-- Ensure RLS is active
alter table public.discount_coupons enable row level security;
alter table public.discount_coupon_packages enable row level security;
alter table public.discount_coupon_redemptions enable row level security;

-- Ensure validate_checkout_coupon RPC is available to all callers (public/anon/authenticated) as SECURITY DEFINER
grant execute on function public.validate_checkout_coupon(text, text, uuid) to anon, authenticated, service_role;
grant execute on function public.create_student_checkout(text, text, text, text, text, text, text) to anon, authenticated, service_role;

-- ============================================================================
-- 2. BOOKINGS & APPOINTMENT LIVE MEETING URL COLUMNS & INDEXES
-- ============================================================================

alter table public.bookings
  add column if not exists live_meeting_url text check (live_meeting_url is null or live_meeting_url ~* '^https?://[^\s]+$'),
  add column if not exists meeting_link_sent_at timestamptz;

create index if not exists idx_bookings_student_user_id on public.bookings(student_user_id);
create index if not exists idx_bookings_email on public.bookings(email);

-- ============================================================================
-- 3. ATOMIC ADMIN BOOKING CREATION WITH AUTO-STUDENT LINKING & LIVE URL
-- ============================================================================

create or replace function public.admin_create_booking(
  p_full_name text,
  p_email text,
  p_phone text,
  p_exam text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_privacy_consent boolean,
  p_notes text default null,
  p_status text default 'confirmed',
  p_live_meeting_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot public.availability_slots%rowtype;
  v_booking_id uuid;
  v_actor uuid := auth.uid();
  v_clean_email text := lower(btrim(p_email));
  v_student_id uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if nullif(btrim(p_full_name), '') is null
    or nullif(v_clean_email, '') is null
    or p_privacy_consent is not true
    or p_ends_at <= p_starts_at
    or p_starts_at <= now() then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT');
  end if;

  if p_status not in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS');
  end if;

  if p_live_meeting_url is not null and btrim(p_live_meeting_url) <> '' and p_live_meeting_url !~* '^https?://[^\s]+$' then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_MEETING_URL');
  end if;

  -- Lock slot if exists
  select * into v_slot
  from public.availability_slots
  where starts_at = p_starts_at and ends_at = p_ends_at
  for update;

  if exists (
    select 1 from public.availability_slots
    where starts_at < p_ends_at and ends_at > p_starts_at
      and status in ('booked', 'blocked')
      and (v_slot.id is null or id <> v_slot.id)
  ) then
    return jsonb_build_object('success', false, 'error_code', 'SLOT_UNAVAILABLE');
  end if;

  if v_slot.id is null then
    if exists (
      select 1 from public.availability_slots
      where starts_at < p_ends_at and ends_at > p_starts_at
    ) then
      return jsonb_build_object('success', false, 'error_code', 'SLOT_OVERLAP');
    end if;
    insert into public.availability_slots (starts_at, ends_at, status, created_by)
    values (p_starts_at, p_ends_at, 'available', v_actor)
    returning * into v_slot;
  end if;

  if v_slot.status <> 'available' then
    return jsonb_build_object('success', false, 'error_code', 'SLOT_UNAVAILABLE');
  end if;

  -- Check if student profile exists for this email
  select id into v_student_id
  from public.student_profiles
  where email = v_clean_email
  limit 1;

  update public.availability_slots
  set status = case when p_status = 'cancelled' then 'available' else 'booked' end,
      updated_at = now()
  where id = v_slot.id;

  insert into public.bookings (
    full_name, email, phone, custom_exam, locale, notes, slot_id,
    status, source, privacy_consent, marketing_consent,
    student_user_id, live_meeting_url
  ) values (
    btrim(p_full_name), v_clean_email, nullif(btrim(p_phone), ''),
    nullif(btrim(p_exam), ''), 'tr', nullif(btrim(p_notes), ''), v_slot.id,
    p_status, 'admin_manual', p_privacy_consent, false,
    v_student_id, nullif(btrim(p_live_meeting_url), '')
  ) returning id into v_booking_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor,
    'admin.booking.create',
    'booking',
    v_booking_id::text,
    jsonb_build_object(
      'slot_id', v_slot.id,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'status', p_status,
      'source', 'admin_manual',
      'student_user_id', v_student_id,
      'live_meeting_url', nullif(btrim(p_live_meeting_url), '')
    )
  );

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'slot_id', v_slot.id,
    'student_user_id', v_student_id
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error_code', 'SLOT_UNAVAILABLE');
end;
$$;

create or replace function public.admin_create_student_booking(
  p_student_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_exam text,
  p_subject text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_privacy_consent boolean,
  p_notes text default null,
  p_status text default 'confirmed',
  p_live_meeting_url text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_booking_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  perform 1 from public.student_profiles where id = p_student_id;
  if not found then return jsonb_build_object('success', false, 'error_code', 'STUDENT_NOT_FOUND'); end if;

  v_result := public.admin_create_booking(
    p_full_name, p_email, p_phone, p_exam, p_starts_at, p_ends_at,
    p_privacy_consent, p_notes, p_status, p_live_meeting_url
  );
  if not coalesce((v_result->>'success')::boolean, false) then return v_result; end if;

  v_booking_id := (v_result->>'booking_id')::uuid;
  update public.bookings
  set student_user_id = p_student_id,
      appointment_subject = left(nullif(btrim(p_subject), ''), 160),
      live_meeting_url = nullif(btrim(p_live_meeting_url), ''),
      updated_at = now()
  where id = v_booking_id;

  return v_result || jsonb_build_object('student_user_id', p_student_id);
end;
$$;

revoke all on function public.admin_create_booking(text, text, text, text, timestamptz, timestamptz, boolean, text, text, text) from public, anon;
grant execute on function public.admin_create_booking(text, text, text, text, timestamptz, timestamptz, boolean, text, text, text) to authenticated;

revoke all on function public.admin_create_student_booking(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, text, text) from public, anon;
grant execute on function public.admin_create_student_booking(uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, text, text, text) to authenticated;
