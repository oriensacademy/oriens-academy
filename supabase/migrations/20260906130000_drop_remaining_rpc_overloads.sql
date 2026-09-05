-- Migration: 20260906130000_drop_remaining_rpc_overloads.sql
--
-- Aynı sınıftan kalan tüm belirsizlikleri temizler. admin_record_completed_lesson
-- ve enqueue_email_notification üretimde patladıktan sonra public şemadaki bütün
-- fonksiyonlar tarandı (admin_list_duplicate_functions) ve dört tane daha çift
-- imzalı fonksiyon bulundu. Her biri, çağrıldığı anda aynı hatayı üretmeye hazır:
--
--   Could not choose the best candidate function between ...
--
-- Her fonksiyon için, uygulamanın GERÇEKTEN çağırdığı imza korunur; eski imza
-- tam parametre listesiyle düşürülür (isim ambiguous olduğu için `drop function
-- <ad>` çalışmaz, imza vermek zorunludur).

-- 1. admin_add_extra_lessons
--    Çağıran: src/lib/admin/student-learning.ts -> p_idempotency_key gönderiyor.
--    Korunan: 7 parametreli sürüm.
drop function if exists public.admin_add_extra_lessons(uuid, integer, numeric, text, text, text);

-- 2. admin_adjust_package_lessons
--    Çağıran: src/lib/admin/student-learning.ts -> p_idempotency_key gönderiyor.
--    Korunan: 5 parametreli sürüm.
drop function if exists public.admin_adjust_package_lessons(uuid, integer, text, text);

-- 3. admin_adjust_package_lesson_rights
--    Uygulamada çağıranı yok. Korunan: 20260906120000 ile gelen 3 parametreli
--    sürüm (negatif hak ve refund/expired paket koruması içerir).
drop function if exists public.admin_adjust_package_lesson_rights(uuid, integer, text, text);

-- 4. admin_create_booking
--    Çağıran: src/lib/admin/bookings.ts -> p_live_meeting_url gönderiyor.
--    Korunan: 10 parametreli sürüm.
drop function if exists public.admin_create_booking(text, text, text, text, timestamptz, timestamptz, boolean, text, text);

-- NOT: admin_update_student_profile bilerek DOKUNULMADI. Orada iki imza da
-- canlı olarak kullanılıyor ve parametre ADLARI farklı (5 alanlı hızlı kimlik
-- düzenlemesi ile 9 alanlı tam profil güncellemesi), bu yüzden PostgREST adlı
-- parametrelerle doğru olanı seçebiliyor ve belirsizlik hatası üretmiyor.
-- Yine de iki imzayı tek bir kanonik fonksiyonda birleştirmek ileride yapılacak
-- bir temizlik olarak raporlanıyor.
