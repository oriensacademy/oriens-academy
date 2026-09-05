-- Migration: 20260905130000_account_deletion_no_crm_residue.sql
--
-- Business rule (final): deleting an account must leave NO CRM identity behind.
-- No 'Deleted User' row, no 'deleted+<uuid>@deleted.oriens-academy.invalid'
-- placeholder, no anonymised profile, nothing that can surface again in
-- Admin -> Kullanicilar / student lists / search.
--
-- The previous implementation (20260903150000_account_deletion_reminders_phone_cleanup.sql)
-- had two paths: 'deleted' (no purchase history) and 'anonymized' (any purchase
-- history) -- and the 'anonymized' path is precisely what produced the
-- 'Deleted User' / deleted+<uuid>@ placeholders in guardian_accounts and
-- student_profiles. Financial history was the reason for that path; this
-- migration keeps the financial ledger and drops the CRM identity instead:
--
--   * payment_transactions / payment_refunds rows are PRESERVED.
--   * student_package_purchases rows are PRESERVED (paid-entitlement ledger).
--   * Their identity foreign keys (student_user_id, auth_actor_user_id,
--     purchaser_guardian_user_id, package_owner_student_id) are set to NULL, so
--     the ledger no longer resolves to a CRM person and cannot rebuild one.
--   * Contactable PII on the retained ledger rows (payer_phone) is scrubbed;
--     payer_name / payer_email remain as the invoice-level accounting record.
--
-- Every FK that would otherwise block this is already nullable, so no FK
-- definition is changed here -- the RPC nulls the columns explicitly before
-- deleting the identity rows.
--
-- Audit rule: the deleted user's own operational audit history is removed and
-- replaced by exactly ONE PII-free 'account_deleted' event.

-- ==============================================================================
-- 1. SELF-SERVICE ACCOUNT DELETION (no placeholder, no CRM residue)
-- ==============================================================================

