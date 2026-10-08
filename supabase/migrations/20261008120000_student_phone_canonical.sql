-- Öğrenci telefonu: tek kanonik biçim "905XXXXXXXXX" (Türkiye) ya da 11–15
-- haneli uluslararası rakamlar. Panel "0532 123 45 67", "+90 (532) 123 45 67",
-- "5321234567" gibi girişleri aynı değere indirir; WhatsApp bağlantısı bu
-- rakamlarla kurulur. İstemci karşılığı: src/lib/format/phone.ts
-- normalizeStudentPhone. Var olan kayıtlara dokunulmaz (veri dönüşümü yok);
-- yalnız iki panel RPC'si yeni değerleri normalize eder. Denetim kayıtları
-- ham numara içermez (student.created: has_phone, güncelleme: changed_fields).

create or replace function public.normalize_student_phone(p_value text)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select case
    when d is null then null
    when d ~ '^[1-9][0-9]{9}$' then '90' || d
    when d ~ '^0[1-9][0-9]{9}$' then '90' || substr(d, 2)
    when d ~ '^90[1-9][0-9]{9}$' then d
    when d ~ '^[1-9][0-9]{10,14}$' and d !~ '^90' then d
    else null
  end
  from (
    select case
      when char_length(btrim(coalesce(p_value, ''))) between 1 and 30
        then regexp_replace(regexp_replace(p_value, '\D', '', 'g'), '^00', '')
    end as d
  ) input;
$fn$;

revoke all on function public.normalize_student_phone(text) from public, anon;
grant execute on function public.normalize_student_phone(text) to authenticated, service_role;

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
  v_phone_raw text := nullif(btrim(coalesce(p_phone, '')), '');
  v_phone text := public.normalize_student_phone(p_phone);
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
  if v_phone_raw is not null and v_phone is null then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_PHONE');
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

create or replace function public.admin_update_student_form_profile(
  p_student_id uuid,
  p_changes jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_old public.student_profiles%rowtype;
  v_changed text[] := '{}';
  v_unknown_keys text[];
  v_name text;
  v_phone text;
  v_school text;
  v_program text;
  v_exams text[];
  v_grade text;
  v_language text;
  v_active boolean;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_CHANGES');
  end if;
  select array_agg(item.key) into v_unknown_keys from jsonb_object_keys(p_changes) as item(key)
  where item.key not in ('full_name','phone','school','education_program','exams_taken','grade_level','preferred_language','active');
  if coalesce(array_length(v_unknown_keys, 1), 0) > 0 then
    return jsonb_build_object('success', false, 'error_code', 'UNSUPPORTED_FIELDS');
  end if;

  select * into v_old from public.student_profiles where id = p_student_id for update;
  if v_old.id is null then return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND'); end if;

  v_name := case when p_changes ? 'full_name' then left(regexp_replace(btrim(coalesce(p_changes->>'full_name','')), '\s+', ' ', 'g'), 100) else v_old.full_name end;
  v_phone := case when p_changes ? 'phone' then public.normalize_student_phone(p_changes->>'phone') else v_old.phone end;
  if p_changes ? 'phone' and v_phone is null and nullif(btrim(coalesce(p_changes->>'phone', '')), '') is not null then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_PHONE');
  end if;
  v_school := case when p_changes ? 'school' then left(nullif(btrim(p_changes->>'school'), ''), 160) else v_old.school end;
  v_program := case when p_changes ? 'education_program' then left(nullif(btrim(p_changes->>'education_program'), ''), 160) else v_old.education_program end;
  v_grade := case when p_changes ? 'grade_level' then left(nullif(btrim(p_changes->>'grade_level'), ''), 120) else v_old.grade_level end;
  v_language := case when p_changes ? 'preferred_language' then p_changes->>'preferred_language' else v_old.preferred_language end;
  v_active := case when p_changes ? 'active' then (p_changes->>'active')::boolean else v_old.active end;

  if p_changes ? 'exams_taken' then
    if jsonb_typeof(p_changes->'exams_taken') <> 'array' then return jsonb_build_object('success', false, 'error_code', 'INVALID_EXAMS'); end if;
    select coalesce(array_agg(left(value, 80)), '{}') into v_exams
    from (select distinct btrim(value) value from jsonb_array_elements_text(p_changes->'exams_taken') where nullif(btrim(value), '') is not null) clean;
  else
    v_exams := v_old.exams_taken;
  end if;

  if char_length(v_name) not between 2 and 100 or v_language not in ('tr','en') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_INPUT');
  end if;
  if v_grade is not null and v_grade is distinct from v_old.grade_level and not exists (
    select 1 from public.student_grade_options where label = v_grade and active
  ) then return jsonb_build_object('success', false, 'error_code', 'GRADE_UNAVAILABLE'); end if;

  if v_old.full_name is distinct from v_name then v_changed := array_append(v_changed, 'full_name'); end if;
  if v_old.phone is distinct from v_phone then v_changed := array_append(v_changed, 'phone'); end if;
  if v_old.school is distinct from v_school then v_changed := array_append(v_changed, 'school'); end if;
  if v_old.education_program is distinct from v_program then v_changed := array_append(v_changed, 'education_program'); end if;
  if v_old.exams_taken is distinct from v_exams then v_changed := array_append(v_changed, 'exams_taken'); end if;
  if v_old.grade_level is distinct from v_grade then v_changed := array_append(v_changed, 'grade_level'); end if;
  if v_old.preferred_language is distinct from v_language then v_changed := array_append(v_changed, 'preferred_language'); end if;
  if v_old.active is distinct from v_active then v_changed := array_append(v_changed, 'active'); end if;

  update public.student_profiles set
    full_name = v_name, phone = v_phone, school = v_school,
    education_program = v_program, exams_taken = v_exams, grade_level = v_grade,
    preferred_language = v_language, active = v_active, updated_at = now()
  where id = p_student_id;

  -- Telefon yalnız student_profiles.phone'da tutulur; auth meta verisine kopyalanmaz.
  if v_old.full_name is distinct from v_name or v_old.phone is distinct from v_phone then
    update auth.users set raw_user_meta_data = (coalesce(raw_user_meta_data, '{}'::jsonb) - 'phone') || jsonb_build_object('full_name', v_name)
    where id = p_student_id;
  end if;
  perform public.write_audit_event(
    case when v_old.full_name is distinct from v_name or v_old.phone is distinct from v_phone then 'student.identity.updated' else 'student.profile.updated' end,
    'student', 'info', 'student_profile', p_student_id::text, null,
    jsonb_build_object('changed_fields', v_changed), auth.uid()
  );
  return jsonb_build_object('success', true, 'student_id', p_student_id, 'changed_fields', v_changed);
end;
$fn$;
revoke all on function public.admin_update_student_form_profile(uuid,jsonb) from public, anon;
grant execute on function public.admin_update_student_form_profile(uuid,jsonb) to authenticated, service_role;
