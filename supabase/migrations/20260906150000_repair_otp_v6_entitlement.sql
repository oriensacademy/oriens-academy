-- Repair one proven ledger inconsistency for otp_v6.
--
-- The package was granted with 10 rights, then a manual -1 adjustment with
-- reason "Ders tamamlandı" reduced lesson_count to 9. No completed lesson was
-- created and lessons_used remained 0, so this was not a valid consumption.
-- Preserve the original row and append an auditable compensating +1 entry.

do $repair$
declare
  v_student_id constant uuid := '571f9dbf-c760-49cc-be5d-25ddabd75a2a';
  v_purchase_id constant uuid := 'f009df9d-af06-4e52-a916-40add7b02d7f';
  v_adjustment_id uuid;
begin
  if exists (
    select 1
    from public.student_package_purchases p
    where p.id = v_purchase_id
      and p.student_user_id = v_student_id
      and p.lesson_count = 9
      and p.lessons_used = 0
      and p.status = 'active'
  ) and exists (
    select 1
    from public.student_package_adjustments a
    where a.id = '2c1de6bd-61bc-4810-8b5d-4e2b8f14ac7f'::uuid
      and a.package_purchase_id = v_purchase_id
      and a.adjustment_type = 'manual_adjustment'
      and a.lesson_delta = -1
      and a.reason = 'Ders tamamlandı'
      and a.linked_lesson_id is null
  ) and not exists (
    select 1
    from public.student_package_adjustments a
    where a.idempotency_key = 'repair:otp_v6:restore-invalid-completion-deduction:v1'
  ) then
    update public.student_package_purchases
    set lesson_count = 10,
        updated_at = now()
    where id = v_purchase_id;

    insert into public.student_package_adjustments (
      student_user_id, package_purchase_id, adjustment_type, lesson_delta,
      price_amount, currency, payment_status, reason, notes, created_by,
      idempotency_key
    ) values (
      v_student_id, v_purchase_id, 'manual_adjustment', 1,
      null, 'TRY', 'waived', 'Veri bütünlüğü düzeltmesi',
      'Tamamlanmış ders kaydı ve lessons_used hareketi olmadan uygulanan hatalı -1 işlem geri alındı.',
      null, 'repair:otp_v6:restore-invalid-completion-deduction:v1'
    ) returning id into v_adjustment_id;

    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      null,
      'package.lesson_rights_integrity_repaired',
      'student_package_purchase',
      v_purchase_id::text,
      jsonb_build_object(
        'student_user_id', v_student_id,
        'old_lesson_count', 9,
        'new_lesson_count', 10,
        'lessons_used', 0,
        'old_remaining', 9,
        'new_remaining', 10,
        'reversed_adjustment_id', '2c1de6bd-61bc-4810-8b5d-4e2b8f14ac7f',
        'compensating_adjustment_id', v_adjustment_id,
        'reason', 'invalid_completion_deduction_without_lesson_record'
      )
    );
  end if;
end;
$repair$;
