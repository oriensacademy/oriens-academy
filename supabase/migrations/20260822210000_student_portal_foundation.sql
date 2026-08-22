-- Oriens Academy student accounts and portal data.
-- Authorization never relies on editable user_metadata roles.

create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  email text not null,
  phone text,
  date_of_birth date,
  preferred_language text not null default 'tr' check (preferred_language in ('tr', 'en')),
  school text,
  target_country text,
  target_university text,
  target_exam text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists student_user_id uuid references auth.users(id) on delete set null;

create table if not exists public.student_lessons (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  package_purchase_id uuid references public.student_package_purchases(id) on delete set null,
  title text not null,
  subject text not null,
  exam_code text,
  lesson_date timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  teacher_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.student_homework (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid references public.student_lessons(id) on delete set null,
  title text not null,
  description text not null,
  due_date timestamptz,
  status text not null default 'assigned' check (status in ('assigned', 'submitted', 'reviewed', 'completed', 'late')),
  submission_text text,
  submitted_at timestamptz,
  teacher_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_profiles_email on public.student_profiles(lower(email));
create index if not exists idx_bookings_student_date on public.bookings(student_user_id, created_at desc);
create index if not exists idx_student_lessons_student_date on public.student_lessons(student_user_id, lesson_date desc);
create index if not exists idx_student_homework_student_due on public.student_homework(student_user_id, due_date);

create trigger trg_student_profiles_updated_at before update on public.student_profiles
  for each row execute function public.set_updated_at();
create trigger trg_student_homework_updated_at before update on public.student_homework
  for each row execute function public.set_updated_at();

create or replace function public.sync_package_usage_from_lesson()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'completed' and new.package_purchase_id is not null then
    update public.student_package_purchases set lessons_used = least(lesson_count, lessons_used + 1) where id = new.package_purchase_id;
  elsif tg_op = 'DELETE' and old.status = 'completed' and old.package_purchase_id is not null then
    update public.student_package_purchases set lessons_used = greatest(0, lessons_used - 1) where id = old.package_purchase_id;
  elsif tg_op = 'UPDATE' then
    if old.status = 'completed' and old.package_purchase_id is not null and (new.status <> 'completed' or new.package_purchase_id is distinct from old.package_purchase_id) then
      update public.student_package_purchases set lessons_used = greatest(0, lessons_used - 1) where id = old.package_purchase_id;
    end if;
    if new.status = 'completed' and new.package_purchase_id is not null and (old.status <> 'completed' or new.package_purchase_id is distinct from old.package_purchase_id) then
      update public.student_package_purchases set lessons_used = least(lesson_count, lessons_used + 1) where id = new.package_purchase_id;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger trg_sync_package_usage_from_lesson
  after insert or update or delete on public.student_lessons
  for each row execute function public.sync_package_usage_from_lesson();

create or replace function public.create_student_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  -- Admin authorization remains app_metadata-only and admin users do not
  -- receive student profiles implicitly.
  if new.email is null then return new; end if;
  if coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then return new; end if;
  v_name := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 100);
  if char_length(v_name) < 2 then v_name := 'Student'; end if;
  insert into public.student_profiles (
    id, full_name, email, phone, preferred_language, school, target_country, target_university, target_exam
  ) values (
    new.id,
    v_name,
    lower(new.email),
    left(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), 30),
    case when new.raw_user_meta_data ->> 'preferred_language' = 'en' then 'en' else 'tr' end,
    left(nullif(btrim(new.raw_user_meta_data ->> 'school'), ''), 160),
    left(nullif(btrim(new.raw_user_meta_data ->> 'target_country'), ''), 120),
    left(nullif(btrim(new.raw_user_meta_data ->> 'target_university'), ''), 160),
    left(nullif(btrim(new.raw_user_meta_data ->> 'target_exam'), ''), 80)
  ) on conflict (id) do nothing;

  update public.bookings set student_user_id = new.id
    where student_user_id is null and lower(email) = lower(new.email);
  update public.payment_transactions set student_user_id = new.id
    where student_user_id is null and lower(payer_email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_student_profile on auth.users;
create trigger on_auth_user_created_student_profile
  after insert on auth.users for each row execute function public.create_student_profile_for_auth_user();

create or replace function public.sync_student_profile_auth_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.student_profiles set email = lower(new.email), updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_email_changed_student_profile on auth.users;
create trigger on_auth_user_email_changed_student_profile
  after update of email on auth.users for each row execute function public.sync_student_profile_auth_email();

create or replace function public.protect_student_profile_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    if auth.uid() is distinct from old.id then raise exception 'STUDENT_PROFILE_FORBIDDEN' using errcode = '42501'; end if;
    new.id := old.id;
    new.email := old.email;
    new.active := old.active;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger trg_protect_student_profile_fields before update on public.student_profiles
  for each row execute function public.protect_student_profile_fields();

create or replace function public.protect_student_homework_submission()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    if auth.uid() is distinct from old.student_user_id then raise exception 'HOMEWORK_FORBIDDEN' using errcode = '42501'; end if;
    if old.status not in ('assigned', 'late', 'submitted') then raise exception 'HOMEWORK_REVIEW_LOCKED' using errcode = '42501'; end if;
    new.id := old.id; new.student_user_id := old.student_user_id; new.lesson_id := old.lesson_id;
    new.title := old.title; new.description := old.description; new.due_date := old.due_date;
    new.teacher_feedback := old.teacher_feedback; new.created_at := old.created_at;
    if nullif(btrim(coalesce(new.submission_text, '')), '') is null then raise exception 'HOMEWORK_SUBMISSION_REQUIRED'; end if;
    new.status := 'submitted'; new.submitted_at := now();
  end if;
  return new;
end;
$$;
create trigger trg_protect_student_homework_submission before update on public.student_homework
  for each row execute function public.protect_student_homework_submission();

alter table public.student_profiles enable row level security;
alter table public.student_lessons enable row level security;
alter table public.student_homework enable row level security;

create policy "Student own profile read" on public.student_profiles for select using (id = auth.uid());
create policy "Student own profile update" on public.student_profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Admin student profiles" on public.student_profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "Student own bookings read" on public.bookings for select using (student_user_id = auth.uid());
create policy "Student related slots read" on public.availability_slots for select using (
  exists (select 1 from public.bookings b where b.slot_id = availability_slots.id and b.student_user_id = auth.uid())
);
create policy "Student own lessons read" on public.student_lessons for select using (student_user_id = auth.uid());
create policy "Admin student lessons" on public.student_lessons for all using (public.is_admin()) with check (public.is_admin());
create policy "Student own homework read" on public.student_homework for select using (student_user_id = auth.uid());
create policy "Student own homework submit" on public.student_homework for update using (student_user_id = auth.uid()) with check (student_user_id = auth.uid());
create policy "Admin student homework" on public.student_homework for all using (public.is_admin()) with check (public.is_admin());

grant select, update on public.student_profiles to authenticated;
grant select on public.bookings, public.availability_slots, public.student_lessons to authenticated;
grant select, update on public.student_homework to authenticated;
grant insert, update, delete on public.student_lessons, public.student_homework to authenticated;
