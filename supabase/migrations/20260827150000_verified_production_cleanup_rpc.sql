-- ============================================================================
-- VERIFIED PRODUCTION CLEANUP RPC & GRANTS
-- Migration: 20260827150000_verified_production_cleanup_rpc.sql
-- ============================================================================

grant delete on public.contact_requests to service_role;
grant delete on public.notification_deliveries to service_role;
grant delete on public.payment_transactions to service_role;

create or replace function public.execute_verified_production_cleanup(
  p_contact_ids uuid[],
  p_test_payment_ids uuid[],
  p_clear_notifications boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_contacts integer := 0;
  v_deleted_notifications integer := 0;
  v_deleted_payments integer := 0;
  v_protected_e_id uuid := '95963699-7a64-47ee-a415-09572941af73'::uuid;
  v_protected_a_id uuid := '27effcf8-b41e-4966-9229-da80b6d7e901'::uuid;
begin
  if not public.is_admin()
     and current_user not in ('postgres', 'service_role')
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Safety assertion: Never allow deletion of protected users' payments
  if exists (
    select 1 from public.payment_transactions
    where id = any(p_test_payment_ids)
      and (student_user_id in (v_protected_e_id, v_protected_a_id)
           or payer_email in ('yesim.alaeddinoglu@gmail.com', 'aydinozbek15@hotmail.com'))
  ) then
    raise exception 'SAFETY_VIOLATION: Attempted to delete protected user payment';
  end if;

  -- Safety assertion: Never allow deletion of transactions linked to packages
  if exists (
    select 1 from public.student_package_purchases
    where payment_transaction_id = any(p_test_payment_ids)
  ) then
    raise exception 'SAFETY_VIOLATION: Attempted to delete transaction linked to package purchase';
  end if;

  -- 1. Delete Contact Requests
  if p_contact_ids is not null and array_length(p_contact_ids, 1) > 0 then
    delete from public.contact_requests
    where id = any(p_contact_ids)
      and email in (
        'qa-contact-1787786086359@oriens-academy.com',
        'qa-contact-1787785256546@oriens-academy.com'
      );
    get diagnostics v_deleted_contacts = row_count;
  end if;

  -- 2. Delete Notifications
  if p_clear_notifications then
    delete from public.notification_deliveries;
    get diagnostics v_deleted_notifications = row_count;
  end if;

  -- 3. Delete Confirmed Test Payments
  if p_test_payment_ids is not null and array_length(p_test_payment_ids, 1) > 0 then
    delete from public.payment_transactions
    where id = any(p_test_payment_ids);
    get diagnostics v_deleted_payments = row_count;
  end if;

  return jsonb_build_object(
    'success', true,
    'deleted_contacts', v_deleted_contacts,
    'deleted_notifications', v_deleted_notifications,
    'deleted_payments', v_deleted_payments
  );
end;
$$;

revoke all on function public.execute_verified_production_cleanup(uuid[], uuid[], boolean) from public, anon;
grant execute on function public.execute_verified_production_cleanup(uuid[], uuid[], boolean) to authenticated, service_role;
