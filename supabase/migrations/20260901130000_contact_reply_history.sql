-- Dedicated, auditable contact reply history for authenticated admin replies.

create table public.contact_replies (
  id uuid primary key default gen_random_uuid(),
  contact_request_id uuid not null references public.contact_requests(id) on delete restrict,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_email text not null,
  recipient_email text not null,
  sender_name text not null,
  message_text text not null check (char_length(message_text) between 1 and 10000),
  message_html text,
  external_message_id text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  sent_by_admin_user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  error_metadata jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint contact_replies_error_metadata_object check (error_metadata is null or jsonb_typeof(error_metadata) = 'object'),
  constraint contact_replies_sent_timestamp check (delivery_status <> 'sent' or sent_at is not null),
  constraint contact_replies_request_idempotency unique (contact_request_id, idempotency_key)
);

create index contact_replies_thread_chronology_idx
  on public.contact_replies (contact_request_id, created_at, id);

alter table public.contact_replies enable row level security;

create policy "Admins can read contact reply history"
  on public.contact_replies
  for select
  to authenticated
  using (public.is_admin());

revoke all on table public.contact_replies from anon, authenticated;
grant select on table public.contact_replies to authenticated;
grant select, insert, update on table public.contact_replies to service_role;

create or replace function public.protect_contact_reply_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CONTACT_REPLY_HISTORY_IMMUTABLE' using errcode = '42501';
  end if;

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

create trigger protect_contact_reply_history_trigger
  before update or delete on public.contact_replies
  for each row execute function public.protect_contact_reply_history();

revoke all on function public.protect_contact_reply_history() from public, anon, authenticated;
grant execute on function public.protect_contact_reply_history() to service_role;
