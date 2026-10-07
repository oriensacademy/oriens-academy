-- Yönetim paneli "Yeni Öğrenci" ve "Arşive taşı" nedenleri.
--
-- Yeni öğrenci: veli hesabı (guardian_accounts) bir auth kullanıcısına bağlı
-- olduğundan panelden veli hesabı AÇILMAZ. Öğrenci kaydı, kayıt formundaki
-- öğrenci bilgileri ve referanstaki iletişim alanları (veli adı, telefon,
-- e-posta) ile oluşturulur; auth kullanıcısı, paket, ödeme veya e-posta
-- oluşturulmaz. Tek transaction, tek denetim kaydı (student.created) ve
-- istemci tarafından üretilen istek anahtarı ile çift tıklamaya karşı
-- idempotenttir.
--
-- Arşiv nedeni: mevcut admin_archive_member akışı aynen çağrılır; neden ve
-- kısa açıklama aynı transaction içinde yazılan member_archived denetim
-- kaydının metadata'sına eklenir. Yeni kolon yok, kayıt silinmez.
--
-- Additive: tek nullable kolon, yeni fonksiyonlar. Veri silme / toplu
-- güncelleme / backfill yok.

alter table public.student_profiles
  add column if not exists contact_guardian_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_profiles_contact_guardian_name_len'
      and conrelid = 'public.student_profiles'::regclass
  ) then
    alter table public.student_profiles
      add constraint student_profiles_contact_guardian_name_len
      check (contact_guardian_name is null or char_length(contact_guardian_name) between 2 and 100);
  end if;
end $$;

comment on column public.student_profiles.contact_guardian_name is
  'Panelden eklenen ve veli hesabı olmayan öğrencide iletişim kişisinin (veli) adı. Veli hesabı bağlıysa guardian_accounts.full_name esastır.';

