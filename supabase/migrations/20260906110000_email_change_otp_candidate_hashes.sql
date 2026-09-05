-- Migration: 20260906110000_email_change_otp_candidate_hashes.sql
--
-- Follow-up to 20260906100000. The email-change OTP is bound to the challenge's
-- own `new_email`, so the verifier cannot compute a single expected hash before
-- it knows which challenge the code belongs to -- the exact circular dependency
-- that made the previous implementation fall back to "newest challenge wins".
--
-- Resolution: the Edge Function computes one hash per active challenge (each
-- bound to that row's new_email) and hands the set to the RPC, which atomically
-- consumes whichever row matches. Per-row email binding is preserved: a wrong
-- code produces no matching hash for any row.

drop function if exists public.verify_email_change_otp(uuid, text, integer);

create or replace function public.verify_email_change_otp(
  p_user_id uuid,
  p_code_hashes text[],
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
  if p_user_id is null or p_code_hashes is null or array_length(p_code_hashes, 1) is null then
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
    and code_hash = any(p_code_hashes)
  order by created_at desc, id desc
  limit 1;

  if v_match.id is null then
    -- Only a genuinely wrong code costs an attempt.
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

revoke all on function public.verify_email_change_otp(uuid, text[], integer) from public, anon, authenticated;
grant execute on function public.verify_email_change_otp(uuid, text[], integer) to service_role;
