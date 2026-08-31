-- Narrow production cleanup requested on 2026-08-31.
-- Four requested financial rows linked to real/admin identities are intentionally preserved.
do $$
declare
  v_user_id constant uuid := '5af239bb-bcde-4199-9100-37591e6a99ef';
  v_booking_id constant uuid := '8b3fc64b-f737-4fa4-a42a-a8b02baa349c';
  v_slot_id constant uuid := '97d32c29-1f89-4537-a0b6-802ec412ec41';
  v_deleted integer;
begin
  if (select count(*) from auth.users where id = v_user_id and lower(email) = 'paymentv6@gmail.com' and coalesce(phone, raw_user_meta_data ->> 'phone') = '+905324898394') <> 1 then
    raise exception 'SAFETY_ABORT: paymentv6 auth identity is not an exact unique email+phone match';
  end if;
  if (select count(*) from public.student_profiles where id = v_user_id and lower(email) = 'paymentv6@gmail.com' and phone = '+905324898394') <> 1 then
    raise exception 'SAFETY_ABORT: paymentv6 profile is not an exact unique email+phone match';
  end if;
  if (select count(*) from public.support_threads where id::text like 'a5c7b9ed%') <> 1
     or (select count(*) from public.support_threads where id::text like '912575af%') <> 1 then
    raise exception 'SAFETY_ABORT: requested support prefixes are not uniquely resolved';
  end if;
  if exists (select 1 from public.student_lessons where student_user_id = v_user_id)
     or exists (select 1 from public.student_homework where student_user_id = v_user_id)
     or exists (select 1 from public.student_admin_notes where student_user_id = v_user_id)
     or exists (select 1 from public.student_exam_attempts where student_user_id = v_user_id) then
    raise exception 'SAFETY_ABORT: unexpected learning records appeared for paymentv6';
  end if;
  if (select count(*) from public.payment_transactions where id in ('27e90380-6f6f-4a0f-ac14-1cb30cc5507b', 'c06838a9-6f23-450c-bf0a-35e0c2c81e24') and student_user_id = v_user_id and lower(payer_email) = 'paymentv6@gmail.com') <> 2 then
    raise exception 'SAFETY_ABORT: paymentv6 payment set changed';
  end if;
  if exists (select 1 from public.discount_coupon_redemptions where payment_transaction_id in ('27e90380-6f6f-4a0f-ac14-1cb30cc5507b', 'c06838a9-6f23-450c-bf0a-35e0c2c81e24')) then
    raise exception 'SAFETY_ABORT: target payments gained coupon redemptions';
  end if;

  delete from public.support_threads
  where id in ('a5c7b9ed-88d4-42d7-9781-b036fd45c715', '912575af-aef1-46e3-afb2-8be25610842e')
    and subject = 'test';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 2 then raise exception 'SAFETY_ABORT: expected 2 support threads, deleted %', v_deleted; end if;

  delete from public.bookings
  where id = v_booking_id and student_user_id = v_user_id
    and lower(email) = 'paymentv6@gmail.com' and phone = '+905324898394';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception 'SAFETY_ABORT: expected 1 appointment, deleted %', v_deleted; end if;

  update public.availability_slots set status = 'available', updated_at = now()
  where id = v_slot_id and status = 'booked'
    and not exists (select 1 from public.bookings where slot_id = v_slot_id and status not in ('cancelled', 'no_show'));

  delete from public.student_package_purchases
  where id in ('823ab0c8-a383-407f-b8da-fcac9c766adf', 'e0ee43de-faf2-4acb-8e48-b72175501282')
    and student_user_id = v_user_id
    and payment_transaction_id in ('27e90380-6f6f-4a0f-ac14-1cb30cc5507b', 'c06838a9-6f23-450c-bf0a-35e0c2c81e24');
  get diagnostics v_deleted = row_count;
  if v_deleted <> 2 then raise exception 'SAFETY_ABORT: expected 2 package purchases, deleted %', v_deleted; end if;

  delete from public.payment_transactions
  where id in ('27e90380-6f6f-4a0f-ac14-1cb30cc5507b', 'c06838a9-6f23-450c-bf0a-35e0c2c81e24')
    and student_user_id = v_user_id and lower(payer_email) = 'paymentv6@gmail.com'
    and public_reference in ('ORI2026082620235513F51B26C42C', 'ORI20260826213026E6950017ABDC');
  get diagnostics v_deleted = row_count;
  if v_deleted <> 2 then raise exception 'SAFETY_ABORT: expected 2 payments, deleted %', v_deleted; end if;

  delete from auth.users
  where id = v_user_id and lower(email) = 'paymentv6@gmail.com'
    and coalesce(phone, raw_user_meta_data ->> 'phone') = '+905324898394';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception 'SAFETY_ABORT: expected 1 auth user, deleted %', v_deleted; end if;

  if exists (select 1 from public.student_profiles where id = v_user_id)
     or exists (select 1 from public.bookings where student_user_id = v_user_id)
     or exists (select 1 from public.payment_transactions where student_user_id = v_user_id or lower(payer_email) = 'paymentv6@gmail.com') then
    raise exception 'SAFETY_ABORT: paymentv6 post-delete verification failed';
  end if;
end $$;
