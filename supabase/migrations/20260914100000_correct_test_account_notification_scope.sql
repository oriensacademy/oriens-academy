-- Keep payment/admin delivery evidence outside a member-facing operational reset.
-- The target account has nine recipient-facing deliveries; two additional
-- payment_success_admin rows share payment entity IDs and must remain immutable.
create or replace function public.admin_reset_test_account_operational_state(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student_id uuid;
  v_email text;
  v_guardian_count integer;
  v_student_count integer;
  v_link_count integer;
  v_purchase_count integer;
  v_lesson_count integer;
  v_adjustment_count integer;
  v_payment_count integer;
  v_notification_count integer;
  v_contact_count integer;
  v_booking_count integer;
  v_homework_count integer;
  v_note_count integer;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_user_id is null then raise exception 'MEMBER_ID_REQUIRED'; end if;

  select count(*), min(lower(btrim(email))) into v_guardian_count, v_email
  from public.guardian_accounts where user_id = p_user_id;
  select count(*) into v_student_count
  from public.student_profiles where id = p_user_id or legacy_auth_user_id = p_user_id;
  select id into v_student_id from public.student_profiles
  where id = p_user_id or legacy_auth_user_id = p_user_id limit 1;
  if v_guardian_count <> 1 or v_student_count <> 1 then raise exception 'RESET_IDENTITY_ASSERTION_FAILED'; end if;

  select count(*) into v_link_count from public.guardian_students where guardian_user_id = p_user_id and student_id = v_student_id;
  select count(*) into v_purchase_count from public.student_package_purchases where student_user_id = v_student_id;
  select count(*) into v_lesson_count from public.student_lessons where student_user_id = v_student_id;
  select count(*) into v_adjustment_count from public.student_package_adjustments where student_user_id = v_student_id;
  select count(*) into v_payment_count from public.payment_transactions
  where student_user_id = v_student_id or package_owner_student_id = v_student_id or purchaser_guardian_user_id = p_user_id;
  select count(*) into v_notification_count from public.notification_deliveries
  where lower(btrim(recipient)) = v_email;
  select count(*) into v_contact_count from public.contact_requests where lower(btrim(email)) = v_email;
  select count(*) into v_booking_count from public.bookings where student_user_id = v_student_id;
  select count(*) into v_homework_count from public.student_homework where student_user_id = v_student_id;
  select count(*) into v_note_count from public.student_admin_notes where student_user_id = v_student_id;

  if v_link_count <> 1 or v_purchase_count <> 5 or v_lesson_count <> 2 or v_adjustment_count <> 5
     or v_payment_count <> 2 or v_notification_count <> 9 or v_contact_count <> 0
     or v_booking_count <> 0 or v_homework_count <> 0 or v_note_count <> 0 then
    raise exception 'RESET_PREFLIGHT_ASSERTION_FAILED';
  end if;

  update public.student_package_purchases set is_archived = true, archived_at = coalesce(archived_at, now())
  where student_user_id = v_student_id and not is_archived;
  update public.student_lessons set is_archived = true, archived_at = coalesce(archived_at, now()), updated_at = now()
  where student_user_id = v_student_id and not is_archived;
  update public.student_package_adjustments set is_archived = true, archived_at = coalesce(archived_at, now())
  where student_user_id = v_student_id and not is_archived;
  update public.payment_transactions set is_archived = true, archived_at = coalesce(archived_at, now()), archive_reason = 'test_account_operational_reset'
  where (student_user_id = v_student_id or package_owner_student_id = v_student_id or purchaser_guardian_user_id = p_user_id) and not is_archived;
  update public.notification_deliveries set is_archived = true, archived_at = coalesce(archived_at, now())
  where not is_archived and lower(btrim(recipient)) = v_email;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'test_account_operational_reset', 'member', p_user_id::text,
    jsonb_build_object('student_id', v_student_id, 'package_rows', v_purchase_count, 'lesson_rows', v_lesson_count,
      'adjustment_rows', v_adjustment_count, 'payment_rows', v_payment_count, 'notification_rows', v_notification_count));

  return jsonb_build_object('success', true, 'student_id', v_student_id, 'package_rows', v_purchase_count,
    'lesson_rows', v_lesson_count, 'adjustment_rows', v_adjustment_count, 'payment_rows', v_payment_count,
    'notification_rows', v_notification_count);
end;
$$;

revoke all on function public.admin_reset_test_account_operational_state(uuid) from public, anon;
grant execute on function public.admin_reset_test_account_operational_state(uuid) to authenticated;
