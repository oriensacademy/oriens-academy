-- Oriens Academy Student Onboarding Preferences & Multi-Selection
-- Migration: 20260823020000_student_preferences_multi_select.sql

-- 1. Add multi-value preference columns and onboarding marker to student_profiles
alter table public.student_profiles
  add column if not exists target_exams text[] not null default '{}',
  add column if not exists target_countries text[] not null default '{}',
  add column if not exists onboarding_completed boolean not null default false;

-- 2. Normalized relational table for student exam preferences
create table if not exists public.student_exam_preferences (
  student_user_id uuid not null references public.student_profiles(id) on delete cascade,
  exam_code text not null,
  created_at timestamptz not null default now(),
  primary key (student_user_id, exam_code)
);

create index if not exists idx_student_exam_prefs_exam on public.student_exam_preferences(exam_code);
create index if not exists idx_student_exam_prefs_user on public.student_exam_preferences(student_user_id);

-- 3. Normalized relational table for student destination/country preferences
create table if not exists public.student_destination_preferences (
  student_user_id uuid not null references public.student_profiles(id) on delete cascade,
  destination_code text not null,
  created_at timestamptz not null default now(),
  primary key (student_user_id, destination_code)
);

create index if not exists idx_student_dest_prefs_dest on public.student_destination_preferences(destination_code);
create index if not exists idx_student_dest_prefs_user on public.student_destination_preferences(student_user_id);

-- 4. Enable RLS
alter table public.student_exam_preferences enable row level security;
alter table public.student_destination_preferences enable row level security;

-- 5. RLS Policies: Students can manage their own preferences
create policy "Students can view own exam preferences"
  on public.student_exam_preferences for select
  to authenticated
  using (student_user_id = auth.uid() or (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

create policy "Students can insert own exam preferences"
  on public.student_exam_preferences for insert
  to authenticated
  with check (student_user_id = auth.uid() or (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

create policy "Students can delete own exam preferences"
  on public.student_exam_preferences for delete
  to authenticated
  using (student_user_id = auth.uid() or (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

create policy "Students can view own destination preferences"
  on public.student_destination_preferences for select
  to authenticated
  using (student_user_id = auth.uid() or (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

create policy "Students can insert own destination preferences"
  on public.student_destination_preferences for insert
  to authenticated
  with check (student_user_id = auth.uid() or (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

create policy "Students can delete own destination preferences"
  on public.student_destination_preferences for delete
  to authenticated
  using (student_user_id = auth.uid() or (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin');

-- 6. RPC: Save student preferences securely
create or replace function public.save_student_preferences(
  p_student_id uuid,
  p_exams text[],
  p_countries text[],
  p_mark_onboarding_completed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_calling_user uuid := auth.uid();
  v_is_admin boolean;
  v_exam text;
  v_country text;
begin
  select exists (
    select 1 from public.admin_profiles
    where user_id = v_calling_user and role = 'admin' and active = true
  ) into v_is_admin;

  if v_calling_user is null or (v_calling_user <> p_student_id and not v_is_admin) then
    raise exception 'Unauthorized to update student preferences';
  end if;

  -- Update student profile columns
  update public.student_profiles
  set
    target_exams = coalesce(p_exams, '{}'),
    target_countries = coalesce(p_countries, '{}'),
    target_exam = case when array_length(p_exams, 1) > 0 then p_exams[1] else target_exam end,
    target_country = case when array_length(p_countries, 1) > 0 then p_countries[1] else target_country end,
    onboarding_completed = case when p_mark_onboarding_completed then true else onboarding_completed end,
    updated_at = now()
  where id = p_student_id;

  -- Re-sync relational exam preferences
  delete from public.student_exam_preferences where student_user_id = p_student_id;
  if p_exams is not null then
    foreach v_exam in array p_exams loop
      if length(trim(v_exam)) > 0 then
        insert into public.student_exam_preferences (student_user_id, exam_code)
        values (p_student_id, trim(v_exam))
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Re-sync relational destination preferences
  delete from public.student_destination_preferences where student_user_id = p_student_id;
  if p_countries is not null then
    foreach v_country in array p_countries loop
      if length(trim(v_country)) > 0 then
        insert into public.student_destination_preferences (student_user_id, destination_code)
        values (p_student_id, trim(v_country))
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'exams', coalesce(p_exams, '{}'),
    'countries', coalesce(p_countries, '{}'),
    'onboarding_completed', true
  );
end;
$$;
