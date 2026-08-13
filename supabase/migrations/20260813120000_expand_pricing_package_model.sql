alter table public.pricing_packages
  add column if not exists name_tr text,
  add column if not exists name_en text,
  add column if not exists description_tr text,
  add column if not exists description_en text,
  add column if not exists lesson_count integer check (lesson_count is null or lesson_count > 0),
  add column if not exists discount_percentage numeric check (discount_percentage is null or discount_percentage between 0 and 100),
  add column if not exists unit_price numeric check (unit_price is null or unit_price >= 0),
  add column if not exists old_total numeric check (old_total is null or old_total >= 0),
  add column if not exists current_total numeric check (current_total is null or current_total >= 0),
  add column if not exists badge_tr text,
  add column if not exists badge_en text;

insert into public.pricing_packages (
  id, price_amount, currency, billing_basis, active, featured, display_order,
  name_tr, name_en, description_tr, description_en, lesson_count,
  discount_percentage, unit_price, old_total, current_total, badge_tr, badge_en
) values
  ('single', 3200, 'TRY', 'session', true, false, 1, '1 Ders Ücreti', '1 Lesson', 'Esnek ve ihtiyaca yönelik', 'Flexible, as-needed', 1, null, 3200, null, 3200, null, null),
  ('package5', 15000, 'TRY', 'custom', true, false, 2, '5 Derslik Paket', '5-Lesson Package', 'Düzenli akademik destek', 'Regular academic support', 5, 7, 3000, 16000, 15000, null, null),
  ('package10', 27000, 'TRY', 'custom', true, true, 3, '10 Derslik Paket', '10-Lesson Package', 'Düzenli akademik destek', 'Regular academic support', 10, 15, 2700, 32000, 27000, 'En Çok Tercih Edilen', 'Most Popular'),
  ('package20', 51000, 'TRY', 'custom', true, false, 4, '20 Derslik Paket', '20-Lesson Package', 'Başarıya giden en popüler yol', 'The most popular route to results', 20, 20, 2550, 64000, 51000, null, null),
  ('package30', 72000, 'TRY', 'custom', true, true, 5, '30 Derslik Paket', '30-Lesson Package', 'Uzun vadeli maksimum avantaj', 'Maximum long-term value', 30, 25, 2400, 96000, 72000, 'En Avantajlı Paket', 'Best Value')
on conflict (id) do update set
  price_amount = excluded.price_amount,
  currency = excluded.currency,
  billing_basis = excluded.billing_basis,
  active = excluded.active,
  featured = excluded.featured,
  display_order = excluded.display_order,
  name_tr = coalesce(public.pricing_packages.name_tr, excluded.name_tr),
  name_en = coalesce(public.pricing_packages.name_en, excluded.name_en),
  description_tr = coalesce(public.pricing_packages.description_tr, excluded.description_tr),
  description_en = coalesce(public.pricing_packages.description_en, excluded.description_en),
  lesson_count = coalesce(public.pricing_packages.lesson_count, excluded.lesson_count),
  discount_percentage = coalesce(public.pricing_packages.discount_percentage, excluded.discount_percentage),
  unit_price = coalesce(public.pricing_packages.unit_price, excluded.unit_price),
  old_total = coalesce(public.pricing_packages.old_total, excluded.old_total),
  current_total = coalesce(public.pricing_packages.current_total, excluded.current_total),
  badge_tr = coalesce(public.pricing_packages.badge_tr, excluded.badge_tr),
  badge_en = coalesce(public.pricing_packages.badge_en, excluded.badge_en);

update public.pricing_packages
set active = false, updated_at = now()
where id in ('foundation', 'method', 'immersive');

