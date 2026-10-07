-- Sepet / ödeme başlangıcı denetim kayıtları.
--
-- Sepet tarayıcıda (localStorage) tutulur; satın alma mantığı değişmez. İstemci
-- yalnızca olay türünü, sepet kimliğini ve paket kimliklerini bildirir: paket
-- adı, ders sayısı ve fiyat SUNUCUDA pricing_packages'tan; ödeme başlangıcının
-- tutarı / kuponu / kalemleri payment_transactions'tan okunur. Kart, token,
-- telefon veya serbest metin saklanmaz. Çağrı başarısız olsa bile sepet ve
-- ödeme akışı etkilenmez (istemci sonucu beklemez).

create index if not exists audit_logs_cart_transaction_idx
  on public.audit_logs ((metadata ->> 'transaction_id'))
  where entity_type = 'cart';

create or replace function public.record_cart_event(
  p_kind text,
  p_cart_id text,
  p_package_ids text[] default null,
  p_student_id uuid default null,
  p_reference text default null,
  p_result text default null,
  p_error_code text default null,
  p_source text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cart uuid := public.audit_try_uuid(p_cart_id);
  v_is_admin boolean := public.is_admin();
  v_ids text[];
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_student uuid;
  v_tx public.payment_transactions%rowtype;
  v_names text;
  v_lessons integer;
  v_total numeric;
  v_currency text;
  v_first jsonb;
  v_result text;
  v_severity text := 'info';
  v_meta jsonb;
begin
  if v_uid is null or v_cart is null
     or coalesce(p_kind, '') not in ('cart_item_added', 'cart_item_removed', 'cart_cleared', 'checkout_opened', 'checkout_started') then
    return false;
  end if;

  -- Kötüye kullanım sınırı: kullanıcı başına 10 dakikada en fazla 60 sepet olayı.
  if (select count(*) from public.audit_logs a
      where a.entity_type = 'cart' and a.actor_user_id = v_uid and a.created_at > now() - interval '10 minutes') >= 60 then
    return false;
  end if;

  -- Ödeme ekranı açılışı aynı sepet için 30 dakikada bir kez yazılır (yenileme gürültüsü yok).
  if p_kind = 'checkout_opened' and exists (
      select 1 from public.audit_logs a
      where a.entity_type = 'cart' and a.correlation_id = v_cart::text and a.action = 'checkout_opened'
        and a.actor_user_id = v_uid and a.created_at > now() - interval '30 minutes') then
    return false;
  end if;

  v_ids := array(
    select s.id from (
      select left(btrim(u.x), 64) as id, min(u.o) as o
      from unnest(coalesce(p_package_ids, '{}'::text[])) with ordinality u(x, o)
      where btrim(coalesce(u.x, '')) <> ''
      group by 1
    ) s
    order by s.o
    limit 20);

  -- Öğrenci: hesaba bağlı olan seçili öğrenci, yoksa birincil öğrenci.
  select gs.student_id into v_student
  from public.guardian_students gs
  where gs.guardian_user_id = v_uid and gs.active and (p_student_id is null or gs.student_id = p_student_id)
  order by (gs.student_id = p_student_id) desc nulls last, gs.is_primary desc nulls last
  limit 1;
  if v_student is null and v_is_admin and p_student_id is not null then
    select sp.id into v_student from public.student_profiles sp where sp.id = p_student_id;
  end if;

  if p_kind = 'checkout_started' and nullif(btrim(coalesce(p_reference, '')), '') is not null then
    select t.* into v_tx
    from public.payment_transactions t
    where t.public_reference = left(btrim(p_reference), 64)
      and (t.auth_actor_user_id = v_uid or t.purchaser_guardian_user_id = v_uid)
      and t.created_at > now() - interval '2 hours'
    limit 1;
  end if;

  if v_tx.id is not null then
    -- Ödeme kaydındaki yetkili kalemler (sunucu fiyatı, kupon payı dahil).
    select coalesce(jsonb_agg(jsonb_build_object(
        'package_id', i ->> 'package_id',
        'package_name', coalesce(p.name_tr, p.name_en, i ->> 'package_name'),
        'lesson_count', coalesce(p.lesson_count, (i ->> 'lesson_count')::integer),
        'price', (i ->> 'base_amount')::numeric,
        'discount', (i ->> 'discount_amount')::numeric,
        'final', (i ->> 'final_amount')::numeric,
        'currency', v_tx.currency,
        'quantity', 1) order by o), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(case when jsonb_typeof(v_tx.metadata -> 'checkout_items') = 'array' then v_tx.metadata -> 'checkout_items' else '[]'::jsonb end) with ordinality e(i, o)
    left join public.pricing_packages p on p.id = i ->> 'package_id';
    v_student := coalesce(v_tx.package_owner_student_id, v_student);
  else
    select coalesce(jsonb_agg(jsonb_build_object(
        'package_id', p.id,
        'package_name', coalesce(p.name_tr, p.name_en, p.id),
        'lesson_count', p.lesson_count,
        'price', coalesce(p.current_total, p.price_amount),
        'currency', coalesce(p.currency, 'TRY'),
        'quantity', 1) order by u.o), '[]'::jsonb)
    into v_items
    from unnest(v_ids) with ordinality u(id, o)
    join public.pricing_packages p on p.id = u.id;
  end if;

  v_count := jsonb_array_length(v_items);
  if v_count = 0 or (p_kind in ('cart_item_added', 'cart_item_removed') and v_count <> 1) then
    return false;
  end if;

  select string_agg(i ->> 'package_name', ', ' order by o),
         sum((i ->> 'lesson_count')::integer),
         sum(coalesce((i ->> 'final')::numeric, (i ->> 'price')::numeric)),
         min(i ->> 'currency')
  into v_names, v_lessons, v_total, v_currency
  from jsonb_array_elements(v_items) with ordinality e(i, o);
  v_first := v_items -> 0;

  if p_kind = 'checkout_started' then
    v_result := case
      when p_result in ('session_created', 'zero_payment', 'session_failed') then p_result
      when v_tx.id is not null then 'session_created'
      else 'session_failed' end;
    if v_result = 'session_failed' then v_severity := 'warning'; end if;
  end if;

  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'cart_id', v_cart::text,
    'guardian_user_id', v_uid,
    'student_id', v_student,
    'package_id', case when v_count = 1 then v_first ->> 'package_id' end,
    'package_name', v_names,
    'lesson_count', v_lessons,
    'price', case when v_count = 1 then (v_first ->> 'price')::numeric end,
    'quantity', case when v_count = 1 then 1 end,
    'currency', coalesce(v_currency, 'TRY'),
    'items', case when v_count > 1 or p_kind in ('cart_cleared', 'checkout_opened', 'checkout_started') then v_items end,
    'item_count', v_count,
    'total', v_total,
    'subtotal', case when v_tx.id is not null then (v_tx.metadata ->> 'base_amount')::numeric end,
    'discount', case when v_tx.id is not null then nullif((v_tx.metadata ->> 'discount_amount')::numeric, 0) end,
    'coupon_code', case when v_tx.id is not null then nullif(left(v_tx.metadata ->> 'coupon_code', 40), '') end,
    'transaction_id', v_tx.id,
    'public_reference', v_tx.public_reference,
    'result', v_result,
    'error_code', case when p_kind = 'checkout_started' and p_error_code ~ '^[A-Z][A-Z_]{1,47}$' then p_error_code end,
    'source', case when p_source in ('pricing', 'cart', 'payment', 'guest_cart', 'payment_result') then p_source end,
    'created_at', now()));

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, category, severity, correlation_id, metadata)
  values (v_uid, p_kind, 'cart', v_cart::text, 'payment', v_severity, v_cart::text, v_meta);
  return true;
