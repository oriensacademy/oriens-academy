-- Stop historical PayTR retry noise from obscuring the operational audit log.
-- Preserve the earliest evidence for every reference/action pair, remove only
-- exact retry duplicates, then enforce the invariant at database level.

do $cleanup$
declare
  v_deleted integer := 0;
begin
  with ranked as (
    select id,
           row_number() over (
             partition by entity_id, action
             order by created_at asc, id asc
           ) as occurrence
    from public.audit_logs
    where entity_type = 'payment_transaction'
      and action in ('paytr_callback_received', 'paytr_callback_transaction_not_found')
  ), deleted as (
    delete from public.audit_logs a
    using ranked r
    where a.id = r.id
      and r.occurrence > 1
    returning a.id
  )
  select count(*) into v_deleted from deleted;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    null,
    'paytr_callback_retry_noise_cleaned',
    'system_maintenance',
    'paytr-callback',
    jsonb_build_object(
      'deleted_duplicate_rows', v_deleted,
      'preservation_rule', 'earliest_row_per_payment_reference_and_action',
      'reason', 'provider_retry_loop_after_missing_test_transactions',
      'cleaned_at', now()
    )
  );
end;
$cleanup$;

create unique index if not exists idx_audit_paytr_callback_once_per_reference
  on public.audit_logs (entity_id, action)
  where entity_type = 'payment_transaction'
    and action in ('paytr_callback_received', 'paytr_callback_transaction_not_found');
