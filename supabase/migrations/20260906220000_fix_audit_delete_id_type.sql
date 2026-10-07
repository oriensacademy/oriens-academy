drop function if exists public.admin_delete_audit_log(uuid);

create or replace function public.admin_delete_audit_log(p_log_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  delete from public.audit_logs where id = p_log_id;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('success', v_deleted = 1);
end;
$$;

revoke all on function public.admin_delete_audit_log(bigint) from public, anon;
grant execute on function public.admin_delete_audit_log(bigint) to authenticated;
