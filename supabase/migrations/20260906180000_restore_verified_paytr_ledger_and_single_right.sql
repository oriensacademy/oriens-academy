-- Restore the verified 1 TRY PayTR transaction removed after the controlled E2E
-- and reverse the later manual -1 adjustment that had no linked lesson.
-- Every condition is pinned to immutable IDs and verified audit evidence.
do $repair$
declare
  v_student_id constant uuid := '571f9dbf-c760-49cc-be5d-25ddabd75a2a';
  v_payment_id constant uuid := '1dbe8b60-916b-4756-b81a-19f4f1cb29d8';
  v_purchase_id constant uuid := 'e1de2dc2-c8a9-4fb4-9817-56253349a4d7';
  v_reference constant text := 'ORI202609051938222A8B35AA7C30';
  v_coupon_id constant uuid := '0f055a9b-9584-49be-b4a4-f7146ddfdb2c';
  v_adjustment_id uuid;
begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'payment_completed'
      and entity_id = v_reference
      and (metadata->>'transaction_id')::uuid = v_payment_id
      and (metadata->>'package_purchase_id')::uuid = v_purchase_id
      and (metadata->>'amount_kurus')::integer = 100
  ) then
    raise exception 'VERIFIED_PAYMENT_AUDIT_NOT_FOUND';
  end if;

  if not exists (select 1 from public.payment_transactions where id = v_payment_id) then
    insert into public.payment_transactions (
      id, student_user_id, package_id, public_reference, status_token_hash,
      provider, provider_transaction_id, amount, currency, status, payment_method,
      purchaser_guardian_user_id, package_owner_student_id, auth_actor_user_id,
      refunded_amount, refund_status, metadata, created_at, updated_at, paid_at,
      is_archived, is_preload, identity_selection_method
    ) values (
      v_payment_id, v_student_id, 'single', v_reference,
      repeat('0', 64), 'paytr', v_reference, 1, 'TRY', 'paid', 'card',
      v_student_id, v_student_id, v_student_id, 0, 'none',
      jsonb_build_object(
        'locale', 'tr',
        'coupon_id', v_coupon_id,
        'coupon_code', 'TESTKUPON',
        'package_ids', jsonb_build_array('single'),
        'amount_paid', 1,
        'base_amount', 3200,
        'discount_amount', 3199,
        'discount_kurus', 319900,
        'subtotal_kurus', 320000,
        'final_total_kurus', 100,
        'lesson_count', 1,
        'package_name', '1 Ders',
        'provider_collected_total', 1,
        'provider_test_mode', false,
        'restored_from_verified_audit', true,
        'restored_at', now()
      ),
      '2026-09-05T19:38:23.328665+00:00',
      '2026-09-05T19:38:54.16809+00:00',
      '2026-09-05T19:38:54.16809+00:00',
      false, true, 'account_holder_linked_learner'
    );

    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
    values (null, 'payment.verified_ledger_restored', 'payment_transaction', v_reference,
      jsonb_build_object('transaction_id', v_payment_id, 'purchase_id', v_purchase_id,
        'amount', 1, 'currency', 'TRY', 'source', 'verified_payment_completed_audit'));
  end if;

  if exists (
    select 1 from public.student_package_purchases
    where id = v_purchase_id and student_user_id = v_student_id
      and payment_transaction_id = v_payment_id and lesson_count = 0
      and lessons_used = 0 and status = 'completed'
  ) and exists (
    select 1 from public.student_package_adjustments
    where id = 'b80a1142-6ca7-46e8-88f4-99c02d9066a2'
      and package_purchase_id = v_purchase_id and lesson_delta = -1
      and linked_lesson_id is null and reason = 'Ders tamamlandı'
  ) then
    update public.student_package_purchases
    set lesson_count = 1, status = 'active', updated_at = now()
    where id = v_purchase_id;

    insert into public.student_package_adjustments (
      student_user_id, package_purchase_id, adjustment_type, lesson_delta,
      price_amount, currency, payment_status, notes, created_by, reason,
      idempotency_key
    ) values (
      v_student_id, v_purchase_id, 'manual_adjustment', 1,
      null, 'TRY', 'waived',
      'Bağlı ders kaydı olmadan yapılan -1 manuel işlem geri alındı.',
      null, 'Veri bütünlüğü düzeltmesi',
      'repair:otp_v6:restore-paid-single-right:v1'
    )
    on conflict (idempotency_key) where idempotency_key is not null do nothing
    returning id into v_adjustment_id;

    insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
    values (null, 'package.lesson_rights_integrity_repaired', 'student_package_purchase', v_purchase_id::text,
      jsonb_build_object('student_user_id', v_student_id, 'old_remaining', 0,
        'new_remaining', 1, 'old_lesson_count', 0, 'new_lesson_count', 1,
        'reversed_adjustment_id', 'b80a1142-6ca7-46e8-88f4-99c02d9066a2',
        'compensating_adjustment_id', v_adjustment_id,
        'reason', 'manual_decrement_without_linked_lesson'));
  end if;
end;
$repair$;
