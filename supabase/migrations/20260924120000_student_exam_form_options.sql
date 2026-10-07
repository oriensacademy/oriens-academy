-- Admin-managed options for the existing student_profiles.exams_taken text[].
-- This migration does not alter, normalize, or backfill any student row.

create table if not exists public.student_exam_options (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_exam_options_label_unique
  on public.student_exam_options (lower(btrim(label)));
create index if not exists student_exam_options_order_idx
  on public.student_exam_options (active desc, sort_order, id);

alter table public.student_exam_options enable row level security;
create policy "Admin student exam options"
  on public.student_exam_options for all
  using (public.is_admin())
  with check (public.is_admin());
grant select, insert, update on public.student_exam_options to authenticated, service_role;

create or replace function public.prevent_student_exam_option_delete()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  raise exception 'STUDENT_EXAM_OPTION_DELETE_FORBIDDEN' using errcode = '23503';
end;
$fn$;

create trigger trg_prevent_student_exam_option_delete
before delete on public.student_exam_options
for each row execute function public.prevent_student_exam_option_delete();

create or replace function public.admin_manage_student_exam_option(
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
  if p_action in ('create', 'rename') and char_length(btrim(coalesce(p_label, ''))) not between 1 and 80 then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_LABEL');
  end if;

  if p_action = 'create' then
    select coalesce(max(sort_order), 0) + 1 into v_order from public.student_exam_options;
    insert into public.student_exam_options(label, sort_order)
    values (left(btrim(p_label), 80), coalesce(p_sort_order, v_order)) returning id into v_id;
  elsif p_action = 'rename' then
    update public.student_exam_options set label = left(btrim(p_label), 80), updated_at = now()
    where id = p_id returning id into v_id;
  elsif p_action in ('activate', 'deactivate') then
    update public.student_exam_options set active = (p_action = 'activate'), updated_at = now()
    where id = p_id returning id into v_id;
  else
    update public.student_exam_options set sort_order = p_sort_order, updated_at = now()
    where id = p_id returning id into v_id;
  end if;

  if v_id is null then return jsonb_build_object('success', false, 'error_code', 'NOT_FOUND'); end if;
  perform public.write_audit_event(
    'student.exam_option_' || case p_action when 'create' then 'created' when 'rename' then 'updated' when 'activate' then 'reactivated' when 'deactivate' then 'deactivated' else 'reordered' end,
    'student', 'info', 'student_exam_option', v_id::text, null,
    jsonb_strip_nulls(jsonb_build_object('reference_id', v_id, 'sort_order', p_sort_order)), auth.uid()
  );
  return jsonb_build_object('success', true, 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('success', false, 'error_code', 'DUPLICATE_LABEL');
end;
$fn$;
revoke all on function public.admin_manage_student_exam_option(text,uuid,text,integer) from public, anon;
grant execute on function public.admin_manage_student_exam_option(text,uuid,text,integer) to authenticated, service_role;
