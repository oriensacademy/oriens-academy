-- Migration: 20260906100000_otp_atomic_verification.sql
--
-- Fixes the production blocker where a CORRECT 6-digit OTP was rejected with
-- "Girdiğiniz doğrulama kodu hatalı".
--
-- Root cause (two paths into the same structural defect):
--
--   1. Both verifiers picked "the newest non-verified, non-expired challenge"
--      (order by created_at desc limit 1) and compared the submitted code
--      against THAT row only. Whenever more than one challenge was active, or
--      the newest one had been consumed by something other than the user, the
--      code was compared against a row it never belonged to -- a correct code
--      then reports as wrong.
--
--   2. Multiple challenges really could be active at once. The one-click
--      verification link (verify-purchase-email-link) marked the newest
--      challenge verified as soon as ANY client fetched the URL -- and mail
--      security scanners / link prefetchers fetch every URL in an email before
--      the user ever opens it. The verifier then fell through to an older,
--      still-active challenge and rejected the fresh code.
--
-- Fix: verification becomes a single atomic, row-locking RPC that matches the
-- submitted hash against EVERY active challenge for that user, consumes the one
-- that actually matches, and only touches the attempt counter when nothing
-- matched. A correct code can no longer be attributed to the wrong row, and can
-- no longer cost the user an attempt.
--
-- The HMAC message layouts are deliberately unchanged, so codes already sitting
-- in users' inboxes keep verifying.

-- ==============================================================================
-- 0. THE ACTUAL ROOT CAUSE: AMBIGUOUS enqueue_email_notification OVERLOAD
-- ==============================================================================
-- 20260904240000 added an 8-argument enqueue_email_notification whose last
-- parameter (p_next_attempt_at) has a DEFAULT, while the original 7-argument
-- version from 20260831150000 was left in place. Every existing call site passes
-- 7 arguments, and Postgres cannot choose between "the 7-arg function" and "the
-- 8-arg function with its default applied":
--
--   ERROR 42725: function public.enqueue_email_notification(unknown, unknown,
--                text, text, unknown, jsonb, text) is not unique
--
-- There are 19 such call sites, all inside triggers and SECURITY DEFINER
-- functions. The consequence is not merely "the email is skipped" -- the
-- exception aborts the *statement that fired the trigger*:
--
--   UPDATE guardian_accounts SET email_verified_at = ...
--     -> trg_guardian_email_verified_welcome
--       -> enqueue_email_notification(7 args)  -> 42725 -> UPDATE ROLLED BACK
--
-- The OTP verifier discarded that error and still returned success, so the
-- challenge was marked verified while email_verified_at stayed NULL. The portal
-- gates on email_verified_at, so every reload showed the OTP screen again, and
-- each reload issued a fresh challenge -- which is why a correct code from the
-- previous email then reported as wrong and burned an attempt.
--
-- Verified in production: guardian_accounts row for the affected signup has
-- email_verified_at = NULL despite two challenges with verified_at set, and the
-- update reproduces 42725 on demand.
--
-- Fix: drop the 7-argument overload. Every 7-argument call then resolves
-- unambiguously to the 8-argument version, whose default is now() -- exactly
-- the behaviour the 7-argument version had.

drop function if exists public.enqueue_email_notification(text, text, text, text, text, jsonb, text);

