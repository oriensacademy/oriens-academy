-- Migration: 20260902220000_fix_purchase_verification_and_one_click.sql
-- Description:
-- 1. Add verification_token_hash to purchase_email_verification_challenges for one-click email verification.
-- 2. Correct sync_guardian_auth_state() so auth.users.email_confirmed_at does NOT auto-verify guardian_accounts.email_verified_at.
-- 3. Bounded correction of false-positive auto-verifications on test accounts created during cutover.

-- 1. Add token hash column to purchase_email_verification_challenges
alter table public.purchase_email_verification_challenges
  add column if not exists verification_token_hash text;

create index if not exists idx_purchase_verification_token_hash
  on public.purchase_email_verification_challenges(verification_token_hash)
  where verified_at is null;

-- 2. Update sync_guardian_auth_state trigger function:
-- MUST NOT copy email_confirmed_at to email_verified_at.
-- Purchase email verification is strictly independent from signup auth confirmation.
create or replace function public.sync_guardian_auth_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guardian_accounts
  set email = lower(new.email),
      updated_at = now()
  where user_id = new.id;

  update public.student_profiles
  set email = lower(new.email),
      updated_at = now()
  where legacy_auth_user_id = new.id;

  return new;
end;
$$;

-- 3. Bounded correction for false-positive auto-verifications
-- Only reset test accounts created after the frictionless-signup cutover (2026-09-02)
-- that have NO purchase verification challenge and NO real payment transactions and are not admin.
do $$
declare
  v_fixed_count integer := 0;
begin
  with candidates as (
    select g.user_id
    from public.guardian_accounts g
    where g.email_verified_at is not null
      and g.created_at >= '2026-09-02 00:00:00+00'
      and g.email in ('frkccku00s@ozsaip.com', 'hodejo6572@robustq.com')
      and not exists (
        select 1 from public.purchase_email_verification_challenges c
        where c.user_id = g.user_id and c.verified_at is not null
      )
      and not exists (
        select 1 from public.payment_transactions pt
        where (pt.purchaser_guardian_user_id = g.user_id or pt.student_user_id = g.user_id or pt.payer_email = g.email)
          and pt.status = 'completed'
      )
  )
  update public.guardian_accounts ga
  set email_verified_at = null,
      updated_at = now()
  from candidates
  where ga.user_id = candidates.user_id;

  get diagnostics v_fixed_count = row_count;
  raise notice 'Bounded false-positive correction: % accounts reset to unverified.', v_fixed_count;
end;
$$;
