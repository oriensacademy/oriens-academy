-- Migration: 20260903120000_signup_otp_gate_paytr_repair.sql
-- Description:
-- 1. Bounded grandfathering of evidenced restored real students (migration_source =
--    'restored_real_student_v1') so the new signup-OTP gate does not lock them out.
--    Runs BEFORE the welcome-mail retarget below so it cannot enqueue a welcome email
--    for already-onboarded real students.
-- 2. Retarget the guardian welcome-mail trigger away from auth.users.email_confirmed_at
--    (which auto-flips at signup because Confirm Email is OFF, independent of real
--    verification) onto guardian_accounts.email_verified_at (the canonical
--    application-level verification field, set only by the OTP verification functions).

-- 1. Bounded grandfathering: only accounts explicitly tagged during the restore/migration
-- process as real students, currently unverified. No blanket verification of test/unknown
-- accounts.
do $$
declare
  v_count integer := 0;
  v_ids text;
begin
  with candidates as (
    select user_id from public.guardian_accounts
    where migration_source = 'restored_real_student_v1'
      and email_verified_at is null
  ),
  updated as (
    update public.guardian_accounts ga
    set email_verified_at = now(), updated_at = now()
    from candidates
    where ga.user_id = candidates.user_id
    returning ga.user_id, ga.email
  )
  select count(*), string_agg(user_id::text, ', ') into v_count, v_ids from updated;

  raise notice 'Grandfathered % restored real student account(s): %', v_count, coalesce(v_ids, '(none)');

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  select null, 'guardian.grandfathered_email_verified', 'guardian_account', ga.user_id::text,
    jsonb_build_object('reason', 'restored_real_student_v1_bounded_migration', 'migration', '20260903120000')
  from public.guardian_accounts ga
  where ga.migration_source = 'restored_real_student_v1'
    and ga.email_verified_at is not null
    and not exists (
      select 1 from public.audit_logs al
      where al.entity_id = ga.user_id::text and al.action = 'guardian.grandfathered_email_verified'
    );
end;
$$;

-- 2. Retarget welcome-mail trigger onto the canonical application verification field.
drop trigger if exists on_auth_user_verified_guardian_welcome on auth.users;
drop function if exists public.queue_verified_guardian_welcome_email();

create or replace function public.queue_guardian_email_verified_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_verified_at is null and new.email_verified_at is not null then
    perform public.enqueue_email_notification('guardian.welcome', 'guardian_account', new.user_id::text,
      new.email, 'guardian_welcome', jsonb_build_object(
        'guardian_name', new.full_name, 'locale', new.preferred_language
      ), 'guardian.welcome:'||new.user_id||':guardian');
  end if;
  return new;
end;
$$;

drop trigger if exists on_guardian_email_verified_welcome on public.guardian_accounts;
create trigger on_guardian_email_verified_welcome
  after update of email_verified_at on public.guardian_accounts
  for each row execute function public.queue_guardian_email_verified_welcome();
