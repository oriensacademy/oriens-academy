-- Admin-managed student grade options for student create/edit forms.
-- Existing destination fields and historical student rows are intentionally untouched.

alter table public.student_profiles
  add column if not exists grade_level text;

create table if not exists public.student_grade_options (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_grade_options_label_unique
  on public.student_grade_options (lower(btrim(label)));
create index if not exists student_grade_options_order_idx
  on public.student_grade_options (active desc, sort_order, id);

alter table public.student_grade_options enable row level security;
create policy "Admin student grade options"
  on public.student_grade_options for all
  using (public.is_admin())
  with check (public.is_admin());
grant select, insert, update on public.student_grade_options to authenticated, service_role;

create or replace function public.prevent_student_grade_option_delete()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  raise exception 'STUDENT_GRADE_OPTION_DELETE_FORBIDDEN' using errcode = '23503';
end;
$fn$;

drop trigger if exists trg_prevent_student_grade_option_delete on public.student_grade_options;
create trigger trg_prevent_student_grade_option_delete
before delete on public.student_grade_options
for each row execute function public.prevent_student_grade_option_delete();

create or replace function public.admin_manage_student_grade_option(
  p_action text,
  p_id uuid default null,
  p_label text default null,
  p_sort_order integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_id uuid;
  v_order integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_action not in ('create', 'rename', 'activate', 'deactivate', 'reorder') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_ACTION');
  end if;
  if p_action in ('create', 'rename') and char_length(btrim(coalesce(p_label, ''))) not between 1 and 120 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_LABEL');
  end if;

  if p_action = 'create' then
    select coalesce(max(sort_order), 0) + 1 into v_order from public.student_grade_options;
    insert into public.student_grade_options(label, sort_order)
    values (left(btrim(p_label), 120), coalesce(p_sort_order, v_order)) returning id into v_id;
  elsif p_action = 'rename' then
    update public.student_grade_options set label = left(btrim(p_label), 120), updated_at = now()
    where id = p_id returning id into v_id;
  elsif p_action in ('activate', 'deactivate') then
    update public.student_grade_options set active = (p_action = 'activate'), updated_at = now()
    where id = p_id returning id into v_id;
  else
    update public.student_grade_options set sort_order = p_sort_order, updated_at = now()
    where id = p_id returning id into v_id;
  end if;

  if v_id is null then return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND'); end if;
  perform public.write_audit_event(
    'student.grade_option_' || case p_action when 'create' then 'created' when 'rename' then 'updated' when 'activate' then 'reactivated' when 'deactivate' then 'deactivated' else 'reordered' end,
    'student', 'info', 'student_grade_option', v_id::text, null,
    jsonb_strip_nulls(jsonb_build_object('reference_id', v_id, 'sort_order', p_sort_order)), auth.uid()
  );
  return jsonb_build_object('success', true, 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('success', false, 'error_code', 'DUPLICATE_LABEL');
end;
$fn$;
revoke all on function public.admin_manage_student_grade_option(text,uuid,text,integer) from public, anon;
grant execute on function public.admin_manage_student_grade_option(text,uuid,text,integer) to authenticated, service_role;

-- A JSON change-set lets each form update only fields it actually manages.
-- Destination fields are not accepted and can therefore never be nulled by these forms.
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
  v_phone := case when p_changes ? 'phone' then left(nullif(btrim(p_changes->>'phone'), ''), 30) else v_old.phone end;
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

  if v_old.full_name is distinct from v_name or v_old.phone is distinct from v_phone then
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', v_name, 'phone', v_phone)
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

create or replace function public.admin_create_student_for_guardian_with_grade(
  p_guardian_user_id uuid,
  p_student_full_name text,
  p_relationship_role text default 'parent',
  p_grade_level text default null
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_result jsonb;
  v_student_id uuid;
  v_grade text := left(nullif(btrim(p_grade_level), ''), 120);
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if v_grade is not null and not exists (select 1 from public.student_grade_options where label = v_grade and active) then
    return jsonb_build_object('success', false, 'error_code', 'GRADE_UNAVAILABLE');
  end if;
  v_result := public.admin_create_or_link_student_for_guardian(p_guardian_user_id, p_student_full_name, p_relationship_role, null);
  if coalesce((v_result->>'success')::boolean, false) then
    v_student_id := (v_result->>'student_id')::uuid;
    update public.student_profiles set grade_level = v_grade, updated_at = now() where id = v_student_id;
  end if;
  return v_result || jsonb_build_object('grade_level', v_grade);
end;
$fn$;
revoke all on function public.admin_create_student_for_guardian_with_grade(uuid,text,text,text) from public, anon;
grant execute on function public.admin_create_student_for_guardian_with_grade(uuid,text,text,text) to authenticated, service_role;
