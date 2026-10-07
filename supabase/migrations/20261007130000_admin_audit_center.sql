-- Denetim Kayıtları > Audit merkezi (yalnız ekleme; mevcut kayıtlar değişmez).
--
-- 1. admin_audit_feed / admin_audit_stats / admin_audit_detail: yalnız admin
--    çağırabilir (SECURITY DEFINER + is_admin() kontrolü). audit_logs ve
--    auth_login_events tek akışta birleşir; kişi/öğrenci/ödeme/mail/ders/paket
--    ilişkileri TEK sorguda (lateral join) çözülür, sayfa 50 kayıt.
-- 2. Hassas veri: metadata sunucuda özyinelemeli olarak temizlenir (password,
--    otp, token, secret, authorization, cookie, api key, service role, kart, cvv,
--    hash, signature…). Telefonlar maskelenir. notification_deliveries.payload,
--    payment_transactions.status_token_hash / payer_phone / payer_address /
--    paytr_refund_reference ve ders raporu / öğretmen notu metni döndürülmez.
-- 3. audit_changes: öğrenci, veli, ders, paket ve ödeme kayıtlarındaki izinli
--    alanların önce/sonra değerleri (telefon maskeli, not/rapor metni yok).
--    Tetikleyiciler hata yutar; asıl yazma işlemini asla bozmaz.
-- 4. auth_login_events.reason: başarısız giriş nedeni (sabit liste). IP tutulmaz.
-- 5. Yeni düşük gürültülü olaylar: account.created (veli hesabı oluştu),
--    account.email_change_requested (e-posta değişikliği istendi; adresler maskeli).
--
-- Geri alma (gerekirse, sırayla):
--   drop trigger if exists audit_changes_student_profiles on public.student_profiles;
--   drop trigger if exists audit_changes_guardian_accounts on public.guardian_accounts;
--   drop trigger if exists audit_changes_student_lessons on public.student_lessons;
--   drop trigger if exists audit_changes_student_package_purchases on public.student_package_purchases;
--   drop trigger if exists audit_changes_payment_transactions on public.payment_transactions;
--   drop trigger if exists audit_guardian_account_created on public.guardian_accounts;
--   drop trigger if exists audit_email_change_requested on public.email_change_challenges;
--   drop function if exists public.admin_audit_detail(text);
--   drop function if exists public.admin_audit_stats();
--   drop function if exists public.admin_audit_feed(text, jsonb, text, text, timestamptz, timestamptz, text, integer, integer);
--   drop function if exists public.admin_audit_rows(timestamptz, timestamptz, text);
--   drop function if exists public.audit_capture_changes();
--   drop function if exists public.audit_on_guardian_account_created();
--   drop function if exists public.audit_on_email_change_requested();
--   drop table if exists public.audit_changes;
--   drop function if exists public.record_login_failure(text, text, text);
--   (record_login_failure(text, text) eski gövdesiyle yeniden oluşturulur, bkz. 20261006103000)
--   alter table public.auth_login_events drop column if exists reason;
--   drop index if exists public.audit_logs_entity_idx;
--   drop index if exists public.notification_deliveries_entity_idx;
--   drop index if exists public.auth_login_events_user_created_idx;

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

