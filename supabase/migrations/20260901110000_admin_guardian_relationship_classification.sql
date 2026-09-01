-- Admin-side relationship classification and audit logging.
-- Enables administrators to classify guardian_students relationship_role (self, parent, guardian, other)
-- without any public-facing role selector or guessing.

create or replace function public.admin_update_guardian_relationship(
  p_student_id uuid,
  p_relationship_role text,
  p_guardian_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gs public.guardian_students%rowtype;
  v_old_role text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if p_relationship_role not in ('self', 'parent', 'guardian', 'other') then
    return jsonb_build_object('success', false, 'error_code', 'INVALID_RELATIONSHIP_ROLE');
  end if;

  if p_guardian_user_id is not null then
    select * into v_gs from public.guardian_students
    where student_id = p_student_id and guardian_user_id = p_guardian_user_id and active
    limit 1 for update;
  else
    select * into v_gs from public.guardian_students
    where student_id = p_student_id and active
    order by is_primary desc, created_at asc
    limit 1 for update;
  end if;

  if v_gs.student_id is null then
    return jsonb_build_object('success', false, 'error_code', 'RELATIONSHIP_NOT_FOUND');
  end if;

  v_old_role := v_gs.relationship_role;

  update public.guardian_students
  set relationship_role = p_relationship_role,
      updated_at = timezone('utc'::text, now())
  where guardian_user_id = v_gs.guardian_user_id and student_id = v_gs.student_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'admin.update_relationship_role',
    'guardian_students',
    v_gs.guardian_user_id::text || ':' || v_gs.student_id::text,
    jsonb_build_object(
      'student_id', p_student_id,
      'guardian_user_id', v_gs.guardian_user_id,
      'old_relationship_role', v_old_role,
      'new_relationship_role', p_relationship_role
    )
  );

  return jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'guardian_user_id', v_gs.guardian_user_id,
    'old_relationship_role', v_old_role,
    'new_relationship_role', p_relationship_role
  );
end;
$$;

revoke all on function public.admin_update_guardian_relationship(uuid, text, uuid) from public, anon;
grant execute on function public.admin_update_guardian_relationship(uuid, text, uuid) to authenticated;

create or replace function public.admin_get_student_guardian_relationship(
  p_student_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select
    gs.student_id,
    gs.guardian_user_id,
    gs.relationship_role,
    gs.is_primary,
    ga.full_name as guardian_name,
    ga.email as guardian_email,
    ga.phone as guardian_phone
  into v_rec
  from public.guardian_students gs
  join public.guardian_accounts ga on ga.user_id = gs.guardian_user_id
  where gs.student_id = p_student_id and gs.active and ga.active
  order by gs.is_primary desc, gs.created_at asc
  limit 1;

  if v_rec.student_id is null then
    return jsonb_build_object('success', false, 'error_code', 'RELATIONSHIP_NOT_FOUND');
  end if;

  return jsonb_build_object(
    'success', true,
    'student_id', v_rec.student_id,
    'guardian_user_id', v_rec.guardian_user_id,
    'guardian_name', v_rec.guardian_name,
    'guardian_email', v_rec.guardian_email,
    'guardian_phone', v_rec.guardian_phone,
    'relationship_role', v_rec.relationship_role,
    'is_primary', v_rec.is_primary
  );
end;
$$;

revoke all on function public.admin_get_student_guardian_relationship(uuid) from public, anon;
grant execute on function public.admin_get_student_guardian_relationship(uuid) to authenticated;
