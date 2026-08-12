-- Oriens Academy Database Migration: Booking Atomicity & Partial Unique Index Defense
-- Migration ID: 20260811210000_booking_atomicity.sql

-- ============================================================================
-- 1. PARTIAL UNIQUE INDEX FOR DOUBLE-BOOKING DEFENSE
-- ============================================================================

-- Guarantees at the PostgreSQL database level that an availability slot cannot
-- have more than one active reservation (pending, confirmed, completed, or no_show).
-- Cancelled bookings do not consume the slot and are excluded from the index.
create unique index if not exists idx_bookings_active_slot_unique
  on public.bookings (slot_id)
  where slot_id is not null
    and status in ('pending', 'confirmed', 'completed', 'no_show');


-- ============================================================================
-- 2. ATOMIC BOOKING RESERVATION RPC FUNCTION
-- ============================================================================

-- Performs atomic slot locking, validation, slot status update, booking insertion,
-- and audit logging in a single database transaction.
-- SECURITY DEFINER with set search_path = '' for strict security.
create or replace function public.reserve_booking_slot(
  p_slot_id uuid,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_exam_code text default null,
  p_custom_exam text default null,
  p_locale text default 'en',
  p_notes text default null,
  p_support_type text default 'general_consultation',
  p_privacy_consent boolean default false,
  p_marketing_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot record;
  v_booking_id uuid;
  v_audit_meta jsonb;
begin
  -- Validate privacy consent
  if p_privacy_consent is not true then
    return jsonb_build_object(
      'success', false,
      'error_code', 'PRIVACY_CONSENT_REQUIRED',
      'message', 'Privacy consent is required to place a booking.'
    );
  end if;

  -- Lock target slot row for update (prevents race conditions / double-booking)
  select id, starts_at, ends_at, status
  into v_slot
  from public.availability_slots
  where id = p_slot_id
  for update;

  -- Verify slot exists and is available for booking
  if v_slot.id is null then
    return jsonb_build_object(
      'success', false,
      'error_code', 'SLOT_NOT_FOUND',
      'message', 'The requested slot was not found.'
    );
  end if;

  if v_slot.status <> 'available' or v_slot.starts_at <= now() then
    return jsonb_build_object(
      'success', false,
      'error_code', 'SLOT_UNAVAILABLE',
      'message', 'The selected appointment time is no longer available.'
    );
  end if;

  -- Atomically reserve the slot
  update public.availability_slots
  set status = 'booked',
      updated_at = now()
  where id = p_slot_id;

  -- Insert the booking record
  insert into public.bookings (
    full_name,
    email,
    phone,
    exam_code,
    custom_exam,
    locale,
    notes,
    slot_id,
    status,
    source,
    privacy_consent,
    marketing_consent
  )
  values (
    p_full_name,
    p_email,
    p_phone,
    p_exam_code,
    p_custom_exam,
    p_locale,
    p_notes,
    p_slot_id,
    'pending',
    'website',
    p_privacy_consent,
    coalesce(p_marketing_consent, false)
  )
  returning id into v_booking_id;

  -- Insert audit log event (strictly excluding PII)
  v_audit_meta := jsonb_build_object(
    'locale', p_locale,
    'support_type', p_support_type,
    'slot_id', p_slot_id,
    'starts_at', v_slot.starts_at,
    'ends_at', v_slot.ends_at
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    null,
    'booking.created',
    'booking',
    v_booking_id::text,
    v_audit_meta
  );

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'slot_id', p_slot_id,
    'starts_at', v_slot.starts_at,
    'ends_at', v_slot.ends_at,
    'status', 'pending'
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'success', false,
      'error_code', 'SLOT_UNAVAILABLE',
      'message', 'The selected slot was reserved by another user.'
    );
  when others then
    return jsonb_build_object(
      'success', false,
      'error_code', 'RESERVATION_FAILED',
      'message', 'An error occurred while reserving the appointment slot.'
    );
end;
$$;


-- ============================================================================
-- 3. PERMISSION HARDENING FOR RPC FUNCTION
-- ============================================================================

-- Revoke execution access from public/anonymous roles to prevent direct RPC invocations from browser
revoke execute on function public.reserve_booking_slot from public, anon, authenticated;

-- Grant execution privilege solely to trusted service_role (used by Edge Functions)
grant execute on function public.reserve_booking_slot to service_role;

-- Grant table SELECT access on availability_slots to anon, authenticated, and service_role
grant select on table public.availability_slots to anon, authenticated, service_role;

-- Public RLS Policy: Anonymous and public users can ONLY view slots that are available and in the future
create policy "Public active available slots policy"
  on public.availability_slots for select
  using (status = 'available' and starts_at > now());

