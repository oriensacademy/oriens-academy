-- Phase 2: least-privilege table grants and owner-approved public testimonials.
-- RLS remains the row-level authority: public reads only active content;
-- authenticated writes still require the existing is_admin() policies.

revoke all on table public.pricing_packages from anon, authenticated;
grant select on table public.pricing_packages to anon;
grant select, insert, update, delete on table public.pricing_packages to authenticated;

revoke all on table public.testimonials from anon, authenticated;
grant select on table public.testimonials to anon;
grant select, insert, update, delete on table public.testimonials to authenticated;

insert into public.testimonials
  (id, locale, quote, name, context, exam_code, active, verified, featured, display_order)
values
  ('20100000-0000-4000-8000-000000000001', 'tr', 'Oğlumun IB Fizik notu belirgin şekilde yükseldi, derse artık severek katılıyor.', 'Ahu G.', 'Veli · IB Fizik', 'IB', true, true, true, 1),
  ('20100000-0000-4000-8000-000000000002', 'tr', 'Oğlumun IB HL Matematik ve Fizik''te motivasyonu ve özgüveni belirgin biçimde arttı.', 'Yasemin T.', 'Veli · IB HL Matematik & Fizik', 'IB', true, true, true, 2),
  ('20100000-0000-4000-8000-000000000003', 'tr', 'Karmaşık konuları basit anlatımıyla öğretti; tüm matematik ve fizik sınavlarımı yüksek notla geçtim.', 'Ahmet S.', 'Öğrenci · Üniversite Fizik', null, true, true, false, 3),
  ('20100000-0000-4000-8000-000000000004', 'tr', 'Kısa sürede belirgin bir başarı sağladı, oldukça yetkin bir eğitimci.', 'Ece A.', 'Öğrenci · AYT Sınav Hazırlık', 'AYT', true, true, false, 4),
  ('20100000-0000-4000-8000-000000000005', 'en', 'My son''s IB Physics grade improved noticeably, and he now enjoys the subject.', 'Ahu G.', 'Parent · IB Physics', 'IB', true, true, true, 1),
  ('20100000-0000-4000-8000-000000000006', 'en', 'My son''s motivation and confidence in IB HL Maths and Physics grew noticeably.', 'Yasemin T.', 'Parent · IB HL Maths & Physics', 'IB', true, true, true, 2),
  ('20100000-0000-4000-8000-000000000007', 'en', 'He teaches hard subjects in simple ways — I passed all my maths and physics exams with high grades.', 'Ahmet S.', 'Student · University Physics', null, true, true, false, 3),
  ('20100000-0000-4000-8000-000000000008', 'en', 'Delivered noticeable progress in a short time — a highly capable tutor.', 'Ece A.', 'Student · AYT Exam Prep', 'AYT', true, true, false, 4)
on conflict (id) do update set
  locale = excluded.locale,
  quote = excluded.quote,
  name = excluded.name,
  context = excluded.context,
  exam_code = excluded.exam_code,
  active = excluded.active,
  verified = excluded.verified,
  featured = excluded.featured,
  display_order = excluded.display_order;
