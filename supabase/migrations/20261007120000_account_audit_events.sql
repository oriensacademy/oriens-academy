-- Denetim > Sistem olayları: çıkış ve şifre değişikliği kaydı.
-- GoTrue denetim kaydını veritabanına yazmıyor (auth.audit_log_entries boş), bu
-- yüzden oturum açmış kullanıcı yalnız KENDİ olayını audit_logs'a yazabilir.
-- Yalnız iki sabit olay kabul edilir; serbest metin/şifre/token kaydedilmez.
-- IP tutulmaz; cihaz özeti record_login_success ile aynı biçimdedir.
-- Geri alma:
--   drop function public.record_account_event(text, text);
--   drop index if exists public.audit_logs_actor_action_created_at_idx;

create index if not exists audit_logs_actor_action_created_at_idx
  on public.audit_logs (actor_user_id, action, created_at desc);

create or replace function public.record_account_event(p_kind text, p_device text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_action text;
begin
  if v_uid is null then return; end if;
  v_action := case p_kind
    when 'logout' then 'auth.logout'
    when 'password_changed' then 'auth.password_changed'
    else null
  end;
  if v_action is null then return; end if;
  -- Aynı kullanıcının aynı olayı 1 dk içinde tekrar yazılmaz.
  if exists (
    select 1 from public.audit_logs a
    where a.actor_user_id = v_uid and a.action = v_action and a.created_at > now() - interval '1 minute'
  ) then return; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata, severity, category)
  values (
    v_uid, v_action, 'auth_user', v_uid::text,
    jsonb_strip_nulls(jsonb_build_object(
      'role', case when public.is_admin() then 'yonetici' else 'veli' end,
      'device', left(nullif(btrim(p_device), ''), 80)
    )),
    'info', 'auth'
  );
end;
$$;

revoke all on function public.record_account_event(text, text) from public, anon;
grant execute on function public.record_account_event(text, text) to authenticated;