-- ==============================================================================
-- 1. SUPERSEDED MARKER
-- ==============================================================================
-- Requesting a new code previously "invalidated" older challenges by back-dating
-- expires_at, which makes a superseded challenge indistinguishable from one that
-- timed out. They need different messages ("request a new code" vs "you already
-- did -- use the newest email"), so record the distinction explicitly.

alter table public.purchase_email_verification_challenges
  add column if not exists superseded_at timestamptz;
alter table public.email_change_challenges
  add column if not exists superseded_at timestamptz;

create index if not exists idx_purchase_otp_active
  on public.purchase_email_verification_challenges (user_id, candidate_email, created_at desc)
  where verified_at is null and superseded_at is null;

create index if not exists idx_email_change_otp_active
  on public.email_change_challenges (user_id, created_at desc)
  where verified_at is null and superseded_at is null;

-- ==============================================================================
-- 2. PURCHASE / SIGNUP EMAIL VERIFICATION (MAIL-001, MAIL-006)
-- ==============================================================================

create or replace function public.verify_purchase_email_otp(
  p_user_id uuid,
  p_candidate_email text,
  p_code_hash text,
  p_max_attempts integer default 5
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_email text := lower(btrim(coalesce(p_candidate_email, '')));
  v_match public.purchase_email_verification_challenges%rowtype;
  v_newest public.purchase_email_verification_challenges%rowtype;
  v_active_count integer;
  v_guardian_updated integer := 0;
  v_now timestamptz := now();
begin
  if p_user_id is null or v_email = '' or nullif(btrim(coalesce(p_code_hash, '')), '') is null then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_REQUEST');
  end if;

  -- Lock every challenge for this identity so two concurrent submissions cannot
  -- both consume a code or both increment the counter.
  perform 1
  from public.purchase_email_verification_challenges
  where user_id = p_user_id and lower(btrim(candidate_email)) = v_email
  for update;

  select count(*) into v_active_count
  from public.purchase_email_verification_challenges
  where user_id = p_user_id and lower(btrim(candidate_email)) = v_email
    and verified_at is null and superseded_at is null and expires_at > v_now;

  if v_active_count = 0 then
    -- Nothing live: say precisely why rather than blaming the code.
    if exists (
      select 1 from public.purchase_email_verification_challenges
      where user_id = p_user_id and lower(btrim(candidate_email)) = v_email and verified_at is not null
    ) then
      return jsonb_build_object('success', false, 'error_code', 'ALREADY_VERIFIED');
    end if;
    if exists (
      select 1 from public.purchase_email_verification_challenges
      where user_id = p_user_id and lower(btrim(candidate_email)) = v_email and superseded_at is not null
    ) then
      return jsonb_build_object('success', false, 'error_code', 'SUPERSEDED');
    end if;
    return jsonb_build_object('success', false, 'error_code', 'EXPIRED');
  end if;

  select * into v_newest
  from public.purchase_email_verification_challenges
  where user_id = p_user_id and lower(btrim(candidate_email)) = v_email
    and verified_at is null and superseded_at is null and expires_at > v_now
  order by created_at desc, id desc
  limit 1;

  if coalesce(v_newest.attempt_count, 0) >= p_max_attempts then
    return jsonb_build_object('success', false, 'error_code', 'TOO_MANY_ATTEMPTS');
  end if;

  -- Match against EVERY active challenge, not just the newest one. This is the
  -- actual fix: a correct code is never judged against a row it did not come from.
  select * into v_match
  from public.purchase_email_verification_challenges
  where user_id = p_user_id and lower(btrim(candidate_email)) = v_email
    and verified_at is null and superseded_at is null and expires_at > v_now
    and code_hash = p_code_hash
  order by created_at desc, id desc
  limit 1;

  if v_match.id is null then
    -- Only a genuinely wrong code costs an attempt.
    update public.purchase_email_verification_challenges
    set attempt_count = coalesce(attempt_count, 0) + 1, updated_at = v_now
    where id = v_newest.id;
    return jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_CODE',
      'remaining_attempts', greatest(0, p_max_attempts - (coalesce(v_newest.attempt_count, 0) + 1))
    );
  end if;

  -- Consume the matched challenge and retire every sibling in the same step.
  update public.purchase_email_verification_challenges
  set verified_at = v_now, updated_at = v_now
  where id = v_match.id;

  update public.purchase_email_verification_challenges
  set superseded_at = v_now, updated_at = v_now
  where user_id = p_user_id and lower(btrim(candidate_email)) = v_email
    and id <> v_match.id and verified_at is null and superseded_at is null;

  -- Persist the account state in the SAME transaction as consuming the code.
  -- Previously the Edge Function did this afterwards and discarded the result,
  -- so a failed write (see section 0) still reported verification as successful
  -- while email_verified_at stayed NULL -- the portal then re-gated on every
  -- reload. Either both land or neither does.
  update public.guardian_accounts
  set email = v_email,
      email_verified_at = coalesce(email_verified_at, v_now),
      updated_at = v_now
  where user_id = p_user_id;
  get diagnostics v_guardian_updated = row_count;

  update public.student_profiles
  set email = v_email, updated_at = v_now
  where id = p_user_id;

  if v_guardian_updated = 0 then
    -- No account row to mark verified: refuse rather than report a success the
    -- portal will immediately contradict.
    raise exception 'GUARDIAN_ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'success', true,
    'challenge_id', v_match.id,
    'candidate_email', v_match.candidate_email,
    'account_verified', true,
    'verified_at', v_now
  );
