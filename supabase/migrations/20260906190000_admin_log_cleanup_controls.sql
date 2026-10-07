create or replace function public.admin_delete_audit_log(p_log_id uuid)
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

create or replace function public.admin_delete_notification_delivery(p_delivery_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  delete from public.notification_deliveries where id = p_delivery_id;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('success', v_deleted = 1);
end;
$$;

revoke all on function public.admin_delete_audit_log(uuid) from public, anon;
revoke all on function public.admin_delete_notification_delivery(uuid) from public, anon;
grant execute on function public.admin_delete_audit_log(uuid) to authenticated;
grant execute on function public.admin_delete_notification_delivery(uuid) to authenticated;

-- Service-role maintenance may clear customer correspondence before handover;
-- ordinary admin/user calls retain the immutable-history protection.
create or replace function public.protect_contact_reply_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
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

-- Completing a lesson must never send an e-mail as a hidden side effect. The
-- administrator's explicit "send e-mail" action uses MAIL-027 instead.
create or replace function public.suppress_uncontrolled_lesson_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.template = 'lesson_remaining_rights_account_holder' then return null; end if;
  return new;
end;
$$;

drop trigger if exists suppress_uncontrolled_lesson_email on public.notification_deliveries;
create trigger suppress_uncontrolled_lesson_email
before insert on public.notification_deliveries
for each row execute function public.suppress_uncontrolled_lesson_email();