create or replace function public.delete_or_anonymize_own_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_guardian public.guardian_accounts%rowtype;
  v_learner_ids uuid[];
  v_subject_ids uuid[];
  v_subject_texts text[];
  v_emails text[];
  v_active_entitlement boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into v_guardian from public.guardian_accounts where user_id = v_uid;
  if v_guardian.user_id is null then
    return jsonb_build_object('success', false, 'error_code', 'GUARDIAN_ACCOUNT_NOT_FOUND');
  end if;

  -- Every learner ever linked to this account holder (active link or not): an
  -- inactive link must not leave an orphan student_profiles row behind.
  select coalesce(array_agg(distinct student_id), array[]::uuid[]) into v_learner_ids
  from public.guardian_students
  where guardian_user_id = v_uid;

  select coalesce(array_agg(distinct x), array[]::uuid[]) into v_subject_ids
  from unnest(v_learner_ids || array[v_uid]) as t(x);

  select coalesce(array_agg(x::text), array[]::text[]) into v_subject_texts
  from unnest(v_subject_ids) as t(x);

  select coalesce(array_agg(distinct e), array[]::text[]) into v_emails from (
    select lower(btrim(v_guardian.email)) as e
    union
    select lower(btrim(sp.email)) from public.student_profiles sp
      where sp.id = any(v_learner_ids) and sp.email is not null
  ) s
  where s.e is not null and s.e <> '';

  -- Safety gate: never silently destroy active paid rights, upcoming lessons,
  -- or in-flight money movement. No refund logic is invented here.
  select exists(
    select 1 from public.student_package_purchases
    where student_user_id = any(v_learner_ids) and status = 'active' and lesson_count > lessons_used
  ) or exists(
    select 1 from public.student_lessons
    where student_user_id = any(v_learner_ids) and status = 'scheduled' and lesson_date > now()
  ) or exists(
    select 1 from public.bookings
    where student_user_id = any(v_learner_ids) and status in ('pending','confirmed')
  ) or exists(
    select 1 from public.payment_transactions
    where purchaser_guardian_user_id = v_uid and status = 'pending'
  ) or exists(
    select 1 from public.payment_refunds pr
    join public.payment_transactions pt on pt.id = pr.payment_transaction_id
    where pt.purchaser_guardian_user_id = v_uid
      and pr.status not in ('refund_succeeded','refund_failed')
  ) into v_active_entitlement;

  if v_active_entitlement then
    return jsonb_build_object('success', false, 'error_code', 'ACTIVE_ENTITLEMENT_EXISTS');
  end if;

  -- ---------------------------------------------------------------------------
  -- 1a. Detach the retained financial ledger from every CRM identity.
  --     These rows survive; they simply stop pointing at a person.
  -- ---------------------------------------------------------------------------
  update public.student_package_purchases
  set student_user_id = null
  where student_user_id = any(v_learner_ids);

  update public.payment_transactions
  set student_user_id = null,
      auth_actor_user_id = null,
      purchaser_guardian_user_id = null,
      package_owner_student_id = null,
      payer_phone = null,
      updated_at = now()
  where purchaser_guardian_user_id = v_uid
     or auth_actor_user_id = v_uid
     or student_user_id = any(v_subject_ids)
     or package_owner_student_id = any(v_learner_ids);

  -- ---------------------------------------------------------------------------
  -- 1b. Remove every row that can rebuild a CRM person for this account.
  --     Order is FK-safe (leaves first).
  -- ---------------------------------------------------------------------------
  delete from public.homework_student_answers
  where student_homework_id in (
    select id from public.student_homework where student_user_id = any(v_learner_ids)
  );
  delete from public.student_homework where student_user_id = any(v_learner_ids);
  delete from public.student_exam_attempts where student_user_id = any(v_learner_ids);
  delete from public.student_admin_notes where student_user_id = any(v_learner_ids);
  delete from public.student_package_adjustments where student_user_id = any(v_learner_ids);
  delete from public.student_lessons where student_user_id = any(v_learner_ids);
  delete from public.discount_coupon_redemptions where student_user_id = any(v_subject_ids);

  update public.anonymous_exam_result_claims
  set claimed_by_user_id = null
  where claimed_by_user_id = v_uid;
  delete from public.anonymous_exam_result_claims
  where lower(btrim(normalized_email)) = any(v_emails);

  -- Bookings and contact requests both feed the admin CRM list directly
  -- (listAdminStudents merges student_profiles + contact_requests + bookings),
  -- so an email match must go too or the person reappears as "contact_only".
  delete from public.bookings
  where student_user_id = any(v_learner_ids) or lower(btrim(email)) = any(v_emails);

  delete from public.contact_replies
  where contact_request_id in (
    select id from public.contact_requests where lower(btrim(email)) = any(v_emails)
  );
  delete from public.contact_requests where lower(btrim(email)) = any(v_emails);

  delete from public.notification_deliveries where lower(btrim(recipient)) = any(v_emails);

  delete from public.email_change_challenges where user_id = v_uid;
  delete from public.purchase_email_verification_challenges where user_id = v_uid;
  delete from public.identity_migration_review
  where entity_type in ('student_profile','guardian_account')
    and entity_id = any(v_subject_texts);

  delete from public.guardian_students where guardian_user_id = v_uid;
  delete from public.guardian_accounts where user_id = v_uid;

  -- student_destination_preferences / student_exam_preferences cascade from here.
  delete from public.student_profiles sp
  where sp.id = any(v_learner_ids)
    and not exists (
      select 1 from public.guardian_students gs where gs.student_id = sp.id
    );

  -- ---------------------------------------------------------------------------
  -- 1c. Audit history: wipe the account's own operational trail, leave exactly
  --     one PII-free terminal event. No email/name/phone/address/snapshot.
  -- ---------------------------------------------------------------------------
  delete from public.audit_logs
  where actor_user_id = v_uid
     or entity_id = any(v_subject_texts)
     or (metadata ->> 'student_id') = any(v_subject_texts)
     or (metadata ->> 'student_user_id') = any(v_subject_texts)
     or (metadata ->> 'account_holder_id') = any(v_subject_texts);

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (null, 'account_deleted', 'account', v_uid::text, '{}'::jsonb);

  -- 'mode' is kept in the response for wire compatibility with the currently
  -- deployed delete-student-account Edge Function, which deletes the GoTrue
  -- user when mode = 'deleted' -- now always the correct action.
  return jsonb_build_object('success', true, 'mode', 'deleted');
