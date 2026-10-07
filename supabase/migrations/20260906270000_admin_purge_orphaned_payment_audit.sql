-- Migration: 20260906270000_admin_purge_orphaned_payment_audit.sql
-- Purpose: Remove payment-lifecycle audit rows whose transaction no longer exists.
--
-- admin_purge_deleted_account_audit_history() matches audit rows by account id,
-- but the PayTR lifecycle events (payment_session_requested, paytr_token_created,
-- paytr_iframe_opened, payment_status_pending, payment_completed,
-- payment_success_return_reached, payment_status_paid) are keyed by
-- entity_id = payment_transactions.public_reference. When a test transaction is
-- deleted from the ledger those rows survive and Admin -> Denetim keeps showing
-- events for a transaction that cannot be opened any more.
--
-- service_role has no DELETE on public.audit_logs by design
-- (20260811230000_least_privilege_service_role.sql), so this is the sanctioned
-- SECURITY DEFINER escape hatch, in the same shape as the existing admin audit
-- cleanup RPCs.
--
-- Safety: a row is only removable when its entity_id matches NO row in
-- payment_transactions. The function cannot touch the audit history of a live
-- transaction even if a caller passes its reference, and it never deletes
-- 'account_deleted' terminal events.

create or replace function public.admin_purge_orphaned_payment_audit(
  p_public_references text[] default null,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_orphans text[];
  v_purged_count integer := 0;
begin
  -- 1. Authorization: caller must be admin or postgres/service_role
  if not public.is_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  -- 2. Resolve the orphaned references. A reference qualifies only when no
  --    payment_transactions row claims it, so live ledger history is untouchable.
  select coalesce(array_agg(distinct al.entity_id), array[]::text[])
  into v_orphans
  from public.audit_logs al
  where al.entity_type = 'payment_transaction'
    and al.action <> 'account_deleted'
    and (p_public_references is null or al.entity_id = any(p_public_references))
    and not exists (
      select 1 from public.payment_transactions pt
      where pt.public_reference = al.entity_id
    );

  if array_length(v_orphans, 1) is null then
    return jsonb_build_object('success', true, 'dry_run', p_dry_run, 'orphaned_references', array[]::text[], 'purged_audit_logs', 0);
  end if;

  if p_dry_run then
    select count(*) into v_purged_count
    from public.audit_logs
    where entity_type = 'payment_transaction'
      and action <> 'account_deleted'
      and entity_id = any(v_orphans);

    return jsonb_build_object(
      'success', true,
      'dry_run', true,
      'orphaned_references', v_orphans,
      'purged_audit_logs', v_purged_count
    );
  end if;

  delete from public.audit_logs
  where entity_type = 'payment_transaction'
    and action <> 'account_deleted'
    and entity_id = any(v_orphans);

  get diagnostics v_purged_count = row_count;

  return jsonb_build_object(
    'success', true,
    'dry_run', false,
    'orphaned_references', v_orphans,
    'purged_audit_logs', v_purged_count
  );
end;
$fn$;

revoke all on function public.admin_purge_orphaned_payment_audit(text[], boolean) from public, anon;
grant execute on function public.admin_purge_orphaned_payment_audit(text[], boolean) to authenticated, service_role;