end;
$$;

revoke all on function public.record_cart_event(text, text, text[], uuid, text, text, text, text) from public, anon;
grant execute on function public.record_cart_event(text, text, text[], uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Detay: sepet kalemleri + sepet → ödeme zaman çizelgesi köprüsü
-- (20261007130000 sürümüyle aynı; yalnız v_carts / v_payments eklendi)
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
  v_carts text[] := '{}';
  v_payments uuid[] := '{}';
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
      -- Sepet kalemleri (paket adı, ders sayısı, fiyat, kupon payı); kart/token alanı yok.
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'package_id', i ->> 'package_id', 'package_name', coalesce(p.name_tr, p.name_en, i ->> 'package_name'),
          'lesson_count', i -> 'lesson_count', 'price', i -> 'base_amount', 'discount', i -> 'discount_amount',
          'final', i -> 'final_amount') order by o), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(pt.metadata -> 'checkout_items') = 'array'
          then pt.metadata -> 'checkout_items' else '[]'::jsonb end) with ordinality e(i, o)
        left join public.pricing_packages p on p.id = i ->> 'package_id'),
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

  -- Sepet → ödeme köprüsü: checkout_started kaydı sepet kimliğini (correlation_id)
  -- ödeme kaydına (metadata.transaction_id) bağlar; iki yönde de izlenir.
  if r.entity_type = 'cart' and r.correlation_id is not null then
    v_carts := array[r.correlation_id];
  end if;
  if r.payment_id is not null then
    v_carts := v_carts || array(
      select distinct a.correlation_id from public.audit_logs a
      where a.entity_type = 'cart' and a.metadata ->> 'transaction_id' = r.payment_id::text and a.correlation_id is not null);
  end if;
  if cardinality(v_carts) > 0 then
    v_payments := array(
      select distinct public.audit_try_uuid(a.metadata ->> 'transaction_id') from public.audit_logs a
      where a.entity_type = 'cart' and a.correlation_id = any(v_carts) and a.metadata ? 'transaction_id');
    v_payments := array_remove(v_payments, null);
  end if;

  v_has_link := cardinality(v_carts) > 0 or r.correlation_id is not null or r.payment_id is not null or r.lesson_id is not null
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
       or (cardinality(v_carts) > 0 and x.correlation_id = any(v_carts))
       or (cardinality(v_payments) > 0 and x.payment_id = any(v_payments))
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
    'cart_id', v_carts[1],
    'timeline', v_timeline
  );
end;
$$;

revoke all on function public.admin_audit_detail(text) from public, anon;
grant execute on function public.admin_audit_detail(text) to authenticated;
