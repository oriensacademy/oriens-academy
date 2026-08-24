-- Migration: 20260825140000_phase02_student_security_and_admin_reauth.sql
-- Description: Locks student personal fields (full_name, phone) on self-updates and creates secure admin update RPC with audit logging.

-- 1. Tighten trigger to forbid non-admins from mutating full_name, phone, email, id, active, created_at
create or replace function public.protect_student_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then
    if auth.uid() is distinct from old.id then
      raise exception 'STUDENT_PROFILE_FORBIDDEN' using errcode = '42501';
    end if;

    -- Identity and system fields are immutable for non-admin students
    new.id := old.id;
    new.email := old.email;
    new.full_name := old.full_name;
    new.phone := old.phone;
    new.active := old.active;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

-- Ensure trigger is active
drop trigger if exists trg_protect_student_profile_fields on public.student_profiles;
create trigger trg_protect_student_profile_fields
  before update on public.student_profiles
  for each row execute function public.protect_student_profile_fields();

-- 2. Secure Admin RPC: update student identity & academic profile with audit logging
create or replace function public.admin_update_student_profile(
  p_student_id uuid,
  p_full_name text,
  p_phone text default null,
  p_school text default null,
  p_target_university text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_calling_user uuid := auth.uid();
  v_is_admin boolean;
  v_trimmed_name text := trim(coalesce(p_full_name, ''));
  v_trimmed_phone text := trim(coalesce(p_phone, ''));
begin
  select exists (
    select 1 from public.admin_profiles
    where user_id = v_calling_user and role = 'admin' and active = true
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'UNAUTHORIZED_ADMIN_ACTION' using errcode = '42501';
  end if;

  if length(v_trimmed_name) = 0 then
    raise exception 'FULL_NAME_REQUIRED' using errcode = '22023';
  end if;

  -- Update student profile table directly (is_admin() evaluates to true for admin caller)
  update public.student_profiles
  set
    full_name = v_trimmed_name,
    phone = nullif(v_trimmed_phone, ''),
    school = nullif(trim(coalesce(p_school, '')), ''),
    target_university = nullif(trim(coalesce(p_target_university, '')), ''),
    updated_at = now()
  where id = p_student_id;

  -- Sync raw_user_meta_data in auth.users if student account exists
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'full_name', v_trimmed_name,
    'phone', nullif(v_trimmed_phone, '')
  )
  where id = p_student_id;

  -- Log action into audit_logs (never recording any passwords)
  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_calling_user,
    'student.identity.updated',
    'student_profile',
    p_student_id,
    jsonb_build_object(
      'full_name', v_trimmed_name,
      'phone', nullif(v_trimmed_phone, ''),
      'school', nullif(trim(coalesce(p_school, '')), ''),
      'target_university', nullif(trim(coalesce(p_target_university, '')), '')
    )
  );

  return jsonb_build_object(
    'success', true,
    'student_id', p_student_id
  );
end;
$$;
