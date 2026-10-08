-- Sepet seviyesinde yetkili kupon kuralı.
--
-- validate_checkout_coupon tek paket için çalışır; çoklu paket sepetinde
-- istemci ve sunucu kuponun hangi pakete uygulanacağını ayrı ayrı tahmin
-- ediyordu (ekrandaki toplam ≠ PayTR tutarı). Bu fonksiyon siparişteki TÜM
-- paketler için tek seferde karar verir ve yalnız kuralı döndürür:
-- uygun paketler, indirim türü / değeri, en yüksek indirim, en düşük sepet
-- tutarı. Tutarı tek ortak hesap (supabase/functions/_shared/payments/pricing.ts)
-- hesaplar; sepet, ödeme ekranı, taksit tablosu ve paytr-create-token aynı
-- kural + aynı hesapla aynı kuruş tutarını üretir.
--
-- Salt okur: kupon kullanım sayısı, kullanım kaydı veya ödeme kaydı yazılmaz.
-- validate_checkout_coupon değişmeden kalır.

create or replace function public.quote_checkout_coupon(
  p_code text,
  p_package_ids text[],
  p_student_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_clean_code text;
  v_coupon public.discount_coupons%rowtype;
  v_package_ids text[];
  v_found_count integer;
  v_subtotal numeric;
  v_currency text;
  v_targeted boolean;
  v_eligible text[];
  v_student_uses integer;
  v_has_previous_purchase boolean;
  v_target_user_id uuid;
begin
  v_target_user_id := coalesce(p_student_user_id, auth.uid());
  v_clean_code := upper(trim(coalesce(p_code, '')));

  if v_clean_code = '' then
    return jsonb_build_object('valid', false, 'error_code', 'EMPTY_CODE', 'message', 'Lütfen bir kupon kodu girin.');
  end if;

  select coalesce(array_agg(distinct nullif(trim(x), '')) filter (where nullif(trim(x), '') is not null), '{}')
  into v_package_ids
  from unnest(coalesce(p_package_ids, '{}'::text[])) as x;

  if cardinality(v_package_ids) = 0 or cardinality(v_package_ids) > 20 then
    return jsonb_build_object('valid', false, 'error_code', 'EMPTY_CART', 'message', 'Sepetinizde paket bulunmuyor.');
  end if;

  -- 1. Paketler (tümü aktif olmalı); sepet ara toplamı paket fiyatlarından
  select count(*), coalesce(sum(coalesce(current_total, price_amount, 0)), 0), min(coalesce(currency, 'TRY'))
  into v_found_count, v_subtotal, v_currency
  from public.pricing_packages
  where id = any(v_package_ids) and active;

  if v_found_count <> cardinality(v_package_ids) then
    return jsonb_build_object('valid', false, 'error_code', 'INVALID_PACKAGE', 'message', 'Geçersiz eğitim paketi.');
  end if;

  -- 2. Kupon
  select * into v_coupon from public.discount_coupons where upper(code) = v_clean_code;
  if not found then
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_NOT_FOUND', 'message', 'Kupon kodu geçersiz.');
  end if;

  -- 3. Aktif / arşivlenmemiş
  if not v_coupon.active or v_coupon.archived_at is not null then
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_INACTIVE', 'message', 'Bu kupon şu anda aktif değil.');
  end if;

  -- 4. Geçerlilik tarihleri
  if v_coupon.valid_from is not null and now() < v_coupon.valid_from then
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_NOT_STARTED', 'message', 'Bu kuponun geçerlilik tarihi henüz başlamadı.');
  end if;
  if v_coupon.valid_until is not null and now() > v_coupon.valid_until then
    return jsonb_build_object('valid', false, 'error_code', 'COUPON_EXPIRED', 'message', 'Bu kuponun kullanım süresi dolmuş.');
  end if;

  -- 5. Toplam kullanım limiti
  if v_coupon.max_total_uses is not null and v_coupon.used_count >= v_coupon.max_total_uses then
    return jsonb_build_object('valid', false, 'error_code', 'USAGE_LIMIT_REACHED', 'message', 'Bu kuponun kullanım limiti dolmuş.');
  end if;

  -- 6. Uygun paketler: kupon pakete bağlıysa kesişim, değilse sepetin tamamı
  select exists (select 1 from public.discount_coupon_packages where coupon_id = v_coupon.id) into v_targeted;
  if v_targeted then
    select coalesce(array_agg(cp.package_id order by cp.package_id), '{}')
    into v_eligible
    from public.discount_coupon_packages cp
    where cp.coupon_id = v_coupon.id and cp.package_id = any(v_package_ids);
  else
    select coalesce(array_agg(x order by x), '{}') into v_eligible from unnest(v_package_ids) as x;
  end if;

  if cardinality(v_eligible) = 0 then
    return jsonb_build_object('valid', false, 'error_code', 'PACKAGE_NOT_ELIGIBLE', 'message', 'Bu kupon bu paket için kullanılamaz.');
  end if;

  -- 7. En düşük sepet tutarı (sipariş ara toplamı)
  if v_coupon.minimum_order_amount is not null and v_subtotal < v_coupon.minimum_order_amount then
    return jsonb_build_object('valid', false, 'error_code', 'MINIMUM_AMOUNT_NOT_MET', 'message', 'Bu kupon için minimum sepet tutarı sağlanamadı.');
  end if;

  -- 8. Öğrenci kısıtları (yalnız ödenmiş kullanımlar sayılır)
  if v_target_user_id is not null then
    if v_coupon.max_uses_per_student is not null then
      select count(*) into v_student_uses
      from public.discount_coupon_redemptions r
      left join public.payment_transactions pt on pt.id = r.payment_transaction_id
      where r.coupon_id = v_coupon.id
        and r.student_user_id = v_target_user_id
        and (r.package_purchase_id is not null or pt.status = 'paid');

      if v_student_uses >= v_coupon.max_uses_per_student then
        return jsonb_build_object('valid', false, 'error_code', 'STUDENT_LIMIT_REACHED', 'message', 'Bu kuponu daha önce kullandınız.');
      end if;
    end if;

    if v_coupon.first_purchase_only then
      select exists (
        select 1 from public.student_package_purchases
        where student_user_id = v_target_user_id and payment_status = 'paid'
      ) into v_has_previous_purchase;

      if v_has_previous_purchase then
        return jsonb_build_object('valid', false, 'error_code', 'FIRST_PURCHASE_ONLY', 'message', 'Bu kupon yalnızca ilk paket alımında geçerlidir.');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'name', v_coupon.name,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'maximum_discount_amount', v_coupon.maximum_discount_amount,
    'minimum_order_amount', v_coupon.minimum_order_amount,
    'eligible_package_ids', to_jsonb(v_eligible),
    'currency', coalesce(v_currency, 'TRY')
  );
end;
$function$;

revoke all on function public.quote_checkout_coupon(text, text[], uuid) from public;
grant execute on function public.quote_checkout_coupon(text, text[], uuid) to anon, authenticated, service_role;