create or replace function public.audit_try_uuid(p_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_value::uuid
  end;
$$;

-- foldTurkish (src/lib/format/turkish.ts) ile aynı katlama: arama Türkçe karaktere duyarsız.
create or replace function public.audit_fold(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(coalesce(p_value, ''), 'İIıŞşĞğÜüÖöÇçÂâÎîÛû', 'iiissgguuooccaaiiuu'));
$$;

create or replace function public.audit_mask_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
begin
  if p_value is null or btrim(p_value) = '' then return p_value; end if;
  if length(v_digits) < 4 then return '***'; end if;
  if length(v_digits) = 12 and left(v_digits, 2) = '90' then
    return '+90 ' || substr(v_digits, 3, 1) || '** *** **' || right(v_digits, 2);
  end if;
  if length(v_digits) = 11 and left(v_digits, 1) = '0' then
    return '0' || substr(v_digits, 2, 1) || '** *** **' || right(v_digits, 2);
  end if;
  return repeat('*', length(v_digits) - 2) || right(v_digits, 2);
end;
$$;

create or replace function public.audit_is_secret_key(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_key ~* '(pass(word|wd)?($|_)|otp|token|secret|authori[sz]ation|cookie|api[_-]?key|apikey|service[_-]?role|card|cvv|cvc|hash|signature|salt|merchant_key|private[_-]?key|credential|refresh|bearer|jwt|session[_-]?key)'
    or lower(p_key) in ('code', 'verification_code', 'pin', 'payload', 'iframe_token', 'paytr_callback', 'raw_body', 'headers'),
    false
  );
$$;

-- Özyinelemeli temizleme: gizli anahtarlar "[gizlendi]", telefonlar maskeli,
-- JWT / Bearer görünümlü dizeler gizli. p_phone: telefon anahtarı altındaki
-- iç içe değerler ({"phone": {"old": …, "new": …}}) de maskelenir.
create or replace function public.audit_redact(p_value jsonb, p_phone boolean default false)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_item jsonb;
  v_out jsonb;
begin
  if p_value is null then return null; end if;
  case jsonb_typeof(p_value)
    when 'object' then
      v_out := '{}'::jsonb;
      for v_key, v_item in select e.key, e.value from jsonb_each(p_value) e loop
        if public.audit_is_secret_key(v_key) then
          v_out := v_out || jsonb_build_object(v_key, '[gizlendi]');
        else
          v_out := v_out || jsonb_build_object(v_key, public.audit_redact(v_item, p_phone or v_key ~* 'phone'));
        end if;
      end loop;
      return v_out;
    when 'array' then
      select coalesce(jsonb_agg(public.audit_redact(e.value, p_phone) order by e.ordinality), '[]'::jsonb)
        into v_out
        from jsonb_array_elements(p_value) with ordinality e;
      return v_out;
    when 'string' then
      if (p_value #>> '{}') ~* '(^bearer\s+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})' then
        return to_jsonb('[gizlendi]'::text);
      end if;
      if p_phone then return to_jsonb(public.audit_mask_phone(p_value #>> '{}')); end if;
      return p_value;
    else
      return p_value;
  end case;
end;
$$;

-- Ekran kategorisi: auth | payment | mail | student | lesson | package | admin | system | security
create or replace function public.audit_feed_category(p_action text, p_category text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_action in ('database.permission_denied', 'database.rls_denied', 'paytr_callback_hash_invalid') then 'security'
    when p_action like 'auth.%' or p_action like 'account.%' or p_action like 'purchase.email%'
      or p_action in ('account_deleted', 'admin.password_change_completed', 'student.password_reset_sent') then 'auth'
    when p_action like 'payment%' or p_action like 'paytr%' or p_action like 'bank_transfer.%' then 'payment'
    when p_action like 'email.%' or p_action = 'admin.contact.reply_sent' then 'mail'
    when p_action like 'admin.%' or p_action like 'instructor.%' or p_action = 'lesson.topic_created'
      or p_action like 'student.grade_option%' or p_action like 'student.exam_option%'
      or p_action like 'contact%' or p_action = 'test_account_operational_reset' then 'admin'
    when p_action like 'lesson.%' then 'lesson'
    when p_action like 'package%' or p_action = 'lesson_rights_adjusted' then 'package'
    when p_action like 'student.%' or p_action like 'member%' or p_action like 'guardian.%' then 'student'
    when p_category = 'auth' then 'auth'
    when p_category = 'payment' then 'payment'
    when p_category = 'email' then 'mail'
    when p_category in ('admin', 'blog', 'contact') then 'admin'
    when p_category in ('student', 'lesson', 'package') then p_category
    else 'system'
  end;
$$;

-- Ekran durumu: success | error | pending | warning | info
create or replace function public.audit_feed_status(p_action text, p_severity text, p_metadata jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_severity in ('error', 'critical')
      or p_action in (
        'auth.login_failed', 'paytr_token_creation_failed', 'payment_status_failed', 'payment_failed',
        'payment_failure_return_reached', 'payment_status_verification_error', 'paytr_callback_hash_invalid',
        'paytr_callback_transaction_not_found', 'paytr_callback_amount_mismatch', 'email.failed',
        'email.render_failed', 'bank_transfer.rejected', 'database.permission_denied', 'database.rls_denied',
        'database.rpc_failed')
      or (p_action = 'paytr_callback_received' and p_metadata ->> 'provider_status' = 'failed') then 'error'
    when p_action in (
        'auth.login', 'auth.password_changed', 'admin.password_change_completed', 'purchase.email_verified',
        'account.email_change_verified', 'account.created', 'payment_status_paid', 'payment_completed',
        'payment.refund_finalized', 'payment.refunded', 'bank_transfer.approved', 'email.sent',
        'admin.contact.reply_sent', 'student.created', 'student.created_under_guardian', 'lesson.created',
        'lesson.created_past', 'lesson.completed', 'lesson.report_email_manually_sent',
        'lesson.report_email_manually_resent', 'lesson.completion_email_manually_sent', 'package.assigned',
        'package_assigned', 'package_assigned_manual', 'package.extra_lessons_added',
        'package.package_assigned_email_manually_sent', 'package.lesson_rights_email_manually_sent',
        'package.rights_summary_requested', 'admin.blog.post_published')
      or (p_action = 'paytr_callback_received' and p_metadata ->> 'provider_status' = 'success') then 'success'
    when p_action in (
        'payment_session_requested', 'payment_status_pending', 'email.queued', 'email.retry_scheduled',
        'payment.refund_intent_created', 'purchase.email_verification_requested',
        'account.email_change_requested') then 'pending'
    when p_severity = 'warning' or p_action in ('payment_session_superseded', 'lesson.cancelled') then 'warning'
    else 'info'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Giriş hatası nedeni (sabit liste; serbest metin yok)
-- ---------------------------------------------------------------------------

alter table public.auth_login_events add column if not exists reason text;

-- Eski 2 parametreli sürüm kaldırılır; PostgREST {p_email, p_device} çağrısı
-- yeni sürüme (p_reason varsayılan null) eşleşir, mevcut istemci bozulmaz.
drop function if exists public.record_login_failure(text, text);

create or replace function public.record_login_failure(p_email text, p_device text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_uid uuid;
  v_admin boolean;
  v_reason text := case
    when p_reason in ('invalid_credentials', 'email_not_confirmed', 'user_banned', 'rate_limited', 'account_unavailable') then p_reason
    when p_reason is null then 'invalid_credentials'
    else 'other'
  end;
begin
  if v_email = '' or length(v_email) > 254 then return; end if;
  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  if v_uid is null then return; end if;
  if (
    select count(*) from public.auth_login_events e
    where e.email = v_email and e.result = 'fail' and e.created_at > now() - interval '10 minutes'
  ) >= 10 then return; end if;
  select coalesce(u.raw_app_meta_data ->> 'role' = 'admin', false) into v_admin from auth.users u where u.id = v_uid;
  insert into public.auth_login_events (user_id, email, role, result, device, reason)
  values (v_uid, v_email, case when v_admin then 'yonetici' else 'veli' end, 'fail', left(nullif(btrim(p_device), ''), 80), v_reason);
end;
$$;

revoke all on function public.record_login_failure(text, text, text) from public;
grant execute on function public.record_login_failure(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Önce / sonra değişiklik kaydı
-- ---------------------------------------------------------------------------

create table if not exists public.audit_changes (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text not null,
  changes jsonb not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists audit_changes_row_created_idx on public.audit_changes (row_id, created_at desc);

alter table public.audit_changes enable row level security;
revoke all on table public.audit_changes from anon, authenticated;
grant select on table public.audit_changes to authenticated;
drop policy if exists audit_changes_admin_select on public.audit_changes;
create policy audit_changes_admin_select on public.audit_changes for select to authenticated using (public.is_admin());

-- TG_ARGV: izinli kolon listesi. Yalnız gerçekten değişen alanlar yazılır.
create or replace function public.audit_capture_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_out jsonb := '{}'::jsonb;
  v_field text;
  v_before jsonb;
  v_after jsonb;
begin
  begin
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    foreach v_field in array tg_argv loop
      v_before := v_old -> v_field;
      v_after := v_new -> v_field;
      if v_before is distinct from v_after then
        if v_field ~* 'phone' then
          v_before := to_jsonb(public.audit_mask_phone(v_before #>> '{}'));
          v_after := to_jsonb(public.audit_mask_phone(v_after #>> '{}'));
        end if;
        v_out := v_out || jsonb_build_object(v_field, jsonb_build_object('old', v_before, 'new', v_after));
      end if;
    end loop;
    if v_out <> '{}'::jsonb then
      insert into public.audit_changes (table_name, row_id, changes, changed_by)
      values (tg_table_name, coalesce(v_new ->> 'id', v_new ->> 'user_id'), v_out, auth.uid());
    end if;
  exception when others then
    null; -- kayıt hatası asıl güncellemeyi asla bozmaz
  end;
  return null;
end;
$$;

revoke all on function public.audit_capture_changes() from public, anon, authenticated;

drop trigger if exists audit_changes_student_profiles on public.student_profiles;
create trigger audit_changes_student_profiles
  after update on public.student_profiles
  for each row execute function public.audit_capture_changes(
    'full_name', 'email', 'phone', 'school', 'target_country', 'target_university', 'target_exam', 'target_exams',
    'target_countries', 'education_program', 'exams_taken', 'grade_level', 'contact_guardian_name',
    'preferred_language', 'active', 'archived_at');

drop trigger if exists audit_changes_guardian_accounts on public.guardian_accounts;
create trigger audit_changes_guardian_accounts
  after update on public.guardian_accounts
  for each row execute function public.audit_capture_changes(
    'full_name', 'email', 'phone', 'contact_address', 'preferred_language', 'email_verified_at', 'active', 'archived_at');

drop trigger if exists audit_changes_student_lessons on public.student_lessons;
create trigger audit_changes_student_lessons
  after update on public.student_lessons
  for each row execute function public.audit_capture_changes(
    'title', 'subject', 'exam_code', 'lesson_date', 'duration_minutes', 'status', 'topic_id', 'instructor_id',
    'package_purchase_id', 'lesson_timezone_label', 'report_version', 'is_archived');

drop trigger if exists audit_changes_student_package_purchases on public.student_package_purchases;
create trigger audit_changes_student_package_purchases
  after update on public.student_package_purchases
  for each row execute function public.audit_capture_changes(
    'package_id', 'custom_package_name', 'lesson_count', 'lessons_used', 'status', 'payment_status', 'end_date', 'is_archived');

drop trigger if exists audit_changes_payment_transactions on public.payment_transactions;
create trigger audit_changes_payment_transactions
  after update on public.payment_transactions
  for each row execute function public.audit_capture_changes(
    'status', 'paid_at', 'refund_status', 'refunded_amount', 'is_archived');

-- ---------------------------------------------------------------------------
-- Yeni olaylar (az gürültü, hata yutar)
-- ---------------------------------------------------------------------------

create or replace function public.audit_on_guardian_account_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata, severity, category)
    values (
      coalesce(auth.uid(), new.user_id), 'account.created', 'guardian_account', new.user_id::text,
      jsonb_build_object(
        'role', 'veli',
        'source', coalesce(nullif(new.migration_source, ''), case when public.is_admin() then 'admin' else 'self_service' end)
      ),
      'info', 'auth');
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke all on function public.audit_on_guardian_account_created() from public, anon, authenticated;

drop trigger if exists audit_guardian_account_created on public.guardian_accounts;
create trigger audit_guardian_account_created
  after insert on public.guardian_accounts
  for each row execute function public.audit_on_guardian_account_created();

create or replace function public.audit_on_email_change_requested()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mask text;
begin
  begin
    if exists (
      select 1 from public.audit_logs a
      where a.actor_user_id = new.user_id and a.action = 'account.email_change_requested'
        and a.created_at > now() - interval '1 minute'
    ) then
      return null;
    end if;
    v_mask := regexp_replace(coalesce(new.new_email, ''), '^(.).*(@.*)$', '\1***\2');
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata, severity, category)
    values (
      new.user_id, 'account.email_change_requested', 'auth_user', new.user_id::text,
      jsonb_build_object(
        'old_email_masked', regexp_replace(coalesce(new.old_email, ''), '^(.).*(@.*)$', '\1***\2'),
        'new_email_masked', v_mask),
      'info', 'auth');
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke all on function public.audit_on_email_change_requested() from public, anon, authenticated;

drop trigger if exists audit_email_change_requested on public.email_change_challenges;
create trigger audit_email_change_requested
  after insert on public.email_change_challenges
  for each row execute function public.audit_on_email_change_requested();

-- ---------------------------------------------------------------------------
-- İndeksler (ilişki ve zaman çizelgesi aramaları)
-- ---------------------------------------------------------------------------

create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists notification_deliveries_entity_idx on public.notification_deliveries (entity_type, entity_id);
create index if not exists auth_login_events_user_created_idx on public.auth_login_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Akış satırları (iç kullanım; doğrudan çağrılamaz)
-- ---------------------------------------------------------------------------

create or replace function public.admin_audit_rows(p_from timestamptz default null, p_to timestamptz default null, p_event_id text default null)
returns table (
  event_id text,
  source text,
  created_at timestamptz,
  action text,
  raw_category text,
  severity text,
  feed_category text,
  feed_status text,
  correlation_id text,
  entity_type text,
  entity_id text,
  actor_user_id uuid,
  actor_name text,
  actor_role text,
  actor_email text,
  subject_user_id uuid,
  subject_name text,
  subject_email text,
  subject_role text,
  student_id uuid,
  student_name text,
  payment_id uuid,
  public_reference text,
  provider_transaction_id text,
  amount numeric,
  currency text,
  payment_status text,
  purchase_id uuid,
  package_name text,
  lesson_id uuid,
  lesson_title text,
  delivery_id uuid,
  mail_recipient text,
  mail_template text,
  mail_event_type text,
  mail_status text,
  mail_error_code text,
  login_device text,
  login_reason text,
  metadata jsonb,
  search_text text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  return query
  with base as (
    select
      'a' || a.id::text as eid, 'audit'::text as src, a.created_at as at, a.action as act, a.category as cat,
      a.severity as sev, a.correlation_id as corr, a.entity_type as etype, a.entity_id as ent, a.actor_user_id as actor,
      coalesce(a.metadata, '{}'::jsonb) as m, null::uuid as luser, null::text as lemail, null::text as lrole,
      null::text as ldevice, null::text as lreason
    from public.audit_logs a
    where (p_event_id is null or a.id = case when p_event_id ~ '^a[0-9]{1,18}$' then substr(p_event_id, 2)::bigint end)
      and (p_from is null or a.created_at >= p_from)
      and (p_to is null or a.created_at < p_to)
    union all
    select
      'l' || l.id::text, 'login'::text, l.created_at,
      case when l.result = 'ok' then 'auth.login' else 'auth.login_failed' end, 'auth'::text,
      case when l.result = 'ok' then 'info' else 'warning' end, null::text, 'auth_user'::text, l.user_id::text, l.user_id,
      jsonb_strip_nulls(jsonb_build_object('email', l.email, 'role', l.role, 'result', l.result, 'device', l.device, 'reason', l.reason)),
      l.user_id, l.email, l.role, l.device, l.reason
    from public.auth_login_events l
    where (p_event_id is null or l.id = case when p_event_id ~ '^l[0-9]{1,18}$' then substr(p_event_id, 2)::bigint end)
      and (p_from is null or l.created_at >= p_from)
      and (p_to is null or l.created_at < p_to)
  ),
  resolved as (
    select
      b.*,
      nd.id as nd_id, nd.recipient as nd_recipient, nd.template as nd_template, nd.event_type as nd_event_type,
      nd.status as nd_status, nd.last_error_code as nd_error,
      sl.id as sl_id, sl.title as sl_title,
      spp.id as spp_id, spp.package_id as spp_package, spp.custom_package_name as spp_custom,
      pt.id as pt_id, pt.public_reference as pt_ref, pt.provider_transaction_id as pt_txn, pt.amount as pt_amount,
      pt.currency as pt_currency, pt.status as pt_status, pt.package_id as pt_package, pt.payer_name as pt_payer_name,
      pt.payer_email as pt_payer_email,
      sx.sid, su.uid,
      ap.user_id as ap_id, ap.display_name as ap_name
    from base b
    left join public.admin_profiles ap on ap.user_id = b.actor
    left join lateral (
      select d.id, d.recipient, d.template, d.event_type, d.status, d.last_error_code, d.entity_type, d.entity_id
      from public.notification_deliveries d
      where d.id = coalesce(
        public.audit_try_uuid(b.m ->> 'delivery_id'),
        public.audit_try_uuid(b.m ->> 'notification_delivery_id'),
        case when b.etype = 'notification_delivery' then public.audit_try_uuid(b.ent) end)
    ) nd on true
    left join lateral (
      select x.id, x.title, x.student_user_id, x.package_purchase_id
      from public.student_lessons x
      where x.id = coalesce(
        case when b.etype = 'student_lesson' then public.audit_try_uuid(b.ent) end,
        public.audit_try_uuid(b.m ->> 'lesson_id'),
        case when nd.entity_type = 'student_lesson' then public.audit_try_uuid(nd.entity_id) end)
    ) sl on true
    left join lateral (
      select x.id, x.student_user_id, x.package_id, x.custom_package_name, x.payment_transaction_id
      from public.student_package_purchases x
      where x.id = coalesce(
        case when b.etype = 'student_package_purchase' then public.audit_try_uuid(b.ent) end,
        public.audit_try_uuid(b.m ->> 'package_purchase_id'),
        case when nd.entity_type = 'student_package_purchase' then public.audit_try_uuid(nd.entity_id) end,
        sl.package_purchase_id)
    ) spp on true
    left join lateral (
      select y.*
      from (
        select x.id, x.public_reference, x.provider_transaction_id, x.amount, x.currency, x.status, x.package_id,
               x.payer_name, x.payer_email, x.purchaser_guardian_user_id, x.auth_actor_user_id,
               x.package_owner_student_id, x.student_user_id, 1 as pri
        from public.payment_transactions x
        where x.id = coalesce(
          public.audit_try_uuid(b.m ->> 'transaction_id'),
          case when b.etype = 'payment_transaction' then public.audit_try_uuid(b.ent) end,
          case when nd.entity_type = 'payment_transaction' then public.audit_try_uuid(nd.entity_id) end,
          -- Ders olayları paket üzerinden ödemeye bağlanmaz (zaman çizelgesi gürültüsü olmasın).
          case when b.etype = 'student_package_purchase' then spp.payment_transaction_id end)
        union all
        select x.id, x.public_reference, x.provider_transaction_id, x.amount, x.currency, x.status, x.package_id,
               x.payer_name, x.payer_email, x.purchaser_guardian_user_id, x.auth_actor_user_id,
               x.package_owner_student_id, x.student_user_id, 2
        from public.payment_transactions x
        where x.public_reference in (
          b.m ->> 'public_reference', b.m ->> 'merchant_oid',
          case when b.etype = 'payment_transaction' then b.ent end,
          case when nd.entity_type = 'payment_transaction' then nd.entity_id end)
      ) y
      order by y.pri
      limit 1
    ) pt on true
    left join lateral (
      select coalesce(
        public.audit_try_uuid(b.m ->> 'student_id'),
        public.audit_try_uuid(b.m ->> 'student_user_id'),
        public.audit_try_uuid(b.m ->> 'resolved_student_id'),
        sl.student_user_id,
        spp.student_user_id,
        pt.package_owner_student_id,
        pt.student_user_id,
        case when b.etype in ('student', 'student_profile', 'student_profiles', 'member') then public.audit_try_uuid(b.ent) end,
        case when nd.entity_type = 'student' then public.audit_try_uuid(nd.entity_id) end,
        case when b.luser is not null then (
          select gs.student_id from public.guardian_students gs
          where gs.guardian_user_id = b.luser and gs.active
          order by gs.is_primary desc nulls last
          limit 1)
        end
      ) as sid
    ) sx on true
    left join lateral (
      select coalesce(
        b.luser,
        pt.purchaser_guardian_user_id,
        pt.auth_actor_user_id,
        case when b.etype in ('guardian_account', 'auth_user', 'user', 'account') then public.audit_try_uuid(b.ent) end,
        case when nd.entity_type in ('guardian_account', 'auth_user', 'user') then public.audit_try_uuid(nd.entity_id) end,
        case when ap.user_id is null then b.actor end,
        (select gs.guardian_user_id from public.guardian_students gs
          where gs.student_id = sx.sid
          order by gs.active desc, gs.is_primary desc nulls last
          limit 1),
        (select g.user_id from public.guardian_accounts g
          where nd.recipient is not null and lower(g.email) = lower(nd.recipient)
          limit 1),
        sx.sid
      ) as uid
    ) su on true
  ),
  named as (
    select
      r.eid, r.src, r.at, r.act, r.cat, r.sev, r.corr, r.etype, r.ent, r.actor, r.m, r.ldevice, r.lreason,
      coalesce(nullif(btrim(r.ap_name), ''), nullif(btrim(ag.full_name), ''), nullif(btrim(aau.raw_user_meta_data ->> 'full_name'), '')) as actor_name,
      case when r.ap_id is not null then 'admin' when ag.user_id is not null then 'veli' when r.actor is not null then 'kullanici' else 'sistem' end as actor_role,
      aau.email::text as actor_email,
      r.uid,
      coalesce(
        nullif(btrim(sg.full_name), ''), nullif(btrim(sa.display_name), ''), nullif(btrim(ssp.full_name), ''),
        nullif(btrim(r.pt_payer_name), ''), nullif(btrim(sau.raw_user_meta_data ->> 'full_name'), '')) as subject_name,
      coalesce(sg.email, sau.email::text, ssp.email, r.lemail, r.pt_payer_email, r.nd_recipient) as subject_email,
      case
        when sa.user_id is not null or r.lrole = 'yonetici' then 'admin'
        when sg.user_id is not null or r.lrole = 'veli' then 'veli'
        when ssp.id is not null then 'ogrenci'
        when r.pt_id is not null and coalesce(r.pt_payer_name, r.pt_payer_email) is not null then 'veli'
      end as subject_role,
      r.sid, nullif(btrim(st.full_name), '') as student_name,
      r.pt_id, coalesce(r.pt_ref, r.m ->> 'public_reference', r.m ->> 'merchant_oid') as reference, r.pt_txn,
      r.pt_amount, r.pt_currency, r.pt_status, r.pt_payer_name, r.pt_payer_email,
      r.spp_id,
      coalesce(nullif(btrim(r.spp_custom), ''), pkg.name_tr, pkg.name_en, r.m ->> 'package_name') as package_name,
      r.sl_id, r.sl_title,
      r.nd_id, r.nd_recipient, r.nd_template, r.nd_event_type, r.nd_status, r.nd_error
    from resolved r
    left join public.guardian_accounts ag on ag.user_id = r.actor and r.ap_id is null
    left join auth.users aau on aau.id = r.actor
    left join public.guardian_accounts sg on sg.user_id = r.uid
    left join public.admin_profiles sa on sa.user_id = r.uid
    left join auth.users sau on sau.id = r.uid
    left join public.student_profiles ssp on ssp.id = r.uid and sg.user_id is null and sa.user_id is null
    left join public.student_profiles st on st.id = r.sid
    left join public.pricing_packages pkg on pkg.id = coalesce(r.spp_package, r.pt_package, r.m ->> 'package_id')
  )
  select
    n.eid, n.src, n.at, n.act, n.cat, n.sev,
    public.audit_feed_category(n.act, n.cat),
    public.audit_feed_status(n.act, n.sev, n.m),
    n.corr, n.etype, n.ent,
    n.actor, n.actor_name, n.actor_role, n.actor_email,
    n.uid, n.subject_name, n.subject_email, n.subject_role,
    n.sid, n.student_name,
    n.pt_id, n.reference, n.pt_txn, n.pt_amount, n.pt_currency, n.pt_status,
    n.spp_id, n.package_name,
    n.sl_id, n.sl_title,
    n.nd_id, n.nd_recipient, n.nd_template, n.nd_event_type, n.nd_status, n.nd_error,
    n.ldevice, n.lreason, n.m,
    public.audit_fold(concat_ws(' ',
      n.eid, n.act, n.subject_name, n.subject_email, n.actor_name, n.actor_email, n.student_name, n.reference,
      n.pt_txn, n.pt_payer_name, n.pt_payer_email, n.package_name, n.sl_title, n.corr, n.nd_recipient, n.ent))
  from named n;
end;
$$;

revoke all on function public.admin_audit_rows(timestamptz, timestamptz, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Liste (sunucu tarafı filtre + arama + sayfalama)
-- p_term_actions: istemcinin Türkçe başlık kataloğundan her arama kelimesi için
-- eşleşen olay anahtarları ({"odeme": ["payment_completed", …]}).
-- ---------------------------------------------------------------------------

create or replace function public.admin_audit_feed(
  p_search text default null,
  p_term_actions jsonb default null,
  p_category text default null,
  p_status text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_person text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  event_id text,
  source text,
  created_at timestamptz,
  action text,
  raw_category text,
  severity text,
  feed_category text,
  feed_status text,
  correlation_id text,
  entity_type text,
  entity_id text,
  actor_user_id uuid,
  actor_name text,
  actor_role text,
  actor_email text,
  subject_user_id uuid,
  subject_name text,
  subject_email text,
  subject_role text,
  student_id uuid,
  student_name text,
  payment_id uuid,
  public_reference text,
  provider_transaction_id text,
  amount numeric,
  currency text,
  payment_status text,
  purchase_id uuid,
  package_name text,
  lesson_id uuid,
  lesson_title text,
  delivery_id uuid,
  mail_recipient text,
  mail_template text,
  mail_event_type text,
  mail_status text,
  mail_error_code text,
  login_device text,
  login_reason text,
  metadata jsonb,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_terms text[];
  v_person_text text := lower(nullif(btrim(coalesce(p_person, '')), ''));
  v_person uuid := public.audit_try_uuid(btrim(coalesce(p_person, '')));
  v_actions jsonb := case when jsonb_typeof(p_term_actions) = 'object' then p_term_actions else '{}'::jsonb end;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  v_terms := array(
    select t from regexp_split_to_table(left(public.audit_fold(btrim(coalesce(p_search, ''))), 200), '\s+') t
    where t <> ''
    limit 8);

  return query
  select
    s.event_id, s.source, s.created_at, s.action, s.raw_category, s.severity, s.feed_category, s.feed_status,
    s.correlation_id, s.entity_type, s.entity_id, s.actor_user_id, s.actor_name, s.actor_role, s.actor_email,
    s.subject_user_id, s.subject_name, s.subject_email, s.subject_role, s.student_id, s.student_name,
    s.payment_id, s.public_reference, s.provider_transaction_id, s.amount, s.currency, s.payment_status,
    s.purchase_id, s.package_name, s.lesson_id, s.lesson_title, s.delivery_id, s.mail_recipient, s.mail_template,
    s.mail_event_type, s.mail_status, s.mail_error_code, s.login_device, s.login_reason,
    public.audit_redact(s.metadata), s.total_count
  from (
    select r.*, count(*) over () as total_count
    from public.admin_audit_rows(p_from, p_to, null) r
    where (coalesce(p_category, '') = '' or r.feed_category = p_category)
      and (coalesce(p_status, '') = '' or r.feed_status = p_status)
      and (
        v_person_text is null
        or r.subject_user_id = v_person or r.actor_user_id = v_person or r.student_id = v_person
        or lower(r.subject_email) = v_person_text or lower(r.actor_email) = v_person_text
      )
      and not exists (
        select 1 from unnest(v_terms) t
        where r.search_text not like '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'
          and not (coalesce(v_actions -> t, '[]'::jsonb) ? r.action)
      )
    order by r.created_at desc, r.event_id desc
    limit v_limit offset v_offset
  ) s
  order by s.created_at desc, s.event_id desc;
end;
$$;

revoke all on function public.admin_audit_feed(text, jsonb, text, text, timestamptz, timestamptz, text, integer, integer) from public, anon;
grant execute on function public.admin_audit_feed(text, jsonb, text, text, timestamptz, timestamptz, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Bugünün özet sayıları (Europe/Istanbul günü)
-- ---------------------------------------------------------------------------

create or replace function public.admin_audit_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'since', v_from,
    'total', count(*),
    'failed', count(*) filter (where r.feed_status = 'error'),
    'payments_paid', count(distinct coalesce(r.payment_id::text, r.public_reference)) filter (where r.action in ('payment_completed', 'payment_status_paid')),
    'payment_events', count(*) filter (where r.feed_category = 'payment'),
    'logins', count(*) filter (where r.action = 'auth.login'),
    'login_failures', count(*) filter (where r.action = 'auth.login_failed'),
    'mails_sent', count(*) filter (where r.action = 'email.sent'),
    'mails_failed', count(*) filter (where r.action in ('email.failed', 'email.render_failed'))
  )
  into v_result
  from public.admin_audit_rows(v_from, null, null) r;
  return v_result;
end;
$$;

revoke all on function public.admin_audit_stats() from public, anon;
grant execute on function public.admin_audit_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Olay ayrıntısı (çekmece): kişi, işlemi yapan, ödeme, mail, ders, paket,
-- değişiklikler, ilgili işlem akışı. Hassas alanlar hiç seçilmez.
-- ---------------------------------------------------------------------------

create or replace function public.admin_audit_detail(p_event_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  r record;
  v_event jsonb;
  v_actor jsonb;
  v_subject jsonb;
  v_payment jsonb;
  v_delivery jsonb;
  v_lesson jsonb;
  v_purchase jsonb;
  v_changes jsonb;
  v_lookups jsonb;
  v_timeline jsonb;
  v_has_link boolean;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_event_id is null or p_event_id !~ '^[al][0-9]{1,18}$' then
    return null;
  end if;

  select * into r from public.admin_audit_rows(null, null, p_event_id) limit 1;
  if not found then
    return null;
  end if;

  v_event := (to_jsonb(r) - 'search_text') || jsonb_build_object('metadata', public.audit_redact(r.metadata));

  if r.actor_user_id is not null then
    v_actor := jsonb_build_object(
      'user_id', r.actor_user_id, 'name', r.actor_name, 'role', r.actor_role, 'email', r.actor_email);
  end if;

  if r.subject_user_id is not null or r.subject_email is not null or r.subject_name is not null then
    select jsonb_build_object(
      'user_id', r.subject_user_id,
      'name', r.subject_name,
      'email', r.subject_email,
      'role', r.subject_role,
      'email_verified_at', g.email_verified_at,
      'active', coalesce(g.active, sp.active),
      'archived_at', coalesce(g.archived_at, sp.archived_at),
      'created_at', coalesce(g.created_at, sp.created_at),
      'students', (
        select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.full_name, 'primary', gs.is_primary) order by gs.is_primary desc nulls last, s.full_name), '[]'::jsonb)
        from public.guardian_students gs
        join public.student_profiles s on s.id = gs.student_id
        where gs.guardian_user_id = r.subject_user_id and gs.active)
    )
    into v_subject
    from (select 1) one
    left join public.guardian_accounts g on g.user_id = r.subject_user_id
    left join public.student_profiles sp on sp.id = r.subject_user_id and g.user_id is null;
  end if;

  if r.payment_id is not null then
    select jsonb_build_object(
      'id', pt.id,
      'public_reference', pt.public_reference,
      'provider', pt.provider,
      'provider_transaction_id', pt.provider_transaction_id,
      'amount', pt.amount,
      'currency', pt.currency,
      'status', pt.status,
      'payment_method', pt.payment_method,
      'installment_count', pt.installment_count,
      'payer_name', pt.payer_name,
      'payer_email', pt.payer_email,
      'created_at', pt.created_at,
      'paid_at', pt.paid_at,
      'refunded_amount', pt.refunded_amount,
      'refund_status', pt.refund_status,
      'last_refunded_at', pt.last_refunded_at,
      'last_refund_reason', pt.last_refund_reason,
      'is_preload', pt.is_preload,
      'is_archived', pt.is_archived,
      'coupon_code', pt.metadata ->> 'coupon_code',
      'discount_kurus', pt.metadata -> 'discount_kurus',
      'subtotal_kurus', pt.metadata -> 'subtotal_kurus',
      'final_total_kurus', pt.metadata -> 'final_total_kurus',
      'learner_name', pt.metadata ->> 'learner_name',
      'failed_reason_code', pt.metadata ->> 'failed_reason_code',
      'failed_reason_msg', pt.metadata ->> 'failed_reason_msg',
      'test_mode', pt.metadata -> 'provider_test_mode',
      'package_name', coalesce(pkg.name_tr, pkg.name_en, pt.metadata ->> 'package_name'),
      'callback', (
        select jsonb_build_object('at', a.created_at, 'provider_status', a.metadata ->> 'provider_status', 'event_id', 'a' || a.id::text)
        from public.audit_logs a
        where a.entity_type = 'payment_transaction' and a.action = 'paytr_callback_received'
          and a.entity_id in (pt.public_reference, pt.id::text)
        order by a.created_at
        limit 1),
      'purchases', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', s.id, 'lesson_count', s.lesson_count, 'lessons_used', s.lessons_used, 'status', s.status,
          'payment_status', s.payment_status, 'package_name', coalesce(nullif(btrim(s.custom_package_name), ''), p.name_tr, p.name_en),
          'created_at', s.created_at) order by s.created_at), '[]'::jsonb)
        from public.student_package_purchases s
        left join public.pricing_packages p on p.id = s.package_id
        where s.payment_transaction_id = pt.id),
      'mails', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', d.id, 'event_type', d.event_type, 'template', d.template, 'recipient', d.recipient, 'status', d.status,
          'attempt_count', d.attempt_count, 'created_at', d.created_at, 'sent_at', d.sent_at,
          'last_error_code', d.last_error_code) order by d.created_at), '[]'::jsonb)
        from public.notification_deliveries d
        where d.entity_type = 'payment_transaction' and d.entity_id in (pt.id::text, pt.public_reference))
    )
    into v_payment
    from public.payment_transactions pt
    left join public.pricing_packages pkg on pkg.id = pt.package_id
    where pt.id = r.payment_id;
  end if;

  if r.delivery_id is not null then
    select jsonb_build_object(
      'id', d.id,
      'channel', d.channel,
      'event_type', d.event_type,
      'template', d.template,
      'recipient', d.recipient,
      -- Doğrulama / şifre kodları konu satırında olabilir: 4+ haneli sayılar gizlenir.
      'subject', regexp_replace(d.subject, '[0-9]{4,}', '••••', 'g'),
      'status', d.status,
      'provider', d.provider,
      'provider_message_id', d.provider_message_id,
      'attempt_count', d.attempt_count,
      'max_attempts', 8,
      'created_at', d.created_at,
      'sent_at', d.sent_at,
      'next_attempt_at', d.next_attempt_at,
      'last_error_code', d.last_error_code,
      'last_error', regexp_replace(left(d.last_error, 300), '(bearer\s+)?[A-Za-z0-9_\-\.]{32,}', '[gizlendi]', 'gi'),
      'dedupe_key', d.dedupe_key,
      'entity_type', d.entity_type,
      'entity_id', d.entity_id,
      'is_archived', d.is_archived
    )
    into v_delivery
    from public.notification_deliveries d
    where d.id = r.delivery_id;
  end if;

  if r.lesson_id is not null then
    select jsonb_build_object(
      'id', l.id,
      'title', l.title,
      'subject', l.subject,
      'exam_code', l.exam_code,
      'lesson_date', l.lesson_date,
      'duration_minutes', l.duration_minutes,
      'timezone_label', l.lesson_timezone_label,
      'status', l.status,
      'completed_at', l.completed_at,
      'instructor', i.name,
      'topic', t.label,
      'student_id', l.student_user_id,
      'student_name', s.full_name,
      'package_name', coalesce(nullif(btrim(pp.custom_package_name), ''), pk.name_tr, pk.name_en),
      'package_lesson_count', pp.lesson_count,
      'package_lessons_used', pp.lessons_used,
      'previous_remaining', l.completion_previous_remaining,
      'has_report', coalesce(btrim(l.completion_report), '') <> '',
      'report_updated_at', l.report_updated_at,
      'report_email_sent_at', l.report_email_sent_at,
      'report_version', l.report_version,
      'is_archived', l.is_archived
    )
    into v_lesson
    from public.student_lessons l
    left join public.instructors i on i.id = l.instructor_id
    left join public.lesson_topics t on t.id = l.topic_id
    left join public.student_profiles s on s.id = l.student_user_id
    left join public.student_package_purchases pp on pp.id = l.package_purchase_id
    left join public.pricing_packages pk on pk.id = pp.package_id
    where l.id = r.lesson_id;
  end if;

  if r.purchase_id is not null then
    select jsonb_build_object(
      'id', s.id,
      'package_name', coalesce(nullif(btrim(s.custom_package_name), ''), p.name_tr, p.name_en),
      'lesson_count', s.lesson_count,
      'lessons_used', s.lessons_used,
      'remaining', greatest(coalesce(s.lesson_count, 0) - coalesce(s.lessons_used, 0), 0),
      'status', s.status,
      'payment_status', s.payment_status,
      'assignment_source', s.assignment_source,
      'price_amount', s.price_amount,
      'currency', s.currency,
      'created_at', s.created_at,
      'is_archived', s.is_archived
    )
    into v_purchase
    from public.student_package_purchases s
    left join public.pricing_packages p on p.id = s.package_id
    where s.id = r.purchase_id;
  end if;

  if r.source = 'audit' then
    select coalesce(jsonb_agg(jsonb_build_object('table', c.table_name, 'row_id', c.row_id, 'changes', c.changes, 'created_at', c.created_at) order by c.id), '[]'::jsonb)
    into v_changes
    from public.audit_changes c
    where c.row_id in (r.entity_id, r.lesson_id::text, r.student_id::text, r.purchase_id::text, r.subject_user_id::text, r.payment_id::text)
      and c.created_at between r.created_at - interval '5 seconds' and r.created_at + interval '5 seconds';
    if v_changes::text ~ '"(topic_id|instructor_id)"' then
      select coalesce(jsonb_object_agg(x.id, x.label), '{}'::jsonb)
      into v_lookups
      from (
        select i.id::text as id, i.name as label from public.instructors i
        union all
        select t.id::text, t.label from public.lesson_topics t
      ) x;
    end if;
  end if;

  v_has_link := r.correlation_id is not null or r.payment_id is not null or r.lesson_id is not null
    or r.delivery_id is not null or r.purchase_id is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
      'event_id', t.event_id, 'created_at', t.created_at, 'action', t.action, 'feed_category', t.feed_category,
      'feed_status', t.feed_status, 'actor_name', t.actor_name, 'actor_role', t.actor_role,
      'subject_name', t.subject_name, 'mail_recipient', t.mail_recipient, 'mail_template', t.mail_template,
      'mail_event_type', t.mail_event_type, 'is_current', t.event_id = r.event_id) order by t.created_at, t.event_id), '[]'::jsonb)
  into v_timeline
  from (
    select x.*
    from public.admin_audit_rows(r.created_at - interval '30 days', r.created_at + interval '30 days', null) x
    where (r.correlation_id is not null and x.correlation_id = r.correlation_id)
       or (r.payment_id is not null and x.payment_id = r.payment_id)
       or (r.public_reference is not null and r.payment_id is null and x.public_reference = r.public_reference)
       or (r.lesson_id is not null and x.lesson_id = r.lesson_id and r.feed_category in ('lesson', 'mail'))
       or (r.delivery_id is not null and x.delivery_id = r.delivery_id)
       or (r.purchase_id is not null and r.payment_id is null and r.lesson_id is null and x.purchase_id = r.purchase_id
           and x.feed_category in ('package', 'mail'))
       or (not v_has_link and r.subject_user_id is not null and x.subject_user_id = r.subject_user_id
           and x.created_at between r.created_at - interval '30 minutes' and r.created_at + interval '30 minutes')
       or x.event_id = r.event_id
    order by abs(extract(epoch from (x.created_at - r.created_at)))
    limit 60
  ) t;

  return jsonb_build_object(
    'event', v_event,
    'actor', v_actor,
    'subject', v_subject,
    'payment', v_payment,
    'delivery', v_delivery,
    'lesson', v_lesson,
    'purchase', v_purchase,
    'changes', coalesce(v_changes, '[]'::jsonb),
    'lookups', coalesce(v_lookups, '{}'::jsonb),
    'timeline', v_timeline
  );
end;
$$;

revoke all on function public.admin_audit_detail(text) from public, anon;
grant execute on function public.admin_audit_detail(text) to authenticated;
