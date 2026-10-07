-- Migration: 20260906290000_admin_payments_seen_state.sql
--
-- The "Ödemeler" sidebar badge counted every visible payment transaction, not
-- unread ones, so it could never reach zero: opening the page changed nothing
-- and the number stayed forever. This gives payments the same read semantics
-- notification_deliveries already has, per admin.
--
-- A single timestamp per admin is enough: everything created after the last
-- visit is unread. That needs no per-row bookkeeping on the financial ledger
-- and cannot alter payment data.

alter table public.admin_profiles
  add column if not exists payments_seen_at timestamptz;

comment on column public.admin_profiles.payments_seen_at is
  'Last time this admin opened /admin/odemeler. Payments created after it are unread.';

-- Read the caller's own stamp. admin_profiles is not granted to the API roles
-- directly, so this is the read path for the badge.
create or replace function public.admin_payments_seen_at()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_seen timestamptz;
begin
  if not public.is_admin() and current_user not in ('postgres', 'service_role') then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select payments_seen_at into v_seen
  from public.admin_profiles
  where user_id = auth.uid();

  return v_seen;
end;
$fn$;

-- Mark every payment up to now as read for the calling admin.
create or replace function public.admin_mark_payments_seen()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_seen timestamptz;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  update public.admin_profiles
  set payments_seen_at = now(),
      updated_at = now()
  where user_id = auth.uid()
  returning payments_seen_at into v_seen;

  return v_seen;
end;
$fn$;

revoke all on function public.admin_payments_seen_at() from public, anon;
revoke all on function public.admin_mark_payments_seen() from public, anon;
grant execute on function public.admin_payments_seen_at() to authenticated, service_role;
grant execute on function public.admin_mark_payments_seen() to authenticated;