end;
$fn$;

revoke all on function public.delete_or_anonymize_own_account() from public, anon;
grant execute on function public.delete_or_anonymize_own_account() to authenticated;

-- ==============================================================================
-- 2. ADMIN PURGE OF PRE-EXISTING PLACEHOLDER / ORPHAN CRM RESIDUE
-- ==============================================================================
-- Idempotent, bounded, admin-only, dry-run by default. Removes exactly the rows
-- this rule forbids (placeholder profiles produced by the old 'anonymized'
-- path). Financial rows are detached, never deleted.

create or replace function public.admin_purge_deleted_account_residue(p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_profile_ids uuid[];
  v_guardian_ids uuid[];
  v_profile_texts text[];
  v_removed_profiles integer := 0;
  v_removed_guardians integer := 0;
  v_removed_audit integer := 0;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;

  select coalesce(array_agg(id), array[]::uuid[]) into v_profile_ids
  from public.student_profiles
  where full_name in ('Deleted User', 'Silinmis Kullanici', E'Silinmiş Kullanıcı')
     or email like 'deleted+%@deleted.oriens-academy.invalid';

  select coalesce(array_agg(user_id), array[]::uuid[]) into v_guardian_ids
  from public.guardian_accounts
  where full_name in ('Deleted User', 'Silinmis Kullanici', E'Silinmiş Kullanıcı')
     or email like 'deleted+%@deleted.oriens-academy.invalid';

  if p_dry_run then
    return jsonb_build_object(
      'success', true,
      'dry_run', true,
      'placeholder_student_profiles', coalesce(array_length(v_profile_ids, 1), 0),
      'placeholder_guardian_accounts', coalesce(array_length(v_guardian_ids, 1), 0)
    );
  end if;

  select coalesce(array_agg(x::text), array[]::text[]) into v_profile_texts
  from unnest(v_profile_ids) as t(x);

  update public.student_package_purchases set student_user_id = null
  where student_user_id = any(v_profile_ids);

  update public.payment_transactions
  set student_user_id = null, auth_actor_user_id = null,
      purchaser_guardian_user_id = null, package_owner_student_id = null,
      payer_phone = null, updated_at = now()
  where package_owner_student_id = any(v_profile_ids)
     or student_user_id = any(v_profile_ids)
     or purchaser_guardian_user_id = any(v_guardian_ids)
     or auth_actor_user_id = any(v_guardian_ids);

  delete from public.homework_student_answers
  where student_homework_id in (select id from public.student_homework where student_user_id = any(v_profile_ids));
  delete from public.student_homework where student_user_id = any(v_profile_ids);
  delete from public.student_exam_attempts where student_user_id = any(v_profile_ids);
  delete from public.student_admin_notes where student_user_id = any(v_profile_ids);
  delete from public.student_package_adjustments where student_user_id = any(v_profile_ids);
  delete from public.student_lessons where student_user_id = any(v_profile_ids);
  delete from public.discount_coupon_redemptions where student_user_id = any(v_profile_ids);
  delete from public.bookings where student_user_id = any(v_profile_ids);
  delete from public.guardian_students
  where student_id = any(v_profile_ids) or guardian_user_id = any(v_guardian_ids);

  delete from public.audit_logs
  where entity_id = any(v_profile_texts)
     or (metadata ->> 'student_id') = any(v_profile_texts);
  get diagnostics v_removed_audit = row_count;

  delete from public.student_profiles where id = any(v_profile_ids);
  get diagnostics v_removed_profiles = row_count;

  delete from public.guardian_accounts where user_id = any(v_guardian_ids);
  get diagnostics v_removed_guardians = row_count;

  return jsonb_build_object(
    'success', true,
    'dry_run', false,
    'removed_student_profiles', v_removed_profiles,
    'removed_guardian_accounts', v_removed_guardians,
    'removed_audit_logs', v_removed_audit
  );
end;
$fn$;

revoke all on function public.admin_purge_deleted_account_residue(boolean) from public, anon;
grant execute on function public.admin_purge_deleted_account_residue(boolean) to authenticated, service_role;
