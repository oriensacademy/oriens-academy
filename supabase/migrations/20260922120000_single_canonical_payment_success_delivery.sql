-- One successful card payment creates exactly one customer-facing outbox row.
-- The existing mail service BCCs that same localized delivery to admin@, so a
-- second independent English admin delivery is both redundant and noisy.
-- Existing transactions and notification history remain untouched.

create or replace function public.queue_payment_success_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_locale text;
  v_customer_email text;
  v_lesson_count integer;
  v_reference text;
begin
  if new.status = 'paid'
     and old.status is distinct from 'paid'
     and new.payment_method = 'card' then
    select
      lower(btrim(ga.email)),
      case when ga.preferred_language in ('tr', 'en') then ga.preferred_language else null end
    into v_customer_email, v_locale
    from public.guardian_accounts ga
    where ga.user_id = new.purchaser_guardian_user_id
      and ga.active
      and ga.email_verified_at is not null
    limit 1;

    v_customer_email := coalesce(nullif(v_customer_email, ''), lower(btrim(new.payer_email)));
    v_locale := coalesce(v_locale, case when lower(new.metadata ->> 'locale') = 'en' then 'en' else 'tr' end);
    v_reference := coalesce(nullif(btrim(new.public_reference), ''), new.id::text);
    v_lesson_count := coalesce(
      nullif(new.metadata ->> 'lesson_count', '')::integer,
      (select p.lesson_count from public.pricing_packages p where p.id = new.package_id)
    );

    v_payload := jsonb_build_object(
      'transaction_id', new.id,
      'reference', v_reference,
      'payer_name', new.payer_name,
      'payer_email', v_customer_email,
      'package_id', new.package_id,
      'lesson_count', v_lesson_count,
      'package_name', case when v_locale = 'en' then v_lesson_count || ' Lessons' else v_lesson_count || ' Ders' end,
      'student_id', new.package_owner_student_id,
      'amount', new.amount,
      'currency', new.currency,
      'paid_at', new.paid_at,
      'locale', v_locale
    );

    perform public.enqueue_email_notification(
      'payment.success',
      'payment_transaction',
      new.id::text,
      v_customer_email,
      'payment_success_guardian',
      v_payload,
      'payment.success:' || v_reference || ':customer'
    );
  end if;

  return new;
end
$$;
