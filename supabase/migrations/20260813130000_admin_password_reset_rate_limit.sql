-- Server-only abuse protection for the administrator temporary-password flow.
-- No email address, IP address, or password is stored in plaintext.

create table if not exists public.admin_password_reset_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_password_reset_limits enable row level security;

revoke all on table public.admin_password_reset_limits from anon, authenticated, service_role;

-- The browser can only read admin_profiles through its existing is_admin() RLS
-- policy. The reset function gets SELECT-only access and still validates the row.
grant select on table public.admin_profiles to authenticated, service_role;

create or replace function public.claim_admin_password_reset_limit(
  p_key_hash text,
  p_now timestamptz,
  p_blocked_until timestamptz
)
returns boolean
language sql
security definer
set search_path = public
as $$
  with claimed as (
    insert into public.admin_password_reset_limits (
      key_hash, window_started_at, blocked_until, updated_at
    ) values (
      p_key_hash, p_now, p_blocked_until, p_now
    )
    on conflict (key_hash) do update
      set window_started_at = excluded.window_started_at,
          blocked_until = excluded.blocked_until,
          updated_at = excluded.updated_at
      where public.admin_password_reset_limits.blocked_until <= p_now
    returning 1
  )
  select exists(select 1 from claimed);
$$;

create or replace function public.shorten_admin_password_reset_limit(
  p_key_hash text,
  p_blocked_until timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.admin_password_reset_limits
  set blocked_until = least(blocked_until, p_blocked_until),
      updated_at = now()
  where key_hash = p_key_hash;
$$;

revoke all on function public.claim_admin_password_reset_limit(text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.shorten_admin_password_reset_limit(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_admin_password_reset_limit(text, timestamptz, timestamptz)
  to service_role;
grant execute on function public.shorten_admin_password_reset_limit(text, timestamptz)
  to service_role;

comment on table public.admin_password_reset_limits is
  'Hashed email/IP cooldown keys for the server-side administrator password reset endpoint.';
