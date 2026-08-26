-- ============================================================================
-- ALLOW SERVICE_ROLE IN PROTECT_STUDENT_PROFILE_FIELDS TRIGGER
-- Migration: 20260827142000_allow_service_role_in_protect_student_profile_fields.sql
-- ============================================================================

create or replace function public.protect_student_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin()
     and current_user not in ('postgres', 'service_role')
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
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
