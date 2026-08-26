-- ============================================================================
-- ALLOW SERVICE_ROLE IN ADMIN_MARK_NOTIFICATIONS_READ RPC
-- Migration: 20260827143000_update_admin_mark_notifications_read_service_role.sql
-- ============================================================================

create or replace function public.admin_mark_notifications_read(
  p_notification_ids uuid[] default null,
  p_mark_all boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_count integer := 0;
begin
  if not public.is_admin()
     and current_user not in ('postgres', 'service_role')
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_mark_all then
    update public.notification_deliveries
    set
      is_read = true,
      read_at = coalesce(read_at, now())
    where is_read = false;
    get diagnostics v_updated_count = row_count;
  elsif p_notification_ids is not null and array_length(p_notification_ids, 1) > 0 then
    update public.notification_deliveries
    set
      is_read = true,
      read_at = coalesce(read_at, now())
    where id = any(p_notification_ids) and is_read = false;
    get diagnostics v_updated_count = row_count;
  end if;

  return jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count
  );
end;
$$;

revoke all on function public.admin_mark_notifications_read(uuid[], boolean) from public, anon;
grant execute on function public.admin_mark_notifications_read(uuid[], boolean) to authenticated, service_role;
