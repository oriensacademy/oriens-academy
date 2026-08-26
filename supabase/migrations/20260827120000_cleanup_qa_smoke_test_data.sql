-- Migration: 20260827120000_cleanup_qa_smoke_test_data.sql
-- Description: Controlled, safe cleanup RPC for disposable QA Live Smoke test records without touching genuine student or financial records.

grant delete on public.student_package_purchases to service_role;
grant delete on public.payment_transactions to service_role;
grant delete on public.student_profiles to service_role;

create or replace function public.cleanup_qa_smoke_records()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qa_uid uuid := 'd31861a1-d22e-43e1-b643-6f9b5fa9860a'::uuid;
  v_qa_email text := 'qa-smoke-live@oriens-academy.com';
  v_deleted_purchases integer := 0;
  v_deleted_payments integer := 0;
  v_deleted_profiles integer := 0;
begin
  -- 1. Delete QA student package purchases
  delete from public.student_package_purchases
  where student_user_id = v_qa_uid;
  get diagnostics v_deleted_purchases = row_count;

  -- 2. Delete QA payment transactions
  delete from public.payment_transactions
  where student_user_id = v_qa_uid
     or payer_email = v_qa_email
     or public_reference like 'ORIQA%'
     or public_reference like 'ORILEGAL%';
  get diagnostics v_deleted_payments = row_count;

  -- 3. Delete QA student profile
  delete from public.student_profiles
  where id = v_qa_uid or lower(email) = v_qa_email;
  get diagnostics v_deleted_profiles = row_count;

  -- 4. Delete QA auth user
  delete from auth.users
  where id = v_qa_uid or lower(email) = v_qa_email;

  return jsonb_build_object(
    'success', true,
    'deleted_purchases', v_deleted_purchases,
    'deleted_payments', v_deleted_payments,
    'deleted_profiles', v_deleted_profiles
  );
end;
$$;

revoke all on function public.cleanup_qa_smoke_records() from public, anon, authenticated;
grant execute on function public.cleanup_qa_smoke_records() to service_role;
