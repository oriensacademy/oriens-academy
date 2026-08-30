-- Copy-only revision. Prices, discounts, package IDs and payment economics are untouched.
update public.pricing_packages
set
  description_tr = 'Düzenli çalışmaya başlamak ve kısa vadeli konu hedeflerini takip etmek için esnek paket.',
  description_en = 'A flexible package for starting structured study and tracking short-term topic goals.'
where id = 'package5' and lesson_count = 5;

update public.pricing_packages
set
  description_tr = 'Sınav hazırlığını, konu takibini ve düzenli ilerleme değerlendirmesini birlikte yürüten dengeli paket.',
  description_en = 'A balanced package combining exam preparation, topic tracking and regular progress review.'
where id = 'package10' and lesson_count = 10;
