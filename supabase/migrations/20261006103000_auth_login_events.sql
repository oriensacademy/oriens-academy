-- Denetim > Girişler ve Genel Bakış "giriş yapmayan veli" için giriş kaydı.
-- Platformda giriş geçmişi tutulmuyordu (GoTrue hatalı şifre denemelerini
-- kaydetmez). Bu tablo yalnız: kişi, rol, sonuç, cihaz özeti ve zaman tutar.
-- IP adresi TUTULMAZ. Okuma yalnız admin'e açıktır; yazma yalnız aşağıdaki
-- SECURITY DEFINER fonksiyonlarla yapılır (tabloya doğrudan insert politikası yok).
-- Kayıtlar 1 yıl saklanır.
-- Geri alma:
--   drop function public.record_login_success(text);
--   drop function public.record_login_failure(text, text);
--   drop function public.admin_guardian_last_sign_ins();
--   drop table public.auth_login_events;

create table if not exists public.auth_login_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null check (role in ('veli', 'yonetici')),
  result text not null check (result in ('ok', 'fail')),
  device text,
  created_at timestamptz not null default now()
);

create index if not exists auth_login_events_created_at_idx on public.auth_login_events (created_at desc);
create index if not exists auth_login_events_email_idx on public.auth_login_events (email, created_at desc);

alter table public.auth_login_events enable row level security;

drop policy if exists auth_login_events_admin_select on public.auth_login_events;
create policy auth_login_events_admin_select on public.auth_login_events
  for select to authenticated using (public.is_admin());

revoke all on public.auth_login_events from public, anon;
grant select on public.auth_login_events to authenticated;

-- Başarılı giriş: oturum açmış kullanıcı kendi girişini kaydeder.
create or replace function public.record_login_success(p_device text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then return; end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null then return; end if;
  -- Aynı kullanıcının art arda (1 dk içinde) tekrar kaydı yazılmaz.
  if exists (
    select 1 from public.auth_login_events e
    where e.user_id = v_uid and e.result = 'ok' and e.created_at > now() - interval '1 minute'
  ) then return; end if;
  insert into public.auth_login_events (user_id, email, role, result, device)
  values (v_uid, v_email, case when public.is_admin() then 'yonetici' else 'veli' end, 'ok', left(nullif(btrim(p_device), ''), 80));
  delete from public.auth_login_events where created_at < now() - interval '1 year';
end;
$$;

-- Hatalı şifre: yalnız kayıtlı bir hesabın e-postası için yazılır (rastgele
-- metinler kaydedilmez), e-posta başına 10 dakikada en fazla 10 kayıt.
-- Hiçbir şey döndürmez; hesabın var olup olmadığını çağırana bildirmez.
create or replace function public.record_login_failure(p_email text, p_device text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_uid uuid;
  v_admin boolean;
begin
  if v_email = '' or length(v_email) > 254 then return; end if;
  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  if v_uid is null then return; end if;
  if (
    select count(*) from public.auth_login_events e
    where e.email = v_email and e.result = 'fail' and e.created_at > now() - interval '10 minutes'
  ) >= 10 then return; end if;
  select coalesce(u.raw_app_meta_data ->> 'role' = 'admin', false) into v_admin from auth.users u where u.id = v_uid;
  insert into public.auth_login_events (user_id, email, role, result, device)
  values (v_uid, v_email, case when v_admin then 'yonetici' else 'veli' end, 'fail', left(nullif(btrim(p_device), ''), 80));
end;
$$;

-- Velilerin son başarılı giriş zamanı (auth.users.last_sign_in_at). Yalnız admin.
create or replace function public.admin_guardian_last_sign_ins()
returns table(user_id uuid, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ga.user_id, u.last_sign_in_at
  from public.guardian_accounts ga
  join auth.users u on u.id = ga.user_id
  where public.is_admin() and ga.active;
$$;

revoke all on function public.record_login_success(text) from public, anon;
grant execute on function public.record_login_success(text) to authenticated;
revoke all on function public.record_login_failure(text, text) from public;
grant execute on function public.record_login_failure(text, text) to anon, authenticated;
revoke all on function public.admin_guardian_last_sign_ins() from public, anon;
grant execute on function public.admin_guardian_last_sign_ins() to authenticated;
