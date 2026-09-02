-- ==============================================================================
-- Migration: 20260902200000_paytr_lifecycle_and_agreements.sql
-- Description:
--   1. confirm_payment_agreements RPC for auditable legal acceptance during preload
--   2. expire_stale_card_payments function for ~30m card pending TTL lifecycle
--   3. pg_cron schedule to execute TTL cleanup every 5 minutes
-- ==============================================================================

-- 1. Legal Agreement Confirmation RPC for Preloaded Payment Transactions
create or replace function public.confirm_payment_agreements(
  p_merchant_oid text,
  p_legal_versions jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  update public.payment_transactions
  set
    metadata = metadata || jsonb_build_object(
      'sales_terms_accepted_at', now(),
      'pre_information_accepted_at', now(),
      'refund_policy_accepted_at', now(),
      'sales_terms_version', coalesce(p_legal_versions->>'salesAgreement', metadata->>'sales_terms_version', '2026-08-27'),
      'pre_information_version', coalesce(p_legal_versions->>'preInformation', metadata->>'pre_information_version', '2026-08-27'),
      'refund_policy_version', coalesce(p_legal_versions->>'refundPolicy', metadata->>'refund_policy_version', '2026-08-27'),
      'legal_accepted', true
    ),
    updated_at = now()
  where public_reference = p_merchant_oid
    and status = 'pending'
    and (
      auth_actor_user_id = auth.uid()
      or purchaser_guardian_user_id = auth.uid()
      or public.is_admin()
    );

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.confirm_payment_agreements(text, jsonb) from public, anon;
grant execute on function public.confirm_payment_agreements(text, jsonb) to authenticated, service_role;

-- 2. Server-Side TTL Function for Stale Card Pending Transactions
create or replace function public.expire_stale_card_payments(p_threshold_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with expired as (
    update public.payment_transactions
    set
      status = 'cancelled',
      updated_at = now(),
      metadata = metadata || jsonb_build_object(
        'status_reason', 'timeout',
        'cancellation_reason', 'stale_pending_ttl',
        'cancelled_at', now()
      )
    where payment_method = 'card'
      and status in ('pending', 'requires_action', 'processing')
      and created_at < (now() - make_interval(mins => p_threshold_minutes))
    returning id
  )
  select count(*) into v_count from expired;

  return v_count;
end;
$$;

revoke all on function public.expire_stale_card_payments(integer) from public, anon;
grant execute on function public.expire_stale_card_payments(integer) to authenticated, service_role;

-- 3. Schedule pg_cron Job Every 5 Minutes
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'expire-stale-card-payments-every-5-minutes';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'expire-stale-card-payments-every-5-minutes',
    '*/5 * * * *',
    $cron$
      select public.expire_stale_card_payments(30);
    $cron$
  );
end;
$$;
