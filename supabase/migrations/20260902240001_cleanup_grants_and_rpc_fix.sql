-- Atomic student and payment data purge RPC with explicit WHERE clauses

create or replace function public.admin_cleanup_all_students_and_payments()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notes int;
  v_adjustments int;
  v_purchases int;
  v_payments int;
  v_refunds int;
  v_students int;
  v_guardians int;
begin
  if not public.is_admin()
     and current_user not in ('postgres', 'service_role')
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception 'ADMIN_OR_SERVICE_REQUIRED' using errcode = '42501';
  end if;

  delete from public.student_admin_notes where true;
  get diagnostics v_notes = row_count;

  delete from public.student_package_adjustments where true;
  get diagnostics v_adjustments = row_count;

  delete from public.student_package_purchases where true;
  get diagnostics v_purchases = row_count;

  delete from public.payment_refunds where true;
  get diagnostics v_refunds = row_count;

  delete from public.payment_transactions where true;
  get diagnostics v_payments = row_count;

  delete from public.guardian_students where true;
  delete from public.student_exam_attempts where true;
  delete from public.student_homework where true;
  delete from public.student_lessons where true;
  delete from public.bookings where true;

  delete from public.student_profiles where true;
  get diagnostics v_students = row_count;

  delete from public.guardian_accounts where true;
  get diagnostics v_guardians = row_count;

  return jsonb_build_object(
    'success', true,
    'deleted_notes', v_notes,
    'deleted_adjustments', v_adjustments,
    'deleted_purchases', v_purchases,
    'deleted_refunds', v_refunds,
    'deleted_payments', v_payments,
    'deleted_students', v_students,
    'deleted_guardians', v_guardians
  );
end;
$$;

revoke all on function public.admin_cleanup_all_students_and_payments() from public, anon;
grant execute on function public.admin_cleanup_all_students_and_payments() to service_role, authenticated;
