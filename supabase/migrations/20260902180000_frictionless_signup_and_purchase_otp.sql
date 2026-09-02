-- Migration: 20260902180000_frictionless_signup_and_purchase_otp.sql
-- Description: Frictionless signup with auto self-learner provisioning, bounded stuck account backfill,
-- and secure purchase-only email OTP challenge storage.

-- 1. Update create_student_profile_for_auth_user to atomically provision guardian_accounts, self student_profiles and guardian_students
create or replace function public.create_student_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_phone text;
  v_lang text;
begin
  if new.email is null or coalesce(new.raw_app_meta_data->>'role', '') = 'admin' then return new; end if;
  v_name := left(regexp_replace(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email,'@',1)), '\s+', ' ', 'g'), 100);
  if char_length(v_name) < 2 then v_name := 'Account Holder'; end if;
  v_phone := left(nullif(btrim(new.raw_user_meta_data->>'phone'), ''), 30);
  v_lang := case when new.raw_user_meta_data->>'preferred_language' = 'en' then 'en' else 'tr' end;

  -- 1. Ensure guardian account (email_verified_at is NULL initially for new signups; verified during purchase)
  insert into public.guardian_accounts(
    user_id, full_name, email, phone, contact_address, preferred_language,
    email_verified_at, active, migration_source
  ) values (
    new.id, v_name, lower(new.email), v_phone,
    null, v_lang, null, true, 'native_account_holder_v3'
  ) on conflict(user_id) do update set
    full_name = coalesce(public.guardian_accounts.full_name, excluded.full_name),
    email = lower(new.email),
    phone = coalesce(public.guardian_accounts.phone, excluded.phone),
    preferred_language = coalesce(public.guardian_accounts.preferred_language, excluded.preferred_language),
    active = true;

  -- 2. Ensure self student_profile for this user
  insert into public.student_profiles(
    id, full_name, email, phone, preferred_language, active, migration_source
  ) values (
    new.id, v_name, lower(new.email), v_phone, v_lang, true, 'native_self_learner_v3'
  ) on conflict(id) do update set
    full_name = coalesce(public.student_profiles.full_name, excluded.full_name),
    email = lower(new.email),
    phone = coalesce(public.student_profiles.phone, excluded.phone),
    preferred_language = coalesce(public.student_profiles.preferred_language, excluded.preferred_language),
    active = true;

  -- 3. Ensure primary self relationship in guardian_students
  insert into public.guardian_students(
    guardian_user_id, student_id, relationship_role, is_primary, active, source
  ) values (
    new.id, new.id, 'self', true, true, 'native_self_learner_v3'
  ) on conflict(guardian_user_id, student_id) do update set
    relationship_role = 'self',
    is_primary = true,
    active = true;

  -- 4. Reconcile historical bookings & payment transactions by email if any
  update public.bookings
  set student_user_id = new.id
  where student_user_id is null and lower(email) = lower(new.email);

  update public.payment_transactions
  set purchaser_guardian_user_id = coalesce(purchaser_guardian_user_id, new.id),
      package_owner_student_id = coalesce(package_owner_student_id, new.id)
  where lower(payer_email) = lower(new.email);

  return new;
end;
$$;

-- 2. Bounded backfill: For any active guardian_account that has NO active guardian_students record
do $$
declare
  r record;
  v_backfill_count integer := 0;
begin
  for r in
    select ga.user_id, ga.full_name, ga.email, ga.phone, ga.preferred_language
    from public.guardian_accounts ga
    where ga.active
      and not exists (
        select 1 from public.guardian_students gs
        where gs.guardian_user_id = ga.user_id and gs.active
      )
  loop
    -- Ensure student_profiles
    insert into public.student_profiles(id, full_name, email, phone, preferred_language, active, migration_source)
    values (
      r.user_id,
      coalesce(r.full_name, 'Student'),
      lower(r.email),
      r.phone,
      coalesce(r.preferred_language, 'tr'),
      true,
      'stuck_account_backfill_v3'
    ) on conflict (id) do update set active = true;

    -- Ensure guardian_students
    insert into public.guardian_students(guardian_user_id, student_id, relationship_role, is_primary, active, source)
    values (
      r.user_id,
      r.user_id,
      'self',
      true,
      true,
      'stuck_account_backfill_v3'
    ) on conflict (guardian_user_id, student_id) do update set
      is_primary = true,
      active = true;

    v_backfill_count := v_backfill_count + 1;
  end loop;

  raise notice 'Bounded backfill completed: % stuck accounts resolved.', v_backfill_count;
end;
$$;

-- 3. Secure storage for purchase-only email verification OTP challenges
create table if not exists public.purchase_email_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0,
  resend_available_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_purchase_otp_lookup
  on public.purchase_email_verification_challenges(user_id, lower(candidate_email), expires_at desc);

alter table public.purchase_email_verification_challenges enable row level security;
revoke all on public.purchase_email_verification_challenges from public, anon, authenticated;
grant select, insert, update on public.purchase_email_verification_challenges to service_role;
