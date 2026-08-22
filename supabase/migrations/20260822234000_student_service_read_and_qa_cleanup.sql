-- Trusted Edge Functions need read-only access to student language/learning data.
grant select on public.student_profiles, public.student_lessons, public.student_homework,
  public.student_admin_notes to service_role;

-- Controlled production validation cleanup. This function can target only the
-- exact synthetic address/package namespace used by production-database-qa.mjs.
create or replace function public.cleanup_student_system_qa(p_suffix text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_ids uuid[];
  v_booking_ids uuid[];
  v_slot_ids uuid[];
  v_lesson_ids uuid[];
  v_homework_ids uuid[];
  v_purchase_ids uuid[];
  v_payment_ids uuid[];
  v_package_id text := 'qa-package-' || p_suffix;
begin
  if p_suffix !~ '^[0-9]{13}-[a-z0-9]{6}$' then
    raise exception 'INVALID_QA_SUFFIX' using errcode = '22023';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_user_ids
  from auth.users
  where email in (
    'qa-admin-' || p_suffix || '@example.test',
    'qa-student-a-' || p_suffix || '@example.test',
    'qa-student-b-' || p_suffix || '@example.test'
  );

  select coalesce(array_agg(id), '{}'::uuid[]), coalesce(array_agg(slot_id) filter (where slot_id is not null), '{}'::uuid[])
    into v_booking_ids, v_slot_ids from public.bookings where student_user_id = any(v_user_ids);
  select coalesce(array_agg(id), '{}'::uuid[]) into v_lesson_ids
    from public.student_lessons where student_user_id = any(v_user_ids);
  select coalesce(array_agg(id), '{}'::uuid[]) into v_homework_ids
    from public.student_homework where student_user_id = any(v_user_ids);
  select coalesce(array_agg(id), '{}'::uuid[]) into v_purchase_ids
    from public.student_package_purchases where student_user_id = any(v_user_ids) or package_id = v_package_id;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_payment_ids
    from public.payment_transactions where student_user_id = any(v_user_ids) or package_id = v_package_id;

  delete from public.student_homework where id = any(v_homework_ids);
  delete from public.student_lessons where id = any(v_lesson_ids);
  delete from public.student_admin_notes where student_user_id = any(v_user_ids);
  delete from public.student_package_purchases where id = any(v_purchase_ids);
  delete from public.payment_transactions where id = any(v_payment_ids);
  delete from public.bookings where id = any(v_booking_ids);
  delete from public.availability_slots where id = any(v_slot_ids);
  delete from public.audit_logs where actor_user_id = any(v_user_ids)
    or entity_id = any(array_cat(array_cat(array_cat(v_booking_ids::text[], v_lesson_ids::text[]), v_homework_ids::text[]), v_purchase_ids::text[]))
    or metadata ->> 'student_user_id' = any(v_user_ids::text[]);
  delete from public.pricing_packages where id = v_package_id;
  delete from auth.users where id = any(v_user_ids);

  return jsonb_build_object('success', true, 'users_removed', cardinality(v_user_ids));
end;
$$;

revoke all on function public.cleanup_student_system_qa(text) from public, anon, authenticated;
grant execute on function public.cleanup_student_system_qa(text) to service_role;
