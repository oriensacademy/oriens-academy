-- Ödeme onay e-postasında paket adı: "single" yerine "1 Ders".
--
-- `queue_payment_success_email()` payload'a yalnızca `package_id` koyuyordu.
-- E-posta şablonu `p.package_name || p.package_id` yazdığı için müşteriye
-- teknik kimlik ("single", "package10") gidiyordu.
--
-- Aynı dosyadaki diğer iki bildirim (`package.activated` ve `payment.refunded`)
-- adı zaten `pricing_packages` üzerinden çözüyor; bu fonksiyon atlanmış.
-- Burada aynı deseni uyguluyoruz.
--
-- Çözüm sırası:
--   1) Sepette birden fazla paket varsa checkout'un metadata'daki birleşik adı
--      (tek bir satırdan türetilen ad yanıltıcı olur),
--   2) `pricing_packages` üzerinden dile duyarlı ad (asıl kaynak),
--   3) checkout metadata'sındaki ad,
--   4) son çare olarak `package_id`.
--
-- Fonksiyon `search_path = ''` ile tanımlı, bu yüzden her şey tam nitelenmiştir.

create or replace function public.queue_payment_success_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_locale text;
  v_catalog_name text;
  v_metadata_name text;
  v_package_count integer;
  v_package_name text;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and new.payment_method = 'card' then
    v_locale := coalesce(new.metadata ->> 'locale', 'tr');
    v_metadata_name := nullif(trim(coalesce(new.metadata ->> 'package_name', '')), '');

    select jsonb_array_length(new.metadata -> 'package_ids')
      into v_package_count
    where jsonb_typeof(new.metadata -> 'package_ids') = 'array';

    select nullif(trim(coalesce(
             case when v_locale = 'en' then p.name_en else p.name_tr end,
             case when v_locale = 'en' then p.name_tr else p.name_en end,
             ''
           )), '')
      into v_catalog_name
    from public.pricing_packages p
    where p.id = new.package_id;

    if coalesce(v_package_count, 1) > 1 then
      v_package_name := coalesce(v_metadata_name, v_catalog_name, new.package_id);
    else
      v_package_name := coalesce(v_catalog_name, v_metadata_name, new.package_id);
    end if;

    v_payload := jsonb_build_object(
      'transaction_id', new.id,
      'reference', new.public_reference,
      'payer_name', new.payer_name,
      'payer_email', new.payer_email,
      'package_id', new.package_id,
      'package_name', v_package_name,
      'student_id', new.package_owner_student_id,
      'amount', new.amount,
      'currency', new.currency,
      'paid_at', new.paid_at,
      'locale', v_locale
    );

    perform public.enqueue_email_notification('payment.success', 'payment_transaction', new.id::text,
      new.payer_email, 'payment_success_guardian', v_payload, 'payment.success:' || new.id || ':guardian');
    perform public.enqueue_email_notification('payment.success.admin', 'payment_transaction', new.id::text,
      'admin@oriens-academy.com', 'payment_success_admin', v_payload, 'payment.success:' || new.id || ':admin');
  end if;
  return new;
end;
$$;