create or replace function public.admin_create_student(
  p_request_id uuid,
  p_full_name text,
  p_school text default null,
  p_grade_level text default null,
  p_education_program text default null,
  p_exams_taken text[] default '{}',
  p_guardian_name text default null,
  p_phone text default null,
  p_email text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_correlation text;
  v_existing text;
  v_student_id uuid;
  v_name text := left(regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g'), 101);
  v_school text := left(nullif(regexp_replace(btrim(coalesce(p_school, '')), '\s+', ' ', 'g'), ''), 160);
  v_grade text := left(nullif(btrim(coalesce(p_grade_level, '')), ''), 120);
  v_program text := left(nullif(regexp_replace(btrim(coalesce(p_education_program, '')), '\s+', ' ', 'g'), ''), 160);
  v_guardian text := nullif(regexp_replace(btrim(coalesce(p_guardian_name, '')), '\s+', ' ', 'g'), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_phone_digits text;
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_exams text[];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_request_id is null then
    return jsonb_build_object('success', false, 'error_code', 'REQUEST_ID_REQUIRED');
  end if;

  -- Aynı istek anahtarı ikinci kez gelirse (çift tıklama, ağ tekrarı) yeni
  -- kayıt açılmaz; ilk çağrının sonucu döner.
  v_correlation := 'admin_create_student:' || p_request_id::text;
  perform pg_advisory_xact_lock(hashtextextended(v_correlation, 0));
  select entity_id into v_existing from public.audit_logs
  where correlation_id = v_correlation and action = 'student.created'
  order by id limit 1;
  if v_existing is not null then
    return jsonb_build_object('success', true, 'student_id', v_existing::uuid, 'replayed', true);
  end if;

  if char_length(v_name) not between 2 and 100 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_STUDENT_NAME');
  end if;
  if v_guardian is not null and char_length(v_guardian) not between 2 and 100 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_GUARDIAN_NAME');
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_EMAIL');
  end if;
  if v_phone is not null then
    v_phone_digits := regexp_replace(v_phone, '\D', '', 'g');
    if char_length(v_phone) > 30 or char_length(v_phone_digits) not between 10 and 15 then
      return jsonb_build_object('success', false, 'error_code', 'INVALID_PHONE');
    end if;
  end if;
  if v_grade is not null and not exists (
    select 1 from public.student_grade_options where label = v_grade and active
  ) then
    return jsonb_build_object('success', false, 'error_code', 'GRADE_UNAVAILABLE');
  end if;

  select coalesce(array_agg(left(clean.value, 80) order by clean.first_pos), '{}') into v_exams
  from (
    select btrim(item.value) as value, min(item.pos) as first_pos
    from unnest(coalesce(p_exams_taken, '{}'::text[])) with ordinality as item(value, pos)
    where nullif(btrim(item.value), '') is not null
    group by btrim(item.value)
  ) clean;
  if coalesce(array_length(v_exams, 1), 0) > 20 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_EXAMS');
  end if;

  -- Aynı adla ve aynı iletişim e-postasıyla aktif bir öğrenci zaten varsa
  -- ikinci kayıt açılmaz (yinelenen kayıt koruması).
  if exists (
    select 1 from public.student_profiles sp
    where sp.active
      and lower(regexp_replace(btrim(sp.full_name), '\s+', ' ', 'g')) = lower(v_name)
      and lower(coalesce(nullif(btrim(sp.email), ''), '')) = coalesce(v_email, '')
  ) then
    return jsonb_build_object('success', false, 'error_code', 'DUPLICATE_STUDENT');
  end if;

  insert into public.student_profiles(
    id, full_name, email, phone, school, grade_level, education_program, exams_taken,
    contact_guardian_name, preferred_language, active, migration_source
  ) values (
    gen_random_uuid(), v_name, coalesce(v_email, ''), v_phone, v_school, v_grade, v_program, v_exams,
    v_guardian, 'tr', true, 'admin_created_v1'
  ) returning id into v_student_id;

  perform public.write_audit_event(
    'student.created', 'student', 'info', 'student_profile', v_student_id::text, v_correlation,
    jsonb_build_object(
      'student_id', v_student_id,
      'student_name', v_name,
      'has_guardian_contact', v_guardian is not null,
      'has_email', v_email is not null,
      'has_phone', v_phone is not null,
      'grade_level', v_grade,
      'source', 'admin_panel'
    ),
    auth.uid()
  );

  return jsonb_build_object('success', true, 'student_id', v_student_id, 'replayed', false);
end;
$fn$;

revoke all on function public.admin_create_student(uuid,text,text,text,text,text[],text,text,text) from public, anon;
grant execute on function public.admin_create_student(uuid,text,text,text,text,text[],text,text,text) to authenticated, service_role;

create or replace function public.admin_archive_member_with_reason(
  p_user_id uuid,
  p_reason text default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text := nullif(regexp_replace(btrim(coalesce(p_note, '')), '\s+', ' ', 'g'), '');
  v_result jsonb;
  v_audit_id bigint;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  -- Referans arşiv penceresindeki seçenekler (oriens-admin #arc-dialog).
  if v_reason is not null and v_reason not in ('Kaydı bıraktı', 'Mezun oldu', 'Test kaydı', 'Diğer') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_ARCHIVE_REASON');
  end if;
  if v_note is not null and char_length(v_note) > 120 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_ARCHIVE_NOTE');
  end if;

  v_result := public.admin_archive_member(p_user_id);

  if v_reason is not null or v_note is not null then
    select id into v_audit_id from public.audit_logs
    where action = 'member_archived' and entity_id = p_user_id::text
      and actor_user_id = auth.uid() and created_at = now()
    order by id desc limit 1;
    if v_audit_id is not null then
      update public.audit_logs
      set metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object('archive_reason', v_reason, 'archive_note', v_note))
      where id = v_audit_id;
    end if;
  end if;

  return v_result || jsonb_strip_nulls(jsonb_build_object('archive_reason', v_reason));
end;
$fn$;

revoke all on function public.admin_archive_member_with_reason(uuid,text,text) from public, anon;
grant execute on function public.admin_archive_member_with_reason(uuid,text,text) to authenticated, service_role;
