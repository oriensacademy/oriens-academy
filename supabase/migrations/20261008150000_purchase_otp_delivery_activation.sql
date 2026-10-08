-- Keep purchase-verification OTP challenges unusable until the mail provider
-- accepts the message, and allow a failed provider attempt to be retried
-- immediately without weakening the successful-send dedupe window.

create or replace function public.claim_manual_email_dispatch(
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_recipient text,
  p_window_seconds integer default 60
) returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id uuid;
  v_key text;
  v_window integer := greatest(1, least(coalesce(p_window_seconds, 60), 3600));
begin
  if nullif(btrim(coalesce(p_recipient, '')), '') is null then return null; end if;
  v_key := 'manual:' || coalesce(p_event_type, '') || ':' || coalesce(p_entity_id, '') ||
           ':' || lower(btrim(p_recipient));

  insert into public.notification_deliveries as nd (
    channel, event_type, entity_type, entity_id, recipient, provider,
    status, attempt_count, next_attempt_at, dedupe_key
  ) values (
    'email', p_event_type, p_entity_type, p_entity_id, lower(btrim(p_recipient)),
    'google_workspace', 'processing', 1, now(), v_key
  )
  on conflict (dedupe_key) where dedupe_key is not null do update
    set status = 'processing',
        attempt_count = nd.attempt_count + 1,
        last_error = null,
        last_error_code = null,
        sent_at = null,
        next_attempt_at = now(),
        updated_at = now()
    where nd.status = 'failed'
       or nd.updated_at < now() - make_interval(secs => v_window)
  returning nd.id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.claim_manual_email_dispatch(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_manual_email_dispatch(text, text, text, text, integer) to service_role;

create or replace function public.activate_purchase_email_verification_challenge(
  p_challenge_id uuid,
  p_user_id uuid,
  p_expires_at timestamptz,
  p_resend_available_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_now timestamptz := now();
  v_candidate_email text;
begin
  if p_challenge_id is null or p_user_id is null
     or p_expires_at <= v_now or p_resend_available_at <= v_now then
    return false;
  end if;

  perform 1
  from public.purchase_email_verification_challenges
  where user_id = p_user_id
  for update;

  select candidate_email into v_candidate_email
  from public.purchase_email_verification_challenges
  where id = p_challenge_id
    and user_id = p_user_id
    and verified_at is null
    and superseded_at is not null;

  if v_candidate_email is null then return false; end if;

  update public.purchase_email_verification_challenges
  set superseded_at = v_now,
      expires_at = v_now,
      updated_at = v_now
  where user_id = p_user_id
    and id <> p_challenge_id
    and verified_at is null
    and superseded_at is null;

  update public.purchase_email_verification_challenges
  set superseded_at = null,
      expires_at = p_expires_at,
      resend_available_at = p_resend_available_at,
      updated_at = v_now
  where id = p_challenge_id and user_id = p_user_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_user_id,
    'purchase.email_verification_requested',
    'user',
    p_user_id,
    jsonb_build_object(
      'candidate_email_masked', left(v_candidate_email, 2) || '***@' || split_part(v_candidate_email, '@', 2),
      'delivery_status', 'sent'
    )
  );

  return true;
end;
$fn$;

revoke all on function public.activate_purchase_email_verification_challenge(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.activate_purchase_email_verification_challenge(uuid, uuid, timestamptz, timestamptz) to service_role;
