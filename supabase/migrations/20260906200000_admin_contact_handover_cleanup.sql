create or replace function public.protect_contact_reply_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('oriens.contact_cleanup', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then raise exception 'CONTACT_REPLY_HISTORY_IMMUTABLE' using errcode = '42501'; end if;
  if new.id is distinct from old.id
    or new.contact_request_id is distinct from old.contact_request_id
    or new.direction is distinct from old.direction
    or new.sender_email is distinct from old.sender_email
    or new.recipient_email is distinct from old.recipient_email
    or new.sender_name is distinct from old.sender_name
    or new.message_text is distinct from old.message_text
    or new.message_html is distinct from old.message_html
    or new.sent_by_admin_user_id is distinct from old.sent_by_admin_user_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.created_at is distinct from old.created_at then
    raise exception 'CONTACT_REPLY_CONTENT_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.admin_clear_contact_history()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_replies integer; v_requests integer;
begin
  if not public.is_admin()
     and current_user not in ('postgres', 'service_role')
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then raise exception 'ADMIN_OR_SERVICE_REQUIRED' using errcode = '42501'; end if;
  perform set_config('oriens.contact_cleanup', 'on', true);
  delete from public.contact_replies where true;
  get diagnostics v_replies = row_count;
  delete from public.contact_requests where true;
  get diagnostics v_requests = row_count;
  return jsonb_build_object('success', true, 'deleted_replies', v_replies, 'deleted_requests', v_requests);
end;
$$;

revoke all on function public.admin_clear_contact_history() from public, anon;
grant execute on function public.admin_clear_contact_history() to authenticated, service_role;
