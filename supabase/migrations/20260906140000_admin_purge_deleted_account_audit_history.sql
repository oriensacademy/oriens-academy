-- Migration: 20260906140000_admin_purge_deleted_account_audit_history.sql
-- Purpose: Permission-safe purge of pre-existing user-bound audit logs for deleted QA/test accounts.
-- Preserves the generic 'account_deleted' terminal events (exactly 1 per account).
-- Excludes active auth users, protected owner/admin accounts, and financial ledger records.

create or replace function public.admin_purge_deleted_account_audit_history(
  p_target_account_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_protected_emails text[] := array[
    'mertomeroglu7@gmail.com',
    'oriensacademy@gmail.com',
    'admin@oriens-academy.com'
  ];
  v_active_count integer := 0;
  v_target_texts text[];
  v_purged_count integer := 0;
  v_terminal_count integer := 0;
begin
  -- 1. Authorization: caller must be admin or postgres/service_role
  if not public.is_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if p_target_account_ids is null or array_length(p_target_account_ids, 1) is null or array_length(p_target_account_ids, 1) = 0 then
    return jsonb_build_object(
      'success', true,
      'purged_audit_logs', 0,
      'message', 'No target account IDs provided'
    );
  end if;

  -- 2. Guard: Never target active auth users
  select count(*) into v_active_count
  from auth.users
  where id = any(p_target_account_ids);

  if v_active_count > 0 then
    raise exception 'CANNOT_PURGE_ACTIVE_AUTH_USERS: % active accounts found in target list', v_active_count
      using errcode = '22023';
  end if;

  -- 3. Guard: Protected emails check in auth.users (defense in depth)
  select count(*) into v_active_count
  from auth.users
  where lower(email) = any(v_protected_emails)
    and id = any(p_target_account_ids);

  if v_active_count > 0 then
    raise exception 'CANNOT_PURGE_PROTECTED_ACCOUNTS' using errcode = '22023';
  end if;

  select coalesce(array_agg(x::text), array[]::text[]) into v_target_texts
  from unnest(p_target_account_ids) as t(x);

  -- 4. Verify that target accounts have account_deleted terminal events
  select count(*) into v_terminal_count
  from public.audit_logs
  where action = 'account_deleted'
    and entity_id = any(v_target_texts);

  -- 5. Permission-safe deletion of user-bound operational audit history
  -- STRICT RULES:
  -- - NEVER delete 'account_deleted' events
  -- - Only delete operational logs linked to the deleted target IDs
  -- - Active user logs and financial ledger entries are not touched
  delete from public.audit_logs
  where action != 'account_deleted'
    and (
      actor_user_id = any(p_target_account_ids)
      or entity_id = any(v_target_texts)
      or (metadata ->> 'student_id') = any(v_target_texts)
      or (metadata ->> 'student_user_id') = any(v_target_texts)
      or (metadata ->> 'account_holder_id') = any(v_target_texts)
    );

  get diagnostics v_purged_count = row_count;

  return jsonb_build_object(
    'success', true,
    'target_accounts_count', array_length(p_target_account_ids, 1),
    'purged_audit_logs', v_purged_count,
    'terminal_account_deleted_events', v_terminal_count
  );
end;
$fn$;

revoke all on function public.admin_purge_deleted_account_audit_history(uuid[]) from public, anon;
grant execute on function public.admin_purge_deleted_account_audit_history(uuid[]) to authenticated, service_role;
