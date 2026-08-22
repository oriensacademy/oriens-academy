// Local QA Seed SQL generator and runner for Discount Coupons and QA Data
export const localCouponSeedSql = `
-- QA Pricing Packages Ensure Purchasable
update public.pricing_packages
set purchase_mode = 'purchasable', active = true
where id in ('single', 'package5', 'package10', 'package20', 'package30');

-- Ensure Bank Transfer Details in site_settings
insert into public.site_settings (key, value, is_public)
values
  ('payment.bank_account_holder', '{"value": "Oriens Academy Eğitim Danışmanlık A.Ş."}'::jsonb, true),
  ('payment.bank_name', '{"value": "Garanti BBVA - Levent Şubesi"}'::jsonb, true),
  ('payment.iban', '{"value": "TR12 0006 2000 0001 2345 6789 01"}'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = true;

-- Clean existing QA coupons
delete from public.discount_coupons
where code in (
  'YUZDE20', 'INDIRIM500', 'GECMIS2025', 'PASIFKUPON',
  'SADECE10DERS', 'LIMITDOLDU', 'ILKALIM30', 'MIN5000', 'TEKKULLANIM'
);

-- 1. Valid percentage coupon (20% off all packages)
insert into public.discount_coupons (
  code, name, discount_type, discount_value, currency, active,
  max_total_uses, max_uses_per_student, valid_from, valid_until
) values (
  'YUZDE20', 'Genel %20 İndirim Kampanyası', 'percentage', 20, 'TRY', true,
  500, 5, now() - interval '1 day', now() + interval '90 days'
);

-- 2. Valid fixed coupon (500 TL off)
insert into public.discount_coupons (
  code, name, discount_type, discount_value, currency, active,
  max_total_uses, max_uses_per_student, valid_from, valid_until
) values (
  'INDIRIM500', '500 TL Sabit İndirim Kuponu', 'fixed', 500, 'TRY', true,
  200, 2, now() - interval '1 day', now() + interval '60 days'
);

-- 3. Expired coupon
insert into public.discount_coupons (
  code, name, discount_type, discount_value, currency, active,
  valid_from, valid_until
) values (
  'GECMIS2025', 'Süresi Dolmuş Eski Kampanya', 'percentage', 30, 'TRY', true,
  now() - interval '120 days', now() - interval '10 days'
);

-- 4. Inactive coupon
insert into public.discount_coupons (
  code, name, discount_type, discount_value, currency, active
) values (
  'PASIFKUPON', 'Geçici Olarak Durdurulan Kupon', 'percentage', 25, 'TRY', false
);

-- 5. Package-targeted coupon (Only for package10)
with ins as (
  insert into public.discount_coupons (
    code, name, discount_type, discount_value, currency, active
  ) values (
    'SADECE10DERS', '10 Derslik Pakete Özel %25 İndirim', 'percentage', 25, 'TRY', true
  ) returning id
)
insert into public.discount_coupon_packages (coupon_id, package_id)
select ins.id, 'package10' from ins;

-- 6. Usage limit reached coupon (max 1, used 1)
insert into public.discount_coupons (
  code, name, discount_type, discount_value, currency, active,
  max_total_uses, used_count
) values (
  'LIMITDOLDU', 'Kullanım Limiti Tükenen Kupon', 'percentage', 50, 'TRY', true,
  1, 1
);

-- 7. First purchase only coupon
insert into public.discount_coupons (
  code, name, discount_type, discount_value, currency, active,
  first_purchase_only
) values (
  'ILKALIM30', 'İlk Paket Alımına Özel %30 İndirim', 'percentage', 30, 'TRY', true,
  true
);

-- 8. Minimum spend coupon (Min 5,000 TRY)
insert into public.discount_coupons (
  code, name, discount_type, discount_value, currency, active,
  minimum_order_amount
) values (
  'MIN5000', '5000 TL Üzeri Alışverişlerde 750 TL İndirim', 'fixed', 750, 'TRY', true,
  5000
);

-- 9. Per-student limit coupon (Max 1 per student)
insert into public.discount_coupons (
  code, name, discount_type, discount_value, currency, active,
  max_uses_per_student
) values (
  'TEKKULLANIM', 'Öğrenci Başına 1 Kez Kullanılabilir Kupon', 'percentage', 10, 'TRY', true,
  1
);
`;
