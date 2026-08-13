update public.pricing_packages
set
  name_tr = '1 Ders',
  name_en = 'Single Lesson',
  description_tr = 'Esnek ve ihtiyaca yönelik',
  description_en = 'Flexible support based on your needs',
  lesson_count = 1,
  discount_percentage = null,
  unit_price = 3200,
  old_total = null,
  current_total = 3200,
  price_amount = 3200,
  currency = 'TRY',
  featured = false,
  display_order = 1,
  active = true
where id = 'single';

update public.pricing_packages
set
  name_tr = '5 Derslik Paket',
  name_en = '5-Lesson Package',
  description_tr = 'Düzenli akademik destek',
  description_en = 'Consistent academic support',
  lesson_count = 5,
  discount_percentage = 7,
  unit_price = 3000,
  old_total = 16000,
  current_total = 15000,
  price_amount = 15000,
  currency = 'TRY',
  featured = false,
  display_order = 2,
  active = true
where id = 'package5';

update public.pricing_packages
set
  name_tr = '10 Derslik Paket',
  name_en = '10-Lesson Package',
  description_tr = 'Düzenli akademik destek',
  description_en = 'Consistent academic support',
  lesson_count = 10,
  discount_percentage = 15,
  unit_price = 2700,
  old_total = 32000,
  current_total = 27000,
  price_amount = 27000,
  currency = 'TRY',
  badge_tr = 'En Çok Tercih Edilen',
  badge_en = 'Most Popular',
  featured = true,
  display_order = 3,
  active = true
where id = 'package10';

update public.pricing_packages
set
  name_tr = '20 Derslik Paket',
  name_en = '20-Lesson Package',
  description_tr = 'Başarıya giden en popüler yol',
  description_en = 'A structured path for ongoing progress',
  lesson_count = 20,
  discount_percentage = 20,
  unit_price = 2550,
  old_total = 64000,
  current_total = 51000,
  price_amount = 51000,
  currency = 'TRY',
  featured = false,
  display_order = 4,
  active = true
where id = 'package20';

update public.pricing_packages
set
  name_tr = '30 Derslik Paket',
  name_en = '30-Lesson Package',
  description_tr = 'Uzun vadeli maksimum avantaj',
  description_en = 'Maximum long-term value',
  lesson_count = 30,
  discount_percentage = 25,
  unit_price = 2400,
  old_total = 96000,
  current_total = 72000,
  price_amount = 72000,
  currency = 'TRY',
  badge_tr = 'En Avantajlı Paket',
  badge_en = 'Best Value',
  featured = false,
  display_order = 5,
  active = true
where id = 'package30';

update public.pricing_packages
set active = false, updated_at = now()
where id in ('foundation', 'method', 'immersive');
