-- Forward-only migration for canonical password recovery rate limiting.
-- Protects the public forgot-password endpoint against brute-force and email flooding.
-- Concurrency-safe via atomic SELECT ... FOR UPDATE / transaction locking.
-- No plaintext email or IP is stored; only SHA-256 cryptographic hashes.

create table if not exists public.password_recovery_rate_limits (
  key_hash text primary key,
  kind text not null check (kind in ('cooldown', 'email_window', 'ip_window')),
  request_count int not null default 1,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.password_recovery_rate_limits enable row level security;
revoke all on table public.password_recovery_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.password_recovery_rate_limits to service_role;

create or replace function public.check_and_claim_recovery_rate_limit(
  p_email_hash text,
  p_ip_hash text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cooldown_key text := 'cooldown:' || p_email_hash;
  v_email_window_key text := 'email:' || p_email_hash;
  v_ip_window_key text := 'ip:' || p_ip_hash;

  v_cooldown_row public.password_recovery_rate_limits%rowtype;
  v_email_row public.password_recovery_rate_limits%rowtype;
  v_ip_row public.password_recovery_rate_limits%rowtype;

  v_window_duration interval := interval '15 minutes';
  v_cooldown_duration interval := interval '60 seconds';
  v_max_email_requests int := 3;
  v_max_ip_requests int := 10;
begin
  -- 1. Check Cooldown (60 seconds per email)
  select * into v_cooldown_row
  from public.password_recovery_rate_limits
  where key_hash = v_cooldown_key
  for update;

  if found and v_cooldown_row.blocked_until > p_now then
    return jsonb_build_object('allowed', false, 'reason', 'COOLDOWN');
  end if;

  -- 2. Check Email Window (max 3 per 15 minutes)
  select * into v_email_row
  from public.password_recovery_rate_limits
  where key_hash = v_email_window_key
  for update;

  if found and (v_email_row.window_started_at + v_window_duration) > p_now then
    if v_email_row.request_count >= v_max_email_requests then
      return jsonb_build_object('allowed', false, 'reason', 'EMAIL_LIMIT');
    end if;
  end if;

  -- 3. Check IP Window (max 10 per 15 minutes)
  select * into v_ip_row
  from public.password_recovery_rate_limits
  where key_hash = v_ip_window_key
  for update;

  if found and (v_ip_row.window_started_at + v_window_duration) > p_now then
    if v_ip_row.request_count >= v_max_ip_requests then
      return jsonb_build_object('allowed', false, 'reason', 'IP_LIMIT');
    end if;
  end if;

  -- ALL CHECKS PASSED: Atomically claim and record
  -- Upsert Cooldown row
  insert into public.password_recovery_rate_limits (
    key_hash, kind, request_count, window_started_at, blocked_until, updated_at
  ) values (
    v_cooldown_key, 'cooldown', 1, p_now, p_now + v_cooldown_duration, p_now
  )
  on conflict (key_hash) do update
    set blocked_until = p_now + v_cooldown_duration,
        updated_at = p_now;

  -- Upsert Email Window row
  if v_email_row.key_hash is not null and (v_email_row.window_started_at + v_window_duration) > p_now then
    update public.password_recovery_rate_limits
    set request_count = request_count + 1,
        updated_at = p_now
    where key_hash = v_email_window_key;
  else
    insert into public.password_recovery_rate_limits (
      key_hash, kind, request_count, window_started_at, blocked_until, updated_at
    ) values (
      v_email_window_key, 'email_window', 1, p_now, p_now + v_window_duration, p_now
    )
    on conflict (key_hash) do update
      set request_count = 1,
          window_started_at = p_now,
          blocked_until = p_now + v_window_duration,
          updated_at = p_now;
  end if;

  -- Upsert IP Window row
  if v_ip_row.key_hash is not null and (v_ip_row.window_started_at + v_window_duration) > p_now then
    update public.password_recovery_rate_limits
    set request_count = request_count + 1,
        updated_at = p_now
    where key_hash = v_ip_window_key;
  else
    insert into public.password_recovery_rate_limits (
      key_hash, kind, request_count, window_started_at, blocked_until, updated_at
    ) values (
      v_ip_window_key, 'ip_window', 1, p_now, p_now + v_window_duration, p_now
    )
    on conflict (key_hash) do update
      set request_count = 1,
          window_started_at = p_now,
          blocked_until = p_now + v_window_duration,
          updated_at = p_now;
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.check_and_claim_recovery_rate_limit(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.check_and_claim_recovery_rate_limit(text, text, timestamptz) to service_role;
