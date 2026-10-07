create or replace function public.admin_clear_audit_logs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted integer;
begin
  if not public.is_admin()
     and current_user not in ('postgres', 'service_role')
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then raise exception 'ADMIN_OR_SERVICE_REQUIRED' using errcode = '42501'; end if;
  delete from public.audit_logs where true;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('success', true, 'deleted_logs', v_deleted);
end;
$$;

revoke all on function public.admin_clear_audit_logs() from public, anon;
grant execute on function public.admin_clear_audit_logs() to authenticated, service_role;