end;
$fn$;

revoke all on function public.verify_purchase_email_otp(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.verify_purchase_email_otp(uuid, text, text, integer) to service_role;

-- ==============================================================================
-- 3. EMAIL CHANGE VERIFICATION (MAIL-007)
-- ==============================================================================

create or replace function public.verify_email_change_otp(
  p_user_id uuid,
  p_code_hash text,
  p_max_attempts integer default 5
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_match public.email_change_challenges%rowtype;
  v_newest public.email_change_challenges%rowtype;
  v_active_count integer;
  v_now timestamptz := now();
begin
  if p_user_id is null or nullif(btrim(coalesce(p_code_hash, '')), '') is null then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_REQUEST');
  end if;

  perform 1 from public.email_change_challenges where user_id = p_user_id for update;

  select count(*) into v_active_count
  from public.email_change_challenges
  where user_id = p_user_id and verified_at is null and superseded_at is null and expires_at > v_now;

  if v_active_count = 0 then
    if exists (select 1 from public.email_change_challenges where user_id = p_user_id and verified_at is not null) then
      return jsonb_build_object('success', false, 'error_code', 'ALREADY_VERIFIED');
    end if;
    if exists (select 1 from public.email_change_challenges where user_id = p_user_id and superseded_at is not null) then
      return jsonb_build_object('success', false, 'error_code', 'SUPERSEDED');
    end if;
    return jsonb_build_object('success', false, 'error_code', 'EXPIRED');
  end if;

  select * into v_newest
  from public.email_change_challenges
  where user_id = p_user_id and verified_at is null and superseded_at is null and expires_at > v_now
  order by created_at desc, id desc
  limit 1;

  if coalesce(v_newest.attempt_count, 0) >= p_max_attempts then
    return jsonb_build_object('success', false, 'error_code', 'TOO_MANY_ATTEMPTS');
  end if;

  select * into v_match
  from public.email_change_challenges
  where user_id = p_user_id and verified_at is null and superseded_at is null and expires_at > v_now
    and code_hash = p_code_hash
  order by created_at desc, id desc
  limit 1;

  if v_match.id is null then
    update public.email_change_challenges
    set attempt_count = coalesce(attempt_count, 0) + 1, updated_at = v_now
    where id = v_newest.id;
    return jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_CODE',
      'remaining_attempts', greatest(0, p_max_attempts - (coalesce(v_newest.attempt_count, 0) + 1))
    );
  end if;

  update public.email_change_challenges
  set verified_at = v_now, updated_at = v_now
  where id = v_match.id;

  update public.email_change_challenges
  set superseded_at = v_now, updated_at = v_now
  where user_id = p_user_id and id <> v_match.id and verified_at is null and superseded_at is null;

  -- Move the account to the new address atomically with consuming the code.
  update public.guardian_accounts
  set email = lower(btrim(v_match.new_email)),
      email_verified_at = v_now,
      updated_at = v_now
  where user_id = p_user_id;

  update public.student_profiles
  set email = lower(btrim(v_match.new_email)), updated_at = v_now
  where id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'challenge_id', v_match.id,
    'old_email', v_match.old_email,
    'new_email', v_match.new_email,
    'verified_at', v_now
  );
end;
$fn$;

revoke all on function public.verify_email_change_otp(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.verify_email_change_otp(uuid, text, integer) to service_role;

-- ==============================================================================
-- 4. RETIRE ONE-CLICK VERIFICATION DATA
-- ==============================================================================
-- Business rule: email verification is 6-digit OTP only. The link token column
-- is emptied so no already-issued link can still be redeemed, and the lookup
-- index that only served that flow is dropped. The column itself is left in
-- place (dropping it would break any Edge Function revision still deployed
-- while this migration lands); it is written by nothing after this change.

update public.purchase_email_verification_challenges
set verification_token_hash = null
where verification_token_hash is not null;

drop index if exists public.idx_purchase_verification_token_hash;

comment on column public.purchase_email_verification_challenges.verification_token_hash is
  'DEPRECATED and always NULL. One-click email verification was removed -- verification is 6-digit OTP only. Retained only so older deployed function revisions cannot error on a missing column.';
