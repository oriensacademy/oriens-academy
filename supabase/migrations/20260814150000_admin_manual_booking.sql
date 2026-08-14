-- Atomic manual booking creation for authenticated Oriens administrators.
-- RLS remains enabled; this SECURITY DEFINER function performs its own admin check.

drop function if exists public.admin_create_booking(text, text, text, text, timestamptz, timestamptz, text, text);

create or replace function public.admin_create_booking(
  p_full_name text,
  p_email text,
  p_phone text,
  p_exam text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_privacy_consent boolean,
  p_notes text default null,
  p_status text default 'confirmed'
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
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if nullif(btrim(p_full_name), '') is null
    or nullif(btrim(p_email), '') is null
    or p_privacy_consent is not true
    or p_ends_at <= p_starts_at
    or p_starts_at <= now() then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT');
  end if;

  if p_status not in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS');
  end if;

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

  update public.availability_slots
  set status = case when p_status = 'cancelled' then 'available' else 'booked' end,
      updated_at = now()
  where id = v_slot.id;

  insert into public.bookings (
    full_name, email, phone, custom_exam, locale, notes, slot_id,
    status, source, privacy_consent, marketing_consent
  ) values (
    btrim(p_full_name), lower(btrim(p_email)), nullif(btrim(p_phone), ''),
    nullif(btrim(p_exam), ''), 'tr', nullif(btrim(p_notes), ''), v_slot.id,
    p_status, 'admin_manual', p_privacy_consent, false
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
      'source', 'admin_manual'
    )
  );

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'slot_id', v_slot.id
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error_code', 'SLOT_UNAVAILABLE');
end;
$$;

revoke execute on function public.admin_create_booking(text, text, text, text, timestamptz, timestamptz, boolean, text, text)
  from public, anon;
grant execute on function public.admin_create_booking(text, text, text, text, timestamptz, timestamptz, boolean, text, text)
  to authenticated;

create or replace function public.admin_update_booking_status(
  p_booking_id uuid,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS');
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND'); end if;

  if v_booking.slot_id is not null then
    perform 1 from public.availability_slots where id = v_booking.slot_id for update;
  end if;

  update public.bookings set status = p_status, notes = p_notes, updated_at = now() where id = p_booking_id;
  if v_booking.slot_id is not null then
    update public.availability_slots
    set status = case when p_status = 'cancelled' then 'available' else 'booked' end,
        updated_at = now()
    where id = v_booking.slot_id;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'admin.booking.update', 'booking', p_booking_id::text,
    jsonb_build_object('previous_status', v_booking.status, 'new_status', p_status, 'slot_id', v_booking.slot_id));
  return jsonb_build_object('success', true);
exception when unique_violation then
  return jsonb_build_object('success', false, 'error_code', 'SLOT_UNAVAILABLE');
end;
$$;

revoke execute on function public.admin_update_booking_status(uuid, text, text) from public, anon;
grant execute on function public.admin_update_booking_status(uuid, text, text) to authenticated;
