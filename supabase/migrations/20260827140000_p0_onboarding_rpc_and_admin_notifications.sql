-- ============================================================================
-- P0 STUDENT ONBOARDING RPC CANONICALIZATION & ADMIN NOTIFICATION READ STATE
-- Migration: 20260827140000_p0_onboarding_rpc_and_admin_notifications.sql
-- ============================================================================

-- 1. DROP OBSOLETE OVERLOADS OF SAVE_STUDENT_PREFERENCES
-- To fix PGRST ambiguous function candidate error permanently.
drop function if exists public.save_student_preferences(uuid, text[], text[], boolean);
drop function if exists public.save_student_preferences(uuid, text[], text[], boolean, text);

-- 2. CREATE SINGLE CANONICAL 5-ARGUMENT FUNCTION
create or replace function public.save_student_preferences(
  p_student_id uuid,
  p_exams text[],
  p_countries text[],
  p_mark_onboarding_completed boolean default true,
  p_language text default 'tr'
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
  v_lang text := 'tr';
begin
  if v_caller is null and current_user not in ('postgres', 'service_role') and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if v_caller is not null and v_caller <> p_student_id and not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_exams is not null and array_length(p_exams, 1) > 0 then
    v_target_exam := p_exams[1];
  end if;

  if p_countries is not null and array_length(p_countries, 1) > 0 then
    v_target_country := p_countries[1];
  end if;

  -- Normalize and strictly validate language: tr or en only
  if lower(trim(coalesce(p_language, ''))) in ('en', 'en-us', 'en-gb', 'english') then
    v_lang := 'en';
  else
    v_lang := 'tr';
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

revoke all on function public.save_student_preferences(uuid, text[], text[], boolean, text) from public, anon;
grant execute on function public.save_student_preferences(uuid, text[], text[], boolean, text) to authenticated, service_role;

-- 3. NOTIFICATION DELIVERIES READ STATE & ADMIN RLS
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_deliveries'
      and column_name = 'is_read'
  ) then
    alter table public.notification_deliveries add column is_read boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_deliveries'
      and column_name = 'read_at'
  ) then
    alter table public.notification_deliveries add column read_at timestamptz default null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_deliveries'
      and policyname = 'Admin notification deliveries update policy'
  ) then
    create policy "Admin notification deliveries update policy"
      on public.notification_deliveries for update
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

grant update on table public.notification_deliveries to authenticated;

-- 4. ATOMIC ADMIN MARK NOTIFICATIONS READ RPC
create or replace function public.admin_mark_notifications_read(
  p_notification_ids uuid[] default null,
  p_mark_all boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_mark_all then
    update public.notification_deliveries
    set
      is_read = true,
      read_at = coalesce(read_at, now())
    where is_read = false;
    get diagnostics v_updated_count = row_count;
  elsif p_notification_ids is not null and array_length(p_notification_ids, 1) > 0 then
    update public.notification_deliveries
    set
      is_read = true,
      read_at = coalesce(read_at, now())
    where id = any(p_notification_ids) and is_read = false;
    get diagnostics v_updated_count = row_count;
  end if;

  return jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count
  );
end;
$$;

revoke all on function public.admin_mark_notifications_read(uuid[], boolean) from public, anon;
grant execute on function public.admin_mark_notifications_read(uuid[], boolean) to authenticated, service_role;
